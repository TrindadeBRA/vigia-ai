"""Helpers genéricos: GET/POST JSON com tratamento de erro uniforme."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


def _rate_limit_extra(exc: urllib.error.HTTPError) -> str:
    """Retry-After e headers *ratelimit* — úteis no 429; não vaza Authorization."""
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


def http_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: float = 20.0,
) -> Any:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")[:300]
        extra = _rate_limit_extra(exc)
        raise RuntimeError(f"HTTP {exc.code} {method} {url}{extra}: {err_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"rede {method} {url}: {exc.reason}") from exc
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON inválido de {url}: {exc}") from exc
