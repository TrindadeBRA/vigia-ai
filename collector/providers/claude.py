"""Provedor Claude: OAuth local + endpoint de uso não oficial da Anthropic."""

from __future__ import annotations

import time
from typing import Any

from claude_oauth import load_claude_oauth
from formatting import as_percent, iso_or_none
from http_util import http_json

CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
CLAUDE_BETA = "oauth-2025-04-20"


def claude_token_and_expiry() -> tuple[str | None, int | None, str | None]:
    return load_claude_oauth()


def parse_claude_payload(data: dict[str, Any]) -> dict[str, Any]:
    session_pct = session_reset = weekly_pct = weekly_reset = None

    five = data.get("five_hour") or data.get("fiveHour") or {}
    seven = data.get("seven_day") or data.get("sevenDay") or {}
    if isinstance(five, dict):
        session_pct = as_percent(five.get("utilization") or five.get("percent"))
        session_reset = iso_or_none(five.get("resets_at") or five.get("resetsAt"))
    if isinstance(seven, dict):
        weekly_pct = as_percent(seven.get("utilization") or seven.get("percent"))
        weekly_reset = iso_or_none(seven.get("resets_at") or seven.get("resetsAt"))

    limits = data.get("limits")
    if isinstance(limits, list):
        for item in limits:
            if not isinstance(item, dict):
                continue
            kind = str(item.get("kind") or "").lower()
            pct = as_percent(item.get("percent") or item.get("utilization"))
            reset = iso_or_none(item.get("resets_at") or item.get("resetsAt"))
            if kind in ("session", "five_hour", "5h") and session_pct is None:
                session_pct, session_reset = pct, reset
            if kind in ("weekly_all", "seven_day", "weekly", "7d") and weekly_pct is None:
                weekly_pct, weekly_reset = pct, reset

    return {
        "ok": session_pct is not None or weekly_pct is not None,
        "error": None
        if (session_pct is not None or weekly_pct is not None)
        else "resposta Claude sem janelas de cota",
        "session_percent": session_pct,
        "session_resets_at": session_reset,
        "weekly_percent": weekly_pct,
        "weekly_resets_at": weekly_reset,
    }


def _claude_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "session_percent": None,
        "session_resets_at": None,
        "weekly_percent": None,
        "weekly_resets_at": None,
    }


def fetch_claude() -> dict[str, Any]:
    token, exp_ms, err = claude_token_and_expiry()
    if err:
        return _claude_fail(err)
    if exp_ms and exp_ms < int(time.time() * 1000):
        return _claude_fail("OAuth expirado; abra o Claude Code neste Mac")
    if not token:
        return _claude_fail("sem token Claude")
    data = http_json(
        CLAUDE_USAGE_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "anthropic-beta": CLAUDE_BETA,
            "Accept": "application/json",
        },
    )
    if not isinstance(data, dict):
        return _claude_fail("resposta Claude inesperada")
    return parse_claude_payload(data)
