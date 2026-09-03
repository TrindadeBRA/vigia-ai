"""Provedor Claude: OAuth local + contas extras coladas no painel."""

from __future__ import annotations

import time
from typing import Any

from app.formatting import as_percent_points, claude_utilization_percent, iso_or_none, pick
from app.http_util import http_json
from app.local.claude_oauth import claude_token_candidates
from app.store import provider as provider_cfg

CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
CLAUDE_BETA = "oauth-2025-04-20"
CLAUDE_USER_AGENT = "claude-code/2.1"

SCOPE_HINT = (
    "token sem escopo user:profile (típico de claude setup-token / oat). "
    "Apague o token colado no painel e use o Claude Code logado neste Mac (`claude` / /login)."
)


def claude_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "session_percent": None,
        "session_resets_at": None,
        "weekly_percent": None,
        "weekly_resets_at": None,
        "sonnet_percent": None,
        "sonnet_resets_at": None,
        "opus_percent": None,
        "opus_resets_at": None,
    }


def parse_claude_payload(data: dict[str, Any]) -> dict[str, Any]:
    def _win(obj: Any) -> tuple[float | None, str | None]:
        if not isinstance(obj, dict) or not obj:
            return None, None
        pct = pick(
            as_percent_points(obj.get("percent")),
            claude_utilization_percent(obj.get("utilization")),
        )
        return pct, iso_or_none(pick(obj.get("resets_at"), obj.get("resetsAt")))

    session_pct, session_reset = _win(data.get("five_hour") or data.get("fiveHour"))
    weekly_pct, weekly_reset = _win(data.get("seven_day") or data.get("sevenDay"))
    sonnet_pct, sonnet_reset = _win(data.get("seven_day_sonnet") or data.get("sevenDaySonnet"))
    opus_pct, opus_reset = _win(data.get("seven_day_opus") or data.get("sevenDayOpus"))

    limits = data.get("limits")
    if isinstance(limits, list):
        for item in limits:
            if not isinstance(item, dict):
                continue
            kind = str(item.get("kind") or "").lower()
            pct = pick(
                as_percent_points(item.get("percent")),
                claude_utilization_percent(item.get("utilization")),
            )
            reset = iso_or_none(pick(item.get("resets_at"), item.get("resetsAt")))
            if kind in ("session", "five_hour", "5h") and session_pct is None:
                session_pct, session_reset = pct, reset
            if kind in ("weekly_all", "seven_day", "weekly", "7d") and weekly_pct is None:
                weekly_pct, weekly_reset = pct, reset
            if "sonnet" in kind and sonnet_pct is None:
                sonnet_pct, sonnet_reset = pct, reset
            if "opus" in kind and opus_pct is None:
                opus_pct, opus_reset = pct, reset

    ok = any(v is not None for v in (session_pct, weekly_pct, sonnet_pct, opus_pct))
    return {
        "ok": ok,
        "error": None if ok else "resposta Claude sem janelas de cota",
        "session_percent": session_pct,
        "session_resets_at": session_reset,
        "weekly_percent": weekly_pct,
        "weekly_resets_at": weekly_reset,
        "sonnet_percent": sonnet_pct,
        "sonnet_resets_at": sonnet_reset,
        "opus_percent": opus_pct,
        "opus_resets_at": opus_reset,
    }


def _is_scope_error(msg: str) -> bool:
    low = msg.lower()
    return "user:profile" in low or "oauth_scope_insufficient" in low


def fetch_claude_one(token: str) -> dict[str, Any]:
    token = (token or "").strip()
    if not token:
        return claude_fail("sem token Claude")
    try:
        data = http_json(
            CLAUDE_USAGE_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "anthropic-beta": CLAUDE_BETA,
                "Accept": "application/json",
                "User-Agent": CLAUDE_USER_AGENT,
            },
            provider="CLAUDE",
        )
    except RuntimeError as exc:
        msg = str(exc)
        return claude_fail(SCOPE_HINT if _is_scope_error(msg) else msg)
    if not isinstance(data, dict):
        return claude_fail("resposta Claude inesperada")
    parsed = parse_claude_payload(data)
    if parsed.get("ok"):
        return parsed
    return claude_fail(str(parsed.get("error") or "resposta Claude sem janelas de cota"))


def _fetch_claude_local(cands: list[tuple[str, str, int | None]]) -> dict[str, Any]:
    last_err = "sem token Claude"
    now_ms = int(time.time() * 1000)
    for _source, token, exp_ms in cands:
        if exp_ms and exp_ms < now_ms:
            last_err = "OAuth expirado; abra o Claude Code neste Mac"
            continue
        result = fetch_claude_one(token)
        if result.get("ok"):
            return result
        last_err = str(result.get("error") or last_err)
    return claude_fail(last_err)


def fetch_claude_accounts(cfg: dict) -> list[dict[str, Any]]:
    accounts: list[dict[str, Any]] = []
    p = provider_cfg(cfg, "claude")

    if not p.get("hidden"):
        local_cands = claude_token_candidates(cfg)
        if local_cands:
            result = _fetch_claude_local(local_cands)
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
        result = fetch_claude_one(token)
        accounts.append({"id": aid, "label": label, **result})
    return accounts
