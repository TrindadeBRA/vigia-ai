from __future__ import annotations

from app.providers.claude import parse_claude_payload
from app.providers.cursor import parse_cursor_dashboard
from app.providers.deepseek import parse_deepseek_payload
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
