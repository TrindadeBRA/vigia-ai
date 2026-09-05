import type { CalendarPayload, CurrenciesPayload, GitPayload, GitRepo, RetroAchievementsAccount, RssPayload, WeatherConfig, WeatherPayload } from "../../api/types";
import type { PALETTES, ThemeName } from "../../theme";

export type Pal = (typeof PALETTES)[ThemeName];

export type Metric = { label: string; pct: number | null; sub: string | null; countdownAt?: string | null; value?: string | null; };

export type ProviderMeta = {
  id: string;
  provider: string;
  ok: boolean;
  error: string | null;
  title: string;
  label: string;
  metrics: Metric[];
  kind?: "provider" | "weather" | "currencies" | "git" | "retroachievements" | "calendar" | "rss";
  weather?: WeatherPayload | null;
  weatherConfig?: WeatherConfig | null;
  currencies?: CurrenciesPayload | null;
  git?: GitPayload | null;
  gitRepo?: GitRepo | null;
  retroachievements?: RetroAchievementsAccount | null;
  calendar?: CalendarPayload | null;
  rss?: RssPayload | null;
};
