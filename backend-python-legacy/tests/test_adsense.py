from app.providers.adsense import parse_estimated_earnings, parse_payment_amount, parse_unpaid_payments


def test_parse_payment_amount_brl() -> None:
    cents, cur = parse_payment_amount("R$1.234,57")
    assert cents == 123457
    assert cur == "BRL"


def test_parse_payment_amount_usd() -> None:
    cents, cur = parse_payment_amount("$1,234.57")
    assert cents == 123457
    assert cur == "USD"


def test_parse_unpaid_payments() -> None:
    cents, cur = parse_unpaid_payments(
        {"payments": [{"name": "accounts/pub-1/payments/unpaid", "amount": "R$56,78"}]}
    )
    assert cents == 5678
    assert cur == "BRL"


def test_parse_estimated_earnings_totals() -> None:
    cents, cur = parse_estimated_earnings(
        {
            "headers": [{"name": "ESTIMATED_EARNINGS", "currencyCode": "BRL"}],
            "totals": {"cells": [{"value": "12.34"}]},
        }
    )
    assert cents == 1234
    assert cur == "BRL"


def test_parse_estimated_earnings_empty() -> None:
    cents, cur = parse_estimated_earnings({"headers": [], "rows": []})
    assert cents == 0
