"""Minimal client for the YouVersion Platform API (https://developers.youversion.com/api)."""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

API_BASE = "https://api.youversion.com"
USER_AGENT = "yvsync/0.1 (personal highlight sync)"


class ApiError(Exception):
    def __init__(self, status: int, message: str, path: str = ""):
        super().__init__(f"HTTP {status} on {path}: {message}")
        self.status = status
        self.message = message
        self.path = path

    @property
    def retryable(self) -> bool:
        return self.status in (0, 429) or self.status >= 500


def token_from(body, path: str = "/auth/token") -> dict:
    """A token response, checked before it replaces the saved sign-in."""
    if not isinstance(body, dict) or not body.get("access_token"):
        raise ApiError(502, "no access token in the response", path)
    return body


def _error_message(raw: bytes) -> str:
    # Seen in the wild: {"message": ...} (per the spec), {"error", "error_description"}
    # from the auth layer, and {"fault": {"faultstring": ...}} from the gateway.
    text = raw.decode(errors="replace")
    try:
        body = json.loads(raw)
    except ValueError:
        return text[:300]
    if not isinstance(body, dict):
        return text[:300]
    if "message" in body:
        return str(body["message"])
    if "error" in body:
        return f"{body['error']}: {body.get('error_description', '')}".strip(": ")
    fault = body.get("fault")
    if isinstance(fault, dict) and "faultstring" in fault:
        return str(fault["faultstring"])
    return text[:300]


class TokenStore:
    """OAuth tokens saved in a local JSON file (mode 600)."""

    def __init__(self, path: Path):
        self.path = path
        self.data: dict = {}
        if path.exists():
            self.data = json.loads(path.read_text())

    def save(self, tokens: dict) -> None:
        tokens = dict(tokens)
        tokens["obtained_at"] = time.time()
        if "refresh_token" not in tokens and "refresh_token" in self.data:
            tokens["refresh_token"] = self.data["refresh_token"]
        self.data = tokens
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # Created as 600, so the tokens are never readable by others, even
        # briefly; chmod covers a file left from before with wider permissions.
        fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(json.dumps(tokens, indent=2))
        self.path.chmod(0o600)

    @property
    def access_token(self) -> str | None:
        return self.data.get("access_token")

    def expires_soon(self) -> bool:
        if not self.data:
            return True
        lifetime = float(self.data.get("expires_in", 3599))
        return time.time() > self.data.get("obtained_at", 0) + lifetime - 120


class Client:
    def __init__(self, app_key: str, tokens: TokenStore | None = None,
                 base: str = API_BASE, delay: float = 0.05, max_retries: int = 5):
        self.app_key = app_key
        self.tokens = tokens
        self.base = base
        self.delay = delay
        self.max_retries = max_retries
        self._lock = threading.Lock()
        self._pause_until = 0.0  # shared back-off when the API rate-limits us

    # -- plumbing ---------------------------------------------------------

    def _raw(self, method: str, path: str, *, params=None, body=None, form=None,
             auth: bool = False, ignore_body: bool = False):
        url = self.base + path
        if params:
            url += "?" + urllib.parse.urlencode(params, doseq=True)
        headers = {"X-YVP-App-Key": self.app_key, "Accept": "application/json",
                   "User-Agent": USER_AGENT}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        elif form is not None:
            data = urllib.parse.urlencode(form).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if auth:
            if not self.tokens or not self.tokens.access_token:
                raise ApiError(401, "not signed in - run `yvsync login`", path)
            headers["Authorization"] = f"Bearer {self.tokens.access_token}"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                if ignore_body or not raw.strip():
                    return resp.status, None, resp.headers
                try:
                    return resp.status, json.loads(raw), resp.headers
                except ValueError:
                    # A proxy's or captive portal's page: retried, and if it
                    # persists, fails this request rather than the whole run.
                    raise ApiError(502, f"unreadable response (HTTP {resp.status})", path) from None
        except urllib.error.HTTPError as e:
            raw = e.read()
            msg = _error_message(raw)
            err = ApiError(e.code, msg, path)
            err.retry_after = e.headers.get("Retry-After")
            raise err from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            raise ApiError(0, str(e), path) from None

    def request(self, method: str, path: str, *, auth: bool = False, **kw):
        if auth and self.tokens and self.tokens.expires_soon() and self.tokens.data.get("refresh_token"):
            self.refresh()
        refreshed = False
        for attempt in range(self.max_retries + 1):
            with self._lock:
                wait = self._pause_until - time.time()
            if wait > 0:
                time.sleep(wait)
            if self.delay:
                time.sleep(self.delay)
            try:
                return self._raw(method, path, auth=auth, **kw)
            except ApiError as e:
                if e.status == 401 and auth and not refreshed and self.tokens and self.tokens.data.get("refresh_token"):
                    self.refresh(force=True)
                    refreshed = True
                    continue
                if not e.retryable or attempt == self.max_retries:
                    raise
                backoff = min(60.0, 2 ** attempt)
                ra = getattr(e, "retry_after", None)
                if ra and str(ra).isdigit():
                    backoff = max(backoff, float(ra))
                with self._lock:
                    self._pause_until = max(self._pause_until, time.time() + backoff)

    def refresh(self, force: bool = False) -> None:
        # Standard OAuth refresh grant. Not spelled out in YouVersion's docs; if it
        # fails, `yvsync login` again.
        with self._lock:
            if not force and not self.tokens.expires_soon():
                return  # another thread already refreshed
            _, tokens, _ = self._raw("POST", "/auth/token", form={
                "grant_type": "refresh_token",
                "refresh_token": self.tokens.data["refresh_token"],
                "client_id": self.app_key,
            })
            self.tokens.save(token_from(tokens))

    # -- endpoints ----------------------------------------------------------

    def get_bible(self, bible_id: int) -> dict:
        return self.request("GET", f"/v1/bibles/{bible_id}")[1] or {}

    def get_index(self, bible_id: int) -> dict:
        return self.request("GET", f"/v1/bibles/{bible_id}/index")[1] or {}

    def get_highlights(self, bible_id: int, passage_id: str) -> list[dict]:
        """Highlights for a verse or whole chapter (e.g. "JHN.3"), one per verse."""
        status, body, _ = self.request("GET", "/v1/highlights", auth=True,
                                       params={"bible_id": bible_id, "passage_id": passage_id})
        if status == 204 or not body:
            return []
        return body.get("data", [])

    def set_highlight(self, bible_id: int, passage_id: str, color: str) -> None:
        # Writes don't need the body, so one that can't be parsed is no failure.
        self.request("POST", "/v1/highlights", auth=True, ignore_body=True, body={
            "request_id": str(uuid.uuid4()),
            "highlight": {"bible_id": bible_id, "passage_id": passage_id, "color": color},
        })

    def delete_highlight(self, bible_id: int, passage_id: str) -> None:
        self.request("DELETE", f"/v1/highlights/{urllib.parse.quote(passage_id)}",
                     auth=True, ignore_body=True, params={"bible_id": bible_id})
