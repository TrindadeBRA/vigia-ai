export type ClaudeAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  session_percent: number | null;
  session_resets_at: string | null;
  weekly_percent: number | null;
  weekly_resets_at: string | null;
  sonnet_percent: number | null;
  sonnet_resets_at: string | null;
  opus_percent: number | null;
  opus_resets_at: string | null;
};

export type GptAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  session_percent: number | null;
  session_resets_at: string | null;
  weekly_percent: number | null;
  weekly_resets_at: string | null;
  plan: string | null;
};

export type CursorAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  percent: number | null;
  other_percent: number | null;
  used_cents: number | null;
  limit_cents: number | null;
  remaining_cents: number | null;
  bonus_cents: number | null;
  cycle_end: string | null;
  plan: string | null;
  requests_used: number | null;
  requests_limit: number | null;
};

export type CreditsAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  percent: number | null;
  limit_cents: number | null;
  used_cents: number | null;
  remaining_cents: number | null;
};

export type OpenCodeAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  rolling_percent: number | null;
  rolling_resets_at: string | null;
  weekly_percent: number | null;
  weekly_resets_at: string | null;
  monthly_percent: number | null;
  monthly_resets_at: string | null;
  percent: number | null;
  limit_cents: number | null;
  used_cents: number | null;
  remaining_cents: number | null;
};

export type BitcoinAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  address: string | null;
  balance_btc: number | null;
  price_usd_cents: number | null;
  price_brl_cents: number | null;
  value_usd_cents: number | null;
  value_brl_cents: number | null;
};

export type AdsenseAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  currency: string | null;
  today_cents: number | null;
  unpaid_cents: number | null;
  account_name: string | null;
};

export type WeatherLocation = {
  name: string;
  latitude: number | null;
  longitude: number | null;
  country: string;
  country_code: string;
  timezone: string;
  elevation: number | null;
};

export type WeatherUnits = {
  temperature_unit: string;
  wind_speed_unit: string;
  precipitation_unit: string;
};

export type WeatherDisplayFields = {
  temperature: boolean;
  feels_like: boolean;
  humidity: boolean;
  precipitation: boolean;
  wind: boolean;
  pressure: boolean;
  cloud_cover: boolean;
  uv_index: boolean;
  sunrise_sunset: boolean;
};

export type WeatherDisplay = {
  show_current: boolean;
  show_hourly: boolean;
  show_daily: boolean;
  hourly_count: number;
  daily_count: number;
  fields: WeatherDisplayFields;
};

export type WallpaperProviderStatus = {
  pexels: { configured: boolean; needs_key: boolean };
  wallhaven: { configured: boolean; has_key?: boolean; needs_key: boolean };
  unsplash: { configured: boolean; needs_key: boolean };
};

export type WeatherConfig = {
  enabled: boolean;
  hidden: boolean;
  location: WeatherLocation;
  units: WeatherUnits;
  forecast_days: number;
  past_days: number;
  timezone: string;
  current: string[];
  hourly: string[];
  daily: string[];
  display: WeatherDisplay;
};

export type WeatherCurrent = {
  time?: string | null;
  interval?: number | null;
  temperature_2m?: number | null;
  relative_humidity_2m?: number | null;
  apparent_temperature?: number | null;
  is_day?: number | null;
  precipitation?: number | null;
  rain?: number | null;
  showers?: number | null;
  snowfall?: number | null;
  weather_code?: number | null;
  cloud_cover?: number | null;
  pressure_msl?: number | null;
  surface_pressure?: number | null;
  wind_speed_10m?: number | null;
  wind_direction_10m?: number | null;
  wind_gusts_10m?: number | null;
  visibility?: number | null;
  uv_index?: number | null;
  dew_point_2m?: number | null;
  vapour_pressure_deficit?: number | null;
  et0_fao_evapotranspiration?: number | null;
  shortwave_radiation?: number | null;
} | null;

export type WeatherHourly = {
  time: string[];
  temperature_2m?: (number | null)[] | null;
  relative_humidity_2m?: (number | null)[] | null;
  dew_point_2m?: (number | null)[] | null;
  apparent_temperature?: (number | null)[] | null;
  precipitation_probability?: (number | null)[] | null;
  precipitation?: (number | null)[] | null;
  rain?: (number | null)[] | null;
  showers?: (number | null)[] | null;
  snowfall?: (number | null)[] | null;
  weather_code?: (number | null)[] | null;
  pressure_msl?: (number | null)[] | null;
  cloud_cover?: (number | null)[] | null;
  visibility?: (number | null)[] | null;
  wind_speed_10m?: (number | null)[] | null;
  wind_direction_10m?: (number | null)[] | null;
  wind_gusts_10m?: (number | null)[] | null;
  uv_index?: (number | null)[] | null;
  is_day?: (number | null)[] | null;
  sunshine_duration?: (number | null)[] | null;
  shortwave_radiation?: (number | null)[] | null;
} | null;

export type WeatherDaily = {
  time: string[];
  weather_code?: (number | null)[] | null;
  temperature_2m_max?: (number | null)[] | null;
  temperature_2m_min?: (number | null)[] | null;
  apparent_temperature_max?: (number | null)[] | null;
  apparent_temperature_min?: (number | null)[] | null;
  sunrise?: (string | null)[] | null;
  sunset?: (string | null)[] | null;
  daylight_duration?: (number | null)[] | null;
  sunshine_duration?: (number | null)[] | null;
  uv_index_max?: (number | null)[] | null;
  uv_index_clear_sky_max?: (number | null)[] | null;
  precipitation_sum?: (number | null)[] | null;
  rain_sum?: (number | null)[] | null;
  showers_sum?: (number | null)[] | null;
  snowfall_sum?: (number | null)[] | null;
  precipitation_hours?: (number | null)[] | null;
  precipitation_probability_max?: (number | null)[] | null;
  wind_speed_10m_max?: (number | null)[] | null;
  wind_gusts_10m_max?: (number | null)[] | null;
  wind_direction_10m_dominant?: (number | null)[] | null;
  shortwave_radiation_sum?: (number | null)[] | null;
  et0_fao_evapotranspiration?: (number | null)[] | null;
} | null;

export type WeatherPayload = {
  ok: boolean;
  error: string | null;
  updated_at: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  timezone: string | null;
  timezone_abbreviation: string | null;
  utc_offset_seconds: number | null;
  current: WeatherCurrent;
  current_units: Record<string, string> | null;
  hourly: WeatherHourly;
  hourly_units: Record<string, string> | null;
  daily: WeatherDaily;
  daily_units: Record<string, string> | null;
  location: WeatherLocation | null;
  units: WeatherUnits | null;
};

export type WeatherGeocodingResult = {
  id?: number | null;
  name: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  country_code?: string | null;
  admin1?: string | null;
  admin2?: string | null;
  admin3?: string | null;
  admin4?: string | null;
  timezone?: string | null;
  elevation?: number | null;
  population?: number | null;
  feature_code?: string | null;
  postcodes?: string[] | null;
};

export type CurrencyKind = "fiat" | "crypto";

export type CurrencyItem = {
  id: string;
  kind: CurrencyKind;
  code: string;
  label: string;
};

export type CurrenciesConfig = {
  enabled: boolean;
  hidden: boolean;
  base: string;
  items: CurrencyItem[];
};

export type CurrencyQuote = {
  id: string;
  kind: CurrencyKind;
  code: string;
  label: string;
  price: number | null;
  ok: boolean;
  error: string | null;
};

export type CurrenciesPayload = {
  ok: boolean;
  error: string | null;
  updated_at: string | null;
  base: string;
  items: CurrencyQuote[];
};

export type CurrencySearchResult = { id: string; symbol: string; name: string };

export type GitCommit = {
  hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  date: string;
  subject: string;
  body: string;
};

export type GitRepo = {
  id: string;
  label: string;
  source: string;
  branch: string | null;
  limit: number;
  ok: boolean;
  error: string | null;
  commits: GitCommit[];
  updated_at: string | null;
  head: string | null;
  remote_url: string | null;
};

export type GitPayload = {
  ok: boolean;
  error: string | null;
  updated_at: string | null;
  repos: GitRepo[];
};

export type GitConfig = {
  enabled: boolean;
  hidden: boolean;
  repos: Array<{ id: string; source: string; label: string; limit: number; branch: string | null }>;
};

export type RetroRecentlyPlayed = {
  game_id: number | null;
  title: string | null;
  console_name: string | null;
  image_icon: string | null;
  last_played: string | null;
  achievements_total: number | null;
  num_achieved: number | null;
  score_achieved: number | null;
};

export type RetroRecentAchievement = {
  id: number | null;
  game_id: number | null;
  game_title: string | null;
  title: string | null;
  description: string | null;
  points: number | null;
  badge_name: string | null;
  badge_url: string | null;
  date_awarded: string | null;
  hardcore: boolean | null;
};

export type RetroAwards = {
  total_awards_count: number | null;
  mastery_awards_count: number | null;
  completion_awards_count: number | null;
  beaten_hardcore_awards_count: number | null;
  beaten_softcore_awards_count: number | null;
  event_awards_count: number | null;
  site_awards_count: number | null;
};

export type RetroCompletionProgress = {
  total: number | null;
  count: number | null;
};

export type RetroAchievementsAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  username: string | null;
  ulid: string | null;
  user_pic: string | null;
  member_since: string | null;
  motto: string | null;
  total_points: number | null;
  total_softcore_points: number | null;
  total_true_points: number | null;
  rank: number | null;
  total_ranked: number | null;
  status: string | null;
  rich_presence_msg: string | null;
  rich_presence_msg_date: string | null;
  last_game_id: number | null;
  last_game_title: string | null;
  last_game_console: string | null;
  last_game_image_icon: string | null;
  recently_played: RetroRecentlyPlayed[];
  recent_achievements: RetroRecentAchievement[];
  awards: RetroAwards | null;
  completion_progress: RetroCompletionProgress | null;
  updated_at: string | null;
};

export type CalendarKind = "events" | "tasks";

export type CalendarEvent = {
  uid: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  dtstart: string | null;
  dtend: string | null;
  due: string | null;
  status: string | null;
  allDay: boolean;
  kind: CalendarKind;
};

export type CalendarSource = {
  id: string;
  label: string;
  url: string;
  kind: CalendarKind;
  limit: number;
  ok: boolean;
  error: string | null;
  events: CalendarEvent[];
  updated_at: string | null;
};

export type CalendarPayload = {
  ok: boolean;
  error: string | null;
  updated_at: string | null;
  calendars: CalendarSource[];
};

export type CalendarConfig = {
  enabled: boolean;
  hidden: boolean;
  calendars: Array<{ id: string; url: string; label: string; kind: CalendarKind; limit: number }>;
};

export type RssItem = {
  title: string;
  link: string | null;
  description: string | null;
  pubDate: string | null;
  author: string | null;
  categories: string[];
  guid: string | null;
  enclosure: string | null;
};

export type RssFeed = {
  id: string;
  label: string;
  url: string;
  limit: number;
  ok: boolean;
  error: string | null;
  title: string | null;
  description: string | null;
  link: string | null;
  items: RssItem[];
  updated_at: string | null;
};

export type RssPayload = {
  ok: boolean;
  error: string | null;
  updated_at: string | null;
  feeds: RssFeed[];
};

export type RssConfig = {
  enabled: boolean;
  hidden: boolean;
  feeds: Array<{ id: string; url: string; label: string; limit: number }>;
};

export type UsagePayload = {
  updated_at: string;
  claude: ClaudeAccount[];
  gpt: GptAccount[];
  cursor: CursorAccount[];
  openrouter: CreditsAccount[];
  deepseek: CreditsAccount[];
  opencode: OpenCodeAccount[];
  fal: CreditsAccount[];
  bitcoin: BitcoinAccount[];
  adsense: AdsenseAccount[];
  retroachievements: RetroAchievementsAccount[];
  weather?: WeatherPayload | null;
  currencies?: CurrenciesPayload | null;
  git?: GitPayload | null;
  calendar?: CalendarPayload | null;
  rss?: RssPayload | null;
};

export type AccountPublic = { id: string; label: string; suffix: string | null };

export type ProviderCardPublic = {
  source: string;
  label: string;
  configured: boolean;
  suffix: string | null;
  mode: string;
  hidden: boolean;
  local_label: string;
  primary_label: string;
  accounts: AccountPublic[];
};

export type DevicePublic = {
  ip: string | null;
  last_seen_s: number | null;
  width: number | null;
  height: number | null;
};

export type AlarmMetricKind = "percent" | "cents";

export type AlarmMetric = { key: string; label: string; kind: AlarmMetricKind };

export type AlarmRule = {
  id: string;
  provider: string;
  account_id: string;
  metric: string;
  threshold: number;
  enabled: boolean;
  label: string;
};

export type AlarmsPublic = {
  rules: AlarmRule[];
  metrics: Record<string, AlarmMetric[]>;
};

export type TelegramChat = {
  id: string;
  label: string;
  added_at: string;
};

export type TelegramStatus = {
  configured: boolean;
  bot_username: string;
  chats: TelegramChat[];
};

export type ConfigPublic = {
  ok: boolean;
  in_docker: boolean;
  mock: boolean;
  listen: { host: string; port: number };
  urls: {
    panel: string[];
    usage: string[];
    usage_lan: string;
    usage_local: string;
    secrets_h: string;
    secrets_h_file: string;
    board_ok: boolean;
  };
  lan_ips: string[];
  restart_needed_for_port: boolean;
  providers: Record<string, ProviderCardPublic>;
  weather: WeatherConfig;
  currencies: CurrenciesConfig;
  git: GitConfig;
  calendar: CalendarConfig;
  rss: RssConfig;
  device: DevicePublic;
};
