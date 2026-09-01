from __future__ import annotations

from app.alarms import evaluate


def _payload(claude_percent: float, ok: bool = True) -> dict:
    return {
        "claude": [
            {"id": "local", "label": "", "ok": ok, "error": None, "session_percent": claude_percent},
        ],
        "fal": [
            {"id": "legacy", "label": "", "ok": True, "error": None, "remaining_cents": 500},
        ],
    }


def _rule(**overrides) -> dict:
    rule = {
        "id": "r1",
        "provider": "claude",
        "account_id": "*",
        "metric": "session_percent",
        "threshold": 80.0,
        "enabled": True,
        "label": "",
    }
    rule.update(overrides)
    return rule


def test_fires_once_on_crossing() -> None:
    armed: dict[str, bool] = {}
    rules = [_rule()]

    events = evaluate(_payload(42.0), rules, armed)
    assert events == []

    events = evaluate(_payload(85.0), rules, armed)
    assert len(events) == 1
    assert events[0]["value"] == 85.0

    # continua acima do limiar: não dispara de novo
    events = evaluate(_payload(90.0), rules, armed)
    assert events == []


def test_rearms_after_dropping_below() -> None:
    armed: dict[str, bool] = {}
    rules = [_rule()]

    evaluate(_payload(85.0), rules, armed)
    events = evaluate(_payload(50.0), rules, armed)
    assert events == []  # desarma, mas descer não dispara

    events = evaluate(_payload(85.0), rules, armed)
    assert len(events) == 1  # cruzou de novo


def test_disabled_rule_never_fires() -> None:
    armed: dict[str, bool] = {}
    rules = [_rule(enabled=False)]
    events = evaluate(_payload(99.0), rules, armed)
    assert events == []


def test_failed_account_is_ignored() -> None:
    armed: dict[str, bool] = {}
    rules = [_rule()]
    events = evaluate(_payload(99.0, ok=False), rules, armed)
    assert events == []


def test_none_metric_is_ignored() -> None:
    armed: dict[str, bool] = {}
    payload = {"claude": [{"id": "local", "label": "", "ok": True, "error": None, "session_percent": None}]}
    events = evaluate(payload, [_rule()], armed)
    assert events == []


def test_cents_metric_fires_when_balance_drops() -> None:
    armed: dict[str, bool] = {}
    rules = [_rule(provider="fal", metric="remaining_cents", threshold=1000.0)]

    events = evaluate(_payload(0.0), rules, armed)  # fal remaining_cents = 500 <= 1000
    assert len(events) == 1

    events = evaluate(_payload(0.0), rules, armed)
    assert events == []  # já armado, não repete
