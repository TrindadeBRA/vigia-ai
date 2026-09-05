import { clamp } from "../../../format";
import { defaultMetric, type ThemeProvider } from "../themeMetrics";

export type ThemeIconStyle = "chip" | "card";

export type ThemeIcon = {
  id: string;
  provider: ThemeProvider;
  style: ThemeIconStyle;
  x: number;
  y: number;
  scale: number;
  color: string | null;
  showBackground: boolean;
  bgColor: string | null;
  metric: string;
};

export type ThemeText = { id: string; x: number; y: number; scale: number; color: string | null; text: string };
export type ThemeClock = {
  enabled: boolean;
  x: number;
  y: number;
  scale: number;
  color: string | null;
  format24h: boolean;
  showBackground: boolean;
  autoColor: boolean;
};
export type ThemeState = {
  background: { color: string };
  clock: ThemeClock;
  icons: ThemeIcon[];
  texts: ThemeText[];
};

// Providers sem conta/cota real (ícone da marca, clima) não têm o mini-cartão
// da Início/Agora — mesma exclusão do firmware (ver customtheme.cpp:
// drawThemeIcon retorna antes de checar icon.style pra esses dois).
export function providerSupportsCard(provider: ThemeProvider): boolean {
  return provider !== "weather" && provider !== "brand";
}

// Espelha o clampBoxCenter do firmware (ui/customtheme.cpp) e o do editor
// (ThemeEditorPage.tsx): mantém a caixa do widget inteira dentro do canvas
// mesmo perto das bordas, em vez de deixar a metade fora recortada pelo
// overflow:hidden do container.
export function clampBoxCenter(rawCenter: number, boxSize: number, containerSize: number): number {
  if (!containerSize || !boxSize) return rawCenter;
  if (boxSize >= containerSize) return containerSize / 2;
  return clamp(rawCenter, boxSize / 2, containerSize - boxSize / 2);
}

export const DEFAULT_THEME: ThemeState = {
  background: { color: "#0f0f0f" },
  clock: { enabled: true, x: 0.5, y: 0.16, scale: 2, color: null, format24h: true, showBackground: true, autoColor: false },
  icons: [],
  texts: [],
};

const STORAGE_KEY = "vigia_theme_draft_v2";
const STORAGE_KEY_V1 = "vigia_theme_draft_v1";

export function formatThemeClock(d: Date, format24h: boolean): string {
  let h = d.getHours();
  if (!format24h) {
    h = h % 12;
    if (h === 0) h = 12;
  }
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function migrateTheme(raw: Partial<ThemeState> & { icons?: Array<Partial<ThemeIcon> & { provider?: string }> }): ThemeState {
  const merged = { ...DEFAULT_THEME, ...raw } as ThemeState;
  if (merged.clock) {
    if (typeof merged.clock.showBackground !== "boolean") merged.clock.showBackground = DEFAULT_THEME.clock.showBackground;
    if (typeof merged.clock.autoColor !== "boolean") merged.clock.autoColor = DEFAULT_THEME.clock.autoColor;
  }
  merged.icons = (merged.icons || []).map((icon, idx) => ({
    id: icon.id || `i${idx}`,
    provider: (icon.provider as ThemeProvider) || "claude",
    style: icon.style === "card" ? "card" : "chip",
    x: icon.x ?? 0.5,
    y: icon.y ?? 0.5,
    scale: icon.scale ?? 1,
    color: icon.color ?? null,
    showBackground: typeof icon.showBackground === "boolean" ? icon.showBackground : true,
    bgColor: icon.bgColor ?? null,
    metric: icon.metric || defaultMetric((icon.provider as ThemeProvider) || "claude"),
  }));
  merged.texts = (merged.texts || []).map((txt, idx) => ({
    id: txt.id || `t${idx}`,
    text: txt.text || "",
    x: txt.x ?? 0.5,
    y: txt.y ?? 0.5,
    scale: txt.scale ?? 1,
    color: txt.color ?? null,
  }));
  return merged;
}

export function loadThemeDraft(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_V1);
    if (raw) return migrateTheme(JSON.parse(raw) as Partial<ThemeState>);
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function parseSavedThemeJson(json: string): ThemeState | null {
  try {
    const raw = JSON.parse(json) as {
      background?: { color?: string };
      clock?: Partial<ThemeClock>;
      icons?: Array<{ provider: ThemeProvider; style?: string; x: number; y: number; scale: number; color?: string; showBackground?: boolean; bgColor?: string; metric?: string }>;
      texts?: Array<{ text: string; x: number; y: number; scale: number; color?: string }>;
    };
    return migrateTheme({
      background: { color: raw.background?.color || DEFAULT_THEME.background.color },
      clock: { ...DEFAULT_THEME.clock, ...raw.clock },
      icons: (raw.icons || []).map((icon, idx) => ({
        id: `i${idx}`,
        provider: icon.provider,
        style: icon.style === "card" ? "card" : "chip",
        x: icon.x,
        y: icon.y,
        scale: icon.scale,
        color: icon.color ?? null,
        showBackground: typeof icon.showBackground === "boolean" ? icon.showBackground : true,
        bgColor: icon.bgColor ?? null,
        metric: icon.metric || defaultMetric(icon.provider),
      })),
      texts: (raw.texts || []).map((txt, idx) => ({
        id: `t${idx}`,
        text: txt.text,
        x: txt.x,
        y: txt.y,
        scale: txt.scale,
        color: txt.color ?? null,
      })),
    });
  } catch {
    return null;
  }
}
