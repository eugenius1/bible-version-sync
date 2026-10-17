import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  createPkce,
  errorMessage,
  exchangeCode,
  fromYouVersionId,
  interpretCallback,
  toYouVersionId,
  YouVersionClient,
  type TokenSet,
  type TokenStore,
} from "../src";

class MemoryTokens implements TokenStore {
  constructor(public t: TokenSet | null) {}
  async get() {
    return this.t;
  }
  async set(t: TokenSet) {
    this.t = t;
  }
}

type Call = { url: string; init: RequestInit };

type Fake = { status: number; body?: unknown; text?: string; headers?: Record<string, string> } | "cors-blocked";

function fakeFetch(responses: Fake[]) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    // What a browser reports for a response without CORS headers.
    if (r === "cors-blocked") throw new TypeError("Failed to fetch");
    const body = r.text ?? (r.body === undefined ? null : JSON.stringify(r.body));
    return new Response(body, { status: r.status, headers: r.headers });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const fresh = (): TokenSet => ({ access_token: "a1", refresh_token: "r1", expires_in: 3599, obtained_at: Date.now() });

describe("errorMessage", () => {
  it("understands all three error shapes", () => {
    expect(errorMessage('{"message":"nope"}')).toBe("nope");
    expect(errorMessage('{"error":"invalid_request","error_description":"Missing token"}')).toBe("invalid_request: Missing token");
    expect(errorMessage('{"fault":{"faultstring":"Invalid ApiKey"}}')).toBe("Invalid ApiKey");
    expect(errorMessage("plain text")).toBe("plain text");
  });
});

describe("YouVersionClient", () => {
  it("sends the app key and bearer token, and treats 204 as no highlights", async () => {
    const { f, calls } = fakeFetch([{ status: 204 }]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    expect(await c.getHighlights(111, "JHN.3")).toEqual([]);
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["X-YVP-App-Key"]).toBe("k");
    expect(h.Authorization).toBe("Bearer a1");
    expect(calls[0].url).toContain("bible_id=111&passage_id=JHN.3");
  });

  it("retries after a 429", async () => {
    const { f, calls } = fakeFetch([
      { status: 429, body: { message: "slow down" } },
      { status: 200, body: { data: [{ bible_id: 111, passage_id: "JHN.3.16", color: "ffe066" }] } },
    ]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    const t0 = Date.now();
    expect(await c.getHighlights(111, "JHN.3")).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900); // backed off ~1s
  });

  it("refreshes the token once on a 401 and retries", async () => {
    const tokens = new MemoryTokens(fresh());
    const { f, calls } = fakeFetch([
      { status: 401, body: { error: "invalid_token" } },
      { status: 200, body: { access_token: "a2", expires_in: 3599 } },
      { status: 204 },
    ]);
    const c = new YouVersionClient({ appKey: "k", tokens, fetch: f, delayMs: 0 });
    await c.getHighlights(111, "JHN.3");
    expect(calls[1].url).toContain("/auth/token");
    expect(String(calls[1].init.body)).toContain("grant_type=refresh_token");
    expect(tokens.t?.access_token).toBe("a2");
    expect(tokens.t?.refresh_token).toBe("r1"); // kept when the response omits it
    expect((calls[2].init.headers as Record<string, string>).Authorization).toBe("Bearer a2");
  });

  it("treats a CORS-hidden 401 as an expired token: refreshes and retries", async () => {
    const tokens = new MemoryTokens(fresh());
    const { f, calls } = fakeFetch([
      "cors-blocked",
      { status: 200, body: { access_token: "a2", expires_in: 3599 } },
      { status: 204 },
    ]);
    const c = new YouVersionClient({ appKey: "k", tokens, fetch: f, delayMs: 0 });
    await c.getHighlights(111, "JHN.3");
    expect(calls.map((x) => new URL(x.url).pathname)).toEqual(["/v1/highlights", "/auth/token", "/v1/highlights"]);
    expect(tokens.t?.access_token).toBe("a2");
  });

  it("reports sign-in expired when the refresh is rejected", async () => {
    const { f } = fakeFetch(["cors-blocked", { status: 400, body: { error: "invalid_grant" } }]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    await expect(c.getHighlights(111, "JHN.3")).rejects.toMatchObject({ status: 401, detail: "sign-in expired" });
  });

  it("gives up quickly when YouVersion can't be reached", async () => {
    const noRefresh: TokenSet = { access_token: "a1", obtained_at: Date.now() };
    const { f, calls } = fakeFetch(["cors-blocked", "cors-blocked", "cors-blocked", "cors-blocked"]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(noRefresh), fetch: f, delayMs: 0 });
    await expect(c.getHighlights(111, "JHN.3")).rejects.toMatchObject({ status: 0 });
    expect(calls).toHaveLength(3);
  });

  it("does not retry client errors", async () => {
    const { f, calls } = fakeFetch([{ status: 400, body: { message: "single-chapter requests only" } }]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    await expect(c.getHighlights(111, "JHN.3.16")).rejects.toMatchObject({ status: 400, retryable: false });
    expect(calls).toHaveLength(1);
  });

  it("retries a read whose body isn't JSON, and fails just that request if it persists", async () => {
    const portal = { status: 200, text: "<html>Sign in to the Wi-Fi</html>" };
    const { f, calls } = fakeFetch([portal, { status: 200, body: { data: [{ bible_id: 111, passage_id: "JHN.3.16", color: "ffe066" }] } }]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    expect(await c.getHighlights(111, "JHN.3")).toHaveLength(1);
    expect(calls).toHaveLength(2);

    const { f: f2 } = fakeFetch([portal]);
    const once = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f2, delayMs: 0, maxRetries: 0 });
    // An ApiError, so the runner fails this book and goes on, rather than a
    // SyntaxError that would end the run.
    await expect(once.getHighlights(111, "JHN.3")).rejects.toMatchObject({ status: 502, retryable: true });
  });

  it("counts a write as done whatever its body", async () => {
    // Reporting it failed would mark a verse that was written as unwritable.
    const { f, calls } = fakeFetch([{ status: 200, text: "OK" }, { status: 200, text: "<html>" }]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    await c.setHighlight(111, "JHN.3.16", "ffe066");
    await c.deleteHighlight(111, "JHN.3.16");
    expect(calls).toHaveLength(2);
  });

  it("keeps the saved sign-in when a refresh returns no token", async () => {
    const tokens = new MemoryTokens(fresh());
    const { f } = fakeFetch([{ status: 401, body: { error: "invalid_token" } }, { status: 200, body: { token_type: "Bearer" } }]);
    const c = new YouVersionClient({ appKey: "k", tokens, fetch: f, delayMs: 0 });
    await expect(c.getHighlights(111, "JHN.3")).rejects.toMatchObject({ status: 502 });
    expect(tokens.t?.access_token).toBe("a1");
  });
});

describe("chapters YouVersion ids BOOK.<n>_1", () => {
  // NR2006 (4833) ids its Job and Psalms JOB.1_1…, PSA.1_1…; GNA2025 (67)
  // its Psalms and Philemon; TUKARA84 (3404) its Matthew; BFC (63) only
  // Psalms 10 to 147, DHH94I (52) only Psalms 42 and 43 (#25).
  it("are translated to and from plain ids in the suffixed chapters only", () => {
    expect(toYouVersionId(4833, "PSA.1")).toBe("PSA.1_1");
    expect(toYouVersionId(4833, "PSA.119.176")).toBe("PSA.119_1.176");
    expect(toYouVersionId(4833, "JOB.38.1")).toBe("JOB.38_1.1");
    expect(toYouVersionId(4833, "PSA.1.1+PSA.1.2")).toBe("PSA.1_1.1+PSA.1_1.2");
    expect(toYouVersionId(4833, "JHN.3")).toBe("JHN.3");
    expect(toYouVersionId(67, "PHM.1.5")).toBe("PHM.1_1.5");
    expect(toYouVersionId(3404, "MAT.28.20")).toBe("MAT.28_1.20");
    expect(toYouVersionId(111, "PSA.1.5")).toBe("PSA.1.5");
    expect(["PSA.9.1", "PSA.10.1", "PSA.147.20", "PSA.148.1"].map((p) => toYouVersionId(63, p)))
      .toEqual(["PSA.9.1", "PSA.10_1.1", "PSA.147_1.20", "PSA.148.1"]);
    expect(["PSA.41", "PSA.42", "PSA.43.5", "PSA.44"].map((p) => toYouVersionId(52, p)))
      .toEqual(["PSA.41", "PSA.42_1", "PSA.43_1.5", "PSA.44"]);

    expect(fromYouVersionId(4833, "PSA.1_1.5")).toBe("PSA.1.5");
    expect(fromYouVersionId(4833, "PSA.1_1.1+PSA.1_1.2")).toBe("PSA.1.1+PSA.1.2");
    expect(fromYouVersionId(4833, "JHN.3.16")).toBe("JHN.3.16");
    // Never seen; left as it is, so the engine drops it as unparseable
    // rather than taking it for another verse.
    expect(fromYouVersionId(4833, "PSA.1_2.5")).toBe("PSA.1_2.5");
    expect(fromYouVersionId(3404, "PSA.1_1.5")).toBe("PSA.1_1.5");
    expect(fromYouVersionId(63, "PSA.9_1.1")).toBe("PSA.9_1.1");
    expect(fromYouVersionId(63, "PSA.23_1.1")).toBe("PSA.23.1");
  });

  it("are what the client reads, writes and deletes, while callers see plain ids", async () => {
    const { f, calls } = fakeFetch([
      { status: 200, body: { data: [{ bible_id: 4833, passage_id: "PSA.1_1.5", color: "ffe066" }] } },
      { status: 201, body: {} },
      { status: 204 },
      { status: 204 },
    ]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    expect(await c.getHighlights(4833, "PSA.1")).toEqual([{ bible_id: 4833, passage_id: "PSA.1.5", color: "ffe066" }]);
    await c.setHighlight(4833, "PSA.1.2", "a3d9ff");
    await c.deleteHighlight(4833, "PSA.1.2");
    await c.getHighlights(4833, "JHN.3");
    expect(new URL(calls[0].url).searchParams.get("passage_id")).toBe("PSA.1_1");
    expect(JSON.parse(String(calls[1].init.body)).highlight.passage_id).toBe("PSA.1_1.2");
    expect(new URL(calls[2].url).pathname).toBe("/v1/highlights/PSA.1_1.2");
    expect(new URL(calls[3].url).searchParams.get("passage_id")).toBe("JHN.3");
  });

  it("passes on a highlight without a passage id, and a body without data, for the engine to judge", async () => {
    const odd = { bible_id: 4833, color: "ffe066" };
    const { f } = fakeFetch([{ status: 200, body: { data: [odd] } }, { status: 200, body: {} }]);
    const c = new YouVersionClient({ appKey: "k", tokens: new MemoryTokens(fresh()), fetch: f, delayMs: 0 });
    expect(await c.getHighlights(4833, "PSA.1")).toEqual([odd]);
    expect(await c.getHighlights(4833, "PSA.1")).toEqual([]);
  });
});

describe("sign-in helpers", () => {
  it("rejects a code exchange that returns no token", async () => {
    const exchange = (res: Fake) =>
      exchangeCode({ appKey: "k", code: "c", redirectUri: "http://localhost/callback", verifier: "v", fetch: fakeFetch([res]).f });
    await expect(exchange({ status: 200, body: { access_token: "a1" } })).resolves.toMatchObject({ access_token: "a1" });
    await expect(exchange({ status: 200, body: {} })).rejects.toMatchObject({ status: 502 });
    await expect(exchange({ status: 200, text: "<html>" })).rejects.toMatchObject({ status: 502 });
  });

  it("builds an authorize URL asking for the highlights permission", async () => {
    const { verifier, challenge } = await createPkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const u = new URL(authorizeUrl({ appKey: "k", redirectUri: "http://localhost:5173/callback", state: "s", nonce: "n", codeChallenge: challenge }));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("requested_permissions[]")).toBe("highlights");
    expect(u.searchParams.get("scope")).toBe("openid profile");
  });

  it("walks the two-hop callback", () => {
    expect(interpretCallback("?state=s&granted_permissions=highlights", "s")).toMatchObject({
      kind: "replay",
      url: "https://api.youversion.com/auth/callback?state=s",
      grantedPermissions: ["highlights"],
    });
    expect(interpretCallback("?state=s&code=c1", "s")).toMatchObject({ kind: "code", code: "c1" });
    expect(interpretCallback("?state=evil&code=c1", "s").kind).toBe("error");
    expect(interpretCallback("?state=s&error=access_denied", "s")).toMatchObject({ kind: "error" });
  });
});
