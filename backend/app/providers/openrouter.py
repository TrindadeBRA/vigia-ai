"""Provedor OpenRouter: API key + saldo de créditos da conta."""

from __future__ import annotations

import re
from typing import Any

from app.formatting import ratio_percent
from app.http_util import http_json
from app.store import provider as provider_cfg

_OR_KEY_RE = re.compile(r"sk-or-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
_INVISIBLE = ("\ufeff", "\u200b", "\u200c", "\u200d", "\xa0")
OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits"


def clean_openrouter_key(raw: str) -> str | None:
    text = raw.strip()
    for ch in _INVISIBLE:
        text = text.replace(ch, "")
    text = "".join(ch for ch in text if ch.isascii())
    text = " ".join(text.split())
    if not text:
        return None
    match = _OR_KEY_RE.search(text)
    if match:
        return match.group(0)
    if " " in text:
        return None
    return text or None


def _usd_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return None


def openrouter_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def parse_openrouter_payload(data: dict[str, Any]) -> dict[str, Any]:
    info = data.get("data")
    if not isinstance(info, dict):
        return openrouter_fail("resposta OpenRouter sem campo data")

    limit_cents = _usd_cents(info.get("total_credits"))
    used_cents = _usd_cents(info.get("total_usage")) or 0
    remaining_cents = None
    percent = None
    if limit_cents is not None:
        remaining_cents = max(0, limit_cents - used_cents)
        if limit_cents > 0:
            percent = ratio_percent(used_cents, limit_cents)

    return {
        "ok": True,
        "error": None,
        "percent": percent,
        "limit_cents": limit_cents,
        "used_cents": used_cents,
        "remaining_cents": remaining_cents,
    }


def fetch_openrouter_one(raw_key: str) -> dict[str, Any]:
    key = clean_openrouter_key(raw_key or "")
    if not key:
        return openrouter_fail("API key inválida; cole só a chave sk-or- no painel")
    try:
        data = http_json(
            OPENROUTER_CREDITS_URL,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
            provider="OPENROUTER",
        )
    except RuntimeError as exc:
        return openrouter_fail(str(exc))
    if not isinstance(data, dict):
        return openrouter_fail("resposta OpenRouter inesperada")
    return parse_openrouter_payload(data)


def fetch_openrouter_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "openrouter")
    accounts = list(p.get("accounts") or [])
    if not accounts and not p.get("hidden"):
        legacy = str(p.get("paste_secret") or "").strip()
        if legacy:
            accounts = [{"id": "legacy", "label": str(p.get("local_label") or ""), "secret": legacy}]
    out: list[dict[str, Any]] = []
    for acc in accounts:
        key = str(acc.get("secret") or "").strip()
        label = str(acc.get("label") or "").strip()
        aid = str(acc.get("id") or "extra")
        result = fetch_openrouter_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
