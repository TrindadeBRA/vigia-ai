"""TTL por fonte + last-good. O hub continua a 60 s; cada API só é batida quando vence.

SSE e `/display`/firmware não mudam: o snapshot vai a cada `USAGE_INTERVAL_S`.
O que muda é *quando* o coletor gasta a cota de um terceiro (CoinGecko, AdSense, clima).
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any

from app.http_util import is_rate_limit, result_is_rate_limited, retry_after_s
from app.store import provider as provider_cfg

# Intervalo mínimo entre chamadas *reais*. Cotas de assinatura acompanham o hub.
# Mercado/clima mudam devagar e as APIs públicas 429am se marteladas no mesmo ritmo.
TTL_S: dict[str, int] = {
    "claude": 60,
    "gpt": 60,
    "cursor": 60,
    "openrouter": 60,
    "deepseek": 60,
    "opencode": 60,
    "fal": 60,
    "bitcoin": 60,  # Blockstream; a cotação CoinGecko tem TTL próprio (5 min)
    "adsense": 300,
    "weather": 600,
    "currencies": 60,  # forex/CoinGecko têm TTL próprio dentro do provedor
}

# GET /usage força cotas na hora. Mercado/clima nunca — 429 não se resolve martelando.
FORCEABLE = frozenset(
    {
        "claude",
        "gpt",
        "cursor",
        "openrouter",
        "deepseek",
        "opencode",
        "fal",
    }
)

_DEFAULT_TTL_S = 60
_MIN_BACKOFF_S = 60.0


class RefreshCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fresh_at: dict[str, float] = {}
        self._value: dict[str, Any] = {}
        self._fingerprint: dict[str, str] = {}
        self._backoff_until: dict[str, float] = {}

    def reset(self) -> None:
        with self._lock:
            self._fresh_at.clear()
            self._value.clear()
            self._fingerprint.clear()
            self._backoff_until.clear()

    def get(self, name: str) -> Any | None:
        with self._lock:
            return self._value.get(name)

    def due(self, name: str, *, fingerprint: str = "", force: bool = False) -> bool:
        now = time.monotonic()
        ttl = TTL_S.get(name, _DEFAULT_TTL_S)
        with self._lock:
            if now < self._backoff_until.get(name, 0.0):
                return False
            if self._fingerprint.get(name) != fingerprint:
                return True
            if force and name in FORCEABLE:
                return True
            last = self._fresh_at.get(name)
            if last is None:
                return True
            return (now - last) >= ttl

    def store(self, name: str, value: Any, *, fingerprint: str = "") -> None:
        with self._lock:
            self._value[name] = value
            self._fresh_at[name] = time.monotonic()
            self._fingerprint[name] = fingerprint
            self._backoff_until.pop(name, None)

    def note_rate_limit(self, name: str, retry_after: float | None, value: Any | None = None) -> None:
        ttl = float(TTL_S.get(name, _DEFAULT_TTL_S))
        wait = max(_MIN_BACKOFF_S, retry_after or ttl)
        with self._lock:
            self._backoff_until[name] = time.monotonic() + wait
            if value is not None and name not in self._value:
                self._value[name] = value

    def take(self, name: str, value: Any, *, fingerprint: str = "", error: BaseException | str | None = None) -> Any:
        """Guarda sucesso, ou last-good em 429; devolve o que o payload deve usar."""
        limited = is_rate_limit(error) or result_is_rate_limited(value)
        if limited:
            previous = self.get(name)
            self.note_rate_limit(name, retry_after_s(error or value), value=value)
            return previous if previous is not None else value
        self.store(name, value, fingerprint=fingerprint)
        return value


def fingerprint(cfg: dict[str, Any], name: str) -> str:
    """Muda quando a config da fonte muda — evita servir cache de outra carteira/cidade."""
    if name in ("weather", "currencies"):
        blob: Any = cfg.get(name) or {}
    else:
        blob = provider_cfg(cfg, name)
    try:
        return json.dumps(blob, sort_keys=True, default=str)
    except TypeError:
        return str(blob)


cache = RefreshCache()
