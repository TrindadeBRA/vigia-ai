import type { CalendarPayload, CameraItem, CurrenciesPayload, GitPayload, GitRepo, GithubPayload, GithubRepo, IssPayload, RetroAchievementsAccount, RssPayload, WeatherConfig, WeatherPayload } from "../../api/types";
import type { PALETTES, ResolvedThemeName } from "../../theme";

export type Pal = (typeof PALETTES)[ResolvedThemeName];

export type Metric = { label: string; pct: number | null; sub: string | null; countdownAt?: string | null; value?: string | null; };

export type ProviderMeta = {
  id: string;
  provider: string;
  ok: boolean;
  error: string | null;
  title: string;
  label: string;
  metrics: Metric[];
  kind?: "provider" | "weather" | "currencies" | "git" | "retroachievements" | "calendar" | "rss" | "github" | "iss" | "image" | "note" | "emulator";
  weather?: WeatherPayload | null;
  weatherConfig?: WeatherConfig | null;
  currencies?: CurrenciesPayload | null;
  git?: GitPayload | null;
  gitRepo?: GitRepo | null;
  retroachievements?: RetroAchievementsAccount | null;
  calendar?: CalendarPayload | null;
  rss?: RssPayload | null;
  github?: GithubPayload | null;
  githubRepo?: GithubRepo | null;
  iss?: IssPayload | null;
  imageSrc?: string | null;
  imageFit?: "cover" | "contain";
  imageTransform?: { x: number; y: number; scale: number } | null;
  note?: { id: string; text: string; color: string } | null;
  camera?: CameraItem | null;
  emulator?: { platform: string; core: string; romPath: string; biosPath: string | null; label: string } | null;
};
