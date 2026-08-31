"""Provedor OpenCode Zen: API key + saldo pago-conforme-uso.

OpenCode Zen e pay-as-you-go (saldo pre-pago, recarga automatica de US$ 20
quando o saldo cai abaixo de US$ 5). O coletor exibe apenas o saldo restante
em dolares — analogo ao OpenRouter/DeepSeek (creditos/saldo), nao a uma
assinatura com janelas.

O endpoint publico de saldo do Zen ainda nao foi confirmado no repositorio
oficial (o saldo e interno ao console). Enquanto isso, o provedor tenta o
endpoint mais provavel e, se nao houver, a conta cai em "sem dados" sem
derrubar os demais provedores.
"""

from __future__ import annotations

import re
from typing import Any

from app.http_util import http_json
from app.store import provider as provider_cfg

_OC_KEY_RE = re.compile(r"sk-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
_INVISIBLE = ("\ufeff", "\u200b", "\u200c", "\u200d", "\xa0")
# Endpoint provavel de saldo do Zen — a confirmar na implementacao. Se nao
# existir, a conta cai em "sem dados" (ok=False) sem afetar os outros.
OPENCODE_ZEN_BALANCE_URL = "https://opencode.ai/zen/v1/usage"


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


def _usd_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return None


def opencode_zen_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def parse_opencode_zen_payload(data: dict[str, Any]) -> dict[str, Any]:
    # Formato esperado (a confirmar): o saldo pode vir em `balance` (USD,
    # float) ou em `remaining_cents`. Tambem aceita `data.balance`.
    info = data.get("data") if isinstance(data.get("data"), dict) else data
    remaining_cents = _usd_cents(info.get("remaining_cents"))
    if remaining_cents is None:
        remaining_cents = _usd_cents(info.get("balance"))
    if remaining_cents is None:
        return opencode_zen_fail("resposta OpenCode Zen sem saldo")
    return {
        "ok": True,
        "error": None,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": remaining_cents,
    }


def fetch_opencode_zen_one(raw_key: str) -> dict[str, Any]:
    key = clean_opencode_key(raw_key or "")
    if not key:
        return opencode_zen_fail("API key inválida; cole só a chave sk-... no painel")
    try:
        data = http_json(
            OPENCODE_ZEN_BALANCE_URL,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
    except RuntimeError as exc:
        return opencode_zen_fail(str(exc))
    if not isinstance(data, dict):
        return opencode_zen_fail("resposta OpenCode Zen inesperada")
    return parse_opencode_zen_payload(data)


def fetch_opencode_zen_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "opencode_zen")
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
        result = fetch_opencode_zen_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
