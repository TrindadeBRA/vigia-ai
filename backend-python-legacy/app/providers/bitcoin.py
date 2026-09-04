"""Provedor Bitcoin: endereço de carteira (não é chave privada) + saldo on-chain + cotação."""

from __future__ import annotations

import re
import urllib.parse
from typing import Any

from app.http_util import http_json
from app.providers.coingecko import fetch_simple_price
from app.store import provider as provider_cfg

_ADDRESS_RE = re.compile(
    r"^(1[1-9A-HJ-NP-Za-km-z]{25,34}|3[1-9A-HJ-NP-Za-km-z]{25,34}|bc1[ac-hj-np-z02-9]{6,87})$"
)
_INVISIBLE = ("﻿", "​", "‌", "‍", "\xa0")

BLOCKSTREAM_ADDRESS_URL = "https://blockstream.info/api/address/"

SATS_PER_BTC = 100_000_000


def clean_bitcoin_address(raw: str) -> str | None:
    text = raw.strip()
    for ch in _INVISIBLE:
        text = text.replace(ch, "")
    text = "".join(ch for ch in text if ch.isascii())
    text = " ".join(text.split())
    if not text or " " in text:
        return None
    if not _ADDRESS_RE.match(text):
        return None
    return text


def _cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return None


def bitcoin_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "address": None,
        "balance_btc": None,
        "price_usd_cents": None,
        "price_brl_cents": None,
        "value_usd_cents": None,
        "value_brl_cents": None,
    }


def _fetch_balance_sat(address: str) -> int:
    url = BLOCKSTREAM_ADDRESS_URL + urllib.parse.quote(address, safe="")
    data = http_json(url, timeout=15.0, provider="BTC")
    if not isinstance(data, dict):
        raise RuntimeError("resposta inesperada do explorador de blocos")
    chain = data.get("chain_stats") or {}
    mempool = data.get("mempool_stats") or {}
    funded = int(chain.get("funded_txo_sum") or 0) + int(mempool.get("funded_txo_sum") or 0)
    spent = int(chain.get("spent_txo_sum") or 0) + int(mempool.get("spent_txo_sum") or 0)
    return funded - spent


def _fetch_btc_price() -> tuple[int | None, int | None]:
    data = fetch_simple_price(["bitcoin"], ["usd", "brl"], provider="BTC")
    btc = data.get("bitcoin") or {}
    return _cents(btc.get("usd")), _cents(btc.get("brl"))


def _account_from_balance(
    address: str,
    balance_sat: int,
    price_usd_cents: int | None,
    price_brl_cents: int | None,
) -> dict[str, Any]:
    balance_btc = balance_sat / SATS_PER_BTC
    value_usd_cents = (
        int(round(balance_btc * price_usd_cents)) if price_usd_cents is not None else None
    )
    value_brl_cents = (
        int(round(balance_btc * price_brl_cents)) if price_brl_cents is not None else None
    )
    return {
        "ok": True,
        "error": None,
        "address": address,
        "balance_btc": balance_btc,
        "price_usd_cents": price_usd_cents,
        "price_brl_cents": price_brl_cents,
        "value_usd_cents": value_usd_cents,
        "value_brl_cents": value_brl_cents,
    }


def fetch_bitcoin_one(raw_address: str) -> dict[str, Any]:
    address = clean_bitcoin_address(raw_address or "")
    if not address:
        return bitcoin_fail("Endereço Bitcoin inválido; cole o endereço público da carteira")
    try:
        balance_sat = _fetch_balance_sat(address)
    except RuntimeError as exc:
        return bitcoin_fail(str(exc))
    try:
        price_usd_cents, price_brl_cents = _fetch_btc_price()
    except RuntimeError as exc:
        return bitcoin_fail(str(exc))
    return _account_from_balance(address, balance_sat, price_usd_cents, price_brl_cents)


def fetch_bitcoin_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "bitcoin")
    accounts = list(p.get("accounts") or [])
    if not accounts and not p.get("hidden"):
        legacy = str(p.get("paste_secret") or "").strip()
        if legacy:
            accounts = [{"id": "legacy", "label": str(p.get("local_label") or ""), "secret": legacy}]
    cleaned_accounts: list[tuple[str, str, str | None]] = []
    need_price = False
    for acc in accounts:
        address = str(acc.get("secret") or "").strip()
        label = str(acc.get("label") or "").strip()
        aid = str(acc.get("id") or "extra")
        cleaned = clean_bitcoin_address(address)
        if cleaned:
            need_price = True
        cleaned_accounts.append((aid, label, cleaned))

    price_usd_cents: int | None = None
    price_brl_cents: int | None = None
    price_error: str | None = None
    if need_price:
        try:
            price_usd_cents, price_brl_cents = _fetch_btc_price()
        except RuntimeError as exc:
            price_error = str(exc)

    out: list[dict[str, Any]] = []
    for aid, label, address in cleaned_accounts:
        if not address:
            out.append(
                {
                    "id": aid,
                    "label": label,
                    **bitcoin_fail("Endereço Bitcoin inválido; cole o endereço público da carteira"),
                }
            )
            continue
        if price_error:
            out.append({"id": aid, "label": label, **bitcoin_fail(price_error)})
            continue
        try:
            balance_sat = _fetch_balance_sat(address)
        except RuntimeError as exc:
            out.append({"id": aid, "label": label, **bitcoin_fail(str(exc))})
            continue
        out.append(
            {"id": aid, "label": label, **_account_from_balance(address, balance_sat, price_usd_cents, price_brl_cents)}
        )
    return out
