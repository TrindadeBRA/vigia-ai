"""Helpers genéricos: .env simples e GET/POST JSON com tratamento de erro uniforme."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
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


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and val:
            os.environ[key] = val
        elif key and key not in os.environ:
            os.environ[key] = val


def upsert_dotenv(path: Path, updates: dict[str, str]) -> None:
    """Atualiza chaves no .env sem apagar as outras. Cria o arquivo se faltar."""
    lines: list[str] = []
    if path.is_file():
        lines = path.read_text(encoding="utf-8").splitlines()
    pending = dict(updates)
    out: list[str] = []
    for raw in lines:
        stripped = raw.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.partition("=")[0].strip()
            if key in pending:
                out.append(f"{key}={pending.pop(key)}")
                continue
        out.append(raw)
    if pending:
        if out and out[-1].strip():
            out.append("")
        for key, val in pending.items():
            out.append(f"{key}={val}")
    text = "\n".join(out).rstrip() + "\n"
    path.write_text(text, encoding="utf-8")


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
