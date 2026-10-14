import type { CSSProperties } from "react";
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
// Widget de relógio do canvas — mesmos modos do card de relógio do dashboard
// (ClockCard.tsx: ClockMode/ClockConfig), um por widget em vez de um por card.
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
// Widget de sistema do canvas — espelha os heróis do SystemCard.tsx com o
// nível de detalhe escolhido (minimal = uptime, compact = +mem/cpu,
// full = +último ciclo/armazenamento).
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
// Limites do canvas (ver CONTRATO_TEMA.md): cabem no POST de 8 KB junto com
// os 12 ícones + 4 textos sem estourar.
export const THEME_MAX_CLOCKS = 4;
export const THEME_MAX_SYSTEMS = 2;
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
export type ThemeBg = {
  color: string;
  overlayOpacity: number;
  zoom: number;
  ox: number;
  oy: number;
  rotate: boolean;
  rotateIntervalSec: number;
};
export type ThemeCountdown = { enabled: boolean; x: number; y: number; scale: number; color: string | null };
export type ThemeState = {
  background: ThemeBg;
  clock: ThemeClock;
  countdown: ThemeCountdown;
  icons: ThemeIcon[];
  texts: ThemeText[];
  clocks: ThemeClockWidget[];
  systems: ThemeSystemWidget[];
  layerOrder: string[];
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

// Providers sem conta/cota real (ícone da marca, clima, spotify) não têm o mini-cartão
// da Início/Agora — mesma exclusão do firmware (ver customtheme.cpp:
// drawThemeIcon retorna antes de checar icon.style pra esses).
export function providerSupportsCard(provider: ThemeProvider): boolean {
  return provider !== "weather" && provider !== "brand" && provider !== "spotify" && provider !== "youtubemusic";
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

export function formatThemeClock(d: Date, format24h: boolean): string {
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

export function clampScale(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return clamp(n, 0.5, 4);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function migrateClockMode(v: unknown): CanvasClockMode {
  return v === "countdown" || v === "stopwatch" || v === "pomodoro" ? v : "clock";
}

function migrateDetail(v: unknown): SystemDetail {
  return v === "minimal" || v === "full" ? v : "compact";
}

// Posição/tamanho do <img> do papel pra mostrar a janela visível (zoom em
// torno do centro ox,oy): o ponto (ox,oy) da imagem fica no centro do canvas.
// Em % do container — mesma janela que a firmware amostra no RAW.
export function wallpaperImgStyle(zoom: number, ox: number, oy: number): CSSProperties {
  const z = clampZoom(zoom);
  const cx = clampPan(ox, z);
  const cy = clampPan(oy, z);
  return {
    width: `${z * 100}%`,
    height: `${z * 100}%`,
    left: `${(0.5 - cx * z) * 100}%`,
    top: `${(0.5 - cy * z) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
  };
}

export function migrateTheme(raw: Partial<ThemeState> & { icons?: Array<Partial<ThemeIcon> & { provider?: string }>; clocks?: Array<Partial<ThemeClockWidget>>; systems?: Array<Partial<ThemeSystemWidget>> }): ThemeState {
  const merged = { ...DEFAULT_THEME, ...raw } as ThemeState;
  const rawBg = (raw as Partial<ThemeState>)?.background as (Partial<ThemeBg> & { overlayColor?: unknown }) | undefined;
  const zoom = clampZoom(rawBg?.zoom);
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
  merged.countdown = {
    enabled: false,
    x: merged.countdown?.x ?? DEFAULT_THEME.countdown.x,
    y: merged.countdown?.y ?? DEFAULT_THEME.countdown.y,
    scale: merged.countdown?.scale ?? DEFAULT_THEME.countdown.scale,
    color: merged.countdown?.color ?? null,
  };
  if (merged.clock) {
    if (typeof merged.clock.showBackground !== "boolean") merged.clock.showBackground = DEFAULT_THEME.clock.showBackground;
    if (typeof merged.clock.autoColor !== "boolean") merged.clock.autoColor = DEFAULT_THEME.clock.autoColor;
    merged.clock.enabled = false;
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
  merged.clocks = (merged.clocks || []).slice(0, THEME_MAX_CLOCKS).map((w, idx) => ({
    id: w.id || `c${idx}`,
    mode: migrateClockMode(w.mode),
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
    detail: migrateDetail(w.detail),
    color: w.color ?? null,
    showBackground: typeof w.showBackground === "boolean" ? w.showBackground : true,
    bgColor: w.bgColor ?? null,
  }));
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

/** Rascunho do editor de tema, persistido no coletor (/api/theme-draft) — assim
 * o /display/canvas espelha o que está sendo editado em qualquer dispositivo. */
export async function loadThemeDraft(): Promise<ThemeState> {
  try {
    const res = await fetch("/api/theme-draft", { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as Partial<ThemeState>;
      if (j && typeof j === "object" && Object.keys(j).length) return migrateTheme(j);
    }
  } catch {
    /* offline: cai pro rascunho legado */
  }
  const legacy = readLegacyThemeDraft();
  if (legacy) {
    void fetch("/api/theme-draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(legacy),
    }).catch(() => { /* ignore */ });
    return legacy;
  }
  return DEFAULT_THEME;
}

export function parseSavedThemeJson(json: string): ThemeState | null {
  try {
    const raw = JSON.parse(json) as {
      background?: { color?: string; overlayColor?: string; overlayOpacity?: number; zoom?: number; ox?: number; oy?: number; rotate?: boolean; rotateIntervalSec?: number };
      clock?: Partial<ThemeClock>;
      countdown?: Partial<ThemeCountdown>;
      icons?: Array<{ provider: ThemeProvider; style?: string; x: number; y: number; scale: number; color?: string; showBackground?: boolean; bgColor?: string; metric?: string }>;
      texts?: Array<{ text: string; x: number; y: number; scale: number; color?: string }>;
      clocks?: Array<Partial<ThemeClockWidget>>;
      systems?: Array<Partial<ThemeSystemWidget>>;
    };
    return migrateTheme({
      background: {
        color: raw.background?.color || DEFAULT_THEME.background.color,
        ...(raw.background?.overlayColor ? { overlayColor: raw.background.overlayColor } : {}),
        overlayOpacity: raw.background?.overlayOpacity ?? DEFAULT_THEME.background.overlayOpacity,
        zoom: raw.background?.zoom ?? DEFAULT_THEME.background.zoom,
        ox: raw.background?.ox ?? DEFAULT_THEME.background.ox,
        oy: raw.background?.oy ?? DEFAULT_THEME.background.oy,
        rotate: raw.background?.rotate ?? DEFAULT_THEME.background.rotate,
        rotateIntervalSec: raw.background?.rotateIntervalSec ?? DEFAULT_THEME.background.rotateIntervalSec,
      },
      clock: { ...DEFAULT_THEME.clock, ...raw.clock },
      countdown: { ...DEFAULT_THEME.countdown, ...raw.countdown },
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
      // Arrays crus do JSON salvo — o migrateTheme normaliza/clampa cada item.
      clocks: (raw.clocks || []) as unknown as ThemeClockWidget[],
      systems: (raw.systems || []) as unknown as ThemeSystemWidget[],
    });
  } catch {
    return null;
  }
}
