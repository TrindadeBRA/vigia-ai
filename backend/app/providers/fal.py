"""Provedor fal.ai: API key + saldo de créditos da conta.

O endpoint de billing (GET /v1/account/billing) só aceita chave com escopo
"Admin" (fal.ai/dashboard/keys) -- uma chave "API" comum recebe 401/403 aqui,
mesmo funcionando pra inferência. Isso é comunicado ao usuário no copy do
painel de config, não tratado como erro especial aqui.
"""

from __future__ import annotations

import re
from typing import Any

from app.http_util import http_json
from app.store import provider as provider_cfg

_FAL_KEY_RE = re.compile(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*:[A-Za-z0-9]+")
_INVISIBLE = ("﻿", "​", "‌", "‍", "\xa0")
FAL_BILLING_URL = "https://api.fal.ai/v1/account/billing?expand=credits"


def clean_fal_key(raw: str) -> str | None:
    text = raw.strip()
    for ch in _INVISIBLE:
        text = text.replace(ch, "")
    text = "".join(ch for ch in text if ch.isascii())
    text = " ".join(text.split())
    if not text:
        return None
    match = _FAL_KEY_RE.search(text)
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


def fal_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def parse_fal_payload(data: dict[str, Any]) -> dict[str, Any]:
    credits = data.get("credits")
    if not isinstance(credits, dict):
        return fal_fail("resposta fal.ai sem credits")
    remaining_cents = _usd_cents(credits.get("current_balance"))
    if remaining_cents is None:
        return fal_fail("resposta fal.ai sem current_balance")
    return {
        "ok": True,
        "error": None,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": remaining_cents,
    }


def fetch_fal_one(raw_key: str) -> dict[str, Any]:
    key = clean_fal_key(raw_key or "")
    if not key:
        return fal_fail("API key inválida; cole a chave admin (id:secret) no painel")
    try:
        data = http_json(
            FAL_BILLING_URL,
            headers={"Authorization": f"Key {key}", "Accept": "application/json"},
            provider="FAL",
        )
    except RuntimeError as exc:
        return fal_fail(str(exc))
    if not isinstance(data, dict):
        return fal_fail("resposta fal.ai inesperada")
    return parse_fal_payload(data)


def fetch_fal_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "fal")
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
        result = fetch_fal_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
