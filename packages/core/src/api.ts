/** Minimal client for the YouVersion Platform API (https://developers.youversion.com/api). */

import { suffixedChapters } from "./versification";

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

  /** Sign-in expired, YouVersion unreachable or rate limited: every other request would fail the same way. */
  get stopsRun(): boolean {
    return this.status === 401 || this.status === 0 || this.status === 429;
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
  /**
   * A read can be stopped: aborting the signal rejects with its reason (not
   * an ApiError), at once, even mid-request or while backing off.
   */
  getHighlights(bibleId: number, passageId: string, opts?: { signal?: AbortSignal }): Promise<Highlight[]>;
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

/** The chapters a version ids BOOK.<n>_1, by book (see suffixedChapters). */
export type SuffixedChapters = Readonly<Record<string, readonly number[]>>;

/**
 * A passage id as YouVersion ids it in this version. A few versions id some
 * chapters BOOK.<n>_1 (NR2006's Psalms are PSA.1_1, its verses PSA.1_1.5),
 * and their highlights are stored under those ids: reading PSA.1 there gives
 * an empty list, not an error, and writing PSA.1.2 is a 502 (#25). The rest
 * of the app speaks plain BOOK.<n>; the client translates. Which chapters are
 * suffixed is bundled for scanned versions; for others it comes from the API
 * index, passed as `suffixed`.
 */
export function toYouVersionId(
  bibleId: number,
  passageId: string,
  suffixed: SuffixedChapters = suffixedChapters(bibleId),
): string {
  return passageId.replace(/(^|\+)([0-9A-Z]{3})\.(\d+)(?=[.+]|$)/g, (m, start, book, ch) =>
    suffixed[book]?.includes(Number(ch)) ? `${start}${book}.${ch}_1` : m,
  );
}

/** The reverse of toYouVersionId: "PSA.1_1.5" -> "PSA.1.5" where that chapter is suffixed. */
export function fromYouVersionId(
  bibleId: number,
  passageId: string,
  suffixed: SuffixedChapters = suffixedChapters(bibleId),
): string {
  return passageId.replace(/(^|\+)([0-9A-Z]{3})\.(\d+)_1(?=[.+]|$)/g, (m, start, book, ch) =>
    suffixed[book]?.includes(Number(ch)) ? `${start}${book}.${ch}` : m,
  );
}

/**
 * The longest Retry-After worth waiting out inside a request. YouVersion's
 * rate limit asks for 300 s; sitting silently through that, five retries
 * over, looks like a hang, so the error goes to the caller to explain.
 */
const MAX_RETRY_AFTER_S = 60;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const done = () => {
      signal?.removeEventListener("abort", stop);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", stop, { once: true });
  });

/**
 * Wait for shared work (a token refresh) but stop waiting when this caller's
 * signal fires, leaving the work itself to finish for everyone else.
 */
function untilAborted<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  work.catch(() => undefined); // its failure is reported to whoever still waits
  return new Promise<T>((resolve, reject) => {
    signal.throwIfAborted();
    const stop = () => reject(signal.reason);
    signal.addEventListener("abort", stop, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

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

/**
 * A successful response's JSON. A body that isn't JSON (a proxy's or captive
 * portal's page) is reported as a bad gateway, so it's retried and, if it
 * persists, fails the one request rather than the whole run.
 */
export function parseBody(status: number, text: string, path: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, `unreadable response (HTTP ${status})`, path);
  }
}

/** A token response, checked before it replaces the saved sign-in. */
export function tokenFrom(body: unknown, path: string): Omit<TokenSet, "obtained_at"> {
  const t = body as Partial<TokenSet> | null;
  if (!t || typeof t !== "object" || typeof t.access_token !== "string" || !t.access_token) {
    throw new ApiError(502, "no access token in the response", path);
  }
  return t as Omit<TokenSet, "obtained_at">;
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
  /** Suffixed chapters read from the API index, for versions that aren't bundled. */
  private suffixed = new Map<number, SuffixedChapters>();

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
    /** Writes don't need the body, so one that can't be parsed is no failure. */
    ignoreBody?: boolean;
    /** Only reads take one: a write cut off mid-request may or may not have landed. */
    signal?: AbortSignal;
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
      res = await this.fetchImpl(url, { method, headers, body, signal: init.signal });
    } catch (e) {
      // A stop isn't a network failure: it mustn't be retried or reported as one.
      init.signal?.throwIfAborted();
      throw new ApiError(0, e instanceof Error ? e.message : String(e), path);
    }
    const text = await res.text();
    if (!res.ok) {
      const err = new ApiError(res.status, errorMessage(text), path);
      const ra = Number(res.headers.get("Retry-After"));
      if (Number.isFinite(ra) && ra > 0) err.retryAfter = ra;
      throw err;
    }
    return { status: res.status, body: init.ignoreBody ? null : parseBody(res.status, text, path) };
  }

  private async request(method: string, path: string, init: Parameters<YouVersionClient["raw"]>[2] = {}) {
    if (init.auth && (await this.expiresSoon())) await untilAborted(this.refreshOrExpire(path, false), init.signal);
    let refreshed = false;
    let networkFailures = 0;
    for (let attempt = 0; ; attempt++) {
      const wait = this.pauseUntil - Date.now();
      if (wait > 0) await sleep(wait, init.signal);
      if (this.delayMs) await sleep(this.delayMs, init.signal);
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
            await untilAborted(this.refreshOrExpire(path, true), init.signal);
            continue;
          }
        }
        if (e.status === 401) throw new ApiError(401, "sign-in expired", path);
        if (e.status === 0 && ++networkFailures > 2) {
          throw new ApiError(0, init.auth ? "can't reach YouVersion, or the sign-in has expired" : e.detail, path);
        }
        if (e.status === 429 && (e.retryAfter ?? 0) > MAX_RETRY_AFTER_S) throw e;
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
      // The token endpoint answers a stale refresh token with a 400 that
      // the browser can read, so a refresh that can't get through at all
      // isn't about the sign-in: YouVersion is unreachable, or is rate
      // limiting this app key with a 429 that has no CORS header. Retrying
      // only extends the lock-out, so stop here.
      if (e instanceof ApiError && e.status === 0) throw new ApiError(0, e.detail, path);
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
        const next = tokenFrom(body, "/auth/token");
        await this.tokens!.set({ refresh_token: t.refresh_token, ...next, obtained_at: Date.now() });
      })().finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  /**
   * Use these suffixed chapters for a version, in place of the bundled ones:
   * a version map built from the API index knows them (VersionMap.suffixed),
   * the bundled data doesn't.
   */
  useSuffixedChapters(bibleId: number, suffixed: SuffixedChapters): void {
    this.suffixed.set(bibleId, suffixed);
  }

  private chapterIds(bibleId: number): SuffixedChapters {
    return this.suffixed.get(bibleId) ?? suffixedChapters(bibleId);
  }

  // -- endpoints -------------------------------------------------------------

  async getBible(bibleId: number): Promise<Record<string, unknown>> {
    return ((await this.request("GET", `/v1/bibles/${bibleId}`)).body ?? {}) as Record<string, unknown>;
  }

  async getIndex(bibleId: number): Promise<unknown> {
    return (await this.request("GET", `/v1/bibles/${bibleId}/index`)).body ?? {};
  }

  /** Highlights for one whole chapter (e.g. "JHN.3"); the API rejects single verses. */
  async getHighlights(bibleId: number, passageId: string, opts: { signal?: AbortSignal } = {}): Promise<Highlight[]> {
    const suffixed = this.chapterIds(bibleId);
    const { status, body } = await this.request("GET", "/v1/highlights", {
      auth: true,
      signal: opts.signal,
      params: { bible_id: bibleId, passage_id: toYouVersionId(bibleId, passageId, suffixed) },
    });
    if (status === 204 || !body) return [];
    const data = (body as { data?: Highlight[] }).data ?? [];
    return data.map((h) => (h?.passage_id ? { ...h, passage_id: fromYouVersionId(bibleId, h.passage_id, suffixed) } : h));
  }

  async setHighlight(bibleId: number, passageId: string, color: string): Promise<void> {
    const id = toYouVersionId(bibleId, passageId, this.chapterIds(bibleId));
    await this.request("POST", "/v1/highlights", {
      auth: true,
      ignoreBody: true,
      json: {
        request_id: crypto.randomUUID(),
        highlight: { bible_id: bibleId, passage_id: id, color },
      },
    });
  }

  async deleteHighlight(bibleId: number, passageId: string): Promise<void> {
    const id = toYouVersionId(bibleId, passageId, this.chapterIds(bibleId));
    await this.request("DELETE", `/v1/highlights/${encodeURIComponent(id)}`, {
      auth: true,
      ignoreBody: true,
      params: { bible_id: bibleId },
    });
  }
}
