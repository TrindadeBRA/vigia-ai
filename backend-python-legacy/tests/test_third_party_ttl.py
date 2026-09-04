from __future__ import annotations

import threading

import pytest

from app.http_util import HttpError
from app.providers import coingecko
from app.providers.bitcoin import fetch_bitcoin_accounts
from app.providers.coingecko import fetch_simple_price
from app.providers.currencies import fetch_currency_quotes, reset_forex_cache


@pytest.fixture(autouse=True)
def _reset_third_party() -> None:
    coingecko.reset()
    reset_forex_cache()
    yield
    coingecko.reset()
    reset_forex_cache()


def test_coingecko_ttl_one_http(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"t": 5000.0}
    monkeypatch.setattr("app.providers.coingecko.time.monotonic", lambda: clock["t"])
    calls = {"n": 0}

    def fake_http(url: str, **kwargs):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        assert "simple/price" in url
        return {"bitcoin": {"usd": 65000.0, "brl": 330000.0}}

    monkeypatch.setattr("app.providers.coingecko.http_json", fake_http)
    a = fetch_simple_price(["bitcoin"], ["usd", "brl"])
    b = fetch_simple_price(["bitcoin"], ["brl", "usd"])
    assert a == b
    assert calls["n"] == 1
    clock["t"] += 299
    fetch_simple_price(["bitcoin"], ["usd", "brl"])
    assert calls["n"] == 1
    clock["t"] += 2
    fetch_simple_price(["bitcoin"], ["usd", "brl"])
    assert calls["n"] == 2


def test_coingecko_429_returns_stale(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"t": 5000.0}
    monkeypatch.setattr("app.providers.coingecko.time.monotonic", lambda: clock["t"])
    payload = {"bitcoin": {"usd": 1.0, "brl": 5.0}}

    def ok_then_429(url: str, **kwargs):  # type: ignore[no-untyped-def]
        if ok_then_429.n == 0:  # type: ignore[attr-defined]
            ok_then_429.n = 1  # type: ignore[attr-defined]
            return payload
        raise HttpError("HTTP 429 GET https://api.coingecko.com/x: slow down", status=429)

    ok_then_429.n = 0  # type: ignore[attr-defined]
    monkeypatch.setattr("app.providers.coingecko.http_json", ok_then_429)
    assert fetch_simple_price(["bitcoin"], ["usd"]) == payload
    clock["t"] += 400
    assert fetch_simple_price(["bitcoin"], ["usd"]) == payload


def test_coingecko_parallel_coalesces(monkeypatch: pytest.MonkeyPatch) -> None:
    started = threading.Event()
    release = threading.Event()
    calls = {"n": 0}

    def slow_http(url: str, **kwargs):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        started.set()
        release.wait(timeout=2.0)
        return {"bitcoin": {"usd": 10.0}}

    monkeypatch.setattr("app.providers.coingecko.http_json", slow_http)
    results: list[dict] = []

    def worker() -> None:
        results.append(fetch_simple_price(["bitcoin"], ["usd"]))

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start()
    assert started.wait(timeout=2.0)
    t2.start()
    release.set()
    t1.join(timeout=2.0)
    t2.join(timeout=2.0)
    assert calls["n"] == 1
    assert results == [{"bitcoin": {"usd": 10.0}}, {"bitcoin": {"usd": 10.0}}]


def test_bitcoin_one_price_two_wallets(monkeypatch: pytest.MonkeyPatch) -> None:
    urls: list[str] = []

    def fake_http(url: str, **kwargs):  # type: ignore[no-untyped-def]
        urls.append(url)
        if "blockstream" in url:
            return {
                "chain_stats": {"funded_txo_sum": 100_000_000, "spent_txo_sum": 0},
                "mempool_stats": {"funded_txo_sum": 0, "spent_txo_sum": 0},
            }
        if "coingecko" in url:
            return {"bitcoin": {"usd": 65000.12, "brl": 330000.55}}
        raise AssertionError(url)

    monkeypatch.setattr("app.providers.bitcoin.http_json", fake_http)
    monkeypatch.setattr("app.providers.coingecko.http_json", fake_http)
    cfg = {
        "providers": {
            "bitcoin": {
                "hidden": False,
                "accounts": [
                    {"id": "a", "label": "um", "secret": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"},
                    {"id": "b", "label": "dois", "secret": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"},
                ],
            }
        }
    }
    out = fetch_bitcoin_accounts(cfg)
    assert len(out) == 2
    assert all(acc["ok"] for acc in out)
    gecko = [u for u in urls if "coingecko" in u]
    chain = [u for u in urls if "blockstream" in u]
    assert len(gecko) == 1
    assert len(chain) == 2


def test_forex_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"t": 8000.0}
    monkeypatch.setattr("app.providers.currencies.time.monotonic", lambda: clock["t"])
    calls = {"n": 0}

    def fake_http(url: str, **kwargs):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        if "er-api" in url:
            return {"result": "success", "rates": {"USD": 0.2, "BRL": 1.0}}
        raise AssertionError(url)

    monkeypatch.setattr("app.providers.currencies.http_json", fake_http)
    monkeypatch.setattr(
        "app.providers.currencies.fetch_simple_price",
        lambda ids, vs: {},
    )
    cfg = {"base": "BRL", "items": [{"id": "usd", "kind": "fiat", "code": "USD", "label": "Dólar"}]}
    a = fetch_currency_quotes(cfg)
    b = fetch_currency_quotes(cfg)
    assert a["items"][0]["ok"] is True
    assert b["items"][0]["price"] == pytest.approx(5.0)
    assert calls["n"] == 1
    clock["t"] += 3601
    fetch_currency_quotes(cfg)
    assert calls["n"] == 2
