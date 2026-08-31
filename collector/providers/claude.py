"""Provedor Claude: OAuth local + endpoint de uso não oficial da Anthropic."""

from __future__ import annotations

import time
from typing import Any

from claude_oauth import claude_token_candidates, load_claude_oauth
from formatting import as_percent, iso_or_none, pick
from http_util import http_json

CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
CLAUDE_BETA = "oauth-2025-04-20"
# Sem este UA o endpoint aplica um bucket agressivo (Python-urllib ~5 reqs → 429
# persistente). Com `claude-code/<ver>` a comunidade considera ~180 s seguro.
CLAUDE_USER_AGENT = "claude-code/2.1"


def claude_token_and_expiry() -> tuple[str | None, int | None, str | None]:
    return load_claude_oauth()


def parse_claude_payload(data: dict[str, Any]) -> dict[str, Any]:
    def _win(obj: Any) -> tuple[float | None, str | None]:
        if not isinstance(obj, dict) or not obj:
            return None, None
        return as_percent(pick(obj.get("utilization"), obj.get("percent"))), iso_or_none(
            pick(obj.get("resets_at"), obj.get("resetsAt"))
        )

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
            pct = as_percent(pick(item.get("percent"), item.get("utilization")))
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


def _claude_fail(msg: str) -> dict[str, Any]:
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


SCOPE_HINT = (
    "token sem escopo user:profile (típico de claude setup-token / oat). "
    "Apague CLAUDE_OAUTH_TOKEN no painel e use o Claude Code logado neste Mac (`claude` / /login)."
)


def _is_scope_error(msg: str) -> bool:
    low = msg.lower()
    return "user:profile" in low or "oauth_scope_insufficient" in low


def fetch_claude() -> dict[str, Any]:
    cands = claude_token_candidates()
    if not cands:
        _token, _exp, err = claude_token_and_expiry()
        return _claude_fail(err or "sem token Claude")
    last_err = "sem token Claude"
    now_ms = int(time.time() * 1000)
    for source, token, exp_ms in cands:
        if exp_ms and exp_ms < now_ms:
            last_err = "OAuth expirado; abra o Claude Code neste Mac"
            continue
        try:
            data = http_json(
                CLAUDE_USAGE_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "anthropic-beta": CLAUDE_BETA,
                    "Accept": "application/json",
                    "User-Agent": CLAUDE_USER_AGENT,
                },
            )
        except RuntimeError as exc:
            msg = str(exc)
            if _is_scope_error(msg):
                last_err = SCOPE_HINT
                continue
            last_err = msg
            continue
        if not isinstance(data, dict):
            last_err = "resposta Claude inesperada"
            continue
        parsed = parse_claude_payload(data)
        if parsed.get("ok"):
            return parsed
        last_err = str(parsed.get("error") or "resposta Claude sem janelas de cota")
    return _claude_fail(last_err)
