from __future__ import annotations

from app.alarms import evaluate, format_alarm_notification


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


def test_evaluate_includes_resets_at() -> None:
    armed: dict[str, bool] = {}
    payload = {
        "claude": [
            {
                "id": "local",
                "label": "",
                "ok": True,
                "error": None,
                "weekly_percent": 37.0,
                "weekly_resets_at": "04/09 03h45",
            }
        ]
    }
    events = evaluate(payload, [_rule(metric="weekly_percent", threshold=25.0)], armed)
    assert len(events) == 1
    assert events[0]["resets_at"] == "04/09 03h45"


def test_format_alarm_notification_percent() -> None:
    event = {
        "rule": _rule(threshold=25.0, metric="weekly_percent", label="Claude quase no teto"),
        "provider": "claude",
        "account_id": "local",
        "account_label": "Pessoal",
        "value": 37.0,
        "resets_at": "04/09 03h45",
    }
    text = format_alarm_notification(event)
    assert text == (
        "⚠️ <b>Claude</b>\n"
        "\n"
        "📊 Uso de <b>25% da cota Semana</b>\n"
        "🕐 Reset em <b>04/09 03h45</b>"
    )


def test_format_alarm_notification_without_reset() -> None:
    event = {
        "rule": _rule(threshold=25.0, metric="weekly_percent"),
        "provider": "claude",
        "account_id": "local",
        "account_label": "",
        "value": 37.0,
    }
    text = format_alarm_notification(event)
    assert text == "⚠️ <b>Claude</b>\n\n📊 Uso de <b>25% da cota Semana</b>"


def test_format_alarm_notification_balance() -> None:
    event = {
        "rule": {
            "id": "r2",
            "provider": "fal",
            "account_id": "*",
            "metric": "remaining_cents",
            "threshold": 1000.0,
            "enabled": True,
            "label": "",
        },
        "provider": "fal",
        "account_id": "legacy",
        "account_label": "",
        "value": 500.0,
    }
    text = format_alarm_notification(event)
    assert text == "⚠️ <b>fal.ai</b>\n\n💰 Saldo de <b>$10.00 da cota Saldo restante</b>"


def test_format_alarm_notification_escapes_html() -> None:
    event = {
        "rule": _rule(provider="cursor", metric="percent", label="<script>", threshold=10.0),
        "provider": "cursor",
        "account_id": "local",
        "account_label": "A & B",
        "value": 5.0,
    }
    text = format_alarm_notification(event)
    assert text == "⚠️ <b>Cursor</b>\n\n📊 Uso de <b>10% da cota Uso do plano</b>"
    assert "<script>" not in text
