"""Provedor Google AdSense: ganhos de hoje (estimativa) + saldo não pago.

OAuth 2.0 da conta Google (escopo adsense.readonly). Client ID/Secret e
refresh_token ficam só em config.json. Ver .agents/APIS_ADSENSE.md.
"""

from __future__ import annotations

import re
import urllib.parse
from typing import Any

from app.http_util import http_form, http_json
from app.store import provider as provider_cfg

ADSENSE_SCOPE = "https://www.googleapis.com/auth/adsense.readonly"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
ADSENSE_ACCOUNTS_URL = "https://adsense.googleapis.com/v2/accounts"
_CURRENCY_TAIL = re.compile(r"\s+([A-Z]{3})\s*$")
_DIGITS = re.compile(r"[^\d]")


def adsense_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "currency": None,
        "today_cents": None,
        "unpaid_cents": None,
        "account_name": None,
    }


def redirect_uri(port: int) -> str:
    return f"http://127.0.0.1:{int(port)}/api/oauth/adsense/callback"


def auth_url(client_id: str, port: int, state: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri(port),
        "response_type": "code",
        "scope": ADSENSE_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange_code(client_id: str, client_secret: str, port: int, code: str) -> dict[str, Any]:
    data = http_form(
        GOOGLE_TOKEN_URL,
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri(port),
            "grant_type": "authorization_code",
        },
        provider="ADSENSE",
    )
    if not isinstance(data, dict) or not data.get("refresh_token"):
        raise RuntimeError("Google não devolveu refresh_token — revogue o acesso em myaccount.google.com/permissions e entre de novo")
    return data


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    data = http_form(
        GOOGLE_TOKEN_URL,
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        provider="ADSENSE",
    )
    if not isinstance(data, dict) or not data.get("access_token"):
        raise RuntimeError("falha ao renovar o login Google — entre de novo no painel")
    return str(data["access_token"])


def parse_payment_amount(raw: str | None) -> tuple[int | None, str | None]:
    """Converte o texto da API ('R$1.234,57', '$1,234.57', '¥1,235 JPY') em centavos + ISO."""
    if not raw or not isinstance(raw, str):
        return None, None
    text = raw.strip()
    if not text:
        return None, None
    currency: str | None = None
    tail = _CURRENCY_TAIL.search(text)
    if tail:
        currency = tail.group(1)
        text = text[: tail.start()].strip()
    if text.startswith("R$") or text.startswith("r$"):
        currency = currency or "BRL"
        text = text[2:].strip()
    elif text.startswith("$"):
        currency = currency or "USD"
        text = text[1:].strip()
    elif text.startswith("£"):
        currency = currency or "GBP"
        text = text[1:].strip()
    elif text.startswith("€"):
        currency = currency or "EUR"
        text = text[1:].strip()
    elif text.startswith("¥"):
        currency = currency or "JPY"
        text = text[1:].strip()

    negative = text.startswith("-") or text.startswith("(")
    text = text.strip("()- ").replace("\xa0", "")
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            # 1.234,57
            text = text.replace(".", "").replace(",", ".")
        else:
            # 1,234.57
            text = text.replace(",", "")
    elif "," in text:
        parts = text.split(",")
        if len(parts[-1]) == 2:
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    try:
        value = float(text)
    except ValueError:
        digits = _DIGITS.sub("", raw)
        if not digits:
            return None, currency
        return (int(digits) if currency == "JPY" else int(digits)), currency
    if negative:
        value = -abs(value)
    if currency == "JPY":
        return int(round(value)), currency
    return int(round(value * 100)), currency


def parse_unpaid_payments(payload: dict[str, Any]) -> tuple[int | None, str | None]:
    payments = payload.get("payments") or []
    if not isinstance(payments, list):
        return None, None
    for item in payments:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "")
        if name.endswith("/payments/unpaid"):
            return parse_payment_amount(str(item.get("amount") or "") or None)
    return 0, None


def parse_estimated_earnings(payload: dict[str, Any]) -> tuple[int | None, str | None]:
    headers = payload.get("headers") or []
    currency = None
    if isinstance(headers, list):
        for h in headers:
            if isinstance(h, dict) and h.get("name") == "ESTIMATED_EARNINGS":
                currency = str(h.get("currencyCode") or "") or None
                break
    cells = None
    totals = payload.get("totals")
    if isinstance(totals, dict):
        cells = totals.get("cells")
    if cells is None:
        rows = payload.get("rows") or []
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            cells = rows[0].get("cells")
    if not isinstance(cells, list) or not cells:
        return 0, currency
    raw = cells[0].get("value") if isinstance(cells[0], dict) else None
    if raw is None or raw == "":
        return 0, currency
    try:
        return int(round(float(raw) * 100)), currency
    except (TypeError, ValueError):
        return None, currency


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def fetch_adsense_one(access_token: str) -> dict[str, Any]:
    try:
        accounts = http_json(ADSENSE_ACCOUNTS_URL, headers=_bearer(access_token), provider="ADSENSE")
    except RuntimeError as exc:
        return adsense_fail(str(exc))
    items = (accounts or {}).get("accounts") if isinstance(accounts, dict) else None
    if not isinstance(items, list) or not items:
        return adsense_fail("nenhuma conta AdSense nesta conta Google")
    acc = items[0] if isinstance(items[0], dict) else {}
    account_name = str(acc.get("name") or "").strip()
    display = str(acc.get("displayName") or account_name or "").strip()
    if not account_name.startswith("accounts/"):
        return adsense_fail("conta AdSense sem nome de recurso")

    unpaid_cents: int | None = None
    currency: str | None = None
    try:
        payments = http_json(
            f"https://adsense.googleapis.com/v2/{account_name}/payments", headers=_bearer(access_token), provider="ADSENSE"
        )
        if isinstance(payments, dict):
            unpaid_cents, currency = parse_unpaid_payments(payments)
    except RuntimeError as exc:
        return adsense_fail(str(exc))

    today_cents: int | None = None
    try:
        report_url = (
            f"https://adsense.googleapis.com/v2/{account_name}/reports:generate"
            "?dateRange=TODAY&metrics=ESTIMATED_EARNINGS"
        )
        report = http_json(report_url, headers=_bearer(access_token), provider="ADSENSE")
        if isinstance(report, dict):
            today_cents, report_currency = parse_estimated_earnings(report)
            currency = currency or report_currency
    except RuntimeError as exc:
        return adsense_fail(str(exc))

    return {
        "ok": True,
        "error": None,
        "currency": currency or "USD",
        "today_cents": today_cents if today_cents is not None else 0,
        "unpaid_cents": unpaid_cents if unpaid_cents is not None else 0,
        "account_name": display,
    }


def fetch_adsense_accounts(cfg: dict) -> list[dict[str, Any]]:
    p = provider_cfg(cfg, "adsense")
    if p.get("hidden"):
        return []
    refresh = str(p.get("refresh_token") or "").strip()
    client_id = str(p.get("client_id") or "").strip()
    client_secret = str(p.get("client_secret") or "").strip()
    if not refresh or not client_id or not client_secret:
        return []
    label = str(p.get("local_label") or "").strip()
    try:
        access = refresh_access_token(client_id, client_secret, refresh)
    except RuntimeError as exc:
        return [{"id": "legacy", "label": label, **adsense_fail(str(exc))}]
    result = fetch_adsense_one(access)
    return [{"id": "legacy", "label": label, **result}]
