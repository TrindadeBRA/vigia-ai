"""GET/POST JSON com tratamento de erro uniforme. Não vaza Authorization."""

from __future__ import annotations

import http.client
import json
import re
import sys
import time
import urllib.parse
from typing import Any

import httpx

from app import __version__

_RETRY_AFTER_RE = re.compile(r"retry-after=(\d+(?:\.\d+)?)", re.IGNORECASE)

DEFAULT_USER_AGENT = f"VigiaAI/{__version__} (local collector)"

# Client único e persistente pro processo inteiro: reusa conexões keep-alive
# por host (pool interno do httpx) em vez de abrir TCP+TLS do zero em cada
# chamada. Thread-safe — os providers rodam em paralelo num ThreadPoolExecutor
# (ver app/usage.py), então todos compartilham este client.
_client = httpx.Client(timeout=20.0, headers={"User-Agent": DEFAULT_USER_AGENT})

# Log das chamadas de saída (Claude, Cursor, weather, ...) no mesmo espírito do
# access log do uvicorn (`INFO:     127.0.0.1:12345 - "GET /path HTTP/1.1" 200 OK`),
# só que com o provider no lugar do rótulo de nível e outra cor — dá pra ver
# no mesmo terminal qual fonte está sendo atualizada nesse instante.
_MAGENTA = "\033[35m"
_RED = "\033[31m"
_RESET = "\033[0m"
_USE_COLOR = sys.stdout.isatty()
# "UPDATE - OPENROUTER:" / "UPDATE - CURRENCIES:" são os rótulos mais longos.
_PREFIX_WIDTH = 21
# "NOTIFICATION - TELEGRAM:"
_NOTIFICATION_PREFIX_WIDTH = 25


def _level_prefix(label: str) -> str:
    prefix = f"UPDATE - {label}:".ljust(_PREFIX_WIDTH)
    return f"{_MAGENTA}{prefix}{_RESET}" if _USE_COLOR else prefix


def _notification_prefix(label: str) -> str:
    prefix = f"NOTIFICATION - {label}:".ljust(_NOTIFICATION_PREFIX_WIDTH)
    return f"{_RED}{prefix}{_RESET}" if _USE_COLOR else prefix


def _label_from_host(netloc: str) -> str:
    """Fallback quando o chamador não passa `provider` explicitamente."""
    host = netloc.split(":")[0]
    parts = host.split(".")
    core = parts[-2] if len(parts) >= 2 else host
    return core.upper()


def _log_request(
    prefix: str,
    method: str,
    url: str,
    *,
    status: int | None,
    elapsed_ms: float,
    error: str | None = None,
) -> None:
    parsed = urllib.parse.urlsplit(url)
    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"
    request_line = f'"{method} {path} HTTP/1.1"'
    if error is not None:
        print(f"{prefix}{parsed.netloc} - {request_line} falhou ({elapsed_ms:.0f}ms): {error}")
        return
    reason = http.client.responses.get(status or 0, "")
    print(f"{prefix}{parsed.netloc} - {request_line} {status} {reason} ({elapsed_ms:.0f}ms)")


def _log_outbound(
    method: str,
    url: str,
    *,
    label: str,
    status: int | None,
    elapsed_ms: float,
    error: str | None = None,
) -> None:
    _log_request(
        _level_prefix(label),
        method,
        url,
        status=status,
        elapsed_ms=elapsed_ms,
        error=error,
    )


def log_outbound(
    method: str,
    url: str,
    *,
    label: str,
    status: int | None,
    elapsed_ms: float,
    error: str | None = None,
) -> None:
    """Log de saída no terminal (magenta), mesmo formato do coletor de cotas."""
    _log_outbound(method, url, label=label, status=status, elapsed_ms=elapsed_ms, error=error)


def log_notification(
    method: str,
    url: str,
    *,
    label: str,
    status: int | None,
    elapsed_ms: float,
    error: str | None = None,
) -> None:
    """Log de notificação (vermelho) — ex.: envio de alarme no Telegram."""
    _log_request(
        _notification_prefix(label.upper()),
        method,
        url,
        status=status,
        elapsed_ms=elapsed_ms,
        error=error,
    )


class HttpError(RuntimeError):
    """Falha HTTP com status (ex.: 429). Continua sendo RuntimeError pra quem já captura isso."""

    def __init__(self, message: str, *, status: int, retry_after_s: float | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.retry_after_s = retry_after_s

    @property
    def is_rate_limit(self) -> bool:
        return self.status == 429


def _parse_retry_after(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return max(1.0, float(raw.strip()))
    except ValueError:
        return None


def _rate_limit_extra(resp: httpx.Response) -> str:
    bits: list[str] = []
    retry = resp.headers.get("Retry-After")
    if retry:
        bits.append(f"retry-after={retry}")
    for key, val in resp.headers.items():
        low = key.lower()
        if "ratelimit" in low.replace("-", "") and val:
            bits.append(f"{key}={val}")
    return (" " + " ".join(bits)) if bits else ""


def retry_after_s(exc: BaseException | str) -> float | None:
    """Segundos de Retry-After, se o erro (ou a mensagem) trouxer."""
    if isinstance(exc, HttpError):
        return exc.retry_after_s
    text = str(exc)
    match = _RETRY_AFTER_RE.search(text)
    if not match:
        return None
    return _parse_retry_after(match.group(1))


def is_rate_limit(exc: BaseException | str | None) -> bool:
    if exc is None:
        return False
    if isinstance(exc, HttpError):
        return exc.is_rate_limit
    return "HTTP 429 " in str(exc)


def result_is_rate_limited(value: Any) -> bool:
    """Conta(s) ou bloco weather/currencies com HTTP 429 na mensagem de erro."""
    if isinstance(value, dict):
        if is_rate_limit(value.get("error")):
            return True
        items = value.get("items")
        if isinstance(items, list) and any(result_is_rate_limited(item) for item in items):
            return True
        return False
    if isinstance(value, list):
        return any(result_is_rate_limited(item) for item in value)
    return False


def http_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: float = 20.0,
    provider: str | None = None,
) -> Any:
    hdrs = dict(headers or {})
    try:
        for key, val in hdrs.items():
            key.encode("latin-1")
            val.encode("latin-1")
    except UnicodeEncodeError as exc:
        raise RuntimeError("token com caractere especial; cole de novo no painel") from exc
    label = (provider or _label_from_host(urllib.parse.urlsplit(url).netloc)).upper()
    start = time.perf_counter()
    try:
        resp = _client.request(method, url, content=body, headers=hdrs, timeout=timeout)
    except UnicodeEncodeError as exc:
        raise RuntimeError("token com caractere especial; cole de novo no painel") from exc
    except httpx.RequestError as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000
        _log_outbound(method, url, label=label, status=None, elapsed_ms=elapsed_ms, error=str(exc))
        raise RuntimeError(f"rede {method} {url}: {exc}") from exc
    elapsed_ms = (time.perf_counter() - start) * 1000
    _log_outbound(method, url, label=label, status=resp.status_code, elapsed_ms=elapsed_ms)
    if resp.status_code >= 400:
        err_body = resp.content.decode("utf-8", errors="replace")[:300]
        extra = _rate_limit_extra(resp)
        retry = _parse_retry_after(resp.headers.get("Retry-After"))
        raise HttpError(
            f"HTTP {resp.status_code} {method} {url}{extra}: {err_body}",
            status=resp.status_code,
            retry_after_s=retry,
        )
    raw = resp.content.decode("utf-8", errors="replace")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON inválido de {url}: {exc}") from exc


def http_form(url: str, fields: dict[str, str], *, timeout: float = 20.0, provider: str | None = None) -> Any:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    return http_json(
        url,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        body=body,
        timeout=timeout,
        provider=provider,
    )
