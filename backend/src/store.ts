import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync, mkdirSync } from "node:fs";
import { dataDir as configDataDir, configPath as configConfigPath } from "./config.js";

export const PROVIDERS = [
  "claude",
  "gpt",
  "cursor",
  "openrouter",
  "deepseek",
  "opencode",
  "fal",
  "bitcoin",
  "adsense",
] as const;
export type ProviderName = typeof PROVIDERS[number];

const _EMPTY_PROVIDER: Record<string, unknown> = {
  hidden: false,
  local_label: "",
  paste_secret: "",
  accounts: [],
};

const _WEATHER_DEFAULT: Record<string, unknown> = {
  enabled: false,
  hidden: false,
  location: {
    name: "",
    latitude: null,
    longitude: null,
    country: "",
    country_code: "",
    timezone: "auto",
    elevation: null,
  },
  units: {
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  },
  forecast_days: 7,
  past_days: 0,
  timezone: "auto",
  current: [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "weather_code",
    "wind_speed_10m",
    "precipitation",
  ],
  hourly: [
    "temperature_2m",
    "precipitation_probability",
    "weather_code",
    "wind_speed_10m",
  ],
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "sunrise",
    "sunset",
    "uv_index_max",
  ],
  display: {
    show_current: true,
    show_hourly: true,
    show_daily: true,
    hourly_count: 12,
    daily_count: 7,
    fields: {
      temperature: true,
      feels_like: true,
      humidity: true,
      precipitation: true,
      wind: true,
      pressure: true,
      cloud_cover: true,
      uv_index: true,
      sunrise_sunset: true,
    },
  },
};

const _CURRENCIES_DEFAULT: Record<string, unknown> = {
  enabled: false,
  hidden: false,
  base: "BRL",
  items: [],
};

const _WALLPAPER_PROVIDERS_DEFAULT: Record<string, unknown> = {
  pexels_key: "",
  unsplash_key: "",
  wallhaven_key: "",
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function defaultConfig(): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    version: 1,
    listen: { host: "0.0.0.0", port: 8787 },
    mock: false,
    paths: { claude_credentials: "", cursor_state_db: "", codex_auth: "" },
    providers: {} as Record<string, unknown>,
    telegram: { bot_token: "", bot_username: "", chats: [] },
    alarms: [],
    weather: deepClone(_WEATHER_DEFAULT),
    currencies: deepClone(_CURRENCIES_DEFAULT),
    wallpapers: {
      providers: deepClone(_WALLPAPER_PROVIDERS_DEFAULT),
      selected_id: "",
    },
  };
  const providers = cfg.providers as Record<string, unknown>;
  for (const name of PROVIDERS) {
    providers[name] = deepClone(_EMPTY_PROVIDER);
  }
  const adsense = providers.adsense as Record<string, unknown>;
  adsense.client_id = "";
  adsense.client_secret = "";
  adsense.refresh_token = "";
  adsense.account_name = "";
  (cfg.wallpapers as Record<string, unknown>).grid_selected_id = "";
  return cfg;
}

export function _emptyProvider(): Record<string, unknown> {
  return deepClone(_EMPTY_PROVIDER);
}

export function _parseAccountsBlob(raw: unknown, secretField: string): Array<Record<string, string>> {
  if (!raw) return [];
  let parsed: unknown;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  } else {
    parsed = raw;
  }
  if (!Array.isArray(parsed)) return [];
  const out: Array<Record<string, string>> = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null || !(item as Record<string, unknown>).id) continue;
    const it = item as Record<string, unknown>;
    const secret = String(it[secretField] ?? it.secret ?? it.token ?? it.key ?? "");
    if (!secret) continue;
    out.push({
      id: String(it.id),
      label: String(it.label ?? ""),
      secret,
    });
  }
  return out;
}

function _flag(raw: unknown): boolean {
  return String(raw ?? "").trim().toLowerCase() === "1" ||
    String(raw ?? "").trim().toLowerCase() === "true" ||
    String(raw ?? "").trim().toLowerCase() === "yes";
}

export function _parseTelegramChats(raw: unknown): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, string>> = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const it = item as Record<string, unknown>;
    const chatId = String(it.id ?? "");
    if (!chatId) continue;
    out.push({
      id: chatId,
      label: String(it.label ?? ""),
      added_at: String(it.added_at ?? ""),
    });
  }
  return out;
}

export function _parseAlarms(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const it = item as Record<string, unknown>;
    if (!it.id || !it.provider || !it.metric) continue;
    let threshold: number;
    try {
      threshold = Number(it.threshold);
      if (Number.isNaN(threshold) || !Number.isFinite(threshold)) continue;
    } catch {
      continue;
    }
    out.push({
      id: String(it.id),
      provider: String(it.provider),
      account_id: String(it.account_id ?? "*"),
      metric: String(it.metric),
      threshold,
      enabled: Boolean((it as Record<string, unknown>).enabled ?? true),
      label: String(it.label ?? ""),
    });
  }
  return out;
}

export function migrateLegacy(raw: Record<string, unknown>): Record<string, unknown> {
  const cfg = defaultConfig();
  const host = String(raw.HOST ?? "0.0.0.0").trim() || "0.0.0.0";
  const portS = String(raw.PORT ?? "8787").trim() || "8787";
  let port: number;
  try {
    port = parseInt(portS, 10);
    if (Number.isNaN(port)) port = 8787;
  } catch {
    port = 8787;
  }
  cfg.listen = { host, port };
  cfg.mock = _flag(raw.COLLECTOR_MOCK);
  (cfg.paths as Record<string, unknown>).claude_credentials = String(raw.CLAUDE_CREDENTIALS_PATH ?? "");
  (cfg.paths as Record<string, unknown>).cursor_state_db = String(raw.CURSOR_STATE_DB ?? "");

  const providers = cfg.providers as Record<string, Record<string, unknown>>;

  const claude = providers.claude;
  claude.hidden = _flag(raw.CLAUDE_HIDDEN);
  claude.local_label = String(raw.CLAUDE_LOCAL_LABEL ?? "");
  claude.paste_secret = String(raw.CLAUDE_OAUTH_TOKEN ?? raw.CLAUDE_CODE_OAUTH_TOKEN ?? "");
  claude.accounts = _parseAccountsBlob(raw.CLAUDE_ACCOUNTS, "token");

  const gpt = providers.gpt;
  gpt.hidden = _flag(raw.GPT_HIDDEN);
  gpt.local_label = String(raw.GPT_LOCAL_LABEL ?? "");
  gpt.paste_secret = String(raw.GPT_OAUTH_TOKEN ?? raw.CODEX_ACCESS_TOKEN ?? "");
  gpt.accounts = _parseAccountsBlob(raw.GPT_ACCOUNTS ?? raw.CODEX_ACCOUNTS, "token");

  const cursor = providers.cursor;
  cursor.hidden = _flag(raw.CURSOR_HIDDEN);
  cursor.local_label = String(raw.CURSOR_LOCAL_LABEL ?? "");
  cursor.paste_secret = String(raw.CURSOR_ACCESS_TOKEN ?? "");
  cursor.accounts = _parseAccountsBlob(raw.CURSOR_ACCOUNTS, "token");

  const openrouter = providers.openrouter;
  openrouter.hidden = _flag(raw.OPENROUTER_HIDDEN);
  openrouter.local_label = String(raw.OPENROUTER_LEGACY_LABEL ?? "");
  openrouter.paste_secret = String(raw.OPENROUTER_API_KEY ?? "");
  openrouter.accounts = _parseAccountsBlob(raw.OPENROUTER_ACCOUNTS, "key");

  const deepseek = providers.deepseek;
  deepseek.hidden = _flag(raw.DEEPSEEK_HIDDEN);
  deepseek.local_label = String(raw.DEEPSEEK_LEGACY_LABEL ?? "");
  deepseek.paste_secret = String(raw.DEEPSEEK_API_KEY ?? "");
  deepseek.accounts = _parseAccountsBlob(raw.DEEPSEEK_ACCOUNTS, "key");

  return cfg;
}

export function _normalize(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.version !== 1 || !("providers" in raw)) {
    if (Object.keys(raw).some((k) => k.startsWith("CLAUDE_") || ["HOST", "PORT", "COLLECTOR_MOCK"].includes(k))) {
      return migrateLegacy(raw);
    }
    return defaultConfig();
  }
  const cfg = defaultConfig();
  const listen = (typeof raw.listen === "object" && raw.listen !== null ? raw.listen : {}) as Record<string, unknown>;
  (cfg.listen as Record<string, unknown>).host = String(listen.host ?? "0.0.0.0");
  try {
    (cfg.listen as Record<string, unknown>).port = parseInt(String(listen.port ?? 8787), 10);
    if (Number.isNaN((cfg.listen as Record<string, unknown>).port as number)) throw new Error();
  } catch {
    (cfg.listen as Record<string, unknown>).port = 8787;
  }
  cfg.mock = Boolean(raw.mock);
  const paths = (typeof raw.paths === "object" && raw.paths !== null ? raw.paths : {}) as Record<string, unknown>;
  (cfg.paths as Record<string, unknown>).claude_credentials = String(paths.claude_credentials ?? "");
  (cfg.paths as Record<string, unknown>).cursor_state_db = String(paths.cursor_state_db ?? "");
  (cfg.paths as Record<string, unknown>).codex_auth = String(paths.codex_auth ?? "");
  const providersRaw = (typeof raw.providers === "object" && raw.providers !== null ? raw.providers : {}) as Record<string, unknown>;
  const providers = cfg.providers as Record<string, Record<string, unknown>>;
  for (const name of PROVIDERS) {
    const src = (typeof providersRaw[name] === "object" && providersRaw[name] !== null ? providersRaw[name] : {}) as Record<string, unknown>;
    const dest = providers[name];
    dest.hidden = Boolean(src.hidden);
    dest.local_label = String(src.local_label ?? "");
    dest.paste_secret = String(src.paste_secret ?? "");
    dest.accounts = _parseAccountsBlob((src as Record<string, unknown>).accounts ?? [], "secret");
    if (name === "adsense") {
      dest.client_id = String(src.client_id ?? "");
      dest.client_secret = String(src.client_secret ?? "");
      dest.refresh_token = String(src.refresh_token ?? "");
      dest.account_name = String(src.account_name ?? "");
    }
  }
  // Migration opencode_go/zen -> opencode
  const opencode = providers.opencode;
  if (!opencode.paste_secret && (opencode.accounts as unknown[]).length === 0) {
    for (const old of ["opencode_go", "opencode_zen"]) {
      const src = (typeof providersRaw[old] === "object" && providersRaw[old] !== null ? providersRaw[old] : null) as Record<string, unknown> | null;
      if (!src) continue;
      if (!opencode.paste_secret) opencode.paste_secret = String(src.paste_secret ?? "");
      if (!opencode.local_label) opencode.local_label = String(src.local_label ?? "");
      opencode.hidden = Boolean(opencode.hidden) || Boolean(src.hidden);
      opencode.accounts = _parseAccountsBlob(src.accounts ?? [], "secret");
    }
  }
  const telegramRaw = (typeof raw.telegram === "object" && raw.telegram !== null ? raw.telegram : {}) as Record<string, unknown>;
  (cfg.telegram as Record<string, unknown>).bot_token = String(telegramRaw.bot_token ?? "");
  (cfg.telegram as Record<string, unknown>).bot_username = String(telegramRaw.bot_username ?? "");
  (cfg.telegram as Record<string, unknown>).chats = _parseTelegramChats(telegramRaw.chats ?? []);
  cfg.alarms = _parseAlarms(raw.alarms ?? []);

  // Weather
  const rawWeather = (typeof raw.weather === "object" && raw.weather !== null ? raw.weather : {}) as Record<string, unknown>;
  const weather = cfg.weather as Record<string, unknown>;
  weather.enabled = Boolean(rawWeather.enabled ?? weather.enabled);
  weather.hidden = Boolean(rawWeather.hidden ?? weather.hidden);
  const rawLoc = (typeof rawWeather.location === "object" && rawWeather.location !== null ? rawWeather.location : {}) as Record<string, unknown>;
  const loc = weather.location as Record<string, unknown>;
  loc.name = String(rawLoc.name ?? loc.name ?? "");
  loc.country = String(rawLoc.country ?? loc.country ?? "");
  loc.country_code = String(rawLoc.country_code ?? loc.country_code ?? "");
  loc.timezone = String(rawLoc.timezone ?? loc.timezone ?? "auto") || "auto";
  try {
    const lat = rawLoc.latitude;
    loc.latitude = lat !== null && lat !== undefined && String(lat).trim() !== "" ? Number(lat) : null;
    if (loc.latitude !== null && Number.isNaN(loc.latitude as number)) loc.latitude = null;
  } catch {
    loc.latitude = null;
  }
  try {
    const lon = rawLoc.longitude;
    loc.longitude = lon !== null && lon !== undefined && String(lon).trim() !== "" ? Number(lon) : null;
    if (loc.longitude !== null && Number.isNaN(loc.longitude as number)) loc.longitude = null;
  } catch {
    loc.longitude = null;
  }
  try {
    const elev = rawLoc.elevation;
    loc.elevation = elev !== null && elev !== undefined && String(elev).trim() !== "" ? Number(elev) : null;
    if (loc.elevation !== null && Number.isNaN(loc.elevation as number)) loc.elevation = null;
  } catch {
    loc.elevation = null;
  }
  const rawUnits = (typeof rawWeather.units === "object" && rawWeather.units !== null ? rawWeather.units : {}) as Record<string, unknown>;
  const units = weather.units as Record<string, unknown>;
  for (const k of ["temperature_unit", "wind_speed_unit", "precipitation_unit"]) {
    if (k in rawUnits && typeof rawUnits[k] === "string" && String(rawUnits[k]).trim()) {
      units[k] = String(rawUnits[k]).trim();
    }
  }
  try {
    const fd = parseInt(String(rawWeather.forecast_days ?? weather.forecast_days), 10);
    if (!Number.isNaN(fd)) weather.forecast_days = Math.max(1, Math.min(16, fd));
  } catch {}
  try {
    const pd = parseInt(String(rawWeather.past_days ?? weather.past_days), 10);
    if (!Number.isNaN(pd)) weather.past_days = Math.max(0, Math.min(2, pd));
  } catch {}
  if (typeof rawWeather.timezone === "string" && rawWeather.timezone.trim()) {
    weather.timezone = String(rawWeather.timezone).trim();
  }
  for (const key of ["current", "hourly", "daily"]) {
    const rawList = (rawWeather as Record<string, unknown>)[key];
    if (Array.isArray(rawList)) {
      const cleaned = (rawList as unknown[]).filter((x) => typeof x === "string" && String(x).trim()).map((x) => String(x).trim());
      if (cleaned.length) (weather as Record<string, unknown>)[key] = cleaned;
    }
  }
  const rawDisplay = (typeof rawWeather.display === "object" && rawWeather.display !== null ? rawWeather.display : {}) as Record<string, unknown>;
  const disp = weather.display as Record<string, unknown>;
  for (const k of ["show_current", "show_hourly", "show_daily"]) {
    if (k in rawDisplay) disp[k] = Boolean(rawDisplay[k]);
  }
  for (const k of ["hourly_count", "daily_count"]) {
    if (k in rawDisplay) {
      try {
        const v = parseInt(String(rawDisplay[k]), 10);
        if (!Number.isNaN(v)) {
          if (k === "hourly_count") disp[k] = Math.max(1, Math.min(48, v));
          else disp[k] = Math.max(1, Math.min(16, v));
        }
      } catch {}
    }
  }
  const rawFields = (typeof rawDisplay.fields === "object" && rawDisplay.fields !== null ? rawDisplay.fields : {}) as Record<string, unknown>;
  const dispFields = disp.fields as Record<string, unknown>;
  for (const [fk, fv] of Object.entries(rawFields)) {
    if (fk in dispFields) dispFields[fk] = Boolean(fv);
  }

  // currencies
  const rawCur = (typeof raw.currencies === "object" && raw.currencies !== null ? raw.currencies : {}) as Record<string, unknown>;
  const cur = cfg.currencies as Record<string, unknown>;
  cur.enabled = Boolean(rawCur.enabled ?? cur.enabled);
  cur.hidden = Boolean(rawCur.hidden ?? cur.hidden);
  const rawBase = rawCur.base;
  if (typeof rawBase === "string" && /^[A-Za-z]{3}$/.test(rawBase.trim())) {
    cur.base = rawBase.trim().toUpperCase();
  }
  const rawItems = rawCur.items;
  if (Array.isArray(rawItems)) {
    const cleaned: Array<Record<string, unknown>> = [];
    for (const it of rawItems) {
      if (typeof it !== "object" || it === null || !(it as Record<string, unknown>).id) continue;
      const itm = it as Record<string, unknown>;
      const kind = itm.kind;
      const code = String(itm.code ?? "").trim();
      if ((kind !== "fiat" && kind !== "crypto") || !code) continue;
      cleaned.push({
        id: String(itm.id),
        kind,
        code: kind === "fiat" ? code.toUpperCase() : code.toLowerCase(),
        label: String(itm.label ?? ""),
      });
    }
    cur.items = cleaned;
  }

  // wallpapers
  const rawWp = (typeof raw.wallpapers === "object" && raw.wallpapers !== null ? raw.wallpapers : {}) as Record<string, unknown>;
  const wp = cfg.wallpapers as Record<string, unknown>;
  const rawProv = (typeof rawWp.providers === "object" && rawWp.providers !== null ? rawWp.providers : {}) as Record<string, unknown>;
  for (const k of ["pexels_key", "unsplash_key", "wallhaven_key"]) {
    if (k in rawProv && typeof rawProv[k] === "string") {
      (wp.providers as Record<string, unknown>)[k] = String(rawProv[k]).trim();
    }
  }
  if (typeof rawWp.selected_id === "string") {
    wp.selected_id = String(rawWp.selected_id).trim();
  } else if (!wp.selected_id) {
    const rawSl = (typeof rawWp.slideshow === "object" && rawWp.slideshow !== null ? rawWp.slideshow : {}) as Record<string, unknown>;
    const order = Array.isArray(rawSl.order) ? rawSl.order : [];
    const first = (order as unknown[]).find((x) => typeof x === "string" && String(x).trim());
    if (first) wp.selected_id = String(first).trim();
  }
  if (typeof rawWp.grid_selected_id === "string") {
    wp.grid_selected_id = String(rawWp.grid_selected_id).trim();
  }
  return cfg;
}

function _write(path: string, cfg: Record<string, unknown>): void {
  // ensure dataDir exists
  const dir = configDataDir();
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  // atomic write tmp + rename + chmod 0600
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n", { encoding: "utf-8" });
  // rename is atomic on same filesystem
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {}
}

// simple async mutex queue
let _queue: Promise<void> = Promise.resolve();
function _enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
  const next = _queue.then(() => fn());
  // keep queue alive even if fails
  _queue = next.then(() => {}, () => {});
  return next;
}

export function load(): Record<string, unknown> {
  const path = configConfigPath();
  if (!existsSync(path)) return defaultConfig();
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return defaultConfig();
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return defaultConfig();
  const cfg = _normalize(raw as Record<string, unknown>);
  if ((raw as Record<string, unknown>).version !== 1) {
    _write(path, cfg);
  }
  return cfg;
}

export async function save(cfg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const normalized = _normalize(cfg as Record<string, unknown>);
  await _enqueue(() => _write(configConfigPath(), normalized));
  return normalized;
}

// sync version for callers that expect immediate write (mirrors Python save)
export function saveSync(cfg: Record<string, unknown>): Record<string, unknown> {
  const normalized = _normalize(cfg as Record<string, unknown>);
  _write(configConfigPath(), normalized);
  return normalized;
}

export async function update(mutator: (cfg: Record<string, unknown>) => void | Promise<void>): Promise<Record<string, unknown>> {
  return _enqueue(async () => {
    const cfg = load();
    await mutator(cfg);
    const normalized = _normalize(cfg);
    _write(configConfigPath(), normalized);
    return normalized;
  });
}

// sync variant
export function updateSync(mutator: (cfg: Record<string, unknown>) => void): Record<string, unknown> {
  const cfg = load();
  mutator(cfg);
  const normalized = _normalize(cfg);
  _write(configConfigPath(), normalized);
  return normalized;
}

export function provider(cfg: Record<string, unknown>, name: string): Record<string, unknown> {
  const providers = cfg.providers as Record<string, unknown> | undefined;
  if (providers && typeof providers[name] === "object" && providers[name] !== null) {
    return providers[name] as Record<string, unknown>;
  }
  return _emptyProvider();
}

// re-export dir helpers
export function dataDir(): string {
  return configDataDir();
}
export function configPath(): string {
  return configConfigPath();
}
export const _normalize_export = _normalize;
export const migrate_legacy = migrateLegacy;
