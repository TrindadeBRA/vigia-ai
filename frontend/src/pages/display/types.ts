import type { CurrenciesPayload, WeatherConfig, WeatherPayload } from "../../api/types";
import type { PALETTES, ThemeName } from "../../theme";

export type Pal = (typeof PALETTES)[ThemeName];

export type Metric = { label: string; pct: number | null; sub: string | null; countdownAt?: string | null; value?: string | null };

export type ProviderMeta = {
  id: string;
  provider: string;
  ok: boolean;
  error: string | null;
  title: string;
  label: string;
  metrics: Metric[];
  kind?: "provider" | "weather" | "currencies";
  weather?: WeatherPayload | null;
  weatherConfig?: WeatherConfig | null;
  currencies?: CurrenciesPayload | null;
};
