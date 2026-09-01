"""Provedor OpenCode: API key única + assinatura (Go) e saldo (Zen).

OpenCode usa uma única API key (`sk-...`, criada em opencode.ai/auth) para
dois produtos:
- **OpenCode Go** — assinatura (US$ 10/mês) com três janelas de cota:
  rolling (~5h, US$ 12), weekly (US$ 30) e monthly (US$ 60). Endpoint
  `/zen/go/v1/usage` devolve o percentual usado e o reset de cada janela.
- **OpenCode Zen** — pay-as-you-go (saldo pré-pago). Endpoint `/zen/v1/usage`
  devolve o saldo restante em dólares.

Como ambos usam a mesma chave, o provedor unificado consulta os dois
endpoints e devolve um único objeto de conta com as janelas da assinatura
**e** o saldo do Zen.
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
OPENCODE_ZEN_BALANCE_URL = "https://opencode.ai/zen/v1/usage"
# O Cloudflare do opencode.ai bloqueia o User-Agent padrão do urllib
# (Python-urllib/3.x) com HTTP 403 Error 1010. Um User-Agent de navegador
# real contorna o bloqueio e deixa a API responder (401/200 conforme a key).
OPENCODE_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


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
    # Key OpenCode sempre começa com "sk-". Sem o prefixo, não é uma key
    # válida — rejeita em vez de aceitar um valor qualquer (ex.: placeholder).
    return None


def _usd_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return None


def opencode_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "rolling_percent": None,
        "rolling_resets_at": None,
        "weekly_percent": None,
        "weekly_resets_at": None,
        "monthly_percent": None,
        "monthly_resets_at": None,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": None,
    }


def _parse_go(data: dict[str, Any]) -> dict[str, Any]:
    usage = data.get("usage")
    if not isinstance(usage, dict):
        return {}

    def _win(name: str) -> tuple[float | None, str | None]:
        obj = usage.get(name)
        if not isinstance(obj, dict):
            return None, None
        return as_percent(obj.get("percent")), iso_or_none(obj.get("resetsAt"))

    rolling_pct, rolling_reset = _win("rolling")
    weekly_pct, weekly_reset = _win("weekly")
    monthly_pct, monthly_reset = _win("monthly")
    return {
        "rolling_percent": rolling_pct,
        "rolling_resets_at": rolling_reset,
        "weekly_percent": weekly_pct,
        "weekly_resets_at": weekly_reset,
        "monthly_percent": monthly_pct,
        "monthly_resets_at": monthly_reset,
    }


def _parse_zen(data: dict[str, Any]) -> dict[str, Any]:
    info = data.get("data") if isinstance(data.get("data"), dict) else data
    remaining_cents = _usd_cents(info.get("remaining_cents"))
    if remaining_cents is None:
        remaining_cents = _usd_cents(info.get("balance"))
    return {"remaining_cents": remaining_cents}


def parse_opencode_payload(data: dict[str, Any]) -> dict[str, Any]:
    go = _parse_go(data)
    zen = _parse_zen(data)
    has_go = any(v is not None for v in go.values())
    has_zen = zen.get("remaining_cents") is not None
    if not has_go and not has_zen:
        return opencode_fail("resposta OpenCode sem janelas de cota nem saldo")
    return {
        "ok": True,
        "error": None,
        **go,
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": zen.get("remaining_cents"),
    }


def fetch_opencode_one(raw_key: str) -> dict[str, Any]:
    key = clean_opencode_key(raw_key or "")
    if not key:
        return opencode_fail("API key inválida; cole só a chave sk-... no painel")
    combined: dict[str, Any] = {}
    for url in (OPENCODE_GO_USAGE_URL, OPENCODE_ZEN_BALANCE_URL):
        try:
            data = http_json(
                url,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Accept": "application/json",
                    "User-Agent": OPENCODE_USER_AGENT,
                },
            )
        except RuntimeError as exc:
            combined["error"] = str(exc)
            continue
        if isinstance(data, dict):
            combined.update(_parse_go(data))
            combined.update(_parse_zen(data))
    if not any(v is not None for v in combined.values()):
        return opencode_fail(combined.get("error") or "resposta OpenCode inesperada")
    return {
        "ok": True,
        "error": None,
        "rolling_percent": combined.get("rolling_percent"),
        "rolling_resets_at": combined.get("rolling_resets_at"),
        "weekly_percent": combined.get("weekly_percent"),
        "weekly_resets_at": combined.get("weekly_resets_at"),
        "monthly_percent": combined.get("monthly_percent"),
        "monthly_resets_at": combined.get("monthly_resets_at"),
        "percent": None,
        "limit_cents": None,
        "used_cents": None,
        "remaining_cents": combined.get("remaining_cents"),
    }


def fetch_opencode_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "opencode")
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
        result = fetch_opencode_one(key)
        out.append({"id": aid, "label": label, **result})
    return out
