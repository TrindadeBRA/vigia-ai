"""Provedor OpenRouter: API key do usuário + saldo de créditos da conta."""

from __future__ import annotations

import os
import re
from typing import Any

from formatting import ratio_percent
from http_util import http_json
from store import get_accounts

# Key real: sk-or-v1- + hex. Paste do painel às vezes vem "Nome — sk-or-v1-..."
# (travessão U+2014). Header HTTP não aceita isso.
_OR_KEY_RE = re.compile(r"sk-or-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
_INVISIBLE = ("\ufeff", "\u200b", "\u200c", "\u200d", "\xa0")


def clean_openrouter_key(raw: str) -> str | None:
    """Extrai a API key ASCII. None se não houver nada utilizável.

    Paste do Notes/Word troca `--` por `—` (U+2014); header HTTP é latin-1.
    """
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


# /auth/key devolve uso "por key" -- fica zerado se a key nunca foi usada
# diretamente (ex.: key nova só pra isto, gasto real feito com outra key/app).
# /credits é o saldo real da conta: quanto foi comprado e quanto foi gasto no
# total, não importa qual key fez a chamada. É o que a tela deve mostrar.
OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits"


def _usd_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return None


def parse_openrouter_payload(data: dict[str, Any]) -> dict[str, Any]:
    info = data.get("data")
    if not isinstance(info, dict):
        return _openrouter_fail("resposta OpenRouter sem campo data")

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


def _openrouter_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def fetch_openrouter_one(raw_key: str) -> dict[str, Any]:
    """Uma chamada de créditos pra uma key já resolvida (uma conta da lista)."""
    key = clean_openrouter_key(raw_key or "")
    if not key:
        return _openrouter_fail("API key inválida; cole só a chave sk-or- no painel")
    try:
        data = http_json(
            OPENROUTER_CREDITS_URL,
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
    except RuntimeError as exc:
        return _openrouter_fail(str(exc))
    if not isinstance(data, dict):
        return _openrouter_fail("resposta OpenRouter inesperada")
    return parse_openrouter_payload(data)


def fetch_openrouter_accounts() -> list[dict[str, Any]]:
    """Uma entrada por key configurada (`OPENROUTER_ACCOUNTS`). Sem conceito de
    conta "local" — toda conta OpenRouter é uma key colada no painel.
    """
    accounts = get_accounts("OPENROUTER_ACCOUNTS")
    if not accounts:
        # Migração transparente da OPENROUTER_API_KEY única do formato antigo.
        legacy = os.environ.get("OPENROUTER_API_KEY", "").strip()
        if legacy:
            accounts = [{"id": "legacy", "label": "", "key": legacy}]
    out: list[dict[str, Any]] = []
    for acc in accounts:
        key = str(acc.get("key") or "").strip()
        label = str(acc.get("label") or "").strip()
        aid = str(acc.get("id") or "extra")
        result = fetch_openrouter_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
