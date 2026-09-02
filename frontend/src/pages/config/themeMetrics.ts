import type { UsagePayload } from "../../api/types";
import { fmtBtc, fmtMoney, fmtPct, fmtTemp, fmtUsd, wmoEmoji } from "../../format";
import type { Lang } from "../../i18n";

export type ThemeProvider =
  | "claude"
  | "gpt"
  | "cursor"
  | "openrouter"
  | "deepseek"
  | "opencode"
  | "fal"
  | "bitcoin"
  | "adsense"
  | "weather"
  | "brand";

export type MetricKind = "percent" | "cents" | "btc" | "temp";

export type MetricDef = { key: string; kind: MetricKind };

export const ICON_PROVIDERS: { id: ThemeProvider; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "gpt", label: "GPT" },
  { id: "cursor", label: "Cursor" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "opencode", label: "OpenCode" },
  { id: "fal", label: "fal.ai" },
  { id: "bitcoin", label: "Bitcoin" },
  { id: "adsense", label: "AdSense" },
  { id: "weather", label: "Clima" },
  { id: "brand", label: "VIGIA AI" },
];

export const PROVIDER_METRICS: Record<ThemeProvider, MetricDef[]> = {
  claude: [
    { key: "session_percent", kind: "percent" },
    { key: "weekly_percent", kind: "percent" },
    { key: "sonnet_percent", kind: "percent" },
    { key: "opus_percent", kind: "percent" },
  ],
  gpt: [
    { key: "session_percent", kind: "percent" },
    { key: "weekly_percent", kind: "percent" },
  ],
  cursor: [
    { key: "percent", kind: "percent" },
    { key: "other_percent", kind: "percent" },
    { key: "remaining_cents", kind: "cents" },
  ],
  openrouter: [
    { key: "remaining_cents", kind: "cents" },
    { key: "percent", kind: "percent" },
  ],
  deepseek: [
    { key: "remaining_cents", kind: "cents" },
    { key: "percent", kind: "percent" },
  ],
  opencode: [
    { key: "rolling_percent", kind: "percent" },
    { key: "weekly_percent", kind: "percent" },
    { key: "monthly_percent", kind: "percent" },
    { key: "remaining_cents", kind: "cents" },
  ],
  fal: [{ key: "remaining_cents", kind: "cents" }],
  bitcoin: [
    { key: "value_usd_cents", kind: "cents" },
    { key: "balance_btc", kind: "btc" },
  ],
  adsense: [
    { key: "unpaid_cents", kind: "cents" },
    { key: "today_cents", kind: "cents" },
  ],
  weather: [{ key: "temperature", kind: "temp" }],
  brand: [],
};

const METRIC_LABEL: Record<Lang, Record<string, string>> = {
  pt: {
    none: "Só o ícone",
    session_percent: "Sessão 5h",
    weekly_percent: "Semana",
    sonnet_percent: "Sonnet (semana)",
    opus_percent: "Opus (semana)",
    percent: "Uso do plano",
    other_percent: "Outros modelos",
    remaining_cents: "Saldo restante",
    rolling_percent: "Rolling",
    monthly_percent: "Mês",
    value_usd_cents: "Valor em USD",
    balance_btc: "Saldo BTC",
    unpaid_cents: "Carteira",
    today_cents: "Hoje",
    temperature: "Temperatura",
  },
  en: {
    none: "Icon only",
    session_percent: "5h session",
    weekly_percent: "Week",
    sonnet_percent: "Sonnet (week)",
    opus_percent: "Opus (week)",
    percent: "Plan usage",
    other_percent: "Other models",
    remaining_cents: "Remaining balance",
    rolling_percent: "Rolling",
    monthly_percent: "Month",
    value_usd_cents: "Value in USD",
    balance_btc: "BTC balance",
    unpaid_cents: "Wallet",
    today_cents: "Today",
    temperature: "Temperature",
  },
  es: {
    none: "Solo el ícono",
    session_percent: "Sesión 5h",
    weekly_percent: "Semana",
    sonnet_percent: "Sonnet (semana)",
    opus_percent: "Opus (semana)",
    percent: "Uso del plan",
    other_percent: "Otros modelos",
    remaining_cents: "Saldo restante",
    rolling_percent: "Rolling",
    monthly_percent: "Mes",
    value_usd_cents: "Valor en USD",
    balance_btc: "Saldo BTC",
    unpaid_cents: "Billetera",
    today_cents: "Hoy",
    temperature: "Temperatura",
  },
};

export function defaultMetric(provider: ThemeProvider): string {
  return PROVIDER_METRICS[provider][0]?.key || "none";
}

export function metricLabel(key: string, lang: Lang): string {
  return METRIC_LABEL[lang][key] || key;
}

function numField(acc: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!acc) return null;
  const v = acc[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function firstAccount(usage: UsagePayload | null, provider: ThemeProvider): Record<string, unknown> | null {
  if (!usage) return null;
  const map: Record<string, unknown[] | undefined> = {
    claude: usage.claude,
    gpt: usage.gpt,
    cursor: usage.cursor,
    openrouter: usage.openrouter,
    deepseek: usage.deepseek,
    opencode: usage.opencode,
    fal: usage.fal,
    bitcoin: usage.bitcoin,
    adsense: usage.adsense,
  };
  const list = map[provider];
  if (!list?.length) return null;
  const typed = list as Record<string, unknown>[];
  return typed.find((a) => a.ok !== false) || typed[0];
}

export function formatThemeMetric(
  usage: UsagePayload | null,
  provider: ThemeProvider,
  metric: string,
): string {
  if (!metric || metric === "none" || provider === "brand") return "";
  if (provider === "weather") {
    const w = usage?.weather;
    const temp = w?.current?.temperature_2m;
    const unit = w?.current_units?.["temperature_2m"] || "°C";
    return temp != null ? fmtTemp(temp, unit) : "--";
  }
  const acc = firstAccount(usage, provider);
  if (metric === "balance_btc") return fmtBtc(numField(acc, "balance_btc"));
  if (metric.endsWith("_cents")) {
    const cents = numField(acc, metric);
    if (provider === "adsense") {
      const cur = typeof acc?.currency === "string" ? acc.currency : "USD";
      return fmtMoney(cents, cur);
    }
    return fmtUsd(cents);
  }
  return fmtPct(numField(acc, metric));
}

export function weatherEmoji(usage: UsagePayload | null): string {
  return wmoEmoji(usage?.weather?.current?.weather_code);
}

export function providerHasData(provider: ThemeProvider): boolean {
  return PROVIDER_METRICS[provider].length > 0;
}
