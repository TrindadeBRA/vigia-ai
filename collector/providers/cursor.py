"""Provedor Cursor: JWT local (conta "local", state.vscdb) + contas extras
coladas no painel, todas via Dashboard Connect RPC / auth/usage legado.
"""

from __future__ import annotations

import os
from typing import Any

from cursor_state import (
    cursor_token_and_plan,
    cursor_token_candidates,
    env_cursor_token,
    jwt_expired,
)
from formatting import as_percent, cycle_end_label, money_cents, ratio_percent
from http_util import http_json
from store import env_flag, get_accounts

CURSOR_USAGE_URL = (
    "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage"
)
CURSOR_AUTH_USAGE_URL = "https://api2.cursor.sh/auth/usage"


def parse_cursor_dashboard(data: dict[str, Any], plan: str | None) -> dict[str, Any] | None:
    usage = data.get("planUsage") or data.get("plan_usage") or {}
    if not isinstance(usage, dict):
        usage = {}
    # Painel Cursor: "Cursor Models" = auto, "Other Models" = api.
    percent = as_percent(usage.get("autoPercentUsed") or usage.get("totalPercentUsed"))
    other_percent = as_percent(usage.get("apiPercentUsed"))
    spend = data.get("spendLimitUsage") or data.get("spend_limit_usage") or {}
    if not isinstance(spend, dict):
        spend = {}
    ondemand_limit = money_cents(spend.get("individualLimit") or spend.get("limit"))
    ondemand_remain = money_cents(spend.get("individualRemaining") or spend.get("remaining"))
    ondemand_used = None
    if ondemand_limit is not None and ondemand_remain is not None:
        ondemand_used = max(0, ondemand_limit - ondemand_remain)
    elif ondemand_limit is not None:
        ondemand_used = 0
    cycle_end = cycle_end_label(
        data.get("billingCycleEnd") or data.get("billing_cycle_end") or usage.get("endDate")
    )
    if percent is None and other_percent is None and ondemand_limit is None and not cycle_end:
        return None
    return {
        "ok": percent is not None or other_percent is not None or ondemand_limit is not None,
        "error": None
        if (percent is not None or other_percent is not None or ondemand_limit is not None)
        else "planUsage sem números",
        "percent": percent,
        "other_percent": other_percent,
        "used_cents": ondemand_used,
        "limit_cents": ondemand_limit,
        "remaining_cents": ondemand_remain,
        "bonus_cents": 0,
        "cycle_end": cycle_end,
        "plan": (plan or data.get("membershipType") or "").strip() or None,
        "requests_used": None,
        "requests_limit": None,
    }


def parse_cursor_auth_usage(data: dict[str, Any], plan: str | None) -> dict[str, Any]:
    # Formato legado: { "gpt-4": { "numRequests": n, "maxRequestUsage": m }, ... }
    best_pct = None
    used = limit = None
    if isinstance(data, dict):
        for _key, bucket in data.items():
            if not isinstance(bucket, dict):
                continue
            n = bucket.get("numRequests")
            m = bucket.get("maxRequestUsage") or bucket.get("maxRequests")
            try:
                n_i, m_i = int(n), int(m) if m is not None else 0
            except (TypeError, ValueError):
                continue
            if m_i <= 0:
                continue
            pct = ratio_percent(n_i, m_i)
            if best_pct is None or (pct is not None and pct > best_pct):
                best_pct, used, limit = pct, n_i, m_i
    ok = best_pct is not None
    return {
        "ok": ok,
        "error": None if ok else "auth/usage sem buckets",
        "percent": best_pct,
        "other_percent": None,
        "used_cents": None,
        "limit_cents": None,
        "remaining_cents": None,
        "bonus_cents": None,
        "cycle_end": None,
        "plan": plan,
        "requests_used": used,
        "requests_limit": limit,
    }


def _cursor_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "percent": None,
        "other_percent": None,
        "used_cents": None,
        "limit_cents": None,
        "remaining_cents": None,
        "bonus_cents": None,
        "cycle_end": None,
        "plan": None,
        "requests_used": None,
        "requests_limit": None,
    }


def _is_auth_error(msg: str) -> bool:
    return "HTTP 401" in msg or "HTTP 403" in msg


def _fetch_cursor_with_token(token: str, plan: str | None) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "Accept": "application/json",
    }
    dash_err = "GetCurrentPeriodUsage vazio"
    try:
        data = http_json(
            CURSOR_USAGE_URL,
            method="POST",
            headers=headers,
            body=b"{}",
        )
        if isinstance(data, dict):
            parsed = parse_cursor_dashboard(data, plan)
            if parsed and parsed.get("ok"):
                return parsed
            if parsed and parsed.get("error"):
                dash_err = str(parsed["error"])
    except RuntimeError as exc:
        dash_err = str(exc)

    try:
        data = http_json(
            CURSOR_AUTH_USAGE_URL,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        if isinstance(data, dict):
            parsed = parse_cursor_auth_usage(data, plan)
            if parsed.get("ok"):
                return parsed
            return _cursor_fail(f"{dash_err}; {parsed.get('error')}")
    except RuntimeError as exc:
        return _cursor_fail(f"{dash_err}; fallback: {exc}")
    return _cursor_fail(dash_err)


def fetch_cursor_one(token: str, plan: str | None) -> dict[str, Any]:
    """Uma chamada de uso pra um token já resolvido (conta extra colada)."""
    token = (token or "").strip()
    if not token:
        return _cursor_fail("sem token Cursor")
    return _fetch_cursor_with_token(token, plan)


def _fetch_cursor_local(cands: list[tuple[str, str, str | None]]) -> dict[str, Any]:
    """Tenta cada candidato local (vscdb) até um funcionar; pula 401/403."""
    last_err = "sem JWT Cursor"
    for _source, token, plan in cands:
        if jwt_expired(token):
            last_err = "JWT expirado; abra o Cursor neste Mac"
            continue
        parsed = fetch_cursor_one(token, plan)
        if parsed.get("ok"):
            return parsed
        err = str(parsed.get("error") or "")
        last_err = err
        if _is_auth_error(err):
            continue
        return parsed
    return _cursor_fail(last_err)


def fetch_cursor_accounts() -> list[dict[str, Any]]:
    """Conta "local" (state.vscdb, se não oculta) + contas extras coladas no
    painel (`CURSOR_ACCOUNTS`)."""
    accounts: list[dict[str, Any]] = []

    if not env_flag("CURSOR_HIDDEN"):
        local_cands = [c for c in cursor_token_candidates() if c[0] != "env"]
        if local_cands:
            result = _fetch_cursor_local(local_cands)
            label = os.environ.get("CURSOR_LOCAL_LABEL", "").strip()
            accounts.append({"id": "local", "label": label, **result})

    extra = get_accounts("CURSOR_ACCOUNTS")
    if not extra:
        # Migração transparente do CURSOR_ACCESS_TOKEN colado no formato antigo.
        legacy = env_cursor_token()
        if legacy:
            extra = [{"id": "legacy", "label": "", "token": legacy}]
    for acc in extra:
        token = str(acc.get("token") or "").strip()
        label = str(acc.get("label") or "").strip()
        aid = str(acc.get("id") or "extra")
        result = fetch_cursor_one(token, None)
        accounts.append({"id": aid, "label": label, **result})

    return accounts
