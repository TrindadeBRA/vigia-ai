"""Modelos Pydantic = contrato OpenAPI (`GET /usage`, `GET /events` e painel)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProviderId = Literal[
    "claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal", "bitcoin"
]

USAGE_EXAMPLE = {
    "updated_at": "2026-08-31T14:00:00-03:00",
    "claude": [
        {
            "id": "local",
            "label": "Pessoal",
            "ok": True,
            "error": None,
            "session_percent": 42.0,
            "session_resets_at": "31/08 18h00",
            "weekly_percent": 18.5,
            "weekly_resets_at": "04/09 03h00",
            "sonnet_percent": None,
            "sonnet_resets_at": None,
            "opus_percent": None,
            "opus_resets_at": None,
        }
    ],
    "gpt": [
        {
            "id": "local",
            "label": "",
            "ok": True,
            "error": None,
            "session_percent": 12.0,
            "session_resets_at": "31/08 21h00",
            "weekly_percent": 8.0,
            "weekly_resets_at": "04/09 03h00",
            "plan": "plus",
        }
    ],
    "cursor": [
        {
            "id": "local",
            "label": "Pessoal",
            "ok": True,
            "error": None,
            "percent": 35.0,
            "other_percent": 12.0,
            "used_cents": 700,
            "limit_cents": 2000,
            "remaining_cents": 1300,
            "bonus_cents": 0,
            "cycle_end": "15/09",
            "plan": "pro",
            "requests_used": None,
            "requests_limit": None,
        }
    ],
    "openrouter": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "percent": 66.6,
            "limit_cents": 1000,
            "used_cents": 666,
            "remaining_cents": 334,
        }
    ],
    "deepseek": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "percent": 25.0,
            "limit_cents": 1000,
            "used_cents": 250,
            "remaining_cents": 750,
        }
    ],
    "opencode": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "rolling_percent": 40.0,
            "rolling_resets_at": "31/08 18h00",
            "weekly_percent": 20.0,
            "weekly_resets_at": "04/09 03h00",
            "monthly_percent": 10.0,
            "monthly_resets_at": "01/09 03h00",
            "percent": None,
            "limit_cents": None,
            "used_cents": None,
            "remaining_cents": 1500,
        }
    ],
    "fal": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "percent": None,
            "limit_cents": None,
            "used_cents": None,
            "remaining_cents": 2450,
        }
    ],
    "bitcoin": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "address": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
            "balance_btc": 0.00123456,
            "price_usd_cents": 6500000,
            "price_brl_cents": 33000000,
            "value_usd_cents": 8025,
            "value_brl_cents": 40740,
        }
    ],
}

SSE_WIRE_EXAMPLE = (
    ": connected\n\n"
    "event: usage\n"
    'data: {"updated_at":"2026-08-31T14:00:00-03:00","claude":[],"gpt":[],"cursor":[],"openrouter":[],"deepseek":[],"opencode":[],"fal":[],"bitcoin":[]}\n\n'
    ": ping\n\n"
)


class AccountBase(BaseModel):
    id: str = Field(description="Chave estável de UI, não é segredo.")
    label: str = Field(default="", description="Apelido opcional. Vazio = só o nome do provedor.")
    ok: bool = Field(description="False se esta conta falhou; as outras seguem no mesmo JSON.")
    error: str | None = Field(default=None, description="Mensagem curta quando ok é false.")


class ClaudeAccount(AccountBase):
    session_percent: float | None = Field(default=None, description="0–100, janela de 5 h.")
    session_resets_at: str | None = None
    weekly_percent: float | None = Field(default=None, description="0–100, limite semanal.")
    weekly_resets_at: str | None = None
    sonnet_percent: float | None = None
    sonnet_resets_at: str | None = None
    opus_percent: float | None = None
    opus_resets_at: str | None = None


class GptAccount(AccountBase):
    session_percent: float | None = Field(default=None, description="0–100, janela curta (~5 h) se o plano tiver.")
    session_resets_at: str | None = None
    weekly_percent: float | None = Field(default=None, description="0–100, janela longa (semana / mês).")
    weekly_resets_at: str | None = None
    plan: str | None = Field(default=None, description="plus, pro, free, … — vem do Codex / ChatGPT.")


class CursorAccount(AccountBase):
    percent: float | None = None
    other_percent: float | None = None
    used_cents: int | None = None
    limit_cents: int | None = None
    remaining_cents: int | None = None
    bonus_cents: int | None = None
    cycle_end: str | None = None
    plan: str | None = None
    requests_used: int | None = None
    requests_limit: int | None = None


class CreditsAccount(AccountBase):
    percent: float | None = None
    limit_cents: int | None = None
    used_cents: int | None = None
    remaining_cents: int | None = None


class BitcoinAccount(AccountBase):
    address: str | None = Field(default=None, description="Endereço público da carteira (não é chave privada).")
    balance_btc: float | None = Field(default=None, description="Saldo on-chain (confirmado + mempool) em BTC.")
    price_usd_cents: int | None = Field(default=None, description="Cotação do BTC em centavos de USD.")
    price_brl_cents: int | None = Field(default=None, description="Cotação do BTC em centavos de BRL.")
    value_usd_cents: int | None = Field(default=None, description="balance_btc × price_usd_cents.")
    value_brl_cents: int | None = Field(default=None, description="balance_btc × price_brl_cents.")


class OpenCodeAccount(AccountBase):
    rolling_percent: float | None = Field(default=None, description="0–100, janela rolling (~5 h).")
    rolling_resets_at: str | None = None
    weekly_percent: float | None = Field(default=None, description="0–100, janela semanal.")
    weekly_resets_at: str | None = None
    monthly_percent: float | None = Field(default=None, description="0–100, janela mensal.")
    monthly_resets_at: str | None = None
    percent: float | None = None
    limit_cents: int | None = None
    used_cents: int | None = None
    remaining_cents: int | None = Field(default=None, description="Saldo do Zen em centavos.")


# ── Weather (Open-Meteo) ──────────────────────────────────────────────

class WeatherLocation(BaseModel):
    name: str = ""
    latitude: float | None = None
    longitude: float | None = None
    country: str = ""
    country_code: str = ""
    timezone: str = "auto"
    elevation: float | None = None


class WeatherUnits(BaseModel):
    temperature_unit: str = "celsius"
    wind_speed_unit: str = "kmh"
    precipitation_unit: str = "mm"


class WeatherDisplayFields(BaseModel):
    temperature: bool = True
    feels_like: bool = True
    humidity: bool = True
    precipitation: bool = True
    wind: bool = True
    pressure: bool = True
    cloud_cover: bool = True
    uv_index: bool = True
    sunrise_sunset: bool = True


class WeatherDisplay(BaseModel):
    show_current: bool = True
    show_hourly: bool = True
    show_daily: bool = True
    hourly_count: int = 12
    daily_count: int = 7
    fields: WeatherDisplayFields = Field(default_factory=WeatherDisplayFields)


class WeatherConfig(BaseModel):
    enabled: bool = False
    hidden: bool = False
    location: WeatherLocation = Field(default_factory=WeatherLocation)
    units: WeatherUnits = Field(default_factory=WeatherUnits)
    forecast_days: int = Field(default=7, ge=1, le=16)
    past_days: int = Field(default=0, ge=0, le=2)
    timezone: str = "auto"
    current: list[str] = Field(default_factory=list)
    hourly: list[str] = Field(default_factory=list)
    daily: list[str] = Field(default_factory=list)
    display: WeatherDisplay = Field(default_factory=WeatherDisplay)


class WeatherCurrent(BaseModel):
    time: str | None = None
    interval: int | None = None
    temperature_2m: float | None = None
    relative_humidity_2m: float | None = None
    apparent_temperature: float | None = None
    is_day: int | None = None
    precipitation: float | None = None
    rain: float | None = None
    showers: float | None = None
    snowfall: float | None = None
    weather_code: int | None = None
    cloud_cover: float | None = None
    pressure_msl: float | None = None
    surface_pressure: float | None = None
    wind_speed_10m: float | None = None
    wind_direction_10m: float | None = None
    wind_gusts_10m: float | None = None
    visibility: float | None = None
    uv_index: float | None = None
    dew_point_2m: float | None = None
    vapour_pressure_deficit: float | None = None
    et0_fao_evapotranspiration: float | None = None
    shortwave_radiation: float | None = None


class WeatherHourly(BaseModel):
    time: list[str] = Field(default_factory=list)
    temperature_2m: list[float | None] | None = None
    relative_humidity_2m: list[float | None] | None = None
    dew_point_2m: list[float | None] | None = None
    apparent_temperature: list[float | None] | None = None
    precipitation_probability: list[float | None] | None = None
    precipitation: list[float | None] | None = None
    rain: list[float | None] | None = None
    showers: list[float | None] | None = None
    snowfall: list[float | None] | None = None
    weather_code: list[int | None] | None = None
    pressure_msl: list[float | None] | None = None
    cloud_cover: list[float | None] | None = None
    visibility: list[float | None] | None = None
    wind_speed_10m: list[float | None] | None = None
    wind_direction_10m: list[float | None] | None = None
    wind_gusts_10m: list[float | None] | None = None
    uv_index: list[float | None] | None = None
    is_day: list[int | None] | None = None
    sunshine_duration: list[float | None] | None = None
    shortwave_radiation: list[float | None] | None = None


class WeatherDaily(BaseModel):
    time: list[str] = Field(default_factory=list)
    weather_code: list[int | None] | None = None
    temperature_2m_max: list[float | None] | None = None
    temperature_2m_min: list[float | None] | None = None
    apparent_temperature_max: list[float | None] | None = None
    apparent_temperature_min: list[float | None] | None = None
    sunrise: list[str | None] | None = None
    sunset: list[str | None] | None = None
    daylight_duration: list[float | None] | None = None
    sunshine_duration: list[float | None] | None = None
    uv_index_max: list[float | None] | None = None
    uv_index_clear_sky_max: list[float | None] | None = None
    precipitation_sum: list[float | None] | None = None
    rain_sum: list[float | None] | None = None
    showers_sum: list[float | None] | None = None
    snowfall_sum: list[float | None] | None = None
    precipitation_hours: list[float | None] | None = None
    precipitation_probability_max: list[float | None] | None = None
    wind_speed_10m_max: list[float | None] | None = None
    wind_gusts_10m_max: list[float | None] | None = None
    wind_direction_10m_dominant: list[float | None] | None = None
    shortwave_radiation_sum: list[float | None] | None = None
    et0_fao_evapotranspiration: list[float | None] | None = None


class WeatherPayload(BaseModel):
    ok: bool = True
    error: str | None = None
    updated_at: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    elevation: float | None = None
    timezone: str | None = None
    timezone_abbreviation: str | None = None
    utc_offset_seconds: int | None = None
    current: WeatherCurrent | None = None
    current_units: dict[str, str] | None = None
    hourly: WeatherHourly | None = None
    hourly_units: dict[str, str] | None = None
    daily: WeatherDaily | None = None
    daily_units: dict[str, str] | None = None
    location: WeatherLocation | None = None
    units: WeatherUnits | None = None


class WeatherGeocodingResult(BaseModel):
    id: int | None = None
    name: str
    latitude: float
    longitude: float
    country: str | None = None
    country_code: str | None = None
    admin1: str | None = None
    admin2: str | None = None
    admin3: str | None = None
    admin4: str | None = None
    timezone: str | None = None
    elevation: float | None = None
    population: int | None = None
    feature_code: str | None = None
    postcodes: list[str] | None = None


class WeatherGeocodingResponse(BaseModel):
    results: list[WeatherGeocodingResult] | None = None
    generationtime_ms: float | None = None


class WeatherPatch(BaseModel):
    enabled: bool | None = None
    hidden: bool | None = None
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    country: str | None = None
    country_code: str | None = None
    timezone: str | None = None
    elevation: float | None = None
    temperature_unit: str | None = None
    wind_speed_unit: str | None = None
    precipitation_unit: str | None = None
    forecast_days: int | None = Field(default=None, ge=1, le=16)
    past_days: int | None = Field(default=None, ge=0, le=2)
    current: list[str] | None = None
    hourly: list[str] | None = None
    daily: list[str] | None = None
    display_show_current: bool | None = None
    display_show_hourly: bool | None = None
    display_show_daily: bool | None = None
    display_hourly_count: int | None = Field(default=None, ge=1, le=48)
    display_daily_count: int | None = Field(default=None, ge=1, le=16)
    display_fields: dict[str, bool] | None = None


class UsagePayload(BaseModel):
    """Contrato da placa e do mostrador. Mesmo JSON em GET /usage e no evento SSE `usage`."""

    model_config = ConfigDict(json_schema_extra={"example": USAGE_EXAMPLE})

    updated_at: str = Field(description="ISO-8601 com offset, ou o instante do ciclo no coletor.")
    claude: list[ClaudeAccount]
    gpt: list[GptAccount]
    cursor: list[CursorAccount]
    openrouter: list[CreditsAccount]
    deepseek: list[CreditsAccount]
    opencode: list[OpenCodeAccount]
    fal: list[CreditsAccount]
    bitcoin: list[BitcoinAccount]
    weather: WeatherPayload | None = Field(default=None, description="Dados meteorológicos Open-Meteo, se configurado.")


class HealthPayload(BaseModel):
    ok: bool = True
    version: str = Field(description="Versão do coletor.")
    panel: str = Field(default="/", description="Painel React.")
    panel_lan: str = Field(
        default="",
        description="URL absoluta do painel na LAN (telefone / outro PC). Vazia se não houver IPv4.",
    )
    display: str = Field(default="/display", description="Mostrador web.")
    usage: str = Field(default="/usage", description="JSON na hora (força um ciclo de APIs).")
    events: str = Field(default="/events", description="Stream SSE (firmware e /display).")
    docs: str = Field(default="/docs", description="Swagger UI.")
    listen: dict[str, str | int] = Field(description="host e port em que o Uvicorn está escutando.")
    interval_s: int = Field(description="Segundos entre ciclos do hub (`USAGE_INTERVAL_S`).")


class AccountPublic(BaseModel):
    id: str
    label: str = ""
    suffix: str | None = None


class ProviderCardPublic(BaseModel):
    source: str
    label: str
    configured: bool
    suffix: str | None = None
    mode: str
    hidden: bool = False
    local_label: str = ""
    primary_label: str = ""
    accounts: list[AccountPublic] = Field(default_factory=list)


class UrlsPublic(BaseModel):
    panel: list[str]
    usage: list[str]
    usage_lan: str
    usage_local: str
    secrets_h: str
    secrets_h_file: str
    board_ok: bool


class ListenPublic(BaseModel):
    host: str
    port: int


class DevicePublic(BaseModel):
    ip: str | None = Field(default=None, description="Último IP que chamou /usage ou /events (a placa).")
    last_seen_s: int | None = Field(default=None, description="Segundos desde o último request da placa.")
    width: int | None = Field(default=None, description="Resolução da tela (header X-Vigia-Screen) — protótipo do tema.")
    height: int | None = Field(default=None, description="Resolução da tela (header X-Vigia-Screen) — protótipo do tema.")


class ConfigPublic(BaseModel):
    ok: bool = True
    in_docker: bool
    mock: bool
    listen: ListenPublic
    urls: UrlsPublic
    lan_ips: list[str]
    restart_needed_for_port: bool = False
    providers: dict[str, ProviderCardPublic]
    weather: WeatherConfig = Field(default_factory=WeatherConfig)
    device: DevicePublic = Field(default_factory=DevicePublic)


class ConfigPatch(BaseModel):
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    mock: bool | None = None
    claude_hidden: bool | None = None
    gpt_hidden: bool | None = None
    cursor_hidden: bool | None = None
    openrouter_hidden: bool | None = None
    deepseek_hidden: bool | None = None
    opencode_hidden: bool | None = None
    fal_hidden: bool | None = None
    bitcoin_hidden: bool | None = None
    claude_local_label: str | None = None
    gpt_local_label: str | None = None
    cursor_local_label: str | None = None
    openrouter_primary_label: str | None = None
    deepseek_primary_label: str | None = None
    opencode_primary_label: str | None = None
    fal_primary_label: str | None = None
    bitcoin_primary_label: str | None = None
    claude_paste: str | None = None
    gpt_paste: str | None = None
    cursor_paste: str | None = None
    openrouter_paste: str | None = None
    deepseek_paste: str | None = None
    opencode_paste: str | None = None
    fal_paste: str | None = None
    bitcoin_paste: str | None = None


class ConfigSaveResult(BaseModel):
    ok: bool
    error: str | None = None
    restart_needed_for_port: bool = False


AlarmMetricKind = Literal["percent", "cents"]


class AlarmMetric(BaseModel):
    key: str
    label: str
    kind: AlarmMetricKind


class AlarmRule(BaseModel):
    id: str
    provider: ProviderId
    account_id: str = "*"
    metric: str
    threshold: float
    enabled: bool = True
    label: str = ""


class AlarmRuleBody(BaseModel):
    provider: ProviderId
    metric: str
    threshold: float
    enabled: bool = True
    label: str = ""


class AlarmRulePatch(BaseModel):
    threshold: float | None = None
    enabled: bool | None = None
    label: str | None = None


class AlarmsPublic(BaseModel):
    rules: list[AlarmRule]
    metrics: dict[str, list[AlarmMetric]]


class PushSubscriptionBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    ua: str = ""


class PushUnsubscribeBody(BaseModel):
    endpoint: str


class VapidPublicKey(BaseModel):
    public_key: str


class AddAccountBody(BaseModel):
    provider: ProviderId
    label: str = ""
    token: str | None = None
    key: str | None = None


class AddAccountResult(BaseModel):
    ok: bool
    id: str | None = None
    error: str | None = None


class OkResult(BaseModel):
    ok: bool
    error: str | None = None
    cleared: str | None = None
