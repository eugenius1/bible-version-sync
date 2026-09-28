/** Minimal client for the YouVersion Platform API (https://developers.youversion.com/api). */

export const API_BASE = "https://api.youversion.com";

export class ApiError extends Error {
  retryAfter?: number;
  /** The API's own message, without the status/path prefix. */
  readonly detail: string;

  constructor(
    readonly status: number,
    message: string,
    readonly path = "",
  ) {
    super(`HTTP ${status} on ${path}: ${message}`);
    this.name = "ApiError";
    this.detail = message;
  }

  /** Network failures (status 0), rate limiting and server errors are worth retrying. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number | string;
  id_token?: string;
  /** ms since epoch, set when saved */
  obtained_at: number;
}

export interface TokenStore {
  get(): Promise<TokenSet | null>;
  set(tokens: TokenSet): Promise<void>;
}

export interface Highlight {
  bible_id: number;
  passage_id: string;
  color: string;
}

/** The subset of the client the sync engine needs (lets tests use a fake). */
export interface HighlightsApi {
  getHighlights(bibleId: number, passageId: string): Promise<Highlight[]>;
  setHighlight(bibleId: number, passageId: string, color: string): Promise<void>;
  deleteHighlight(bibleId: number, passageId: string): Promise<void>;
}

export interface ClientOptions {
  appKey: string;
  tokens?: TokenStore;
  base?: string;
  /** Small pause before each request, to be gentle with the API. */
  delayMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * YouVersion returns errors in several shapes: {"message"} (per the spec),
 * {"error","error_description"} from the auth layer and
 * {"fault":{"faultstring"}} from the gateway.
 */
export function errorMessage(text: string): string {
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object") {
      if ("message" in body) return String(body.message);
      if ("error" in body) return [body.error, body.error_description].filter(Boolean).join(": ");
      if (body.fault?.faultstring) return String(body.fault.faultstring);
    }
  } catch {
    // not JSON
  }
  return text.slice(0, 300);
}

export class YouVersionClient implements HighlightsApi {
  readonly appKey: string;
  private readonly tokens?: TokenStore;
  private readonly base: string;
  private readonly delayMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private pauseUntil = 0; // shared back-off when the API rate-limits us
  private refreshing?: Promise<void>;

  constructor(opts: ClientOptions) {
    this.appKey = opts.appKey;
    this.tokens = opts.tokens;
    this.base = opts.base ?? API_BASE;
    this.delayMs = opts.delayMs ?? 50;
    this.maxRetries = opts.maxRetries ?? 5;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async raw(method: string, path: string, init: {
    params?: Record<string, string | number>;
    json?: unknown;
    form?: Record<string, string>;
    auth?: boolean;
  } = {}): Promise<{ status: number; body: unknown }> {
    let url = this.base + path;
    if (init.params) url += "?" + new URLSearchParams(Object.entries(init.params).map(([k, v]) => [k, String(v)]));
    const headers: Record<string, string> = { "X-YVP-App-Key": this.appKey, Accept: "application/json" };
    let body: string | undefined;
    if (init.json !== undefined) {
      body = JSON.stringify(init.json);
      headers["Content-Type"] = "application/json";
    } else if (init.form) {
      body = new URLSearchParams(init.form).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
    if (init.auth) {
      const t = await this.tokens?.get();
      if (!t?.access_token) throw new ApiError(401, "not signed in", path);
      headers.Authorization = `Bearer ${t.access_token}`;
    }
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method, headers, body });
    } catch (e) {
      throw new ApiError(0, e instanceof Error ? e.message : String(e), path);
    }
    const text = await res.text();
    if (!res.ok) {
      const err = new ApiError(res.status, errorMessage(text), path);
      const ra = Number(res.headers.get("Retry-After"));
      if (Number.isFinite(ra) && ra > 0) err.retryAfter = ra;
      throw err;
    }
    return { status: res.status, body: text.trim() ? JSON.parse(text) : null };
  }

  private async request(method: string, path: string, init: Parameters<YouVersionClient["raw"]>[2] = {}) {
    if (init.auth && (await this.expiresSoon())) await this.refreshOrExpire(path, false);
    let refreshed = false;
    let networkFailures = 0;
    for (let attempt = 0; ; attempt++) {
      const wait = this.pauseUntil - Date.now();
      if (wait > 0) await sleep(wait);
      if (this.delayMs) await sleep(this.delayMs);
      try {
        return await this.raw(method, path, init);
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        // In a browser an expired token looks like a network error: YouVersion's
        // 401 responses carry no CORS header, so the browser hides them.
        const maybeAuth = e.status === 401 || (e.status === 0 && init.auth);
        if (maybeAuth && init.auth && !refreshed) {
          refreshed = true;
          if ((await this.tokens?.get())?.refresh_token) {
            await this.refreshOrExpire(path, true);
            continue;
          }
        }
        if (e.status === 401) throw new ApiError(401, "sign-in expired", path);
        if (e.status === 0 && ++networkFailures > 2) {
          throw new ApiError(0, init.auth ? "can't reach YouVersion, or the sign-in has expired" : e.detail, path);
        }
        if (!e.retryable || attempt >= this.maxRetries) throw e;
        const backoff = Math.max(Math.min(60_000, 1000 * 2 ** attempt), (e.retryAfter ?? 0) * 1000);
        this.pauseUntil = Math.max(this.pauseUntil, Date.now() + backoff);
      }
    }
  }

  /** Refresh the token; a rejected refresh means the user must sign in again. */
  private async refreshOrExpire(path: string, force: boolean): Promise<void> {
    try {
      await this.refresh(force);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
        throw new ApiError(401, "sign-in expired", path);
      }
      throw e;
    }
  }

  private async expiresSoon(): Promise<boolean> {
    const t = await this.tokens?.get();
    if (!t?.refresh_token) return false;
    const lifetime = Number(t.expires_in ?? 3599) * 1000;
    return Date.now() > t.obtained_at + lifetime - 120_000;
  }

  /**
   * Standard OAuth refresh grant. Not spelled out in YouVersion's docs; if it
   * fails the user has to sign in again.
   */
  async refresh(force = false): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const t = await this.tokens?.get();
        if (!t?.refresh_token || (!force && !(await this.expiresSoon()))) return;
        const { body } = await this.raw("POST", "/auth/token", {
          form: { grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: this.appKey },
        });
        const next = body as Omit<TokenSet, "obtained_at">;
        await this.tokens!.set({ refresh_token: t.refresh_token, ...next, obtained_at: Date.now() });
      })().finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  // -- endpoints -------------------------------------------------------------

  async getBible(bibleId: number): Promise<Record<string, unknown>> {
    return ((await this.request("GET", `/v1/bibles/${bibleId}`)).body ?? {}) as Record<string, unknown>;
  }

  async getIndex(bibleId: number): Promise<unknown> {
    return (await this.request("GET", `/v1/bibles/${bibleId}/index`)).body ?? {};
  }

  /** Highlights for one whole chapter (e.g. "JHN.3"); the API rejects single verses. */
  async getHighlights(bibleId: number, passageId: string): Promise<Highlight[]> {
    const { status, body } = await this.request("GET", "/v1/highlights", {
      auth: true,
      params: { bible_id: bibleId, passage_id: passageId },
    });
    if (status === 204 || !body) return [];
    return ((body as { data?: Highlight[] }).data ?? []);
  }

  async setHighlight(bibleId: number, passageId: string, color: string): Promise<void> {
    await this.request("POST", "/v1/highlights", {
      auth: true,
      json: {
        request_id: crypto.randomUUID(),
        highlight: { bible_id: bibleId, passage_id: passageId, color },
      },
    });
  }

  async deleteHighlight(bibleId: number, passageId: string): Promise<void> {
    await this.request("DELETE", `/v1/highlights/${encodeURIComponent(passageId)}`, {
      auth: true,
      params: { bible_id: bibleId },
    });
  }
}
