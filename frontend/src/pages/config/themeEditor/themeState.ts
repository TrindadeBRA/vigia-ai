import { useCallback, useEffect, useRef, useState } from "react";
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
// Selo de contagem regressiva até o próximo refresh — mesmas cores fixas
// (amarelo/verde) do selo do header do firmware (ver drawCountdownBadgeAt em
// ui/layout.cpp), por isso sem campo de cor aqui, diferente do relógio/ícones.
export type ThemeCountdown = { enabled: boolean; x: number; y: number; scale: number };
export type ThemeBg = { color: string };
export type ThemeState = { background: ThemeBg; clock: ThemeClock; countdown: ThemeCountdown; icons: ThemeIcon[]; texts: ThemeText[] };

export type WallpaperItem = {
  id: string;
  source: string;
  provider?: string | null;
  external_id?: string | null;
  preview_url?: string | null;
  original_url?: string | null;
  created_at?: string | null;
  has_preview: boolean;
  kind?: "static" | "gif";
  frame_count?: number;
  frame_delay_ms?: number;
};

export const DEFAULT_THEME: ThemeState = {
  background: { color: "#0f0f0f" },
  clock: { enabled: true, x: 0.5, y: 0.16, scale: 2, color: null, format24h: true, showBackground: true, autoColor: false },
  countdown: { enabled: false, x: 0.9, y: 0.88, scale: 1 },
  icons: [],
  texts: [],
};

const LEGACY_STORAGE_KEY = "vigia_theme_draft_v2";
const LEGACY_STORAGE_KEY_V1 = "vigia_theme_draft_v1";
const SAVE_DEBOUNCE_MS = 500;

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
  merged.countdown = {
    enabled: merged.countdown?.enabled ?? DEFAULT_THEME.countdown.enabled,
    x: merged.countdown?.x ?? DEFAULT_THEME.countdown.x,
    y: merged.countdown?.y ?? DEFAULT_THEME.countdown.y,
    scale: merged.countdown?.scale ?? DEFAULT_THEME.countdown.scale,
  };
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

/** Migração única do rascunho de tema que só existia no localStorage deste navegador. */
function readLegacyThemeDraft(): ThemeState | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
    if (!raw) return null;
    return migrateTheme(JSON.parse(raw) as Partial<ThemeState>);
  } catch {
    return null;
  }
}

/** Rascunho do editor de tema, persistido no coletor (/api/theme-draft) —
 * sem localStorage como fonte de verdade, e o /display/canvas (loadThemeDraft
 * em themeCanvas/state.ts) passa a enxergar o mesmo rascunho em qualquer
 * dispositivo, não só o navegador onde o editor está aberto. */
export function useThemeDraft(): [ThemeState, (fn: (t: ThemeState) => ThemeState) => void] {
  const [theme, setThemeState] = useState<ThemeState>(DEFAULT_THEME);
  const saveTimer = useRef<number | null>(null);

  const persist = useCallback((next: ThemeState) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch("/api/theme-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => { /* offline: tenta de novo na próxima mudança */ });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/theme-draft", { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as Partial<ThemeState>;
          if (cancelled) return;
          if (j && typeof j === "object" && Object.keys(j).length) {
            setThemeState(migrateTheme(j));
            return;
          }
        }
      } catch {
        /* offline: cai pro rascunho legado */
      }
      if (cancelled) return;
      const legacy = readLegacyThemeDraft();
      if (legacy) {
        setThemeState(legacy);
        persist(legacy);
      }
    })();
    return () => { cancelled = true; };
  }, [persist]);

  const setTheme = useCallback((fn: (t: ThemeState) => ThemeState) => {
    setThemeState((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  return [theme, setTheme];
}

export function themeToJson(t: ThemeState, hasWallpaper: boolean, gif?: { frame_count: number; frame_delay_ms: number } | null) {
  const background: Record<string, unknown> = { type: hasWallpaper ? "image" : "color", color: t.background.color };
  if (hasWallpaper && gif) {
    background.type = "gif";
    background.frame_count = Math.min(12, Math.max(2, Math.round(gif.frame_count || 2)));
    background.frame_delay_ms = Math.min(80, Math.max(40, Math.round(gif.frame_delay_ms || 50)));
  }
  return {
    version: 1,
    background,
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
    countdown: {
      enabled: t.countdown.enabled,
      x: t.countdown.x,
      y: t.countdown.y,
      scale: t.countdown.scale,
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

export function downloadThemeJson(theme: ThemeState, hasWallpaper: boolean, gif?: { frame_count: number; frame_delay_ms: number } | null) {
  const payload = { version: 1, exported_at: new Date().toISOString(), theme: themeToJson(theme, hasWallpaper, gif) };
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
