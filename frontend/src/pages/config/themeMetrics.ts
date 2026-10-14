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
  | "spotify"
  | "brand"
  | "rss"
  | "calendar"
  | "github"
  | "github-profile"
  | "git"
  | "currencies"
  | "retroachievements"
  | "apod"
  | "youtubemusic";

export type MetricKind = "percent" | "cents" | "btc" | "temp" | "count" | "text" | "money";

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
  { id: "spotify", label: "Spotify" },
  { id: "brand", label: "VIGIA AI" },
  { id: "rss", label: "RSS Feed" },
  { id: "calendar", label: "Eventos" },
  { id: "github", label: "GitHub" },
  { id: "github-profile", label: "GitHub Perfil" },
  { id: "git", label: "Git" },
  { id: "currencies", label: "Moedas" },
  { id: "retroachievements", label: "RetroAchievements" },
  { id: "apod", label: "NASA APOD" },
  { id: "youtubemusic", label: "YouTube Music" },
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
  spotify: [],
  brand: [],
  rss: [
    { key: "latest_title", kind: "text" },
    { key: "items_count", kind: "count" },
  ],
  calendar: [
    { key: "next_event", kind: "text" },
    { key: "events_count", kind: "count" },
  ],
  github: [
    { key: "stars", kind: "count" },
    { key: "open_issues", kind: "count" },
  ],
  "github-profile": [
    { key: "followers", kind: "count" },
    { key: "public_repos", kind: "count" },
  ],
  git: [
    { key: "latest_subject", kind: "text" },
    { key: "commits_count", kind: "count" },
  ],
  currencies: [
    { key: "first_quote", kind: "money" },
    { key: "quotes_count", kind: "count" },
  ],
  retroachievements: [
    { key: "total_points", kind: "count" },
    { key: "rank", kind: "count" },
  ],
  apod: [{ key: "title", kind: "text" }],
  youtubemusic: [],
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
    latest_title: "Última notícia",
    items_count: "Nº de itens",
    next_event: "Próximo evento",
    events_count: "Nº de eventos",
    stars: "Stars",
    open_issues: "Issues abertas",
    followers: "Seguidores",
    public_repos: "Repos públicos",
    latest_subject: "Último commit",
    commits_count: "Nº de commits",
    first_quote: "Cotação",
    quotes_count: "Nº de moedas",
    total_points: "Pontos",
    rank: "Rank",
    title: "Título",
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
    latest_title: "Latest headline",
    items_count: "Item count",
    next_event: "Next event",
    events_count: "Event count",
    stars: "Stars",
    open_issues: "Open issues",
    followers: "Followers",
    public_repos: "Public repos",
    latest_subject: "Latest commit",
    commits_count: "Commit count",
    first_quote: "Quote",
    quotes_count: "Currency count",
    total_points: "Points",
    rank: "Rank",
    title: "Title",
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
    latest_title: "Última noticia",
    items_count: "Nº de ítems",
    next_event: "Próximo evento",
    events_count: "Nº de eventos",
    stars: "Stars",
    open_issues: "Issues abiertas",
    followers: "Seguidores",
    public_repos: "Repos públicos",
    latest_subject: "Último commit",
    commits_count: "Nº de commits",
    first_quote: "Cotización",
    quotes_count: "Nº de monedas",
    total_points: "Puntos",
    rank: "Rank",
    title: "Título",
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
    retroachievements: usage.retroachievements,
  };
  const list = map[provider];
  if (!list?.length) return null;
  const typed = list as Record<string, unknown>[];
  return typed.find((a) => a.ok !== false) || typed[0];
}

function trunc(v: string | null | undefined, max = 24): string {
  if (!v) return "";
  const s = v.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "--";
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

function rssSummary(usage: UsagePayload | null): { items: number; latest: string } {
  const feeds = usage?.rss?.feeds || [];
  let items = 0;
  let latest = "";
  let latestMs = 0;
  for (const f of feeds) {
    items += f.items?.length || 0;
    for (const it of f.items || []) {
      const ms = it.pubDate ? Date.parse(it.pubDate) : 0;
      if (it.title && (ms >= latestMs || !latest)) {
        latest = it.title;
        latestMs = Number.isNaN(ms) ? latestMs : ms;
      }
    }
  }
  return { items, latest };
}

function calendarSummary(usage: UsagePayload | null): { count: number; next: string } {
  const cals = usage?.calendar?.calendars || [];
  let count = 0;
  let next = "";
  let nextMs = Infinity;
  const nowMs = Date.now();
  for (const c of cals) {
    for (const ev of c.events || []) {
      count += 1;
      const ms = ev.dtstart ? Date.parse(ev.dtstart) : ev.due ? Date.parse(ev.due) : NaN;
      if (!Number.isNaN(ms) && ms >= nowMs - 86400000 && ms < nextMs && ev.summary) {
        next = ev.summary;
        nextMs = ms;
      }
    }
  }
  if (!next) next = cals[0]?.events?.[0]?.summary || "";
  return { count, next };
}

function githubRepoSummary(usage: UsagePayload | null): { stars: number | null; issues: number | null } {
  const repos = usage?.github?.repos || [];
  const ok = repos.find((r) => r.ok !== false) || repos[0];
  if (!ok) return { stars: null, issues: null };
  return { stars: ok.stars, issues: ok.open_issues };
}

function githubProfileSummary(usage: UsagePayload | null): { followers: number | null; repos: number | null } {
  const profiles = usage?.github?.profiles || [];
  const ok = profiles.find((p) => p.ok !== false) || profiles[0];
  if (!ok) return { followers: null, repos: null };
  return { followers: ok.followers, repos: ok.public_repos };
}

function gitSummary(usage: UsagePayload | null): { count: number; latest: string } {
  const repos = usage?.git?.repos || [];
  const ok = repos.find((r) => r.ok !== false) || repos[0];
  if (!ok) return { count: 0, latest: "" };
  const first = ok.commits?.[0];
  return {
    count: ok.commits?.length || 0,
    latest: first ? `${first.short_hash} ${first.subject}` : "",
  };
}

function currenciesSummary(usage: UsagePayload | null): { count: number; quote: string; price: number | null } {
  const cu = usage?.currencies;
  const items = cu?.items || [];
  const first = items.find((i) => i.ok && i.price != null) || items[0];
  return { count: items.length, quote: first ? first.code : "", price: first?.price ?? null };
}

function retroSummary(usage: UsagePayload | null): { points: number | null; rank: number | null } {
  const acc = firstAccount(usage, "retroachievements");
  if (!acc) return { points: null, rank: null };
  const points = typeof acc.total_points === "number" ? acc.total_points : null;
  const rank = typeof acc.rank === "number" ? acc.rank : null;
  return { points, rank };
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
  if (provider === "spotify") {
    // Spotify não vem do /usage, o chip busca /api/spotify direto; fallback mostra placeholder
    return "";
  }
  if (provider === "youtubemusic") {
    // YouTube Music também tem poll próprio (/api/youtubemusic), fora do /usage
    return "";
  }
  if (provider === "rss") {
    const { items, latest } = rssSummary(usage);
    if (metric === "items_count") return items > 0 ? fmtCount(items) : "--";
    return trunc(latest) || (items > 0 ? fmtCount(items) : "--");
  }
  if (provider === "calendar") {
    const { count, next } = calendarSummary(usage);
    if (metric === "events_count") return count > 0 ? fmtCount(count) : "--";
    return trunc(next) || (count > 0 ? fmtCount(count) : "--");
  }
  if (provider === "github") {
    const { stars, issues } = githubRepoSummary(usage);
    if (metric === "open_issues") return issues != null ? fmtCount(issues) : "--";
    return stars != null ? fmtCount(stars) : "--";
  }
  if (provider === "github-profile") {
    const { followers, repos } = githubProfileSummary(usage);
    if (metric === "public_repos") return repos != null ? fmtCount(repos) : "--";
    return followers != null ? fmtCount(followers) : "--";
  }
  if (provider === "git") {
    const { count, latest } = gitSummary(usage);
    if (metric === "commits_count") return count > 0 ? fmtCount(count) : "--";
    return trunc(latest) || (count > 0 ? fmtCount(count) : "--");
  }
  if (provider === "currencies") {
    const { count, quote, price } = currenciesSummary(usage);
    if (metric === "quotes_count") return count > 0 ? fmtCount(count) : "--";
    if (price == null) return "--";
    const base = usage?.currencies?.base || "USD";
    try {
      const v = price.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
      return `${quote} ${v} ${base}`.trim();
    } catch {
      return `${quote} ${price}`.trim() || "--";
    }
  }
  if (provider === "retroachievements") {
    const { points, rank } = retroSummary(usage);
    if (metric === "rank") return rank != null ? `#${fmtCount(rank)}` : "--";
    return points != null ? fmtCount(points) : "--";
  }
  if (provider === "apod") {
    return trunc(usage?.apod?.title, 24) || "--";
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

/** Espelha kMaxIcons do firmware (ui/customtheme.cpp) — acima disso a placa descarta. */
export const THEME_MAX_ICONS = 12;

/**
 * Mesma arte que a placa desenha no widget de clima: o coletor converte esse PNG
 * do Twemoji em RGB565 (`GET /api/weather/icon`, ver backend/src/routers/weather.ts).
 */
export function weatherIconUrl(usage: UsagePayload | null): string {
  const file = Array.from(weatherEmoji(usage))
    .map((ch) => ch.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("-");
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${file}.png`;
}

export function providerHasData(provider: ThemeProvider): boolean {
  return PROVIDER_METRICS[provider].length > 0;
}
