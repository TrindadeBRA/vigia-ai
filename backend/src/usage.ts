import { utcNow, isoBrt } from "./formatting.js";
import { fetchClaudeAccounts, claudeFail } from "./providers/claude.js";
import { fetchGptAccounts, gptFail } from "./providers/gpt.js";
import { fetchCursorAccounts, cursorFail } from "./providers/cursor.js";
import { fetchOpenrouterAccounts, openrouterFail } from "./providers/openrouter.js";
import { fetchDeepseekAccounts, deepseekFail } from "./providers/deepseek.js";
import { fetchOpencodeAccounts, opencodeFail } from "./providers/opencode.js";
import { fetchFalAccounts, falFail } from "./providers/fal.js";
import { fetchBitcoinAccounts, bitcoinFail } from "./providers/bitcoin.js";
import { fetchAdsenseAccounts, adsenseFail } from "./providers/adsense.js";
import { fetchWeatherData, mockWeatherPayload } from "./providers/weather.js";
import { fetchCurrencyQuotes, mockCurrenciesPayload } from "./providers/currencies.js";
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
    weather: mockWeatherPayload(),
    currencies: mockCurrenciesPayload(),
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

  return { updated_at: utcNow(), ...results };
}

// snake_case aliases
export const mock_payload = mockPayload;
export const build_payload = buildPayload;
