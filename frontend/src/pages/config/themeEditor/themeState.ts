import { useEffect, useState } from "react";
import type { ThemeIconStyle } from "../ThemeCanvasView";
import type { ThemeProvider } from "../themeMetrics";
import { defaultMetric } from "../themeMetrics";

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
export type ThemeClock = { enabled: boolean; x: number; y: number; scale: number; color: string | null; format24h: boolean; showBackground: boolean; autoColor: boolean };
export type ThemeBg = { color: string };
export type ThemeState = { background: ThemeBg; clock: ThemeClock; icons: ThemeIcon[]; texts: ThemeText[] };

export type WallpaperItem = { id: string; source: string; provider?: string | null; external_id?: string | null; preview_url?: string | null; created_at?: string | null; has_preview: boolean };

export const DEFAULT_THEME: ThemeState = {
  background: { color: "#0f0f0f" },
  clock: { enabled: true, x: 0.5, y: 0.16, scale: 2, color: null, format24h: true, showBackground: true, autoColor: false },
  icons: [],
  texts: [],
};

const STORAGE_KEY = "vigia_theme_draft_v2";
const STORAGE_KEY_V1 = "vigia_theme_draft_v1";
export const MAX_ICONS = 8;
export const MAX_TEXTS = 4;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function isBareLoopback(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  return v === "127.0.0.1" || v === "localhost" || v === "::1";
}

let uidCounter = 0;
export function uid(): string {
  return `e${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
}

export function formatClock(d: Date, format24h: boolean): string {
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

export function useThemeDraft(): [ThemeState, (fn: (t: ThemeState) => ThemeState) => void] {
  const [theme, setTheme] = useState<ThemeState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_V1);
      if (raw) return migrateTheme(JSON.parse(raw) as Partial<ThemeState>);
    } catch {
      /* ignore */
    }
    return DEFAULT_THEME;
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, (fn) => setTheme(fn)];
}

export function themeToJson(t: ThemeState, hasWallpaper: boolean) {
  return {
    version: 1,
    background: { type: hasWallpaper ? "image" : "color", color: t.background.color },
    clock: {
      enabled: t.clock.enabled,
      x: t.clock.x,
      y: t.clock.y,
      scale: t.clock.scale,
      format24h: t.clock.format24h,
      showBackground: t.clock.showBackground,
      autoColor: t.clock.autoColor,
      ...(t.clock.color ? { color: t.clock.color } : {}),
    },
    icons: t.icons.map((i) => ({
      provider: i.provider,
      style: i.style,
      x: i.x,
      y: i.y,
      scale: i.scale,
      metric: i.metric || defaultMetric(i.provider),
      showBackground: i.showBackground,
      ...(i.color ? { color: i.color } : {}),
      ...(i.bgColor ? { bgColor: i.bgColor } : {}),
    })),
    texts: t.texts.map((x) => ({ text: x.text, x: x.x, y: x.y, scale: x.scale, ...(x.color ? { color: x.color } : {}) })),
  };
}

// ── Exportar/importar tema (fundo, relógio, ícones, textos) como JSON ──────

export function downloadThemeJson(theme: ThemeState, hasWallpaper: boolean) {
  const payload = { version: 1, exported_at: new Date().toISOString(), theme: themeToJson(theme, hasWallpaper) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vigia-tema-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseThemeJson(text: string): ThemeState | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const candidate = data && typeof data === "object" && "theme" in (data as Record<string, unknown>) ? (data as Record<string, unknown>).theme : data;
  if (!candidate || typeof candidate !== "object") return null;
  const migrated = migrateTheme(candidate as Partial<ThemeState>);
  return { ...migrated, background: { color: migrated.background.color } };
}
