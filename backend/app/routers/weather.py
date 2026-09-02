"""Rotas de clima (Open-Meteo): geocoding, config e dados."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.providers.weather import (
    VALID_CURRENT,
    VALID_DAILY,
    VALID_HOURLY,
    VALID_PRECIPITATION_UNITS,
    VALID_TEMPERATURE_UNITS,
    VALID_WIND_UNITS,
    fetch_weather_data,
    mock_weather_payload,
    search_cities,
)
from app.schemas import WeatherConfig, WeatherGeocodingResponse, WeatherPatch, WeatherPayload
from app.store import load, update

router = APIRouter(prefix="/api/weather", tags=["weather"])


def _weather_config_public() -> WeatherConfig:
    cfg = load()
    raw = cfg.get("weather") or {}
    # Normaliza via store (já faz) e valida via Pydantic
    return WeatherConfig.model_validate(raw)


@router.get(
    "/config",
    response_model=WeatherConfig,
    summary="Configuração de clima",
)
def get_weather_config() -> WeatherConfig:
    return _weather_config_public()


@router.patch(
    "/config",
    response_model=WeatherConfig,
    summary="Atualiza configuração de clima",
)
def patch_weather_config(body: WeatherPatch) -> WeatherConfig:
    # Validações
    if body.temperature_unit is not None and body.temperature_unit not in VALID_TEMPERATURE_UNITS:
        raise HTTPException(400, f"temperature_unit inválido: {body.temperature_unit}")
    if body.wind_speed_unit is not None and body.wind_speed_unit not in VALID_WIND_UNITS:
        raise HTTPException(400, f"wind_speed_unit inválido: {body.wind_speed_unit}")
    if body.precipitation_unit is not None and body.precipitation_unit not in VALID_PRECIPITATION_UNITS:
        raise HTTPException(400, f"precipitation_unit inválido: {body.precipitation_unit}")
    if body.current is not None:
        invalid = [x for x in body.current if x not in VALID_CURRENT]
        if invalid:
            raise HTTPException(400, f"current inválido: {', '.join(invalid)}")
    if body.hourly is not None:
        invalid = [x for x in body.hourly if x not in VALID_HOURLY]
        if invalid:
            raise HTTPException(400, f"hourly inválido: {', '.join(invalid)}")
    if body.daily is not None:
        invalid = [x for x in body.daily if x not in VALID_DAILY]
        if invalid:
            raise HTTPException(400, f"daily inválido: {', '.join(invalid)}")

    def mut(cfg: dict[str, Any]) -> None:
        w = cfg.setdefault("weather", {})
        loc = w.setdefault("location", {})
        units = w.setdefault("units", {})
        disp = w.setdefault("display", {})
        fields = disp.setdefault("fields", {})

        if body.enabled is not None:
            w["enabled"] = body.enabled
            w["hidden"] = not body.enabled
        elif body.hidden is not None:
            w["hidden"] = body.hidden
            w["enabled"] = not body.hidden
        if body.name is not None:
            loc["name"] = body.name.strip()
        if body.latitude is not None:
            loc["latitude"] = body.latitude
        if body.longitude is not None:
            loc["longitude"] = body.longitude
        if body.country is not None:
            loc["country"] = body.country.strip()
        if body.country_code is not None:
            loc["country_code"] = body.country_code.strip()
        if body.timezone is not None:
            loc["timezone"] = body.timezone.strip() or "auto"
            w["timezone"] = body.timezone.strip() or "auto"
        if body.elevation is not None:
            loc["elevation"] = body.elevation
        if body.temperature_unit is not None:
            units["temperature_unit"] = body.temperature_unit
        if body.wind_speed_unit is not None:
            units["wind_speed_unit"] = body.wind_speed_unit
        if body.precipitation_unit is not None:
            units["precipitation_unit"] = body.precipitation_unit
        if body.forecast_days is not None:
            w["forecast_days"] = body.forecast_days
        if body.past_days is not None:
            w["past_days"] = body.past_days
        if body.current is not None:
            w["current"] = body.current
        if body.hourly is not None:
            w["hourly"] = body.hourly
        if body.daily is not None:
            w["daily"] = body.daily
        if body.display_show_current is not None:
            disp["show_current"] = body.display_show_current
        if body.display_show_hourly is not None:
            disp["show_hourly"] = body.display_show_hourly
        if body.display_show_daily is not None:
            disp["show_daily"] = body.display_show_daily
        if body.display_hourly_count is not None:
            disp["hourly_count"] = body.display_hourly_count
        if body.display_daily_count is not None:
            disp["display_daily_count"] = body.display_daily_count
            disp["daily_count"] = body.display_daily_count
        if body.display_fields is not None:
            for k, v in body.display_fields.items():
                if k in fields:
                    fields[k] = bool(v)

    update(mut)
    return _weather_config_public()


@router.get(
    "/geocoding",
    response_model=WeatherGeocodingResponse,
    summary="Busca cidades (proxy Geocoding Open-Meteo)",
)
def geocoding_search(
    q: str = Query(..., min_length=2, description="Nome da cidade"),
    count: int = Query(5, ge=1, le=10),
    language: str = Query("pt"),
) -> WeatherGeocodingResponse:
    try:
        data = search_cities(q, count=count, language=language)
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    return WeatherGeocodingResponse.model_validate(data)


@router.get(
    "",
    response_model=WeatherPayload,
    summary="Dados meteorológicos atuais (força fetch)",
)
def get_weather() -> WeatherPayload:
    cfg = load()
    wcfg = cfg.get("weather") or {}
    if cfg.get("mock") and wcfg.get("enabled"):
        return WeatherPayload.model_validate(mock_weather_payload())
    data = fetch_weather_data(wcfg)
    return WeatherPayload.model_validate(data)


@router.post(
    "/location",
    response_model=WeatherConfig,
    summary="Define localização por cidade (atalho)",
)
def set_location(body: dict[str, Any]) -> WeatherConfig:
    name = str(body.get("name") or "").strip()
    lat = body.get("latitude")
    lon = body.get("longitude")
    if lat is None or lon is None:
        raise HTTPException(400, "latitude e longitude são obrigatórios")
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (TypeError, ValueError):
        raise HTTPException(400, "latitude/longitude inválidos")
    if not (-90 <= lat_f <= 90 and -180 <= lon_f <= 180):
        raise HTTPException(400, "latitude/longitude fora do intervalo")

    def mut(cfg: dict[str, Any]) -> None:
        w = cfg.setdefault("weather", {})
        loc = w.setdefault("location", {})
        loc["name"] = name
        loc["latitude"] = lat_f
        loc["longitude"] = lon_f
        if body.get("country") is not None:
            loc["country"] = str(body["country"]).strip()
        if body.get("country_code") is not None:
            loc["country_code"] = str(body["country_code"]).strip()
        if body.get("timezone") is not None:
            tz = str(body["timezone"]).strip() or "auto"
            loc["timezone"] = tz
            w["timezone"] = tz
        if body.get("elevation") is not None:
            try:
                loc["elevation"] = float(body["elevation"])
            except (TypeError, ValueError):
                pass
        # Ao definir localização, liga o clima no painel (busca + card).
        w["enabled"] = True
        w["hidden"] = False

    update(mut)
    return _weather_config_public()
