import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { Logo } from "../../components/Logo";
import { barColor, clamp, fmtPct } from "../../format";
import { ntcGenerateReadableColor } from "../../hooks/useNameToColor";
import type { Lang } from "../../i18n";
import { STR } from "../../i18n";
import { buildProviders } from "../Display";
import { PALETTES, PROVIDER_ICON } from "../../theme";
import { ICON_PROVIDERS, defaultMetric, formatThemeMetric, weatherEmoji, type ThemeProvider } from "./themeMetrics";

export type ThemeIconStyle = "chip" | "card";

export type ThemeIcon = {
  id: string;
  provider: ThemeProvider;
  style: ThemeIconStyle;
  x: number;
  y: number;
  scale: number;
  color: string | null;
  metric: string;
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
function clampBoxCenter(rawCenter: number, boxSize: number, containerSize: number): number {
  if (!containerSize || !boxSize) return rawCenter;
  if (boxSize >= containerSize) return containerSize / 2;
  return clamp(rawCenter, boxSize / 2, containerSize - boxSize / 2);
}
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
    style: icon.style === "card" ? "card" : "chip",
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
      icons?: Array<{ provider: ThemeProvider; style?: string; x: number; y: number; scale: number; color?: string; metric?: string }>;
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

// Mini-cartão (nome + apelido + até 2 barras) — mesmo conteúdo por provedor
// que o firmware desenha em customtheme.cpp:themeCardContentFor(), só que
// construído em cima de buildProviders() (Display.tsx), que já é a mesma
// função por trás do card compacto do /display normal.
export function IconCard({
  provider,
  color,
  scale,
  zoom,
  usage,
  lang,
}: {
  provider: ThemeProvider;
  color: string | null;
  scale: number;
  zoom: number;
  usage: UsagePayload | null;
  lang: Lang;
}) {
  const t = STR[lang];
  const meta = usage ? buildProviders(usage, t).find((p) => p.provider === provider) : undefined;
  const s = scale * zoom;
  const iconPx = 20 * s;
  const rows = (meta?.metrics ?? []).slice(0, 2);
  const title = meta?.title || ICON_PROVIDERS.find((p) => p.id === provider)?.label || provider;
  return (
    <div
      className="flex flex-col rounded-lg bg-black/60"
      style={{ padding: 8 * s, minWidth: 128 * s, border: color ? `1.5px solid ${color}` : undefined }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: 6 * s }}>
        {provider === "brand" ? (
          <Logo size={iconPx} />
        ) : (
          <img src={PROVIDER_ICON[provider]} alt="" draggable={false} style={{ width: iconPx, height: iconPx, objectFit: "contain" }} />
        )}
        <div className="min-w-0 leading-tight">
          <div className="truncate font-bold text-white" style={{ fontSize: 12 * s, color: color || undefined }}>
            {title}
          </div>
          {meta?.label ? (
            <div className="truncate text-white/50" style={{ fontSize: 9 * s }}>
              {meta.label}
            </div>
          ) : null}
        </div>
      </div>
      {meta && !meta.ok ? (
        <div className="text-red-300" style={{ fontSize: 9.5 * s }}>
          {meta.error || t.noData}
        </div>
      ) : rows.length ? (
        rows.map((m, i) => (
          <div key={i} style={{ marginTop: i ? 6 * s : 0 }}>
            <div className="flex items-baseline justify-between gap-2" style={{ fontSize: 9.5 * s }}>
              <span className="text-white/60">{m.label}</span>
              <span className="font-bold text-white">{m.pct != null ? fmtPct(m.pct) : (m.value ?? m.sub ?? "--")}</span>
            </div>
            {m.pct != null ? (
              <div className="mt-1 overflow-hidden rounded-full bg-white/15" style={{ height: Math.max(3, 4 * s) }}>
                <div className="h-full rounded-full" style={{ width: `${clamp(m.pct, 0, 100)}%`, background: barColor(m.pct, PALETTES.dark) }} />
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="text-white/50" style={{ fontSize: 9.5 * s }}>
          --
        </div>
      )}
    </div>
  );
}

function ThemeLayer({
  x,
  y,
  containerSize,
  children,
}: {
  x: number;
  y: number;
  containerSize: { width: number; height: number };
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setBoxSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width: cw, height: ch } = containerSize;
  const left = cw > 0 ? clampBoxCenter(x * cw, boxSize.width, cw) : x * 100;
  const top = ch > 0 ? clampBoxCenter(y * ch, boxSize.height, ch) : y * 100;
  return (
    <div
      ref={boxRef}
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={cw > 0 && ch > 0 ? { left: `${left}px`, top: `${top}px` } : { left: `${left}%`, top: `${top}%` }}
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
  lang = "pt",
}: {
  theme: ThemeState;
  usage: UsagePayload | null;
  now: Date;
  wallpaperId: string | null;
  canvasSize: { width: number; height: number };
  className?: string;
  maxWidth?: number;
  fullscreen?: boolean;
  lang?: Lang;
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
  const renderedH = canvasSize.width > 0 ? renderedW / ar : 0;
  const containerSize = { width: renderedW, height: renderedH };
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
        <ThemeLayer x={theme.clock.x} y={theme.clock.y} containerSize={containerSize}>
          <span
            className={`whitespace-nowrap rounded-md px-2 py-1 font-mono font-bold text-white ${clockBg}`}
            style={{ color: clockColor || undefined, fontSize: `${13 * theme.clock.scale * zoom}px` }}
          >
            {formatThemeClock(now, theme.clock.format24h)}
          </span>
        </ThemeLayer>
      ) : null}
      {theme.icons.map((icon) => (
        <ThemeLayer key={icon.id} x={icon.x} y={icon.y} containerSize={containerSize}>
          {icon.style === "card" && providerSupportsCard(icon.provider) ? (
            <IconCard provider={icon.provider} color={icon.color} scale={icon.scale} zoom={zoom} usage={usage} lang={lang} />
          ) : (
            <IconChip provider={icon.provider} metric={icon.metric} color={icon.color} scale={icon.scale} zoom={zoom} usage={usage} />
          )}
        </ThemeLayer>
      ))}
      {theme.texts.map((txt) => (
        <ThemeLayer key={txt.id} x={txt.x} y={txt.y} containerSize={containerSize}>
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
