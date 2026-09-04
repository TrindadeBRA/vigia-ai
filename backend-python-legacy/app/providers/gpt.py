"""Provedor GPT: OAuth do Codex CLI (ChatGPT) + contas extras coladas no painel."""

from __future__ import annotations

from typing import Any

from app.formatting import iso_or_none, pick
from app.http_util import http_json
from app.local.gpt_oauth import gpt_token_candidates, gpt_token_expired
from app.store import provider as provider_cfg

GPT_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"
GPT_USER_AGENT = "codex-cli"
SESSION_MAX_S = 8 * 3600


def gpt_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "session_percent": None,
        "session_resets_at": None,
        "weekly_percent": None,
        "weekly_resets_at": None,
        "plan": None,
    }


def _used_percent(value: Any) -> float | None:
    """WHAM devolve 0–100. Não tratar 0.5 como 50%."""
    if value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 0:
        n = 0.0
    if n > 100:
        n = 100.0
    return round(n, 1)


def _extract_window(obj: Any) -> tuple[float | None, str | None, int | None]:
    if not isinstance(obj, dict) or not obj:
        return None, None, None
    pct = _used_percent(pick(obj.get("used_percent"), obj.get("utilization"), obj.get("percent")))
    reset = iso_or_none(pick(obj.get("reset_at"), obj.get("resets_at"), obj.get("resetsAt")))
    secs_raw = pick(obj.get("limit_window_seconds"), obj.get("window_seconds"))
    secs: int | None = None
    if secs_raw is not None:
        try:
            secs = int(secs_raw)
        except (TypeError, ValueError):
            secs = None
    return pct, reset, secs


def _is_session(secs: int | None) -> bool:
    return secs is not None and 0 < secs <= SESSION_MAX_S


def parse_gpt_payload(data: dict[str, Any]) -> dict[str, Any]:
    rl = data.get("rate_limit") if isinstance(data.get("rate_limit"), dict) else data
    primary = pick(
        rl.get("primary_window") if isinstance(rl, dict) else None,
        data.get("five_hour"),
        data.get("fiveHour"),
        data.get("five_hour_limit"),
    )
    secondary = pick(
        rl.get("secondary_window") if isinstance(rl, dict) else None,
        data.get("weekly"),
        data.get("weekly_limit"),
        data.get("seven_day"),
    )

    windows: list[tuple[float | None, str | None, int | None]] = []
    for raw in (primary, secondary):
        pct, reset, secs = _extract_window(raw)
        if pct is None and reset is None and secs is None:
            continue
        windows.append((pct, reset, secs))

    session_pct: float | None = None
    session_reset: str | None = None
    weekly_pct: float | None = None
    weekly_reset: str | None = None

    for pct, reset, secs in windows:
        if session_pct is None and (secs is None or _is_session(secs)):
            session_pct, session_reset = pct, reset
            continue
        if weekly_pct is None:
            weekly_pct, weekly_reset = pct, reset
        elif session_pct is None:
            session_pct, session_reset = pct, reset

    plan = data.get("plan_type")
    plan_s = str(plan).strip() if plan else None
    if plan_s == "":
        plan_s = None

    ok = session_pct is not None or weekly_pct is not None
    return {
        "ok": ok,
        "error": None if ok else "resposta GPT sem janelas de cota",
        "session_percent": session_pct,
        "session_resets_at": session_reset,
        "weekly_percent": weekly_pct,
        "weekly_resets_at": weekly_reset,
        "plan": plan_s,
    }


def fetch_gpt_one(token: str, account_id: str | None = None) -> dict[str, Any]:
    token = (token or "").strip()
    if not token:
        return gpt_fail("sem token GPT")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": GPT_USER_AGENT,
    }
    if account_id:
        headers["ChatGPT-Account-Id"] = account_id.strip()
    try:
        data = http_json(GPT_USAGE_URL, headers=headers, provider="GPT")
    except RuntimeError as exc:
        return gpt_fail(str(exc))
    if not isinstance(data, dict):
        return gpt_fail("resposta GPT inesperada")
    parsed = parse_gpt_payload(data)
    if parsed.get("ok"):
        return parsed
    return gpt_fail(str(parsed.get("error") or "resposta GPT sem janelas de cota"))


def _fetch_gpt_local(cands: list[tuple[str, str, str | None, int | None]]) -> dict[str, Any]:
    last_err = "sem token GPT"
    for _source, token, account_id, _exp in cands:
        if gpt_token_expired(token):
            last_err = "OAuth expirado; abra o Codex neste computador (`codex login`)"
            continue
        result = fetch_gpt_one(token, account_id)
        if result.get("ok"):
            return result
        last_err = str(result.get("error") or last_err)
    return gpt_fail(last_err)


def fetch_gpt_accounts(cfg: dict) -> list[dict[str, Any]]:
    accounts: list[dict[str, Any]] = []
    p = provider_cfg(cfg, "gpt")

    if not p.get("hidden"):
        local_cands = gpt_token_candidates(cfg)
        if local_cands:
            result = _fetch_gpt_local(local_cands)
            accounts.append({"id": "local", "label": str(p.get("local_label") or ""), **result})

    extra = list(p.get("accounts") or [])
    if not extra:
        legacy = str(p.get("paste_secret") or "").strip()
        if legacy:
            extra = [{"id": "legacy", "label": "", "secret": legacy}]
    for acc in extra:
        token = str(acc.get("secret") or "").strip()
        label = str(acc.get("label") or "").strip()
        aid = str(acc.get("id") or "extra")
        result = fetch_gpt_one(token)
        accounts.append({"id": aid, "label": label, **result})
    return accounts
