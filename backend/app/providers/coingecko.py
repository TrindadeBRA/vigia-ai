"""Cliente compartilhado do CoinGecko `/simple/price`.

Bitcoin e currencies dividem o mesmo bucket IP. A API *keyless* é ~10–30
chamadas/min (dinâmico) e a própria CoinGecko cacheia 1–5 min — pollar a
cada 60 s só gasta o limite. Ver https://docs.coingecko.com/docs/keyless-public-api
"""

from __future__ import annotations

import threading
import time
import urllib.parse
from collections.abc import Sequence
from typing import Any

from app.http_util import HttpError, http_json, is_rate_limit

SIMPLE_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price"

# A API pública já entrega dado de 1–5 min. 5 min = ~12 req/h, bem abaixo do teto.
TTL_S = 300
_MIN_BACKOFF_S = 120.0

_lock = threading.Condition(threading.Lock())
_inflight = False
# querystring -> (monotonic, payload)
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_backoff_until = 0.0


def reset() -> None:
    global _inflight, _backoff_until
    with _lock:
        _cache.clear()
        _inflight = False
        _backoff_until = 0.0


def _query(ids: Sequence[str], vs: Sequence[str]) -> str | None:
    clean_ids = sorted({str(i).strip().lower() for i in ids if str(i).strip()})
    clean_vs = sorted({str(v).strip().lower() for v in vs if str(v).strip()})
    if not clean_ids or not clean_vs:
        return None
    return urllib.parse.urlencode({"ids": ",".join(clean_ids), "vs_currencies": ",".join(clean_vs)})


def fetch_simple_price(ids: Sequence[str], vs_currencies: Sequence[str]) -> dict[str, Any]:
    """Devolve o JSON do CoinGecko, com TTL, coalescência e last-good em 429."""
    qs = _query(ids, vs_currencies)
    if not qs:
        return {}

    global _inflight, _backoff_until
    stale: dict[str, Any] | None = None
    with _lock:
        while True:
            now = time.monotonic()
            entry = _cache.get(qs)
            if entry is not None and (now - entry[0]) < TTL_S:
                return entry[1]
            if now < _backoff_until and entry is not None:
                return entry[1]
            if _inflight:
                _lock.wait(timeout=20.0)
                continue
            _inflight = True
            stale = entry[1] if entry is not None else None
            break

    try:
        data = http_json(f"{SIMPLE_PRICE_URL}?{qs}", timeout=15.0)
        if not isinstance(data, dict):
            raise RuntimeError("resposta inesperada da cotação")
        with _lock:
            _cache[qs] = (time.monotonic(), data)
            _backoff_until = 0.0
        return data
    except Exception as exc:  # noqa: BLE001
        if is_rate_limit(exc) and stale is not None:
            wait = _MIN_BACKOFF_S
            if isinstance(exc, HttpError) and exc.retry_after_s:
                wait = max(wait, exc.retry_after_s)
            with _lock:
                _backoff_until = time.monotonic() + wait
            return stale
        raise
    finally:
        with _lock:
            _inflight = False
            _lock.notify_all()
