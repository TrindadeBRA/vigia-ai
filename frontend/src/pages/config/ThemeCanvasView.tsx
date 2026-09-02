import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { Logo } from "../../components/Logo";
import { ntcGenerateReadableColor } from "../../hooks/useNameToColor";
import { PROVIDER_ICON } from "../../theme";
import { defaultMetric, formatThemeMetric, weatherEmoji, type ThemeProvider } from "./themeMetrics";

export type ThemeIcon = {
  id: string;
  provider: ThemeProvider;
  x: number;
  y: number;
  scale: number;
  color: string | null;
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

export const DEFAULT_THEME: ThemeState = {
  background: { color: "#10151a" },
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
    x: icon.x ?? 0.5,
    y: icon.y ?? 0.5,
    scale: icon.scale ?? 1,
    color: icon.color ?? null,
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
      icons?: Array<{ provider: ThemeProvider; x: number; y: number; scale: number; color?: string; metric?: string }>;
      texts?: Array<{ text: string; x: number; y: number; scale: number; color?: string }>;
    };
    return migrateTheme({
      background: { color: raw.background?.color || DEFAULT_THEME.background.color },
      clock: { ...DEFAULT_THEME.clock, ...raw.clock },
      icons: (raw.icons || []).map((icon, idx) => ({
        id: `i${idx}`,
        provider: icon.provider,
        x: icon.x,
        y: icon.y,
        scale: icon.scale,
        color: icon.color ?? null,
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

function IconChip({
  provider,
  metric,
  color,
  scale,
  zoom,
  usage,
}: {
  provider: ThemeProvider;
  metric: string;
  color: string | null;
  scale: number;
  zoom: number;
  usage: UsagePayload | null;
}) {
  const value = formatThemeMetric(usage, provider, metric);
  const iconPx = 20 * scale * zoom;
  if (provider === "weather") {
    return (
      <div className="flex items-center gap-1 rounded-md bg-black/35 px-2 py-1" style={{ border: color ? `1.5px solid ${color}` : undefined }}>
        <span style={{ fontSize: `${14 * scale * zoom}px`, lineHeight: 1 }}>{weatherEmoji(usage)}</span>
        <span className="whitespace-nowrap font-mono font-bold text-white" style={{ color: color || undefined, fontSize: `${11 * scale * zoom}px` }}>
          {value || "--"}
        </span>
      </div>
    );
  }
  const glyph =
    provider === "brand" ? (
      <Logo size={iconPx} />
    ) : (
      <img src={PROVIDER_ICON[provider]} alt={provider} draggable={false} style={{ width: iconPx, height: iconPx, objectFit: "contain" }} />
    );
  if (!value) {
    return (
      <div className="rounded-full bg-black/25" style={{ padding: Math.max(2, 4 * zoom), boxShadow: color ? `0 0 0 2px ${color}` : undefined }}>
        {glyph}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-black/35 px-2 py-1" style={{ border: color ? `1.5px solid ${color}` : undefined }}>
      {glyph}
      <span className="whitespace-nowrap font-mono font-bold text-white" style={{ color: color || undefined, fontSize: `${11 * scale * zoom}px` }}>
        {value}
      </span>
    </div>
  );
}

function ThemeLayer({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      {children}
    </div>
  );
}

export function ThemeCanvasView({
  theme,
  usage,
  now,
  wallpaperId,
  canvasSize,
  className,
  maxWidth = 720,
  fullscreen = false,
}: {
  theme: ThemeState;
  usage: UsagePayload | null;
  now: Date;
  wallpaperId: string | null;
  canvasSize: { width: number; height: number };
  className?: string;
  maxWidth?: number;
  fullscreen?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [renderedW, setRenderedW] = useState(0);
  const ar = canvasSize.width / canvasSize.height;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setRenderedW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = canvasSize.width > 0 && renderedW > 0 ? renderedW / canvasSize.width : 1;
  const autoPair = theme.clock.autoColor ? ntcGenerateReadableColor(theme.background.color) : null;
  const autoTextColor = autoPair ? autoPair[0] : null;
  const clockColor = theme.clock.autoColor ? autoTextColor || theme.clock.color : theme.clock.color;
  const clockBg = theme.clock.showBackground ? "bg-black/35" : "bg-transparent";

  const canvasStyle: CSSProperties = fullscreen
    ? {
        width: `min(100vw, 100vh * ${ar})`,
        height: `min(100vh, 100vw / ${ar})`,
        background: theme.background.color,
      }
    : {
        aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
        maxWidth,
        width: "100%",
        background: theme.background.color,
      };

  const canvas = (
    <div ref={canvasRef} className={cn("relative overflow-hidden", !fullscreen && className)} style={canvasStyle}>
      {wallpaperId ? (
        <img
          src={`/api/wallpapers/${wallpaperId}/preview`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-0 size-full object-cover"
        />
      ) : null}
      {theme.clock.enabled ? (
        <ThemeLayer x={theme.clock.x} y={theme.clock.y}>
          <span
            className={`whitespace-nowrap rounded-md px-2 py-1 font-mono font-bold text-white ${clockBg}`}
            style={{ color: clockColor || undefined, fontSize: `${13 * theme.clock.scale * zoom}px` }}
          >
            {formatThemeClock(now, theme.clock.format24h)}
          </span>
        </ThemeLayer>
      ) : null}
      {theme.icons.map((icon) => (
        <ThemeLayer key={icon.id} x={icon.x} y={icon.y}>
          <IconChip provider={icon.provider} metric={icon.metric} color={icon.color} scale={icon.scale} zoom={zoom} usage={usage} />
        </ThemeLayer>
      ))}
      {theme.texts.map((txt) => (
        <ThemeLayer key={txt.id} x={txt.x} y={txt.y}>
          <span
            className="whitespace-nowrap rounded-md bg-black/35 px-2 py-1 font-semibold text-white"
            style={{ color: txt.color || undefined, fontSize: `${12 * txt.scale * zoom}px` }}
          >
            {txt.text || "…"}
          </span>
        </ThemeLayer>
      ))}
    </div>
  );

  if (!fullscreen) return canvas;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black", className)}>
      {canvas}
    </div>
  );
}
