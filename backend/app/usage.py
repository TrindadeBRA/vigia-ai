"""Monta o JSON de GET /usage (cada chamada consulta as APIs na hora)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from app.formatting import utc_now
from app.providers.claude import claude_fail, fetch_claude_accounts
from app.providers.cursor import cursor_fail, fetch_cursor_accounts
from app.providers.deepseek import deepseek_fail, fetch_deepseek_accounts
from app.providers.fal import fal_fail, fetch_fal_accounts
from app.providers.gpt import fetch_gpt_accounts, gpt_fail
from app.providers.opencode_go import fetch_opencode_go_accounts, opencode_go_fail
from app.providers.opencode_zen import fetch_opencode_zen_accounts, opencode_zen_fail
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
        "opencode_go": [
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
            }
        ],
        "opencode_zen": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "percent": None,
                "limit_cents": None,
                "used_cents": None,
                "remaining_cents": 1500,
            }
        ],
        "fal": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "percent": None,
                "limit_cents": None,
                "used_cents": None,
                "remaining_cents": 2450,
            }
        ],
    }


# (chave, fetch_*_accounts, *_fail, id de fallback quando a lista falha inteira)
# — cada provedor faz sua própria chamada de rede bloqueante; ver _fetch_one().
_PROVIDER_JOBS: list[tuple[str, Callable[[dict], list[dict[str, Any]]], Callable[[str], dict[str, Any]], str]] = [
    ("claude", fetch_claude_accounts, claude_fail, "local"),
    ("gpt", fetch_gpt_accounts, gpt_fail, "local"),
    ("cursor", fetch_cursor_accounts, cursor_fail, "local"),
    ("openrouter", fetch_openrouter_accounts, openrouter_fail, "legacy"),
    ("deepseek", fetch_deepseek_accounts, deepseek_fail, "legacy"),
    ("opencode_go", fetch_opencode_go_accounts, opencode_go_fail, "legacy"),
    ("opencode_zen", fetch_opencode_zen_accounts, opencode_zen_fail, "legacy"),
    ("fal", fetch_fal_accounts, fal_fail, "legacy"),
]


def _fetch_one(
    name: str,
    fetch_fn: Callable[[dict], list[dict[str, Any]]],
    fail_fn: Callable[[str], dict[str, Any]],
    fallback_id: str,
    cfg: dict,
) -> tuple[str, list[dict[str, Any]]]:
    try:
        return name, fetch_fn(cfg)
    except Exception as exc:  # noqa: BLE001
        return name, [{"id": fallback_id, "label": "", **fail_fn(str(exc))}]


def build_payload() -> dict[str, Any]:
    cfg = load()
    if cfg.get("mock"):
        payload = mock_payload()
        for name, *_rest in _PROVIDER_JOBS:
            if provider_cfg(cfg, name).get("hidden"):
                payload[name] = []
        return payload
    # Cada provedor é uma chamada de rede bloqueante independente (ver
    # app/http_util.py, timeout de 20s por request) — rodar em paralelo evita
    # que N provedores lentos somem suas latências uma atrás da outra, o que
    # já estourou o timeout de /health do `./dev` script no boot com 8
    # provedores sequenciais.
    with ThreadPoolExecutor(max_workers=len(_PROVIDER_JOBS)) as pool:
        futures = [pool.submit(_fetch_one, name, fetch_fn, fail_fn, fallback_id, cfg)
                   for name, fetch_fn, fail_fn, fallback_id in _PROVIDER_JOBS]
        results = dict(future.result() for future in futures)
    return {"updated_at": utc_now(), **results}
