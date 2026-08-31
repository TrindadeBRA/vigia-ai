"""Provedor DeepSeek: API key + saldo da conta."""

from __future__ import annotations

import re
from typing import Any

from app.http_util import http_json
from app.store import provider as provider_cfg

_DS_KEY_RE = re.compile(r"sk-[A-Za-z0-9]+")
_INVISIBLE = ("\ufeff", "\u200b", "\u200c", "\u200d", "\xa0")
DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance"


def clean_deepseek_key(raw: str) -> str | None:
    text = raw.strip()
    for ch in _INVISIBLE:
        text = text.replace(ch, "")
    text = "".join(ch for ch in text if ch.isascii())
    text = " ".join(text.split())
    if not text:
        return None
    match = _DS_KEY_RE.search(text)
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


def deepseek_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def parse_deepseek_payload(data: dict[str, Any]) -> dict[str, Any]:
    infos = data.get("balance_infos")
    if not isinstance(infos, list) or not infos:
        return deepseek_fail("resposta DeepSeek sem balance_infos")
    info = next(
        (i for i in infos if isinstance(i, dict) and i.get("currency") == "USD"),
        infos[0],
    )
    if not isinstance(info, dict):
        return deepseek_fail("resposta DeepSeek sem balance_infos")
    remaining_cents = _usd_cents(info.get("total_balance"))
    return {
        "ok": True,
        "error": None,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": remaining_cents,
    }


def fetch_deepseek_one(raw_key: str) -> dict[str, Any]:
    key = clean_deepseek_key(raw_key or "")
    if not key:
        return deepseek_fail("API key inválida; cole só a chave sk-... no painel")
    try:
        data = http_json(
            DEEPSEEK_BALANCE_URL,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
    except RuntimeError as exc:
        return deepseek_fail(str(exc))
    if not isinstance(data, dict):
        return deepseek_fail("resposta DeepSeek inesperada")
    return parse_deepseek_payload(data)


def fetch_deepseek_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "deepseek")
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
        result = fetch_deepseek_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
