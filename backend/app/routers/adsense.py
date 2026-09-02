"""OAuth Google AdSense — login no browser, token só no coletor."""

from __future__ import annotations

import json
import secrets
import threading
import time
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse

from app.providers.adsense import auth_url, exchange_code
from app.schemas import OkResult
from app.store import load, provider as provider_cfg, update

router = APIRouter(prefix="/api/oauth/adsense", tags=["adsense"])

_LOCK = threading.Lock()
_PENDING: dict[str, dict[str, Any]] = {}
_TTL_S = 600


def _purge() -> None:
    now = time.monotonic()
    dead = [k for k, v in _PENDING.items() if now - float(v.get("at") or 0) > _TTL_S]
    for k in dead:
        _PENDING.pop(k, None)


def _listen_port(request: Request) -> int:
    return int(request.app.state.listen_port)


def _safe_return_to(raw: str | None, port: int) -> str:
    fallback = f"http://127.0.0.1:{port}/display/config"
    if not raw:
        return fallback
    parsed = urlparse(raw.strip())
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost"):
        return fallback
    path = parsed.path or "/display/config"
    if not path.startswith("/display"):
        return fallback
    host = "127.0.0.1" if parsed.hostname == "localhost" else parsed.hostname
    netloc = f"{host}:{parsed.port}" if parsed.port else host
    return f"http://{netloc}{path}"


def _js_string_literal(value: str) -> str:
    """JSON-encode `value` for safe embedding inside an inline <script> block.

    Escaping just for JS string syntax is not enough: the HTML tokenizer ends
    a <script> element on the literal byte sequence "</script", regardless of
    JS string quoting. Escaping '<', '>' and '&' to \\uXXXX prevents that
    sequence (and any other HTML-significant text) from ever appearing raw.
    """
    encoded = json.dumps(value)
    return (
        encoded.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )


def _html_redirect(url: str, message: str) -> HTMLResponse:
    safe = url.replace("&", "&amp;").replace('"', "&quot;")
    body = (
        "<!doctype html><meta charset=utf-8>"
        f'<meta http-equiv="refresh" content="0;url={safe}">'
        f"<script>location.replace({_js_string_literal(url)})</script>"
        f"<p>{message}</p>"
    )
    return HTMLResponse(body)


@router.get("/start", summary="Abre o login Google AdSense")
def oauth_start(request: Request, return_to: str | None = None) -> dict[str, str]:
    cfg = load()
    p = provider_cfg(cfg, "adsense")
    client_id = str(p.get("client_id") or "").strip()
    client_secret = str(p.get("client_secret") or "").strip()
    if not client_id or not client_secret:
        raise HTTPException(400, "Cole o Client ID e o Client Secret do Google Cloud antes de entrar")
    port = _listen_port(request)
    state = secrets.token_urlsafe(24)
    with _LOCK:
        _purge()
        _PENDING[state] = {"at": time.monotonic(), "return_to": _safe_return_to(return_to, port)}
    return {"url": auth_url(client_id, port, state)}


@router.get("/callback", summary="Callback OAuth (cadastrar esta URI no Google Cloud)", include_in_schema=False)
def oauth_callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None) -> HTMLResponse:
    port = _listen_port(request)
    with _LOCK:
        _purge()
        pending = _PENDING.pop(state or "", None)
    return_to = str((pending or {}).get("return_to") or _safe_return_to(None, port))
    sep = "&" if "?" in return_to else "?"
    if error:
        return _html_redirect(f"{return_to}{sep}adsense=denied", "Login Google cancelado.")
    if not code or not state or not pending:
        return _html_redirect(f"{return_to}{sep}adsense=error", "Callback OAuth inválido ou expirado.")
    cfg = load()
    p = provider_cfg(cfg, "adsense")
    client_id = str(p.get("client_id") or "").strip()
    client_secret = str(p.get("client_secret") or "").strip()
    try:
        tokens = exchange_code(client_id, client_secret, port, code)
    except RuntimeError as exc:
        return _html_redirect(f"{return_to}{sep}adsense=error", str(exc))

    def mut(cfg_now: dict[str, Any]) -> None:
        cfg_now["providers"]["adsense"]["refresh_token"] = str(tokens.get("refresh_token") or "")

    update(mut)
    return _html_redirect(f"{return_to}{sep}adsense=ok", "AdSense conectado. Pode fechar esta aba.")


@router.post("/disconnect", response_model=OkResult, summary="Esquece o login Google (mantém Client ID)")
def oauth_disconnect() -> OkResult:
    def mut(cfg: dict[str, Any]) -> None:
        cfg["providers"]["adsense"]["refresh_token"] = ""
        cfg["providers"]["adsense"]["account_name"] = ""

    update(mut)
    return OkResult(ok=True, cleared="adsense_oauth")
