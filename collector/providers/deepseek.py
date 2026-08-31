"""Provedor DeepSeek: API key do usuário + saldo da conta."""

from __future__ import annotations

import os
import re
from typing import Any

from http_util import http_json
from store import get_accounts

_DS_KEY_RE = re.compile(r"sk-[A-Za-z0-9]+")
_INVISIBLE = ("﻿", "​", "‌", "‍", "\xa0")

DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance"


def clean_deepseek_key(raw: str) -> str | None:
    """Extrai a API key ASCII. None se não houver nada utilizável.

    Mesmo cuidado do OpenRouter: paste do Notes/Word troca `--` por `—`
    (U+2014) e o header HTTP é latin-1.
    """
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


def parse_deepseek_payload(data: dict[str, Any]) -> dict[str, Any]:
    infos = data.get("balance_infos")
    if not isinstance(infos, list) or not infos:
        return _deepseek_fail("resposta DeepSeek sem balance_infos")
    info = next(
        (i for i in infos if isinstance(i, dict) and i.get("currency") == "USD"),
        infos[0],
    )
    if not isinstance(info, dict):
        return _deepseek_fail("resposta DeepSeek sem balance_infos")

    # `granted_balance`/`topped_up_balance`/`total_balance` são todos saldo
    # ATUAL (total_balance = granted + topped_up), não valores históricos.
    # A API não devolve quanto já foi gasto nem quanto já foi depositado no
    # total — só o que resta agora. Por isso não dá pra calcular limite/usado/
    # percentual daqui; só o saldo restante é real.
    remaining_cents = _usd_cents(info.get("total_balance"))

    return {
        "ok": True,
        "error": None,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": remaining_cents,
    }


def _deepseek_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def fetch_deepseek_one(raw_key: str) -> dict[str, Any]:
    """Uma chamada de saldo pra uma key já resolvida (uma conta da lista)."""
    key = clean_deepseek_key(raw_key or "")
    if not key:
        return _deepseek_fail("API key inválida; cole só a chave sk-... no painel")
    try:
        data = http_json(
            DEEPSEEK_BALANCE_URL,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
    except RuntimeError as exc:
        return _deepseek_fail(str(exc))
    if not isinstance(data, dict):
        return _deepseek_fail("resposta DeepSeek inesperada")
    return parse_deepseek_payload(data)


def fetch_deepseek_accounts() -> list[dict[str, Any]]:
    """Uma entrada por key configurada (`DEEPSEEK_ACCOUNTS`). Sem conceito de
    conta "local" — toda conta DeepSeek é uma key colada no painel.
    """
    accounts = get_accounts("DEEPSEEK_ACCOUNTS")
    if not accounts:
        # Migração transparente da DEEPSEEK_API_KEY única do formato antigo.
        legacy = os.environ.get("DEEPSEEK_API_KEY", "").strip()
        if legacy:
            accounts = [{"id": "legacy", "label": "", "key": legacy}]
    out: list[dict[str, Any]] = []
    for acc in accounts:
        key = str(acc.get("key") or "").strip()
        label = str(acc.get("label") or "").strip()
        aid = str(acc.get("id") or "extra")
        result = fetch_deepseek_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
