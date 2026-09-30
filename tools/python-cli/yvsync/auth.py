"""Sign in with YouVersion: OAuth authorization code + PKCE, via a local callback server.

Flow (https://developers.youversion.com/sign-in-apis):
  1. Browser -> /auth/authorize (with requested_permissions[]=highlights)
  2. YouVersion redirects to our callback with ?state=...  (no code yet)
  3. We redirect the browser to /auth/callback?state=... which redirects back
     to our callback with ?code=...
  4. We exchange the code for tokens at /auth/token.
"""

from __future__ import annotations

import base64
import hashlib
import http.server
import secrets
import threading
import urllib.parse
import webbrowser

from .api import API_BASE, ApiError, Client, TokenStore, token_from


def _pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def login(client: Client, tokens: TokenStore, redirect_uri: str, open_browser: bool = True) -> dict:
    parsed = urllib.parse.urlparse(redirect_uri)
    if parsed.hostname not in ("localhost", "127.0.0.1"):
        raise SystemExit("redirect_uri must point at localhost for the CLI login flow")
    verifier, challenge = _pkce()
    state = secrets.token_urlsafe(24)
    authorize_url = API_BASE + "/auth/authorize?" + urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client.app_key,
        "redirect_uri": redirect_uri,
        "scope": "openid profile",
        "nonce": secrets.token_urlsafe(16),
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "requested_permissions[]": "highlights",
    })
    result: dict = {}
    done = threading.Event()

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _reply(self, status: int, text: str, location: str | None = None):
            self.send_response(status)
            if location:
                self.send_header("Location", location)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"<html><body style='font-family:system-ui;padding:2em'>{text}</body></html>".encode())

        def do_GET(self):
            url = urllib.parse.urlparse(self.path)
            if url.path != parsed.path:
                return self._reply(404, "Not found")
            q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query, keep_blank_values=True).items()}
            if q.get("state") != state:
                return self._reply(400, "State mismatch - please run <code>yvsync login</code> again.")
            if "granted_permissions" in q:
                result["granted_permissions"] = q["granted_permissions"]
            if "error" in q:
                result["error"] = f"{q['error']}: {q.get('error_description', '')}"
                done.set()
                return self._reply(400, f"Sign-in failed: {result['error']}")
            if "code" not in q:
                # First, state-only hop: bounce through /auth/callback to get the code.
                cb = API_BASE + "/auth/callback?" + urllib.parse.urlencode({"state": state})
                return self._reply(302, "Continuing sign-in…", location=cb)
            try:
                _, tok, _ = client._raw("POST", "/auth/token", form={
                    "grant_type": "authorization_code",
                    "code": q["code"],
                    "redirect_uri": redirect_uri,
                    "client_id": client.app_key,
                    "code_verifier": verifier,
                })
                tokens.save(token_from(tok))
                result["ok"] = True
                self._reply(200, "Signed in to YouVersion. You can close this tab and return to the terminal.")
            except ApiError as e:
                result["error"] = str(e)
                self._reply(500, f"Token exchange failed: {e}")
            except Exception as e:
                # Anything else would kill this handler and leave the CLI
                # waiting ten minutes for a sign-in that's already over.
                result["error"] = repr(e)
                raise
            finally:
                done.set()

    server = http.server.HTTPServer((parsed.hostname, parsed.port or 80), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print("Opening YouVersion sign-in in your browser. If it doesn't open, visit:\n\n  " + authorize_url + "\n")
    if open_browser:
        webbrowser.open(authorize_url)
    try:
        if not done.wait(timeout=600):
            raise SystemExit("Timed out waiting for sign-in.")
    finally:
        server.shutdown()
    if "error" in result:
        raise SystemExit(f"Sign-in failed: {result['error']}")
    granted = result.get("granted_permissions")
    if granted is not None and "highlights" not in granted.split(","):
        print("Warning: you signed in but did not grant the 'highlights' permission; syncing will fail.")
    return result
