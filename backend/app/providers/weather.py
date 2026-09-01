"""Provedor Weather: Open-Meteo Forecast + Geocoding (sem API key)."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

from app.formatting import utc_now
from app.http_util import http_json
from app.store import load as load_config

# ── Constantes Open-Meteo ─────────────────────────────────────────────

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

# Todas as variáveis disponíveis no Open-Meteo Forecast
# (usadas para validar o que o usuário escolhe no painel)
VALID_CURRENT = {
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature",
    "precipitation", "rain", "showers", "snowfall", "weather_code", "cloud_cover",
    "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
    "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "wind_speed_80m", "wind_direction_80m",
    "wind_speed_120m", "wind_direction_120m",
    "wind_speed_180m", "wind_direction_180m",
    "visibility", "evapotranspiration", "et0_fao_evapotranspiration",
    "vapour_pressure_deficit", "cape",
    "is_day", "sunshine_duration",
    "shortwave_radiation", "direct_radiation", "diffuse_radiation",
    "direct_normal_irradiance", "global_tilted_irradiance",
    "snow_depth", "freezing_level_height",
    "soil_temperature_0cm", "soil_temperature_6cm", "soil_temperature_18cm", "soil_temperature_54cm",
    "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm", "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm", "soil_moisture_27_to_81cm",
    "uv_index", "uv_index_clear_sky",
}

VALID_HOURLY = VALID_CURRENT | {
    "precipitation_probability", "temperature_80m", "temperature_120m", "temperature_180m",
    "snowfall_height",
}

VALID_DAILY = {
    "weather_code",
    "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
    "apparent_temperature_max", "apparent_temperature_min", "apparent_temperature_mean",
    "precipitation_sum", "rain_sum", "showers_sum", "snowfall_sum",
    "precipitation_hours", "precipitation_probability_max", "precipitation_probability_min", "precipitation_probability_mean",
    "sunrise", "sunset", "daylight_duration", "sunshine_duration",
    "wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant",
    "shortwave_radiation_sum", "et0_fao_evapotranspiration",
    "uv_index_max", "uv_index_clear_sky_max",
}

VALID_TEMPERATURE_UNITS = {"celsius", "fahrenheit"}
VALID_WIND_UNITS = {"kmh", "ms", "mph", "kn"}
VALID_PRECIPITATION_UNITS = {"mm", "inch"}

# WMO Weather codes → descrição curta
WMO_DESCRIPTIONS: dict[int, str] = {
    0: "Céu limpo",
    1: "Predominantemente limpo",
    2: "Parcialmente nublado",
    3: "Encoberto",
    45: "Nevoeiro",
    48: "Nevoeiro com geada",
    51: "Chuvisco fraco",
    53: "Chuvisco moderado",
    55: "Chuvisco forte",
    56: "Chuvisco congelante fraco",
    57: "Chuvisco congelante forte",
    61: "Chuva fraca",
    63: "Chuva moderada",
    65: "Chuva forte",
    66: "Chuva congelante fraca",
    67: "Chuva congelante forte",
    71: "Neve fraca",
    73: "Neve moderada",
    75: "Neve forte",
    77: "Grãos de neve",
    80: "Pancadas de chuva fracas",
    81: "Pancadas de chuva moderadas",
    82: "Pancadas de chuva fortes",
    85: "Pancadas de neve fracas",
    86: "Pancadas de neve fortes",
    95: "Trovoada",
    96: "Trovoada com granizo fraco",
    99: "Trovoada com granizo forte",
}

WMO_ICONS: dict[int, str] = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
    71: "🌨️", 73: "🌨️", 75: "❄️", 77: "❄️",
    80: "🌦️", 81: "🌦️", 82: "⛈️", 85: "🌨️", 86: "❄️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
}


def wmo_description(code: int | None) -> str:
    if code is None:
        return ""
    return WMO_DESCRIPTIONS.get(code, f"Código {code}")


def wmo_icon(code: int | None) -> str:
    if code is None:
        return "🌡️"
    return WMO_ICONS.get(code, "🌡️")


# ── Helpers ───────────────────────────────────────────────────────────

def _sanitize_list(values: list[str], valid: set[str]) -> list[str]:
    """Filtra lista mantendo só valores válidos, sem duplicatas, preservando ordem."""
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        s = str(v).strip()
        if s in valid and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def weather_fail(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": msg,
        "updated_at": utc_now(),
        "latitude": None,
        "longitude": None,
        "elevation": None,
        "timezone": None,
        "timezone_abbreviation": None,
        "utc_offset_seconds": None,
        "current": None,
        "current_units": None,
        "hourly": None,
        "hourly_units": None,
        "daily": None,
        "daily_units": None,
        "location": None,
        "units": None,
    }


def _build_forecast_url(cfg_weather: dict[str, Any]) -> str:
    loc = cfg_weather.get("location") or {}
    units = cfg_weather.get("units") or {}
    lat = loc.get("latitude")
    lon = loc.get("longitude")
    if lat is None or lon is None:
        raise ValueError("Localização não configurada (latitude/longitude)")

    params: dict[str, str] = {
        "latitude": str(lat),
        "longitude": str(lon),
        "timezone": str(cfg_weather.get("timezone") or loc.get("timezone") or "auto"),
        "temperature_unit": str(units.get("temperature_unit") or "celsius"),
        "wind_speed_unit": str(units.get("wind_speed_unit") or "kmh"),
        "precipitation_unit": str(units.get("precipitation_unit") or "mm"),
        "forecast_days": str(cfg_weather.get("forecast_days") or 7),
        "past_days": str(cfg_weather.get("past_days") or 0),
    }
    # elevation opcional
    elev = loc.get("elevation")
    if elev is not None:
        params["elevation"] = str(elev)

    # current / hourly / daily
    current = _sanitize_list(cfg_weather.get("current") or [], VALID_CURRENT)
    hourly = _sanitize_list(cfg_weather.get("hourly") or [], VALID_HOURLY)
    daily = _sanitize_list(cfg_weather.get("daily") or [], VALID_DAILY)

    # Se nada selecionado, usa defaults
    if not current:
        current = ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "weather_code", "wind_speed_10m", "precipitation"]
    if not hourly:
        hourly = ["temperature_2m", "precipitation_probability", "weather_code"]
    if not daily:
        daily = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum"]

    params["current"] = ",".join(current)
    params["hourly"] = ",".join(hourly)
    params["daily"] = ",".join(daily)

    qs = urllib.parse.urlencode(params)
    return f"{FORECAST_URL}?{qs}"


def fetch_weather_data(cfg_weather: dict[str, Any] | None = None) -> dict[str, Any]:
    """Busca dados do Open-Meteo Forecast. Retorna dict compatível com WeatherPayload."""
    if cfg_weather is None:
        cfg = load_config()
        cfg_weather = cfg.get("weather") or {}

    if not cfg_weather.get("enabled"):
        return {
            "ok": True,
            "error": None,
            "updated_at": None,
            "latitude": None,
            "longitude": None,
            "elevation": None,
            "timezone": None,
            "timezone_abbreviation": None,
            "utc_offset_seconds": None,
            "current": None,
            "current_units": None,
            "hourly": None,
            "hourly_units": None,
            "daily": None,
            "daily_units": None,
            "location": cfg_weather.get("location"),
            "units": cfg_weather.get("units"),
        }

    loc = cfg_weather.get("location") or {}
    if loc.get("latitude") is None or loc.get("longitude") is None:
        return weather_fail("Configure a cidade nas configurações de clima")

    try:
        url = _build_forecast_url(cfg_weather)
    except ValueError as exc:
        return weather_fail(str(exc))

    try:
        data = http_json(url, timeout=15.0)
    except RuntimeError as exc:
        return weather_fail(str(exc))

    if not isinstance(data, dict):
        return weather_fail("Resposta inesperada do Open-Meteo")

    if data.get("error"):
        return weather_fail(str(data.get("reason") or "Erro do Open-Meteo"))

    # Monta payload
    return {
        "ok": True,
        "error": None,
        "updated_at": utc_now(),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "elevation": data.get("elevation"),
        "timezone": data.get("timezone"),
        "timezone_abbreviation": data.get("timezone_abbreviation"),
        "utc_offset_seconds": data.get("utc_offset_seconds"),
        "current": data.get("current"),
        "current_units": data.get("current_units"),
        "hourly": data.get("hourly"),
        "hourly_units": data.get("hourly_units"),
        "daily": data.get("daily"),
        "daily_units": data.get("daily_units"),
        "location": cfg_weather.get("location"),
        "units": cfg_weather.get("units"),
    }


def mock_weather_payload() -> dict[str, Any]:
    """Payload de exemplo para modo mock."""
    now = utc_now()
    return {
        "ok": True,
        "error": None,
        "updated_at": now,
        "latitude": -23.5505,
        "longitude": -46.6333,
        "elevation": 760,
        "timezone": "America/Sao_Paulo",
        "timezone_abbreviation": "BRT",
        "utc_offset_seconds": -10800,
        "current": {
            "time": now,
            "interval": 900,
            "temperature_2m": 26.5,
            "relative_humidity_2m": 65,
            "apparent_temperature": 28.1,
            "is_day": 1,
            "precipitation": 0.0,
            "weather_code": 2,
            "cloud_cover": 40,
            "pressure_msl": 1013.2,
            "wind_speed_10m": 12.3,
            "wind_direction_10m": 180,
            "wind_gusts_10m": 18.5,
        },
        "current_units": {
            "temperature_2m": "°C",
            "relative_humidity_2m": "%",
            "apparent_temperature": "°C",
            "precipitation": "mm",
            "wind_speed_10m": "km/h",
        },
        "hourly": {
            "time": [now, now, now, now, now, now, now, now, now, now, now, now],
            "temperature_2m": [26.5, 27.0, 27.5, 28.0, 27.8, 27.0, 26.0, 25.0, 24.0, 23.5, 23.0, 22.8],
            "precipitation_probability": [10, 15, 20, 30, 40, 35, 20, 10, 5, 5, 10, 15],
            "weather_code": [2, 2, 3, 3, 80, 80, 2, 1, 1, 0, 0, 1],
            "wind_speed_10m": [12.3, 13.0, 14.0, 15.0, 14.5, 13.0, 12.0, 11.0, 10.0, 9.5, 9.0, 10.0],
        },
        "hourly_units": {
            "temperature_2m": "°C",
            "precipitation_probability": "%",
            "wind_speed_10m": "km/h",
        },
        "daily": {
            "time": ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"],
            "weather_code": [2, 3, 80, 61, 1, 0, 2],
            "temperature_2m_max": [28.5, 27.0, 26.0, 24.5, 26.0, 28.0, 29.0],
            "temperature_2m_min": [18.0, 17.5, 17.0, 16.0, 16.5, 17.0, 18.5],
            "precipitation_sum": [0.0, 2.3, 8.5, 12.0, 0.5, 0.0, 0.0],
            "precipitation_probability_max": [20, 60, 80, 90, 30, 10, 15],
            "wind_speed_10m_max": [15.0, 18.0, 20.0, 16.0, 14.0, 12.0, 13.0],
            "sunrise": ["2026-09-01T06:15", "2026-09-02T06:14", "2026-09-03T06:13", "2026-09-04T06:12", "2026-09-05T06:11", "2026-09-06T06:10", "2026-09-07T06:09"],
            "sunset": ["2026-09-01T18:05", "2026-09-02T18:05", "2026-09-03T18:06", "2026-09-04T18:06", "2026-09-05T18:07", "2026-09-06T18:07", "2026-09-07T18:08"],
            "uv_index_max": [6.5, 5.0, 3.2, 2.8, 5.5, 7.0, 6.8],
        },
        "daily_units": {
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
            "wind_speed_10m_max": "km/h",
        },
        "location": {
            "name": "São Paulo",
            "latitude": -23.5505,
            "longitude": -46.6333,
            "country": "Brasil",
            "country_code": "BR",
            "timezone": "America/Sao_Paulo",
        },
        "units": {
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        },
    }


def search_cities(query: str, count: int = 5, language: str = "pt") -> dict[str, Any]:
    """Busca cidades via Geocoding API do Open-Meteo."""
    query = query.strip()
    if not query or len(query) < 2:
        return {"results": []}
    count = max(1, min(10, count))
    params = {
        "name": query,
        "count": str(count),
        "language": language,
        "format": "json",
    }
    qs = urllib.parse.urlencode(params)
    url = f"{GEOCODING_URL}?{qs}"
    try:
        data = http_json(url, timeout=10.0)
    except RuntimeError as exc:
        raise RuntimeError(f"Busca de cidade falhou: {exc}") from exc
    if not isinstance(data, dict):
        return {"results": []}
    return data
