"""Provedor OpenCode Go: API key + janelas de uso da assinatura.

OpenCode Go e uma assinatura (US$ 10/mes) com tres janelas de cota:
rolling (~5h, US$ 12), weekly (US$ 30) e monthly (US$ 60). O endpoint
`/zen/go/v1/usage` devolve o percentual usado e o instante de reset de cada
janela — analogo ao Claude/GPT (assinatura com janelas), nao a um saldo
pago-conforme-uso.
"""

from __future__ import annotations

import re
from typing import Any

from app.formatting import as_percent, iso_or_none
from app.http_util import http_json
from app.store import provider as provider_cfg

_OC_KEY_RE = re.compile(r"sk-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
_INVISIBLE = ("\ufeff", "\u200b", "\u200c", "\u200d", "\xa0")
OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage"


def clean_opencode_key(raw: str) -> str | None:
    text = raw.strip()
    for ch in _INVISIBLE:
        text = text.replace(ch, "")
    text = "".join(ch for ch in text if ch.isascii())
    text = " ".join(text.split())
    if not text:
        return None
    match = _OC_KEY_RE.search(text)
    if match:
        return match.group(0)
    if " " in text:
        return None
    return text or None


def opencode_go_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "rolling_percent": None,
        "rolling_resets_at": None,
        "weekly_percent": None,
        "weekly_resets_at": None,
        "monthly_percent": None,
        "monthly_resets_at": None,
    }


def parse_opencode_go_payload(data: dict[str, Any]) -> dict[str, Any]:
    usage = data.get("usage")
    if not isinstance(usage, dict):
        return opencode_go_fail("resposta OpenCode Go sem campo usage")

    def _win(name: str) -> tuple[float | None, str | None]:
        obj = usage.get(name)
        if not isinstance(obj, dict):
            return None, None
        return as_percent(obj.get("percent")), iso_or_none(obj.get("resetsAt"))

    rolling_pct, rolling_reset = _win("rolling")
    weekly_pct, weekly_reset = _win("weekly")
    monthly_pct, monthly_reset = _win("monthly")

    ok = any(v is not None for v in (rolling_pct, weekly_pct, monthly_pct))
    return {
        "ok": ok,
        "error": None if ok else "resposta OpenCode Go sem janelas de cota",
        "rolling_percent": rolling_pct,
        "rolling_resets_at": rolling_reset,
        "weekly_percent": weekly_pct,
        "weekly_resets_at": weekly_reset,
        "monthly_percent": monthly_pct,
        "monthly_resets_at": monthly_reset,
    }


def fetch_opencode_go_one(raw_key: str) -> dict[str, Any]:
    key = clean_opencode_key(raw_key or "")
    if not key:
        return opencode_go_fail("API key inválida; cole só a chave sk-... no painel")
    try:
        data = http_json(
            OPENCODE_GO_USAGE_URL,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
    except RuntimeError as exc:
        return opencode_go_fail(str(exc))
    if not isinstance(data, dict):
        return opencode_go_fail("resposta OpenCode Go inesperada")
    return parse_opencode_go_payload(data)


def fetch_opencode_go_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "opencode_go")
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
        result = fetch_opencode_go_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
