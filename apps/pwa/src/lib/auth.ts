import { authorizeUrl, createPkce, exchangeCode, interpretCallback, randomToken, YouVersionClient } from "@bvs/core";
import { tokenStore } from "./db";

export const APP_KEY: string = import.meta.env.VITE_YV_APP_KEY ?? "";
export const redirectUri = () => `${location.origin}/callback`;
export const isCallback = () => location.pathname === "/callback";

// localStorage rather than sessionStorage so the pending sign-in survives the
// browser handing the redirect to a different tab or window.
const PENDING = "bvs.pendingSignIn";
const PENDING_TTL_MS = 15 * 60 * 1000;

export const client = new YouVersionClient({ appKey: APP_KEY, tokens: tokenStore });

export async function startSignIn(): Promise<void> {
  const { verifier, challenge } = await createPkce();
  const state = randomToken();
  localStorage.setItem(PENDING, JSON.stringify({ verifier, state, at: Date.now() }));
  location.assign(
    authorizeUrl({ appKey: APP_KEY, redirectUri: redirectUri(), state, nonce: randomToken(16), codeChallenge: challenge }),
  );
}

/**
 * Handle a load of /callback. Resolves to "redirecting" when the browser is
 * being sent on to the next hop, "done" once tokens are saved.
 */
export async function completeSignIn(): Promise<"redirecting" | "done"> {
  let pending: { verifier: string; state: string; at: number } | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING) ?? "null");
  } catch {
    pending = null;
  }
  if (pending && Date.now() - pending.at > PENDING_TTL_MS) pending = null;

  const step = interpretCallback(location.search, pending?.state ?? null);
  if (step.kind === "error") {
    localStorage.removeItem(PENDING);
    throw new Error(step.message);
  }
  if (step.grantedPermissions && !step.grantedPermissions.includes("highlights")) {
    localStorage.removeItem(PENDING);
    throw new Error("You signed in but didn't allow access to highlights, which this app needs. Please sign in again and allow it.");
  }
  if (step.kind === "replay") {
    location.replace(step.url);
    return "redirecting";
  }
  const tokens = await exchangeCode({ appKey: APP_KEY, code: step.code, redirectUri: redirectUri(), verifier: pending!.verifier });
  await tokenStore.set(tokens);
  localStorage.removeItem(PENDING);
  history.replaceState(null, "", "/");
  return "done";
}

export async function signOut(): Promise<void> {
  await tokenStore.clear();
}
