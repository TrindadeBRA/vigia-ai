import { isoBrt, utcNow } from "./formatting.js";
import { adsenseFail, fetchAdsenseAccounts } from "./providers/adsense.js";
import { bitcoinFail, fetchBitcoinAccounts } from "./providers/bitcoin.js";
import { fetchCalendarSources, mockCalendarPayload } from "./providers/calendar.js";
import { claudeFail, fetchClaudeAccounts } from "./providers/claude.js";
import { fetchCurrencyQuotes, mockCurrenciesPayload } from "./providers/currencies.js";
import { cursorFail, fetchCursorAccounts } from "./providers/cursor.js";
import { deepseekFail, fetchDeepseekAccounts } from "./providers/deepseek.js";
import { falFail, fetchFalAccounts } from "./providers/fal.js";
import { fetchGitRepos, mockGitPayload } from "./providers/git.js";
import { fetchGptAccounts, gptFail } from "./providers/gpt.js";
import { fetchOpencodeAccounts, opencodeFail } from "./providers/opencode.js";
import { fetchOpenrouterAccounts, openrouterFail } from "./providers/openrouter.js";
import { fetchRetroachievementsAccounts, mockRetroPayload, retroFail } from "./providers/retroachievements.js";
import { fetchRssFeeds, mockRssPayload } from "./providers/rss.js";
import { fetchWeatherData, mockWeatherPayload } from "./providers/weather.js";
import { cache, fingerprint } from "./refreshCache.js";
import { load, provider as providerCfg } from "./store.js";

export function mockPayload(): Record<string, unknown> {
  const now = utcNow();
  const nowDate = new Date();
  // BRT now +27 days for cursor cycle_end
  // isoBrt for cycle_end uses BRT formatting
  const cycleEnd = isoBrt(new Date(nowDate.getTime() + 27 * 24 * 3600 * 1000));
  return {
    updated_at: now,
    claude: [
      {
        id: "local",
        label: "",
        ok: true,
        error: null,
        session_percent: 42.0,
        session_resets_at: now,
        weekly_percent: 18.0,
        weekly_resets_at: now,
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
        session_resets_at: now,
        weekly_percent: 8.0,
        weekly_resets_at: now,
        plan: "plus",
      },
    ],
    cursor: [
      {
        id: "local",
        label: "",
        ok: true,
        error: null,
        percent: 70.0,
        other_percent: 73.0,
        used_cents: 0,
        limit_cents: 1000,
        remaining_cents: 1000,
        bonus_cents: 0,
        cycle_end: cycleEnd,
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
        rolling_resets_at: now,
        weekly_percent: 20.0,
        weekly_resets_at: now,
        monthly_percent: 10.0,
        monthly_resets_at: now,
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
    retroachievements: [{ id: "legacy", label: "", ...(mockRetroPayload() as Record<string, unknown>) }],
    weather: mockWeatherPayload(),
    currencies: mockCurrenciesPayload(),
    git: mockGitPayload(),
    calendar: mockCalendarPayload(),
    rss: mockRssPayload(),
  };
}

type ProviderJob = [string, (cfg: Record<string, unknown>) => Promise<unknown[]>, (msg: string) => Record<string, unknown>, string];

const PROVIDER_JOBS: ProviderJob[] = [
  ["claude", fetchClaudeAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, claudeFail as unknown as (msg: string) => Record<string, unknown>, "local"],
  ["gpt", fetchGptAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, gptFail as unknown as (msg: string) => Record<string, unknown>, "local"],
  ["cursor", fetchCursorAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, cursorFail as unknown as (msg: string) => Record<string, unknown>, "local"],
  ["openrouter", fetchOpenrouterAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, openrouterFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
  ["deepseek", fetchDeepseekAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, deepseekFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
  ["opencode", fetchOpencodeAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, opencodeFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
  ["fal", fetchFalAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, falFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
  ["bitcoin", fetchBitcoinAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, bitcoinFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
  ["adsense", fetchAdsenseAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, adsenseFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
  ["retroachievements", fetchRetroachievementsAccounts as unknown as (cfg: Record<string, unknown>) => Promise<unknown[]>, retroFail as unknown as (msg: string) => Record<string, unknown>, "legacy"],
];

async function fetchOne(
  name: string,
  fetchFn: (cfg: Record<string, unknown>) => Promise<unknown[]>,
  failFn: (msg: string) => Record<string, unknown>,
  fallbackId: string,
  cfg: Record<string, unknown>,
  force: boolean,
): Promise<[string, unknown[]]> {
  const fp = fingerprint(cfg, name);
  if (!cache.due(name, { fingerprint: fp, force })) {
    const hit = cache.get(name);
    if (Array.isArray(hit)) return [name, hit as unknown[]];
  }
  try {
    const value = await fetchFn(cfg);
    return [name, cache.take(name, value, { fingerprint: fp }) as unknown[]];
  } catch (exc) {
    const msg = String(exc);
    const value = [{ id: fallbackId, label: "", ...failFn(msg) }];
    return [name, cache.take(name, value, { fingerprint: fp, error: exc }) as unknown[]];
  }
}

async function fetchWeather(cfg: Record<string, unknown>, force: boolean): Promise<Record<string, unknown> | null> {
  const weatherCfg = (cfg.weather ?? {}) as Record<string, unknown>;
  if (weatherCfg.hidden || !weatherCfg.enabled) return null;
  if (cfg.mock) return mockWeatherPayload() as Record<string, unknown>;
  const fp = fingerprint(cfg, "weather");
  if (!cache.due("weather", { fingerprint: fp, force })) {
    const hit = cache.get("weather");
    if (hit !== null && hit !== undefined) return hit as Record<string, unknown>;
  }
  try {
    const value = await fetchWeatherData(weatherCfg);
    return cache.take("weather", value, { fingerprint: fp }) as Record<string, unknown>;
  } catch (exc) {
    const value = {
      ok: false,
      error: String(exc),
      updated_at: utcNow(),
      current: null,
      hourly: null,
      daily: null,
      location: weatherCfg.location,
      units: weatherCfg.units,
    };
    return cache.take("weather", value, { fingerprint: fp, error: exc }) as Record<string, unknown>;
  }
}

async function fetchGit(cfg: Record<string, unknown>, force: boolean): Promise<Record<string, unknown> | null> {
  const gcfg = (cfg.git ?? {}) as Record<string, unknown>;
  if (gcfg.hidden || !gcfg.enabled) return null;
  const repos = Array.isArray(gcfg.repos) ? gcfg.repos as unknown[] : [];
  if (repos.length === 0) return { ok: true, error: null, updated_at: utcNow(), repos: [] };
  if (cfg.mock) return mockGitPayload() as Record<string, unknown>;
  const fp = fingerprint(cfg, "git");
  if (!cache.due("git", { fingerprint: fp, force })) {
    const hit = cache.get("git");
    if (hit !== null && hit !== undefined) return hit as Record<string, unknown>;
  }
  try {
    const reposData = await fetchGitRepos(cfg);
    const value = { ok: true, error: null, updated_at: utcNow(), repos: reposData };
    return cache.take("git", value, { fingerprint: fp }) as Record<string, unknown>;
  } catch (exc) {
    const value = { ok: false, error: String(exc), updated_at: utcNow(), repos: [] };
    return cache.take("git", value, { fingerprint: fp, error: exc }) as Record<string, unknown>;
  }
}

async function fetchRss(cfg: Record<string, unknown>, force: boolean): Promise<Record<string, unknown> | null> {
  const rssCfg = (cfg.rss ?? {}) as Record<string, unknown>;
  if (rssCfg.hidden || !rssCfg.enabled) return null;
  const feeds = Array.isArray(rssCfg.feeds) ? rssCfg.feeds as unknown[] : [];
  if (feeds.length === 0) return { ok: true, error: null, updated_at: utcNow(), feeds: [] };
  if (cfg.mock) return mockRssPayload() as Record<string, unknown>;
  const fp = fingerprint(cfg, "rss");
  if (!cache.due("rss", { fingerprint: fp, force })) {
    const hit = cache.get("rss");
    if (hit !== null && hit !== undefined) return hit as Record<string, unknown>;
  }
  try {
    const rssFeeds = await fetchRssFeeds(cfg) as Array<{ ok: boolean; error: string | null }>;
    const ok = rssFeeds.every((c: { ok: boolean }) => c.ok);
    const value = { ok, error: ok ? null : rssFeeds.find((c: { ok: boolean; error: string | null }) => !c.ok)?.error || null, updated_at: utcNow(), feeds: rssFeeds };
    return cache.take("rss", value, { fingerprint: fp }) as Record<string, unknown>;
  } catch (exc) {
    const value = { ok: false, error: String(exc), updated_at: utcNow(), feeds: [] };
    return cache.take("rss", value, { fingerprint: fp, error: exc }) as Record<string, unknown>;
  }
}

async function fetchCalendar(cfg: Record<string, unknown>, force: boolean): Promise<Record<string, unknown> | null> {
  const calCfg = (cfg.calendar ?? {}) as Record<string, unknown>;
  if (calCfg.hidden || !calCfg.enabled) return null;
  const cals = Array.isArray(calCfg.calendars) ? calCfg.calendars as unknown[] : [];
  if (cals.length === 0) return { ok: true, error: null, updated_at: utcNow(), calendars: [] };
  if (cfg.mock) return mockCalendarPayload() as Record<string, unknown>;
  const fp = fingerprint(cfg, "calendar");
  if (!cache.due("calendar", { fingerprint: fp, force })) {
    const hit = cache.get("calendar");
    if (hit !== null && hit !== undefined) return hit as Record<string, unknown>;
  }
  try {
    const calendars = await fetchCalendarSources(cfg) as Array<{ ok: boolean; error: string | null }>;
    const ok = calendars.every((c: { ok: boolean }) => c.ok);
    const value = { ok, error: ok ? null : calendars.find((c: { ok: boolean; error: string | null }) => !c.ok)?.error || null, updated_at: utcNow(), calendars };
    return cache.take("calendar", value, { fingerprint: fp }) as Record<string, unknown>;
  } catch (exc) {
    const value = { ok: false, error: String(exc), updated_at: utcNow(), calendars: [] };
    return cache.take("calendar", value, { fingerprint: fp, error: exc }) as Record<string, unknown>;
  }
}

async function fetchCurrencies(cfg: Record<string, unknown>, force: boolean): Promise<Record<string, unknown> | null> {
  const ccfg = (cfg.currencies ?? {}) as Record<string, unknown>;
  const base = String(ccfg.base ?? "BRL");
  if (ccfg.hidden || !ccfg.enabled) return null;
  if (cfg.mock) return mockCurrenciesPayload() as Record<string, unknown>;
  const fp = fingerprint(cfg, "currencies");
  if (!cache.due("currencies", { fingerprint: fp, force })) {
    const hit = cache.get("currencies");
    if (hit !== null && hit !== undefined) return hit as Record<string, unknown>;
  }
  try {
    const value = await fetchCurrencyQuotes(ccfg);
    return cache.take("currencies", value, { fingerprint: fp }) as Record<string, unknown>;
  } catch (exc) {
    const value = { ok: false, error: String(exc), updated_at: utcNow(), base, items: [] };
    return cache.take("currencies", value, { fingerprint: fp, error: exc }) as Record<string, unknown>;
  }
}

export async function buildPayload(opts: { forceQuota?: boolean } = {}): Promise<Record<string, unknown>> {
  const forceQuota = opts.forceQuota ?? false;
  const cfg = load() as Record<string, unknown>;
  if (cfg.mock) {
    const payload = mockPayload();
    for (const [name] of PROVIDER_JOBS) {
      const p = providerCfg(cfg, name) as Record<string, unknown>;
      if (p.hidden) (payload as Record<string, unknown>)[name] = [];
    }
    const wcfg = (cfg.weather ?? {}) as Record<string, unknown>;
    if (wcfg.hidden || !wcfg.enabled) payload.weather = null;
    const ccfg = (cfg.currencies ?? {}) as Record<string, unknown>;
    if (ccfg.hidden || !ccfg.enabled) payload.currencies = null;
    const gcfg = (cfg.git ?? {}) as Record<string, unknown>;
    if (gcfg.hidden || !gcfg.enabled || (Array.isArray(gcfg.repos) && (gcfg.repos as unknown[]).length === 0)) {
      // em mock, mantém git se tiver repos; senão null
      if (!gcfg.enabled || (Array.isArray(gcfg.repos) && (gcfg.repos as unknown[]).length === 0)) payload.git = null;
    }
    const calCfg = (cfg.calendar ?? {}) as Record<string, unknown>;
    if (calCfg.hidden || !calCfg.enabled || (Array.isArray(calCfg.calendars) && (calCfg.calendars as unknown[]).length === 0)) {
      if (!calCfg.enabled || (Array.isArray(calCfg.calendars) && (calCfg.calendars as unknown[]).length === 0)) payload.calendar = null;
    }
    const rssCfg = (cfg.rss ?? {}) as Record<string, unknown>;
    if (rssCfg.hidden || !rssCfg.enabled || (Array.isArray(rssCfg.feeds) && (rssCfg.feeds as unknown[]).length === 0)) {
      if (!rssCfg.enabled || (Array.isArray(rssCfg.feeds) && (rssCfg.feeds as unknown[]).length === 0)) payload.rss = null;
    }
    return payload;
  }

  // 9 HTTP calls concurrent via Promise.all (native async)
  const providerPromises = PROVIDER_JOBS.map(([name, fetchFn, failFn, fallbackId]) =>
    fetchOne(name, fetchFn, failFn, fallbackId, cfg, forceQuota),
  );
  const weatherPromise = fetchWeather(cfg, forceQuota).catch((exc) => ({
    ok: false,
    error: String(exc),
    updated_at: utcNow(),
    current: null,
    hourly: null,
    daily: null,
  }));
  const currenciesPromise = fetchCurrencies(cfg, forceQuota).catch((exc) => ({
    ok: false,
    error: String(exc),
    updated_at: utcNow(),
    base: String(((cfg.currencies as Record<string, unknown>) ?? {}).base ?? "BRL"),
    items: [],
  }));
  const gitPromise = fetchGit(cfg, forceQuota).catch((exc) => ({
    ok: false,
    error: String(exc),
    updated_at: utcNow(),
    repos: [],
  }));
  const calendarPromise = fetchCalendar(cfg, forceQuota).catch((exc) => ({
    ok: false,
    error: String(exc),
    updated_at: utcNow(),
    calendars: [],
  }));
  const rssPromise = fetchRss(cfg, forceQuota).catch((exc) => ({
    ok: false,
    error: String(exc),
    updated_at: utcNow(),
    feeds: [],
  }));

  const resultsArray = await Promise.all(providerPromises);
  const results: Record<string, unknown> = {};
  for (const [name, value] of resultsArray) results[name] = value;

  try {
    results.weather = await weatherPromise;
  } catch (exc) {
    results.weather = { ok: false, error: String(exc), updated_at: utcNow(), current: null, hourly: null, daily: null };
  }
  try {
    results.currencies = await currenciesPromise;
  } catch (exc) {
    results.currencies = {
      ok: false,
      error: String(exc),
      updated_at: utcNow(),
      base: String(((cfg.currencies as Record<string, unknown>) ?? {}).base ?? "BRL"),
      items: [],
    };
  }
  try {
    results.git = await gitPromise;
  } catch (exc) {
    results.git = { ok: false, error: String(exc), updated_at: utcNow(), repos: [] };
  }
  try {
    results.calendar = await calendarPromise;
  } catch (exc) {
    results.calendar = { ok: false, error: String(exc), updated_at: utcNow(), calendars: [] };
  }
  try {
    results.rss = await rssPromise;
  } catch (exc) {
    results.rss = { ok: false, error: String(exc), updated_at: utcNow(), feeds: [] };
  }

  return { updated_at: utcNow(), ...results };
}

// snake_case aliases
export const mock_payload = mockPayload;
export const build_payload = buildPayload;
