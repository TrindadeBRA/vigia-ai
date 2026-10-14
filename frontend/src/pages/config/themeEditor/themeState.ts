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
export type CanvasClockMode = "clock" | "countdown" | "stopwatch" | "pomodoro";
export type ThemeClockWidget = {
  id: string;
  mode: CanvasClockMode;
  x: number;
  y: number;
  scale: number;
  label: string | null;
  timezone: string | null;
  format24h: boolean;
  showSeconds: boolean;
  showDate: boolean;
  countdownAt: string | null;
  countdownLabel: string | null;
  pomodoroFocusMin: number;
  pomodoroShortMin: number;
  pomodoroLongMin: number;
  pomodoroCycles: number;
  color: string | null;
  showBackground: boolean;
};
export type SystemDetail = "minimal" | "compact" | "full";
export type ThemeSystemWidget = {
  id: string;
  x: number;
  y: number;
  scale: number;
  detail: SystemDetail;
  color: string | null;
  showBackground: boolean;
  bgColor: string | null;
};
export const THEME_MAX_CLOCKS = 4;
export const THEME_MAX_SYSTEMS = 2;
export type ThemeClock = { enabled: boolean; x: number; y: number; scale: number; color: string | null; format24h: boolean; showBackground: boolean; autoColor: boolean };
// Selo de contagem regressiva até o próximo refresh — mesmas cores fixas
// (amarelo/verde) do selo do header do firmware (ver drawCountdownBadgeAt em
// ui/layout.cpp), por isso sem campo de cor aqui, diferente do relógio/ícones.
export type ThemeCountdown = { enabled: boolean; x: number; y: number; scale: number; color: string | null };
export type ThemeBg = {
  // Cor única: fundo quando sem papel de parede, overlay sobre o papel quando
  // com (combinada com overlayOpacity). Com NameToColor no card Fundo.
  color: string;
  overlayOpacity: number;
  // Janela visível do papel de parede (crop/pan/zoom do editor): zoom 1–4 e
  // centro (ox,oy) em frações 0–1. zoom=1 mostra o papel inteiro.
  zoom: number;
  ox: number;
  oy: number;
  // Rotação automática de papéis (mesmo sistema do /display): o coletor
  // avança o selecionado a cada rotateIntervalSec e avisa via SSE.
  rotate: boolean;
  rotateIntervalSec: number;
};
export type ThemeState = { background: ThemeBg; clock: ThemeClock; countdown: ThemeCountdown; icons: ThemeIcon[]; texts: ThemeText[]; clocks: ThemeClockWidget[]; systems: ThemeSystemWidget[]; layerOrder: string[] };

export type LayerKey = string;

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

export function layerKey(kind: "clock" | "system" | "icon" | "text", id: string): string {
  return `${kind}:${id}`;
}

export function defaultLayerOrder(t: Pick<ThemeState, "clocks" | "systems" | "icons" | "texts">): string[] {
  return [
    ...(t.clocks || []).map((w) => layerKey("clock", w.id)),
    ...(t.systems || []).map((w) => layerKey("system", w.id)),
    ...t.icons.map((i) => layerKey("icon", i.id)),
    ...t.texts.map((x) => layerKey("text", x.id)),
  ];
}

export function normalizeLayerOrder(
  t: Pick<ThemeState, "clocks" | "systems" | "icons" | "texts">,
  raw: unknown,
): string[] {
  const fallback = defaultLayerOrder(t);
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const valid = new Set(fallback);
  const seen = new Set<string>();
  const ordered = (raw as unknown[]).filter(
    (k): k is string => typeof k === "string" && valid.has(k) && !seen.has(k) && (seen.add(k), true),
  );
  for (const k of fallback) if (!seen.has(k)) ordered.push(k);
  return ordered;
}

export const DEFAULT_THEME: ThemeState = {
  background: { color: "#0f0f0f", overlayOpacity: 0, zoom: 1, ox: 0.5, oy: 0.5, rotate: false, rotateIntervalSec: 60 },
  clock: { enabled: false, x: 0.5, y: 0.16, scale: 2, color: null, format24h: true, showBackground: true, autoColor: false },
  countdown: { enabled: false, x: 0.9, y: 0.88, scale: 1, color: null },
  icons: [],
  texts: [],
  clocks: [],
  systems: [],
  layerOrder: [],
};

const LEGACY_STORAGE_KEY = "vigia_theme_draft_v2";
const LEGACY_STORAGE_KEY_V1 = "vigia_theme_draft_v1";
const SAVE_DEBOUNCE_MS = 500;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampScale(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return clamp(n, 0.5, 4);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Contraste simples (mesmo peso de luma da placa, ver drawCountdownBadgeAt
// em firmware/src/ui/layout.cpp) — só pro preview do selo do contador
// acompanhar visualmente o que o dispositivo vai desenhar.
export function readableTextOn(hex: string): "#000000" | "#ffffff" {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const luma = (r * 30 + g * 59 + b * 11) / 100;
  return luma > 140 ? "#000000" : "#ffffff";
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

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function clampOpacity(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return clamp(n, 0, 1);
}

export function clampZoom(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return clamp(n, 1, 4);
}

// Centro (ox,oy) da janela visível, sempre dentro do papel pro zoom atual:
// a janela tem largura 1/zoom e não pode sair de 0–1.
export function clampPan(v: unknown, zoom: number): number {
  const n = typeof v === "number" ? v : Number(v);
  const c = Number.isFinite(n) ? n : 0.5;
  const z = clampZoom(zoom);
  const half = 0.5 / z;
  if (half >= 0.5) return 0.5;
  return clamp(c, half, 1 - half);
}

export function clampRotateIntervalSec(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 60;
  return Math.min(3600, Math.max(15, Math.round(n)));
}

export function migrateTheme(raw: Partial<ThemeState> & { icons?: Array<Partial<ThemeIcon> & { provider?: string }> }): ThemeState {
  const merged = { ...DEFAULT_THEME, ...raw } as ThemeState;
  const rawBg = (raw as Partial<ThemeState>)?.background as (Partial<ThemeBg> & { overlayColor?: unknown }) | undefined;
  const zoom = clampZoom(rawBg?.zoom);
  // Legado: overlayColor separado — com overlay ativo, ele era a cor visível.
  const legacyOverlay = isHexColor(rawBg?.overlayColor) ? (rawBg.overlayColor as string) : null;
  const opacity = clampOpacity(rawBg?.overlayOpacity);
  merged.background = {
    color: opacity > 0 && legacyOverlay ? legacyOverlay : isHexColor(rawBg?.color) ? (rawBg.color as string) : DEFAULT_THEME.background.color,
    overlayOpacity: opacity,
    zoom,
    ox: clampPan(rawBg?.ox, zoom),
    oy: clampPan(rawBg?.oy, zoom),
    rotate: rawBg?.rotate === true,
    rotateIntervalSec: clampRotateIntervalSec(rawBg?.rotateIntervalSec),
  };
  if (merged.clock) {
    if (typeof merged.clock.showBackground !== "boolean") merged.clock.showBackground = DEFAULT_THEME.clock.showBackground;
    if (typeof merged.clock.autoColor !== "boolean") merged.clock.autoColor = DEFAULT_THEME.clock.autoColor;
  }
  const legacyClockOn = merged.clock?.enabled === true;
  const legacyCountdownOn = merged.countdown?.enabled === true;
  merged.clock = { ...(merged.clock as ThemeClock), enabled: false };
  merged.countdown = {
    enabled: false,
    x: merged.countdown?.x ?? DEFAULT_THEME.countdown.x,
    y: merged.countdown?.y ?? DEFAULT_THEME.countdown.y,
    scale: merged.countdown?.scale ?? DEFAULT_THEME.countdown.scale,
    color: merged.countdown?.color ?? null,
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
  const clockMode = (v: unknown): CanvasClockMode => (v === "countdown" || v === "stopwatch" || v === "pomodoro" ? v : "clock");
  const detail = (v: unknown): SystemDetail => (v === "minimal" || v === "full" ? v : "compact");
  merged.clocks = (merged.clocks || []).slice(0, THEME_MAX_CLOCKS).map((w, idx) => ({
    id: w.id || `c${idx}`,
    mode: clockMode(w.mode),
    x: w.x ?? 0.5,
    y: w.y ?? 0.5,
    scale: clampScale(w.scale),
    label: typeof w.label === "string" && w.label.trim() ? w.label.slice(0, 40) : null,
    timezone: typeof w.timezone === "string" && w.timezone.trim() ? w.timezone.slice(0, 40) : null,
    showBackground: typeof w.showBackground === "boolean" ? w.showBackground : true,
    format24h: typeof w.format24h === "boolean" ? w.format24h : true,
    showSeconds: w.showSeconds !== false,
    showDate: w.showDate !== false,
    countdownAt: typeof w.countdownAt === "string" && w.countdownAt.trim() ? w.countdownAt : null,
    countdownLabel: typeof w.countdownLabel === "string" && w.countdownLabel.trim() ? w.countdownLabel.slice(0, 40) : null,
    pomodoroFocusMin: clampInt(w.pomodoroFocusMin, 1, 180, 25),
    pomodoroShortMin: clampInt(w.pomodoroShortMin, 1, 60, 5),
    pomodoroLongMin: clampInt(w.pomodoroLongMin, 1, 90, 15),
    pomodoroCycles: clampInt(w.pomodoroCycles, 2, 8, 4),
    color: w.color ?? null,
  }));
  merged.systems = (merged.systems || []).slice(0, THEME_MAX_SYSTEMS).map((w, idx) => ({
    id: w.id || `s${idx}`,
    x: w.x ?? 0.5,
    y: w.y ?? 0.5,
    scale: clampScale(w.scale),
    detail: detail(w.detail),
    color: w.color ?? null,
    showBackground: typeof w.showBackground === "boolean" ? w.showBackground : true,
    bgColor: w.bgColor ?? null,
  }));
  if ((legacyClockOn || legacyCountdownOn) && merged.clocks.length === 0) {
    const src = legacyClockOn ? merged.clock : null;
    merged.clocks = [
      {
        id: "c-migrated",
        mode: "clock",
        x: src?.x ?? 0.5,
        y: src?.y ?? 0.16,
        scale: clampScale(src?.scale ?? 2) > 2 ? 2 : clampScale(src?.scale ?? 1),
        label: null,
        timezone: null,
        showBackground: src?.showBackground ?? true,
        format24h: true,
        showSeconds: true,
        showDate: true,
        countdownAt: null,
        countdownLabel: null,
        pomodoroFocusMin: 25,
        pomodoroShortMin: 5,
        pomodoroLongMin: 15,
        pomodoroCycles: 4,
        color: src?.color ?? null,
      },
    ];
  }
  merged.layerOrder = normalizeLayerOrder(merged, (raw as Partial<ThemeState>)?.layerOrder);
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
  const overlayOpacity = clampOpacity(t.background.overlayOpacity);
  const background: Record<string, unknown> = { type: hasWallpaper ? "image" : "color", color: t.background.color };
  if (hasWallpaper && overlayOpacity > 0) {
    background.overlayOpacity = Math.round(overlayOpacity * 100) / 100;
  }
  const zoom = clampZoom(t.background.zoom);
  if (hasWallpaper && zoom > 1.001) {
    background.zoom = Math.round(zoom * 100) / 100;
    background.ox = Math.round(clampPan(t.background.ox, zoom) * 1000) / 1000;
    background.oy = Math.round(clampPan(t.background.oy, zoom) * 1000) / 1000;
  }
  if (hasWallpaper && t.background.rotate === true) {
    background.rotate = true;
    background.rotateIntervalSec = clampRotateIntervalSec(t.background.rotateIntervalSec);
  }
  if (hasWallpaper && gif) {
    background.type = "gif";
    background.frame_count = Math.min(12, Math.max(2, Math.round(gif.frame_count || 2)));
    background.frame_delay_ms = Math.min(80, Math.max(40, Math.round(gif.frame_delay_ms || 50)));
  }
  return {
    version: 1,
    background,
    clock: {
      enabled: false,
      x: t.clock.x,
      y: t.clock.y,
      scale: t.clock.scale,
      format24h: t.clock.format24h,
      showBackground: t.clock.showBackground,
      autoColor: t.clock.autoColor,
      ...(t.clock.color ? { color: t.clock.color } : {}),
    },
    countdown: {
      enabled: false,
      x: t.countdown.x,
      y: t.countdown.y,
      scale: t.countdown.scale,
      ...(t.countdown.color ? { color: t.countdown.color } : {}),
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
    clocks: t.clocks.map((w) => ({
      mode: w.mode,
      x: Math.round(w.x * 1000) / 1000,
      y: Math.round(w.y * 1000) / 1000,
      scale: Math.round(clampScale(w.scale) * 100) / 100,
      ...(w.label ? { label: w.label } : {}),
      ...(w.timezone ? { timezone: w.timezone } : {}),
      ...(w.format24h === false ? { format24h: false } : {}),
      ...(w.showSeconds === false ? { showSeconds: false } : {}),
      ...(w.showDate === false ? { showDate: false } : {}),
      ...(w.mode === "countdown" && w.countdownAt ? { countdownAt: w.countdownAt } : {}),
      ...(w.mode === "countdown" && w.countdownLabel ? { countdownLabel: w.countdownLabel } : {}),
      ...(w.mode === "pomodoro"
        ? {
            pomodoroFocusMin: clampInt(w.pomodoroFocusMin, 1, 180, 25),
            pomodoroShortMin: clampInt(w.pomodoroShortMin, 1, 60, 5),
            pomodoroLongMin: clampInt(w.pomodoroLongMin, 1, 90, 15),
            pomodoroCycles: clampInt(w.pomodoroCycles, 2, 8, 4),
          }
        : {}),
      ...(w.color ? { color: w.color } : {}),
      ...(w.showBackground === false ? { showBackground: false } : {}),
    })),
    systems: t.systems.map((w) => ({
      x: Math.round(w.x * 1000) / 1000,
      y: Math.round(w.y * 1000) / 1000,
      scale: Math.round(clampScale(w.scale) * 100) / 100,
      detail: w.detail,
      ...(w.color ? { color: w.color } : {}),
      ...(w.showBackground === false ? { showBackground: false } : {}),
      ...(w.bgColor ? { bgColor: w.bgColor } : {}),
    })),
    layerOrder: normalizeLayerOrder(t, t.layerOrder),
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
  return migrated;
}
