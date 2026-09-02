"""Cotação de moedas: lista livre do usuário, fiat (câmbio) + cripto (CoinGecko)."""

from __future__ import annotations

import re
import urllib.parse
from typing import Any

from app.formatting import utc_now
from app.http_util import http_json

_FIAT_RE = re.compile(r"^[A-Za-z]{3}$")
_CRYPTO_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")

COINGECKO_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price"
COINGECKO_SEARCH_URL = "https://api.coingecko.com/api/v3/search"
FOREX_URL = "https://open.er-api.com/v6/latest/"


def clean_fiat_code(raw: str) -> str | None:
    text = raw.strip().upper()
    return text if _FIAT_RE.match(text) else None


def clean_crypto_code(raw: str) -> str | None:
    text = raw.strip().lower()
    return text if _CRYPTO_RE.match(text) else None


def search_crypto(query: str, count: int = 8) -> list[dict[str, Any]]:
    """Proxy pra `GET /search` do CoinGecko — devolve id/symbol/name pro usuário escolher."""
    query = query.strip()
    if len(query) < 2:
        return []
    count = max(1, min(15, count))
    qs = urllib.parse.urlencode({"query": query})
    try:
        data = http_json(f"{COINGECKO_SEARCH_URL}?{qs}", timeout=10.0)
    except RuntimeError:
        return []
    coins = data.get("coins") if isinstance(data, dict) else None
    if not isinstance(coins, list):
        return []
    out: list[dict[str, Any]] = []
    for c in coins[:count]:
        if not isinstance(c, dict) or not c.get("id"):
            continue
        out.append(
            {
                "id": str(c["id"]),
                "symbol": str(c.get("symbol") or "").upper(),
                "name": str(c.get("name") or ""),
            }
        )
    return out


def _quote_item(
    item: dict[str, Any],
    crypto_prices: dict[str, Any],
    fiat_rates: dict[str, Any] | None,
    fiat_error: str | None,
    base: str,
) -> dict[str, Any]:
    kind = item.get("kind")
    code = str(item.get("code") or "")
    out: dict[str, Any] = {
        "id": str(item.get("id") or ""),
        "kind": kind,
        "code": code,
        "label": str(item.get("label") or ""),
        "price": None,
        "ok": False,
        "error": None,
    }
    if kind == "crypto":
        entry = crypto_prices.get(code)
        price = entry.get(base.lower()) if isinstance(entry, dict) else None
        if price is None:
            out["error"] = "cotação não encontrada"
            return out
        out["price"] = float(price)
        out["ok"] = True
        return out
    # fiat: fiat_rates vem de open.er-api.com com `base` como origem — inverte
    # pra virar "1 <code> vale quantos <base>" (o que a tela mostra).
    if code.upper() == base.upper():
        out["price"] = 1.0
        out["ok"] = True
        return out
    if fiat_error:
        out["error"] = fiat_error
        return out
    rate = (fiat_rates or {}).get(code.upper())
    if not rate:
        out["error"] = "cotação não encontrada"
        return out
    try:
        out["price"] = 1.0 / float(rate)
        out["ok"] = True
    except (TypeError, ValueError, ZeroDivisionError):
        out["error"] = "cotação inválida"
    return out


def fetch_currency_quotes(cfg_currencies: dict[str, Any]) -> dict[str, Any]:
    base = str(cfg_currencies.get("base") or "BRL").strip().upper() or "BRL"
    items = list(cfg_currencies.get("items") or [])
    if not items:
        return {"ok": True, "error": None, "updated_at": utc_now(), "base": base, "items": []}

    crypto_codes = sorted({str(i.get("code")) for i in items if i.get("kind") == "crypto" and i.get("code")})
    need_fiat = any(i.get("kind") == "fiat" and str(i.get("code") or "").upper() != base for i in items)

    crypto_prices: dict[str, Any] = {}
    if crypto_codes:
        try:
            qs = urllib.parse.urlencode({"ids": ",".join(crypto_codes), "vs_currencies": base.lower()})
            data = http_json(f"{COINGECKO_PRICE_URL}?{qs}", timeout=15.0)
            if isinstance(data, dict):
                crypto_prices = data
        except RuntimeError:
            crypto_prices = {}

    fiat_rates: dict[str, Any] | None = None
    fiat_error: str | None = None
    if need_fiat:
        try:
            data = http_json(f"{FOREX_URL}{urllib.parse.quote(base)}", timeout=15.0)
            if isinstance(data, dict) and data.get("result") == "success" and isinstance(data.get("rates"), dict):
                fiat_rates = data["rates"]
            else:
                fiat_error = "resposta inesperada da API de câmbio"
        except RuntimeError as exc:
            fiat_error = str(exc)

    quoted = [_quote_item(i, crypto_prices, fiat_rates, fiat_error, base) for i in items]
    return {"ok": True, "error": None, "updated_at": utc_now(), "base": base, "items": quoted}


def mock_currencies_payload() -> dict[str, Any]:
    now = utc_now()
    return {
        "ok": True,
        "error": None,
        "updated_at": now,
        "base": "BRL",
        "items": [
            {"id": "usd", "kind": "fiat", "code": "USD", "label": "Dólar", "price": 5.42, "ok": True, "error": None},
            {"id": "eur", "kind": "fiat", "code": "EUR", "label": "Euro", "price": 5.90, "ok": True, "error": None},
            {"id": "eth", "kind": "crypto", "code": "ethereum", "label": "Ethereum", "price": 18500.30, "ok": True, "error": None},
        ],
    }
