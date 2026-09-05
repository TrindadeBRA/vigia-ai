/**
 * Provedor Weather: Open-Meteo Forecast + Geocoding (sem API key).
 * Port of backend-python-legacy/app/providers/weather.py
 */
import { httpJson } from "../httpClient.js";
import { utcNow } from "../formatting.js";
import { load as loadConfig } from "../store.js";

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

// Copy VALID_* sets entirely (~80 values)
export const VALID_CURRENT = new Set<string>([
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
]);

export const VALID_HOURLY = new Set<string>([
  ...VALID_CURRENT,
  "precipitation_probability", "temperature_80m", "temperature_120m", "temperature_180m",
  "snowfall_height",
]);

export const VALID_DAILY = new Set<string>([
  "weather_code",
  "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
  "apparent_temperature_max", "apparent_temperature_min", "apparent_temperature_mean",
  "precipitation_sum", "rain_sum", "showers_sum", "snowfall_sum",
  "precipitation_hours", "precipitation_probability_max", "precipitation_probability_min", "precipitation_probability_mean",
  "sunrise", "sunset", "daylight_duration", "sunshine_duration",
  "wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant",
  "shortwave_radiation_sum", "et0_fao_evapotranspiration",
  "uv_index_max", "uv_index_clear_sky_max",
]);

export const VALID_TEMPERATURE_UNITS = new Set(["celsius", "fahrenheit"]);
export const VALID_WIND_UNITS = new Set(["kmh", "ms", "mph", "kn"]);
export const VALID_PRECIPITATION_UNITS = new Set(["mm", "inch"]);

export const WMO_DESCRIPTIONS: Record<number, string> = {
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
};

export const WMO_ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "❄️",
  80: "🌦️", 81: "🌦️", 82: "⛈️", 85: "🌨️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

export function wmoDescription(code: number | null | undefined): string {
  if (code === null || code === undefined) return "";
  return WMO_DESCRIPTIONS[code] ?? `Código ${code}`;
}

export function wmoIcon(code: number | null | undefined): string {
  if (code === null || code === undefined) return "🌡️";
  return WMO_ICONS[code] ?? "🌡️";
}

function sanitizeList(values: unknown[], valid: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = String(v).trim();
    if (valid.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function weatherFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    updated_at: utcNow(),
    latitude: null,
    longitude: null,
    elevation: null,
    timezone: null,
    timezone_abbreviation: null,
    utc_offset_seconds: null,
    current: null,
    current_units: null,
    hourly: null,
    hourly_units: null,
    daily: null,
    daily_units: null,
    location: null,
    units: null,
  };
}

export function buildForecastUrl(cfgWeather: Record<string, unknown>): string {
  const loc = (cfgWeather.location ?? {}) as Record<string, unknown>;
  const units = (cfgWeather.units ?? {}) as Record<string, unknown>;
  const lat = loc.latitude;
  const lon = loc.longitude;
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    throw new Error("Localização não configurada (latitude/longitude)");
  }

  const params: Record<string, string> = {
    latitude: String(lat),
    longitude: String(lon),
    timezone: String(cfgWeather.timezone ?? loc.timezone ?? "auto"),
    temperature_unit: String(units.temperature_unit ?? "celsius"),
    wind_speed_unit: String(units.wind_speed_unit ?? "kmh"),
    precipitation_unit: String(units.precipitation_unit ?? "mm"),
    forecast_days: String(cfgWeather.forecast_days ?? 7),
    past_days: String(cfgWeather.past_days ?? 0),
  };
  const elev = loc.elevation;
  if (elev !== null && elev !== undefined) params.elevation = String(elev);

  let current = sanitizeList((cfgWeather.current ?? []) as unknown[], VALID_CURRENT);
  let hourly = sanitizeList((cfgWeather.hourly ?? []) as unknown[], VALID_HOURLY);
  let daily = sanitizeList((cfgWeather.daily ?? []) as unknown[], VALID_DAILY);

  if (current.length === 0) {
    current = ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "weather_code", "wind_speed_10m", "precipitation"];
  }
  if (hourly.length === 0) hourly = ["temperature_2m", "precipitation_probability", "weather_code"];
  if (daily.length === 0) daily = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum"];

  params.current = current.join(",");
  params.hourly = hourly.join(",");
  params.daily = daily.join(",");

  const qs = new URLSearchParams(params).toString();
  return `${FORECAST_URL}?${qs}`;
}

export async function fetchWeatherData(cfgWeather?: Record<string, unknown> | null): Promise<Record<string, unknown>> {
  let cfgW = cfgWeather;
  if (cfgW === null || cfgW === undefined) {
    const cfg = loadConfig();
    cfgW = (cfg.weather ?? {}) as Record<string, unknown>;
  }

  if (!cfgW.enabled) {
    return {
      ok: true,
      error: null,
      updated_at: null,
      latitude: null,
      longitude: null,
      elevation: null,
      timezone: null,
      timezone_abbreviation: null,
      utc_offset_seconds: null,
      current: null,
      current_units: null,
      hourly: null,
      hourly_units: null,
      daily: null,
      daily_units: null,
      location: cfgW.location,
      units: cfgW.units,
    };
  }

  const loc = (cfgW.location ?? {}) as Record<string, unknown>;
  if (loc.latitude === null || loc.latitude === undefined || loc.longitude === null || loc.longitude === undefined) {
    return weatherFail("Configure a cidade nas configurações de clima");
  }

  let url: string;
  try {
    url = buildForecastUrl(cfgW);
  } catch (e) {
    return weatherFail(String(e instanceof Error ? e.message : e));
  }

  let data: unknown;
  try {
    data = await httpJson(url, { timeout: 15.0, provider: "WEATHER" });
  } catch (e) {
    return weatherFail(String(e));
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) return weatherFail("Resposta inesperada do Open-Meteo");
  const dict = data as Record<string, unknown>;
  if (dict.error) return weatherFail(String(dict.reason ?? "Erro do Open-Meteo"));

  return {
    ok: true,
    error: null,
    updated_at: utcNow(),
    latitude: dict.latitude,
    longitude: dict.longitude,
    elevation: dict.elevation,
    timezone: dict.timezone,
    timezone_abbreviation: dict.timezone_abbreviation,
    utc_offset_seconds: dict.utc_offset_seconds,
    current: dict.current,
    current_units: dict.current_units,
    hourly: dict.hourly,
    hourly_units: dict.hourly_units,
    daily: dict.daily,
    daily_units: dict.daily_units,
    location: cfgW.location,
    units: cfgW.units,
  };
}

export function mockWeatherPayload(): Record<string, unknown> {
  const now = utcNow();
  return {
    ok: true,
    error: null,
    updated_at: now,
    latitude: -23.5505,
    longitude: -46.6333,
    elevation: 760,
    timezone: "America/Sao_Paulo",
    timezone_abbreviation: "BRT",
    utc_offset_seconds: -10800,
    current: {
      time: now,
      interval: 900,
      temperature_2m: 26.5,
      relative_humidity_2m: 65,
      apparent_temperature: 28.1,
      is_day: 1,
      precipitation: 0.0,
      weather_code: 2,
      cloud_cover: 40,
      pressure_msl: 1013.2,
      wind_speed_10m: 12.3,
      wind_direction_10m: 180,
      wind_gusts_10m: 18.5,
    },
    current_units: {
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      apparent_temperature: "°C",
      precipitation: "mm",
      wind_speed_10m: "km/h",
    },
    hourly: {
      time: [now, now, now, now, now, now, now, now, now, now, now, now],
      temperature_2m: [26.5, 27.0, 27.5, 28.0, 27.8, 27.0, 26.0, 25.0, 24.0, 23.5, 23.0, 22.8],
      precipitation_probability: [10, 15, 20, 30, 40, 35, 20, 10, 5, 5, 10, 15],
      weather_code: [2, 2, 3, 3, 80, 80, 2, 1, 1, 0, 0, 1],
      wind_speed_10m: [12.3, 13.0, 14.0, 15.0, 14.5, 13.0, 12.0, 11.0, 10.0, 9.5, 9.0, 10.0],
    },
    hourly_units: {
      temperature_2m: "°C",
      precipitation_probability: "%",
      wind_speed_10m: "km/h",
    },
    daily: {
      time: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"],
      weather_code: [2, 3, 80, 61, 1, 0, 2],
      temperature_2m_max: [28.5, 27.0, 26.0, 24.5, 26.0, 28.0, 29.0],
      temperature_2m_min: [18.0, 17.5, 17.0, 16.0, 16.5, 17.0, 18.5],
      precipitation_sum: [0.0, 2.3, 8.5, 12.0, 0.5, 0.0, 0.0],
      precipitation_probability_max: [20, 60, 80, 90, 30, 10, 15],
      wind_speed_10m_max: [15.0, 18.0, 20.0, 16.0, 14.0, 12.0, 13.0],
      sunrise: ["2026-09-01T06:15", "2026-09-02T06:14", "2026-09-03T06:13", "2026-09-04T06:12", "2026-09-05T06:11", "2026-09-06T06:10", "2026-09-07T06:09"],
      sunset: ["2026-09-01T18:05", "2026-09-02T18:05", "2026-09-03T18:06", "2026-09-04T18:06", "2026-09-05T18:07", "2026-09-06T18:07", "2026-09-07T18:08"],
      uv_index_max: [6.5, 5.0, 3.2, 2.8, 5.5, 7.0, 6.8],
    },
    daily_units: {
      temperature_2m_max: "°C",
      temperature_2m_min: "°C",
      precipitation_sum: "mm",
      wind_speed_10m_max: "km/h",
    },
    location: {
      name: "São Paulo",
      latitude: -23.5505,
      longitude: -46.6333,
      country: "Brasil",
      country_code: "BR",
      timezone: "America/Sao_Paulo",
    },
    units: {
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
    },
  };
}

export async function searchCities(query: string, count = 5, language = "pt"): Promise<Record<string, unknown>> {
  query = query.trim();
  if (!query || query.length < 2) return { results: [] };
  count = Math.max(1, Math.min(10, count));
  const params = { name: query, count: String(count), language, format: "json" };
  const qs = new URLSearchParams(params).toString();
  const url = `${GEOCODING_URL}?${qs}`;
  let data: unknown;
  try {
    data = await httpJson(url, { timeout: 10.0, provider: "WEATHER" });
  } catch (e) {
    throw new Error(`Busca de cidade falhou: ${e}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return { results: [] };
  return data as Record<string, unknown>;
}

export const weather_fail = weatherFail;
export const fetch_weather_data = fetchWeatherData;
export const mock_weather_payload = mockWeatherPayload;
export const search_cities = searchCities;
export const _build_forecast_url = buildForecastUrl;
export const VALID_CURRENT_SET = VALID_CURRENT;
export const VALID_HOURLY_SET = VALID_HOURLY;
export const VALID_DAILY_SET = VALID_DAILY;
