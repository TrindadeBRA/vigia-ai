"""Datas (BRT) e números (percentual, centavos) para o payload de /usage."""

from __future__ import annotations

import re
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


def claude_utilization_percent(value: Any) -> float | None:
    """`utilization` do Claude OAuth: 0–1 (fração) ou 0–100 (pontos).

    Valores estritamente entre 0 e 1 são fração (0.42 → 42%). Demais casos já vêm
    em pontos — `1` é 1% usado, não 100% (`as_percent` multiplicaria por engano).
    """
    if value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 0:
        n = 0.0
    if 0 < n < 1:
        n = n * 100.0
    if n > 100:
        n = 100.0
    return round(n, 1)


def as_percent_points(value: Any) -> float | None:
    """Percentual que já vem em 0–100 (não fração 0–1).

    No Cursor, `autoPercentUsed: 1` é 1% usado; multiplicar vira 100% no ciclo novo.
    """
    if value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 0:
        n = 0.0
    if n > 100:
        n = 100.0
    return round(n, 1)


def ratio_percent(numerator: float, denominator: float) -> float | None:
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


def _from_unix(n: float) -> datetime:
    # Connect/proto JSON manda Timestamp em ms (13 dígitos) ou segundos (10).
    if n > 1e11:
        n = n / 1000.0
    return datetime.fromtimestamp(n, tz=timezone.utc)


def parse_when(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, dict):
        sec = pick(value.get("seconds"), value.get("secondsTime"))
        if sec is None:
            return None
        try:
            n = float(sec)
        except (TypeError, ValueError):
            return None
        nanos = value.get("nanos") or 0
        try:
            n += float(nanos) / 1e9
        except (TypeError, ValueError):
            pass
        return _from_unix(n)
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
    if isinstance(value, (int, float)) and value > 1e9:
        return _from_unix(float(value))
    return None


def iso_or_none(value: Any) -> str | None:
    """Normaliza para ISO-8601 com ano (BRT). Sem ano o countdown vira 362d."""
    if value is None:
        return None
    if isinstance(value, str) and "/" in value.strip() and "h" in value:
        return value.strip()
    dt = parse_when(value)
    if dt is None:
        s = str(value).strip() if value is not None else ""
        return s or None
    return iso_brt(dt)


def cycle_end_label(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str) and len(value.strip()) >= 5 and value.strip()[2:3] == "/":
        return value.strip()[:5]
    dt = parse_when(value)
    if dt is None:
        return None
    return tela_data_utc(dt)


def fmt_reset_when(value: Any) -> str | None:
    """Data/hora do reset no formato da tela (`04/09 03h45` ou `15/09`)."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if re.fullmatch(r"\d{2}/\d{2}(\s+\d{2}h\d{2})?", s):
        return s
    dt = parse_when(value)
    if dt is None:
        return s
    return tela_brt(dt)


def money_cents(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return int(round(n))
