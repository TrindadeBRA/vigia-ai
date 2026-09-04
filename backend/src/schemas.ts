import { z } from "zod";

export const ProviderIdSchema = z.enum([
  "claude",
  "gpt",
  "cursor",
  "openrouter",
  "deepseek",
  "opencode",
  "fal",
  "bitcoin",
  "adsense",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const USAGE_EXAMPLE = {
  updated_at: "2026-08-31T14:00:00-03:00",
  claude: [
    {
      id: "local",
      label: "Pessoal",
      ok: true,
      error: null,
      session_percent: 42.0,
      session_resets_at: "31/08 18h00",
      weekly_percent: 18.5,
      weekly_resets_at: "04/09 03h00",
      sonnet_percent: null,
      sonnet_resets_at: null,
      opus_percent: null,
      opus_resets_at: null,
    },
  ],
  gpt: [
    {
      id: "local",
      label: "",
      ok: true,
      error: null,
      session_percent: 12.0,
      session_resets_at: "31/08 21h00",
      weekly_percent: 8.0,
      weekly_resets_at: "04/09 03h00",
      plan: "plus",
    },
  ],
  cursor: [
    {
      id: "local",
      label: "Pessoal",
      ok: true,
      error: null,
      percent: 35.0,
      other_percent: 12.0,
      used_cents: 700,
      limit_cents: 2000,
      remaining_cents: 1300,
      bonus_cents: 0,
      cycle_end: "15/09",
      plan: "pro",
      requests_used: null,
      requests_limit: null,
    },
  ],
  openrouter: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      percent: 66.6,
      limit_cents: 1000,
      used_cents: 666,
      remaining_cents: 334,
    },
  ],
  deepseek: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      percent: 25.0,
      limit_cents: 1000,
      used_cents: 250,
      remaining_cents: 750,
    },
  ],
  opencode: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      rolling_percent: 40.0,
      rolling_resets_at: "31/08 18h00",
      weekly_percent: 20.0,
      weekly_resets_at: "04/09 03h00",
      monthly_percent: 10.0,
      monthly_resets_at: "01/09 03h00",
      percent: null,
      limit_cents: null,
      used_cents: null,
      remaining_cents: 1500,
    },
  ],
  fal: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      percent: null,
      limit_cents: null,
      used_cents: null,
      remaining_cents: 2450,
    },
  ],
  bitcoin: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      balance_btc: 0.00123456,
      price_usd_cents: 6500000,
      price_brl_cents: 33000000,
      value_usd_cents: 8025,
      value_brl_cents: 40740,
    },
  ],
  adsense: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      currency: "BRL",
      today_cents: 1234,
      unpaid_cents: 56789,
      account_name: "pub-1234",
    },
  ],
} as const;

export const SSE_WIRE_EXAMPLE =
  ": connected\n\n" +
  "event: usage\n" +
  'data: {"updated_at":"2026-08-31T14:00:00-03:00","claude":[],"gpt":[],"cursor":[],"openrouter":[],"deepseek":[],"opencode":[],"fal":[],"bitcoin":[],"adsense":[]}\n\n' +
  ": ping\n\n";

// ----- Base -----
export const AccountBaseSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  ok: z.boolean(),
  error: z.string().nullable().default(null),
});
export type AccountBase = z.infer<typeof AccountBaseSchema>;

export const ClaudeAccountSchema = AccountBaseSchema.extend({
  session_percent: z.number().nullable().default(null),
  session_resets_at: z.string().nullable().default(null),
  weekly_percent: z.number().nullable().default(null),
  weekly_resets_at: z.string().nullable().default(null),
  sonnet_percent: z.number().nullable().default(null),
  sonnet_resets_at: z.string().nullable().default(null),
  opus_percent: z.number().nullable().default(null),
  opus_resets_at: z.string().nullable().default(null),
});
export type ClaudeAccount = z.infer<typeof ClaudeAccountSchema>;

export const GptAccountSchema = AccountBaseSchema.extend({
  session_percent: z.number().nullable().default(null),
  session_resets_at: z.string().nullable().default(null),
  weekly_percent: z.number().nullable().default(null),
  weekly_resets_at: z.string().nullable().default(null),
  plan: z.string().nullable().default(null),
});
export type GptAccount = z.infer<typeof GptAccountSchema>;

export const CursorAccountSchema = AccountBaseSchema.extend({
  percent: z.number().nullable().default(null),
  other_percent: z.number().nullable().default(null),
  used_cents: z.number().int().nullable().default(null),
  limit_cents: z.number().int().nullable().default(null),
  remaining_cents: z.number().int().nullable().default(null),
  bonus_cents: z.number().int().nullable().default(null),
  cycle_end: z.string().nullable().default(null),
  plan: z.string().nullable().default(null),
  requests_used: z.number().int().nullable().default(null),
  requests_limit: z.number().int().nullable().default(null),
});
export type CursorAccount = z.infer<typeof CursorAccountSchema>;

export const CreditsAccountSchema = AccountBaseSchema.extend({
  percent: z.number().nullable().default(null),
  limit_cents: z.number().int().nullable().default(null),
  used_cents: z.number().int().nullable().default(null),
  remaining_cents: z.number().int().nullable().default(null),
});
export type CreditsAccount = z.infer<typeof CreditsAccountSchema>;

export const BitcoinAccountSchema = AccountBaseSchema.extend({
  address: z.string().nullable().default(null),
  balance_btc: z.number().nullable().default(null),
  price_usd_cents: z.number().int().nullable().default(null),
  price_brl_cents: z.number().int().nullable().default(null),
  value_usd_cents: z.number().int().nullable().default(null),
  value_brl_cents: z.number().int().nullable().default(null),
});
export type BitcoinAccount = z.infer<typeof BitcoinAccountSchema>;

export const AdsenseAccountSchema = AccountBaseSchema.extend({
  currency: z.string().nullable().default(null),
  today_cents: z.number().int().nullable().default(null),
  unpaid_cents: z.number().int().nullable().default(null),
  account_name: z.string().nullable().default(null),
});
export type AdsenseAccount = z.infer<typeof AdsenseAccountSchema>;

export const OpenCodeAccountSchema = AccountBaseSchema.extend({
  rolling_percent: z.number().nullable().default(null),
  rolling_resets_at: z.string().nullable().default(null),
  weekly_percent: z.number().nullable().default(null),
  weekly_resets_at: z.string().nullable().default(null),
  monthly_percent: z.number().nullable().default(null),
  monthly_resets_at: z.string().nullable().default(null),
  percent: z.number().nullable().default(null),
  limit_cents: z.number().int().nullable().default(null),
  used_cents: z.number().int().nullable().default(null),
  remaining_cents: z.number().int().nullable().default(null),
});
export type OpenCodeAccount = z.infer<typeof OpenCodeAccountSchema>;

// ----- Weather -----
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

// ----- Currencies -----
export const CurrencyKindSchema = z.enum(["fiat", "crypto"]);
export type CurrencyKind = z.infer<typeof CurrencyKindSchema>;

export const CurrencyItemSchema = z.object({
  id: z.string(),
  kind: CurrencyKindSchema,
  code: z.string(),
  label: z.string().default(""),
});
export type CurrencyItem = z.infer<typeof CurrencyItemSchema>;

export const CurrenciesConfigSchema = z.object({
  enabled: z.boolean().default(false),
  hidden: z.boolean().default(false),
  base: z.string().default("BRL"),
  items: z.array(CurrencyItemSchema).default([]),
});
export type CurrenciesConfig = z.infer<typeof CurrenciesConfigSchema>;

export const CurrencyQuoteSchema = z.object({
  id: z.string(),
  kind: CurrencyKindSchema,
  code: z.string(),
  label: z.string().default(""),
  price: z.number().nullable().default(null),
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
});
export type CurrencyQuote = z.infer<typeof CurrencyQuoteSchema>;

export const CurrenciesPayloadSchema = z.object({
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
  updated_at: z.string().nullable().default(null),
  base: z.string().default("BRL"),
  items: z.array(CurrencyQuoteSchema).default([]),
});
export type CurrenciesPayload = z.infer<typeof CurrenciesPayloadSchema>;

export const CurrencyItemBodySchema = z.object({
  kind: CurrencyKindSchema,
  code: z.string(),
  label: z.string().default(""),
});
export type CurrencyItemBody = z.infer<typeof CurrencyItemBodySchema>;

export const CurrenciesPatchSchema = z.object({
  enabled: z.boolean().nullable().default(null),
  hidden: z.boolean().nullable().default(null),
  base: z.string().nullable().default(null),
});
export type CurrenciesPatch = z.infer<typeof CurrenciesPatchSchema>;

export const CurrencySearchResultSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
});
export type CurrencySearchResult = z.infer<typeof CurrencySearchResultSchema>;

export const CurrencySearchResponseSchema = z.object({
  results: z.array(CurrencySearchResultSchema).default([]),
});
export type CurrencySearchResponse = z.infer<typeof CurrencySearchResponseSchema>;

// ----- Usage / Health -----
export const UsagePayloadSchema = z.object({
  updated_at: z.string(),
  claude: z.array(ClaudeAccountSchema),
  gpt: z.array(GptAccountSchema),
  cursor: z.array(CursorAccountSchema),
  openrouter: z.array(CreditsAccountSchema),
  deepseek: z.array(CreditsAccountSchema),
  opencode: z.array(OpenCodeAccountSchema),
  fal: z.array(CreditsAccountSchema),
  bitcoin: z.array(BitcoinAccountSchema),
  adsense: z.array(AdsenseAccountSchema),
  weather: WeatherPayloadSchema.nullable().default(null),
  currencies: CurrenciesPayloadSchema.nullable().default(null),
});
export type UsagePayload = z.infer<typeof UsagePayloadSchema>;

export const HealthPayloadSchema = z.object({
  ok: z.boolean().default(true),
  version: z.string(),
  panel: z.string().default("/"),
  panel_lan: z.string().default(""),
  display: z.string().default("/display"),
  usage: z.string().default("/usage"),
  events: z.string().default("/events"),
  docs: z.string().default("/docs"),
  listen: z.record(z.union([z.string(), z.number()])),
  interval_s: z.number().int(),
});
export type HealthPayload = z.infer<typeof HealthPayloadSchema>;

export const AccountPublicSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  suffix: z.string().nullable().default(null),
});
export type AccountPublic = z.infer<typeof AccountPublicSchema>;

export const ProviderCardPublicSchema = z.object({
  source: z.string(),
  label: z.string(),
  configured: z.boolean(),
  suffix: z.string().nullable().default(null),
  mode: z.string(),
  hidden: z.boolean().default(false),
  local_label: z.string().default(""),
  primary_label: z.string().default(""),
  accounts: z.array(AccountPublicSchema).default([]),
});
export type ProviderCardPublic = z.infer<typeof ProviderCardPublicSchema>;

export const UrlsPublicSchema = z.object({
  panel: z.array(z.string()),
  usage: z.array(z.string()),
  usage_lan: z.string(),
  usage_local: z.string(),
  secrets_h: z.string(),
  secrets_h_file: z.string(),
  board_ok: z.boolean(),
});
export type UrlsPublic = z.infer<typeof UrlsPublicSchema>;

export const ListenPublicSchema = z.object({
  host: z.string(),
  port: z.number().int(),
});
export type ListenPublic = z.infer<typeof ListenPublicSchema>;

export const DevicePublicSchema = z.object({
  ip: z.string().nullable().default(null),
  last_seen_s: z.number().int().nullable().default(null),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null),
});
export type DevicePublic = z.infer<typeof DevicePublicSchema>;

export const ConfigPublicSchema = z.object({
  ok: z.boolean().default(true),
  in_docker: z.boolean(),
  mock: z.boolean(),
  listen: ListenPublicSchema,
  urls: UrlsPublicSchema,
  lan_ips: z.array(z.string()),
  restart_needed_for_port: z.boolean().default(false),
  providers: z.record(ProviderCardPublicSchema),
  weather: WeatherConfigSchema.default({}),
  currencies: CurrenciesConfigSchema.default({}),
  device: DevicePublicSchema.default({}),
});
export type ConfigPublic = z.infer<typeof ConfigPublicSchema>;

export const ConfigPatchSchema = z.object({
  host: z.string().nullable().default(null),
  port: z.number().int().min(1).max(65535).nullable().default(null),
  mock: z.boolean().nullable().default(null),
  claude_hidden: z.boolean().nullable().default(null),
  gpt_hidden: z.boolean().nullable().default(null),
  cursor_hidden: z.boolean().nullable().default(null),
  openrouter_hidden: z.boolean().nullable().default(null),
  deepseek_hidden: z.boolean().nullable().default(null),
  opencode_hidden: z.boolean().nullable().default(null),
  fal_hidden: z.boolean().nullable().default(null),
  bitcoin_hidden: z.boolean().nullable().default(null),
  adsense_hidden: z.boolean().nullable().default(null),
  claude_local_label: z.string().nullable().default(null),
  gpt_local_label: z.string().nullable().default(null),
  cursor_local_label: z.string().nullable().default(null),
  openrouter_primary_label: z.string().nullable().default(null),
  deepseek_primary_label: z.string().nullable().default(null),
  opencode_primary_label: z.string().nullable().default(null),
  fal_primary_label: z.string().nullable().default(null),
  bitcoin_primary_label: z.string().nullable().default(null),
  adsense_primary_label: z.string().nullable().default(null),
  claude_paste: z.string().nullable().default(null),
  gpt_paste: z.string().nullable().default(null),
  cursor_paste: z.string().nullable().default(null),
  openrouter_paste: z.string().nullable().default(null),
  deepseek_paste: z.string().nullable().default(null),
  opencode_paste: z.string().nullable().default(null),
  fal_paste: z.string().nullable().default(null),
  bitcoin_paste: z.string().nullable().default(null),
  adsense_client_id: z.string().nullable().default(null),
  adsense_client_secret: z.string().nullable().default(null),
});
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;

export const ConfigSaveResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable().default(null),
  restart_needed_for_port: z.boolean().default(false),
});
export type ConfigSaveResult = z.infer<typeof ConfigSaveResultSchema>;

export const AlarmMetricKindSchema = z.enum(["percent", "cents"]);
export type AlarmMetricKind = z.infer<typeof AlarmMetricKindSchema>;

export const AlarmMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: AlarmMetricKindSchema,
});
export type AlarmMetric = z.infer<typeof AlarmMetricSchema>;

export const AlarmRuleSchema = z.object({
  id: z.string(),
  provider: ProviderIdSchema,
  account_id: z.string().default("*"),
  metric: z.string(),
  threshold: z.number(),
  enabled: z.boolean().default(true),
  label: z.string().default(""),
});
export type AlarmRule = z.infer<typeof AlarmRuleSchema>;

export const AlarmRuleBodySchema = z.object({
  provider: ProviderIdSchema,
  metric: z.string(),
  threshold: z.number(),
  enabled: z.boolean().default(true),
  label: z.string().default(""),
});
export type AlarmRuleBody = z.infer<typeof AlarmRuleBodySchema>;

export const AlarmRulePatchSchema = z.object({
  threshold: z.number().nullable().default(null),
  enabled: z.boolean().nullable().default(null),
  label: z.string().nullable().default(null),
});
export type AlarmRulePatch = z.infer<typeof AlarmRulePatchSchema>;

export const AlarmsPublicSchema = z.object({
  rules: z.array(AlarmRuleSchema),
  metrics: z.record(z.array(AlarmMetricSchema)),
});
export type AlarmsPublic = z.infer<typeof AlarmsPublicSchema>;

export const TelegramChatSchema = z.object({
  id: z.string(),
  label: z.string(),
  added_at: z.string(),
});
export type TelegramChat = z.infer<typeof TelegramChatSchema>;

export const TelegramStatusSchema = z.object({
  configured: z.boolean(),
  bot_username: z.string().default(""),
  chats: z.array(TelegramChatSchema),
});
export type TelegramStatus = z.infer<typeof TelegramStatusSchema>;

export const TelegramTokenBodySchema = z.object({
  bot_token: z.string(),
});
export type TelegramTokenBody = z.infer<typeof TelegramTokenBodySchema>;

export const TelegramChatBodySchema = z.object({
  chat_id: z.string(),
});
export type TelegramChatBody = z.infer<typeof TelegramChatBodySchema>;

export const AddAccountBodySchema = z.object({
  provider: ProviderIdSchema,
  label: z.string().default(""),
  token: z.string().nullable().default(null),
  key: z.string().nullable().default(null),
});
export type AddAccountBody = z.infer<typeof AddAccountBodySchema>;

export const AddAccountResultSchema = z.object({
  ok: z.boolean(),
  id: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
});
export type AddAccountResult = z.infer<typeof AddAccountResultSchema>;

export const OkResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable().default(null),
  cleared: z.string().nullable().default(null),
});
export type OkResult = z.infer<typeof OkResultSchema>;
