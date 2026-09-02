"""GET/POST JSON com tratamento de erro uniforme. Não vaza Authorization."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app import __version__

_RETRY_AFTER_RE = re.compile(r"retry-after=(\d+(?:\.\d+)?)", re.IGNORECASE)

DEFAULT_USER_AGENT = f"VigiaAI/{__version__} (local collector)"


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


def _rate_limit_extra(exc: urllib.error.HTTPError) -> str:
    if not exc.headers:
        return ""
    bits: list[str] = []
    retry = exc.headers.get("Retry-After")
    if retry:
        bits.append(f"retry-after={retry}")
    for key, val in exc.headers.items():
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
) -> Any:
    hdrs = dict(headers or {})
    hdrs.setdefault("User-Agent", DEFAULT_USER_AGENT)
    try:
        for key, val in hdrs.items():
            key.encode("latin-1")
            val.encode("latin-1")
    except UnicodeEncodeError as exc:
        raise RuntimeError("token com caractere especial; cole de novo no painel") from exc
    req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except UnicodeEncodeError as exc:
        raise RuntimeError("token com caractere especial; cole de novo no painel") from exc
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")[:300]
        extra = _rate_limit_extra(exc)
        retry = _parse_retry_after(exc.headers.get("Retry-After") if exc.headers else None)
        raise HttpError(
            f"HTTP {exc.code} {method} {url}{extra}: {err_body}",
            status=int(exc.code),
            retry_after_s=retry,
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"rede {method} {url}: {exc.reason}") from exc
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON inválido de {url}: {exc}") from exc


def http_form(url: str, fields: dict[str, str], *, timeout: float = 20.0) -> Any:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    return http_json(
        url,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        body=body,
        timeout=timeout,
    )
