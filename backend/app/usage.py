"""Monta o JSON de GET /usage (cada chamada consulta as APIs na hora)."""

from __future__ import annotations

from typing import Any

from app.formatting import utc_now
from app.providers.claude import claude_fail, fetch_claude_accounts
from app.providers.cursor import cursor_fail, fetch_cursor_accounts
from app.providers.deepseek import deepseek_fail, fetch_deepseek_accounts
from app.providers.gpt import fetch_gpt_accounts, gpt_fail
from app.providers.opencode import fetch_opencode_accounts, opencode_fail
from app.providers.openrouter import fetch_openrouter_accounts, openrouter_fail
from app.store import load, provider as provider_cfg


def mock_payload() -> dict[str, Any]:
    now = utc_now()
    return {
        "updated_at": now,
        "claude": [
            {
                "id": "local",
                "label": "",
                "ok": True,
                "error": None,
                "session_percent": 42.0,
                "session_resets_at": now,
                "weekly_percent": 18.0,
                "weekly_resets_at": now,
                "sonnet_percent": None,
                "sonnet_resets_at": None,
                "opus_percent": None,
                "opus_resets_at": None,
            }
        ],
        "gpt": [
            {
                "id": "local",
                "label": "",
                "ok": True,
                "error": None,
                "session_percent": 12.0,
                "session_resets_at": now,
                "weekly_percent": 8.0,
                "weekly_resets_at": now,
                "plan": "plus",
            }
        ],
        "cursor": [
            {
                "id": "local",
                "label": "",
                "ok": True,
                "error": None,
                "percent": 70.0,
                "other_percent": 73.0,
                "used_cents": 0,
                "limit_cents": 1000,
                "remaining_cents": 1000,
                "bonus_cents": 0,
                "cycle_end": "01/09",
                "plan": "pro",
                "requests_used": None,
                "requests_limit": None,
            }
        ],
        "openrouter": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "percent": 66.6,
                "limit_cents": 1000,
                "used_cents": 666,
                "remaining_cents": 334,
            }
        ],
        "deepseek": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "percent": 25.0,
                "limit_cents": 1000,
                "used_cents": 250,
                "remaining_cents": 750,
            }
        ],
        "opencode": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "rolling_percent": 40.0,
                "rolling_resets_at": now,
                "weekly_percent": 20.0,
                "weekly_resets_at": now,
                "monthly_percent": 10.0,
                "monthly_resets_at": now,
                "percent": None,
                "limit_cents": None,
                "used_cents": None,
                "remaining_cents": 1500,
            }
        ],
    }


def build_payload() -> dict[str, Any]:
    cfg = load()
    if cfg.get("mock"):
        payload = mock_payload()
        if provider_cfg(cfg, "claude").get("hidden"):
            payload["claude"] = []
        if provider_cfg(cfg, "gpt").get("hidden"):
            payload["gpt"] = []
        if provider_cfg(cfg, "cursor").get("hidden"):
            payload["cursor"] = []
        if provider_cfg(cfg, "openrouter").get("hidden"):
            payload["openrouter"] = []
        if provider_cfg(cfg, "deepseek").get("hidden"):
            payload["deepseek"] = []
        if provider_cfg(cfg, "opencode").get("hidden"):
            payload["opencode"] = []
        return payload
    try:
        claude = fetch_claude_accounts(cfg)
    except Exception as exc:  # noqa: BLE001
        claude = [{"id": "local", "label": "", **claude_fail(str(exc))}]
    try:
        gpt = fetch_gpt_accounts(cfg)
    except Exception as exc:  # noqa: BLE001
        gpt = [{"id": "local", "label": "", **gpt_fail(str(exc))}]
    try:
        cursor = fetch_cursor_accounts(cfg)
    except Exception as exc:  # noqa: BLE001
        cursor = [{"id": "local", "label": "", **cursor_fail(str(exc))}]
    try:
        openrouter = fetch_openrouter_accounts(cfg)
    except Exception as exc:  # noqa: BLE001
        openrouter = [{"id": "legacy", "label": "", **openrouter_fail(str(exc))}]
    try:
        deepseek = fetch_deepseek_accounts(cfg)
    except Exception as exc:  # noqa: BLE001
        deepseek = [{"id": "legacy", "label": "", **deepseek_fail(str(exc))}]
    try:
        opencode = fetch_opencode_accounts(cfg)
    except Exception as exc:  # noqa: BLE001
        opencode = [{"id": "legacy", "label": "", **opencode_fail(str(exc))}]
    return {
        "updated_at": utc_now(),
        "claude": claude,
        "gpt": gpt,
        "cursor": cursor,
        "openrouter": openrouter,
        "deepseek": deepseek,
        "opencode": opencode,
    }
