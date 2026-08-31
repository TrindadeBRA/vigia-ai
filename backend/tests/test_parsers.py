from __future__ import annotations

from app.local.gpt_oauth import parse_auth_blob
from app.providers.claude import parse_claude_payload
from app.providers.cursor import parse_cursor_dashboard
from app.providers.deepseek import parse_deepseek_payload
from app.providers.fal import parse_fal_payload
from app.providers.gpt import parse_gpt_payload
from app.providers.openrouter import parse_openrouter_payload


def test_parse_claude_windows() -> None:
    parsed = parse_claude_payload(
        {
            "five_hour": {"utilization": 0.42, "resets_at": "2026-08-31T04:00:00-03:00"},
            "seven_day": {"utilization": 18.5, "resets_at": "2026-09-04T03:00:00-03:00"},
        }
    )
    assert parsed["ok"] is True
    assert parsed["session_percent"] == 42.0
    assert parsed["weekly_percent"] == 18.5


def test_parse_gpt_plus_windows() -> None:
    parsed = parse_gpt_payload(
        {
            "plan_type": "plus",
            "rate_limit": {
                "primary_window": {
                    "used_percent": 42.0,
                    "limit_window_seconds": 18000,
                    "reset_at": 1780000000,
                },
                "secondary_window": {
                    "used_percent": 8.5,
                    "limit_window_seconds": 604800,
                    "reset_at": 1780500000,
                },
            },
        }
    )
    assert parsed["ok"] is True
    assert parsed["session_percent"] == 42.0
    assert parsed["weekly_percent"] == 8.5
    assert parsed["plan"] == "plus"
    assert parsed["session_resets_at"]
    assert parsed["weekly_resets_at"]


def test_parse_gpt_free_monthly_only() -> None:
    parsed = parse_gpt_payload(
        {
            "plan_type": "free",
            "rate_limit": {
                "primary_window": {
                    "used_percent": 0,
                    "limit_window_seconds": 2592000,
                    "reset_at": 1790795505,
                },
                "secondary_window": None,
            },
        }
    )
    assert parsed["ok"] is True
    assert parsed["session_percent"] is None
    assert parsed["weekly_percent"] == 0.0
    assert parsed["plan"] == "free"


def test_parse_gpt_used_percent_is_already_0_100() -> None:
    parsed = parse_gpt_payload(
        {
            "rate_limit": {
                "primary_window": {"used_percent": 0.5, "limit_window_seconds": 18000, "reset_at": 1780000000}
            }
        }
    )
    assert parsed["session_percent"] == 0.5


def test_parse_codex_auth_blob() -> None:
    token, account_id = parse_auth_blob(
        {"tokens": {"access_token": "tok-abc", "account_id": "acct-1", "refresh_token": "nope"}}
    )
    assert token == "tok-abc"
    assert account_id == "acct-1"


def test_parse_cursor_dashboard() -> None:
    parsed = parse_cursor_dashboard(
        {
            "planUsage": {"autoPercentUsed": 35, "apiPercentUsed": 12},
            "spendLimitUsage": {"individualLimit": 2000, "individualRemaining": 1300},
            "membershipType": "pro",
        },
        "pro",
    )
    assert parsed is not None
    assert parsed["ok"] is True
    assert parsed["percent"] == 35.0
    assert parsed["used_cents"] == 700
    assert parsed["plan"] == "pro"


def test_parse_openrouter_credits() -> None:
    parsed = parse_openrouter_payload({"data": {"total_credits": 10.0, "total_usage": 6.66}})
    assert parsed["ok"] is True
    assert parsed["limit_cents"] == 1000
    assert parsed["used_cents"] == 666
    assert parsed["remaining_cents"] == 334


def test_parse_deepseek_balance() -> None:
    parsed = parse_deepseek_payload(
        {"balance_infos": [{"currency": "USD", "total_balance": 7.5}]}
    )
    assert parsed["ok"] is True
    assert parsed["remaining_cents"] == 750
    assert parsed["percent"] is None


def test_parse_fal_billing() -> None:
    parsed = parse_fal_payload(
        {"username": "my-team", "credits": {"current_balance": 24.5, "currency": "USD"}}
    )
    assert parsed["ok"] is True
    assert parsed["remaining_cents"] == 2450
    assert parsed["percent"] is None


def test_parse_fal_billing_missing_credits() -> None:
    parsed = parse_fal_payload({"username": "my-team"})
    assert parsed["ok"] is False
