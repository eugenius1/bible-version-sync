/**
 * Sign in with YouVersion: OAuth authorization code + PKCE for a public client
 * (no secret). https://developers.youversion.com/sign-in-apis
 *
 *   1. Send the browser to authorizeUrl() (asks for the "highlights" permission).
 *   2. YouVersion redirects back to redirect_uri with only ?state=...
 *   3. Validate state, then send the browser to callbackReplayUrl(state).
 *   4. That redirects back with ?code=...&state=...; exchangeCode() for tokens.
 */

import { API_BASE, ApiError, errorMessage, parseBody, tokenFrom, type TokenSet } from "./api";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function authorizeUrl(p: {
  appKey: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  base?: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: p.appKey,
    redirect_uri: p.redirectUri,
    scope: "openid profile",
    nonce: p.nonce,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
  });
  q.append("requested_permissions[]", "highlights");
  return `${p.base ?? API_BASE}/auth/authorize?${q}`;
}

/** Second hop of the flow: YouVersion's first callback carries only `state`. */
export function callbackReplayUrl(state: string, base = API_BASE): string {
  return `${base}/auth/callback?${new URLSearchParams({ state })}`;
}

export async function exchangeCode(p: {
  appKey: string;
  code: string;
  redirectUri: string;
  verifier: string;
  base?: string;
  fetch?: typeof fetch;
}): Promise<TokenSet> {
  const f = p.fetch ?? globalThis.fetch.bind(globalThis);
  const res = await f(`${p.base ?? API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: p.code,
      redirect_uri: p.redirectUri,
      client_id: p.appKey,
      code_verifier: p.verifier,
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, errorMessage(text), "/auth/token");
  return { ...tokenFrom(parseBody(res.status, text, "/auth/token"), "/auth/token"), obtained_at: Date.now() };
}

export type CallbackStep =
  | { kind: "replay"; url: string; grantedPermissions: string[] | null }
  | { kind: "code"; code: string; grantedPermissions: string[] | null }
  | { kind: "error"; code: "state-mismatch" | "provider"; message: string };

/**
 * Decide what to do with a callback URL's query string.
 * `expectedState` is the state saved before redirecting to authorizeUrl().
 */
export function interpretCallback(search: string, expectedState: string | null, base = API_BASE): CallbackStep {
  const q = new URLSearchParams(search);
  const state = q.get("state");
  if (!state || !expectedState || state !== expectedState) {
    return { kind: "error", code: "state-mismatch", message: "Sign-in state didn't match. Please start sign-in again." };
  }
  const granted = q.has("granted_permissions")
    ? (q.get("granted_permissions") ?? "").split(",").filter(Boolean)
    : null;
  const error = q.get("error");
  if (error) return { kind: "error", code: "provider", message: [error, q.get("error_description")].filter(Boolean).join(": ") };
  const code = q.get("code");
  if (!code) return { kind: "replay", url: callbackReplayUrl(state, base), grantedPermissions: granted };
  return { kind: "code", code, grantedPermissions: granted };
}
