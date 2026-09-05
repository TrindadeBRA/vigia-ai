import { z } from "zod";

export const WeatherLocationSchema = z.object({
  name: z.string().default(""),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  country: z.string().default(""),
  country_code: z.string().default(""),
  timezone: z.string().default("auto"),
  elevation: z.number().nullable().default(null),
});
export type WeatherLocation = z.infer<typeof WeatherLocationSchema>;

export const WeatherUnitsSchema = z.object({
  temperature_unit: z.string().default("celsius"),
  wind_speed_unit: z.string().default("kmh"),
  precipitation_unit: z.string().default("mm"),
});
export type WeatherUnits = z.infer<typeof WeatherUnitsSchema>;

export const WeatherDisplayFieldsSchema = z.object({
  temperature: z.boolean().default(true),
  feels_like: z.boolean().default(true),
  humidity: z.boolean().default(true),
  precipitation: z.boolean().default(true),
  wind: z.boolean().default(true),
  pressure: z.boolean().default(true),
  cloud_cover: z.boolean().default(true),
  uv_index: z.boolean().default(true),
  sunrise_sunset: z.boolean().default(true),
});
export type WeatherDisplayFields = z.infer<typeof WeatherDisplayFieldsSchema>;

export const WeatherDisplaySchema = z.object({
  show_current: z.boolean().default(true),
  show_hourly: z.boolean().default(true),
  show_daily: z.boolean().default(true),
  hourly_count: z.number().int().default(12),
  daily_count: z.number().int().default(7),
  fields: WeatherDisplayFieldsSchema.default({}),
});
export type WeatherDisplay = z.infer<typeof WeatherDisplaySchema>;

export const WeatherConfigSchema = z.object({
  enabled: z.boolean().default(false),
  hidden: z.boolean().default(false),
  location: WeatherLocationSchema.default({}),
  units: WeatherUnitsSchema.default({}),
  forecast_days: z.number().int().min(1).max(16).default(7),
  past_days: z.number().int().min(0).max(2).default(0),
  timezone: z.string().default("auto"),
  current: z.array(z.string()).default([]),
  hourly: z.array(z.string()).default([]),
  daily: z.array(z.string()).default([]),
  display: WeatherDisplaySchema.default({}),
});
export type WeatherConfig = z.infer<typeof WeatherConfigSchema>;

export const WeatherCurrentSchema = z.object({
  time: z.string().nullable().default(null),
  interval: z.number().int().nullable().default(null),
  temperature_2m: z.number().nullable().default(null),
  relative_humidity_2m: z.number().nullable().default(null),
  apparent_temperature: z.number().nullable().default(null),
  is_day: z.number().int().nullable().default(null),
  precipitation: z.number().nullable().default(null),
  rain: z.number().nullable().default(null),
  showers: z.number().nullable().default(null),
  snowfall: z.number().nullable().default(null),
  weather_code: z.number().int().nullable().default(null),
  cloud_cover: z.number().nullable().default(null),
  pressure_msl: z.number().nullable().default(null),
  surface_pressure: z.number().nullable().default(null),
  wind_speed_10m: z.number().nullable().default(null),
  wind_direction_10m: z.number().nullable().default(null),
  wind_gusts_10m: z.number().nullable().default(null),
  visibility: z.number().nullable().default(null),
  uv_index: z.number().nullable().default(null),
  dew_point_2m: z.number().nullable().default(null),
  vapour_pressure_deficit: z.number().nullable().default(null),
  et0_fao_evapotranspiration: z.number().nullable().default(null),
  shortwave_radiation: z.number().nullable().default(null),
});
export type WeatherCurrent = z.infer<typeof WeatherCurrentSchema>;

export const WeatherHourlySchema = z.object({
  time: z.array(z.string()).default([]),
  temperature_2m: z.array(z.number().nullable()).nullable().default(null),
  relative_humidity_2m: z.array(z.number().nullable()).nullable().default(null),
  dew_point_2m: z.array(z.number().nullable()).nullable().default(null),
  apparent_temperature: z.array(z.number().nullable()).nullable().default(null),
  precipitation_probability: z.array(z.number().nullable()).nullable().default(null),
  precipitation: z.array(z.number().nullable()).nullable().default(null),
  rain: z.array(z.number().nullable()).nullable().default(null),
  showers: z.array(z.number().nullable()).nullable().default(null),
  snowfall: z.array(z.number().nullable()).nullable().default(null),
  weather_code: z.array(z.number().nullable()).nullable().default(null),
  pressure_msl: z.array(z.number().nullable()).nullable().default(null),
  cloud_cover: z.array(z.number().nullable()).nullable().default(null),
  visibility: z.array(z.number().nullable()).nullable().default(null),
  wind_speed_10m: z.array(z.number().nullable()).nullable().default(null),
  wind_direction_10m: z.array(z.number().nullable()).nullable().default(null),
  wind_gusts_10m: z.array(z.number().nullable()).nullable().default(null),
  uv_index: z.array(z.number().nullable()).nullable().default(null),
  is_day: z.array(z.number().nullable()).nullable().default(null),
  sunshine_duration: z.array(z.number().nullable()).nullable().default(null),
  shortwave_radiation: z.array(z.number().nullable()).nullable().default(null),
});
export type WeatherHourly = z.infer<typeof WeatherHourlySchema>;

export const WeatherDailySchema = z.object({
  time: z.array(z.string()).default([]),
  weather_code: z.array(z.number().nullable()).nullable().default(null),
  temperature_2m_max: z.array(z.number().nullable()).nullable().default(null),
  temperature_2m_min: z.array(z.number().nullable()).nullable().default(null),
  apparent_temperature_max: z.array(z.number().nullable()).nullable().default(null),
  apparent_temperature_min: z.array(z.number().nullable()).nullable().default(null),
  sunrise: z.array(z.string().nullable()).nullable().default(null),
  sunset: z.array(z.string().nullable()).nullable().default(null),
  daylight_duration: z.array(z.number().nullable()).nullable().default(null),
  sunshine_duration: z.array(z.number().nullable()).nullable().default(null),
  uv_index_max: z.array(z.number().nullable()).nullable().default(null),
  uv_index_clear_sky_max: z.array(z.number().nullable()).nullable().default(null),
  precipitation_sum: z.array(z.number().nullable()).nullable().default(null),
  rain_sum: z.array(z.number().nullable()).nullable().default(null),
  showers_sum: z.array(z.number().nullable()).nullable().default(null),
  snowfall_sum: z.array(z.number().nullable()).nullable().default(null),
  precipitation_hours: z.array(z.number().nullable()).nullable().default(null),
  precipitation_probability_max: z.array(z.number().nullable()).nullable().default(null),
  wind_speed_10m_max: z.array(z.number().nullable()).nullable().default(null),
  wind_gusts_10m_max: z.array(z.number().nullable()).nullable().default(null),
  wind_direction_10m_dominant: z.array(z.number().nullable()).nullable().default(null),
  shortwave_radiation_sum: z.array(z.number().nullable()).nullable().default(null),
  et0_fao_evapotranspiration: z.array(z.number().nullable()).nullable().default(null),
});
export type WeatherDaily = z.infer<typeof WeatherDailySchema>;

export const WeatherPayloadSchema = z.object({
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
  updated_at: z.string().nullable().default(null),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  elevation: z.number().nullable().default(null),
  timezone: z.string().nullable().default(null),
  timezone_abbreviation: z.string().nullable().default(null),
  utc_offset_seconds: z.number().int().nullable().default(null),
  current: WeatherCurrentSchema.nullable().default(null),
  current_units: z.record(z.string()).nullable().default(null),
  hourly: WeatherHourlySchema.nullable().default(null),
  hourly_units: z.record(z.string()).nullable().default(null),
  daily: WeatherDailySchema.nullable().default(null),
  daily_units: z.record(z.string()).nullable().default(null),
  location: WeatherLocationSchema.nullable().default(null),
  units: WeatherUnitsSchema.nullable().default(null),
});
export type WeatherPayload = z.infer<typeof WeatherPayloadSchema>;

export const WeatherGeocodingResultSchema = z.object({
  id: z.number().int().nullable().default(null),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  country: z.string().nullable().default(null),
  country_code: z.string().nullable().default(null),
  admin1: z.string().nullable().default(null),
  admin2: z.string().nullable().default(null),
  admin3: z.string().nullable().default(null),
  admin4: z.string().nullable().default(null),
  timezone: z.string().nullable().default(null),
  elevation: z.number().nullable().default(null),
  population: z.number().int().nullable().default(null),
  feature_code: z.string().nullable().default(null),
  postcodes: z.array(z.string()).nullable().default(null),
});
export type WeatherGeocodingResult = z.infer<typeof WeatherGeocodingResultSchema>;

export const WeatherGeocodingResponseSchema = z.object({
  results: z.array(WeatherGeocodingResultSchema).nullable().default(null),
  generationtime_ms: z.number().nullable().default(null),
});
export type WeatherGeocodingResponse = z.infer<typeof WeatherGeocodingResponseSchema>;

export const WeatherPatchSchema = z.object({
  enabled: z.boolean().nullable().default(null),
  hidden: z.boolean().nullable().default(null),
  name: z.string().nullable().default(null),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  country: z.string().nullable().default(null),
  country_code: z.string().nullable().default(null),
  timezone: z.string().nullable().default(null),
  elevation: z.number().nullable().default(null),
  temperature_unit: z.string().nullable().default(null),
  wind_speed_unit: z.string().nullable().default(null),
  precipitation_unit: z.string().nullable().default(null),
  forecast_days: z.number().int().min(1).max(16).nullable().default(null),
  past_days: z.number().int().min(0).max(2).nullable().default(null),
  current: z.array(z.string()).nullable().default(null),
  hourly: z.array(z.string()).nullable().default(null),
  daily: z.array(z.string()).nullable().default(null),
  display_show_current: z.boolean().nullable().default(null),
  display_show_hourly: z.boolean().nullable().default(null),
  display_show_daily: z.boolean().nullable().default(null),
  display_hourly_count: z.number().int().min(1).max(48).nullable().default(null),
  display_daily_count: z.number().int().min(1).max(16).nullable().default(null),
  display_fields: z.record(z.boolean()).nullable().default(null),
});
export type WeatherPatch = z.infer<typeof WeatherPatchSchema>;
