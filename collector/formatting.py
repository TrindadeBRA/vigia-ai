"""Formatação de datas (BRT) e números (percentual, centavos) para o payload de /usage."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

BRT = ZoneInfo("America/Sao_Paulo")


def iso_brt(dt: datetime | None = None) -> str:
    if dt is None:
        dt = datetime.now(BRT)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(BRT)
    else:
        dt = dt.astimezone(BRT)
    off = dt.strftime("%z")
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + f"{off[:3]}:{off[3:]}"


def tela_brt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BRT).strftime("%d/%m %Hh%M")


def utc_now() -> str:
    return iso_brt()


def pick(*values: Any) -> Any:
    """Primeiro valor que não é None. 0 e 0.0 contam (não use `or` em percentuais)."""
    for v in values:
        if v is not None:
            return v
    return None


def as_percent(value: Any) -> float | None:
    if value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 0:
        n = 0.0
    if 0 <= n <= 1.5:
        n = n * 100.0
    if n > 100:
        n = 100.0
    return round(n, 1)


def ratio_percent(numerator: float, denominator: float) -> float | None:
    """Percentual 0-100 a partir de uma razão que o próprio chamador já calculou
    (numerator/denominator), sem a ambiguidade 0-1 vs 0-100 do `as_percent`.

    Não use `as_percent(x * 100.0)` para isso: se x*100.0 cair em 0-1.5 (ex.: 0,5%
    de uso), `as_percent` acha que é fração 0-1 e multiplica de novo por 100,
    virando 50%.
    """
    if not denominator:
        return None
    pct = (numerator / denominator) * 100.0
    if pct < 0:
        pct = 0.0
    if pct > 100:
        pct = 100.0
    return round(pct, 1)


def tela_data_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%d/%m")


def parse_when(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if s.isdigit():
            value = int(s)
        elif s.replace(".", "", 1).isdigit():
            value = float(s)
        else:
            try:
                return datetime.fromisoformat(s.replace("Z", "+00:00"))
            except ValueError:
                return None
    if isinstance(value, (int, float)) and value > 1e11:
        return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
    if isinstance(value, (int, float)) and value > 1e9:
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    return None


def iso_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str) and "/" in value.strip() and "h" in value:
        return value.strip()
    dt = parse_when(value)
    if dt is None:
        s = str(value).strip() if value is not None else ""
        return s or None
    return tela_brt(dt)


def cycle_end_label(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str) and len(value.strip()) >= 5 and value.strip()[2:3] == "/":
        return value.strip()[:5]
    dt = parse_when(value)
    if dt is None:
        return None
    return tela_data_utc(dt)


def money_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return int(round(n))
