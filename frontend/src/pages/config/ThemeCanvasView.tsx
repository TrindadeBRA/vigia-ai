import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { wallpaperMediaSrc } from "../../components/ProviderSearchGrid";
import type { Lang } from "../../i18n";
import { IconCard } from "./themeCanvas/IconCard";
import { IconChip } from "./themeCanvas/IconChip";
import { CanvasClockWidget } from "./themeCanvas/ClockWidgets";
import { CanvasSystemWidget } from "./themeCanvas/SystemWidget";
import { layerKey, normalizeLayerOrder, providerSupportsCard, wallpaperImgStyle, type ThemeState } from "./themeCanvas/state";
import { ThemeLayer } from "./themeCanvas/ThemeLayer";

export { providerSupportsCard, DEFAULT_THEME, THEME_MAX_CLOCKS, THEME_MAX_SYSTEMS, formatThemeClock, layerKey, normalizeLayerOrder, defaultLayerOrder, migrateTheme, loadThemeDraft, parseSavedThemeJson, wallpaperImgStyle, type ThemeIconStyle, type ThemeIcon, type ThemeText, type ThemeClock, type ThemeCountdown, type ThemeClockWidget, type ThemeSystemWidget, type CanvasClockMode, type SystemDetail, type ThemeState } from "./themeCanvas/state";
export { IconCard } from "./themeCanvas/IconCard";

export function ThemeCanvasView({
  theme,
  usage,
  now,
  wallpaperId,
  wallpaperKind,
  wallpaperOriginalUrl,
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
  wallpaperKind?: string | null;
  wallpaperOriginalUrl?: string | null;
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

  const order = normalizeLayerOrder(theme, theme.layerOrder);
  const clockById = new Map((theme.clocks || []).map((w) => [layerKey("clock", w.id), w]));
  const systemById = new Map((theme.systems || []).map((w) => [layerKey("system", w.id), w]));
  const iconById = new Map(theme.icons.map((i) => [layerKey("icon", i.id), i]));
  const textById = new Map(theme.texts.map((x) => [layerKey("text", x.id), x]));

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
          src={wallpaperMediaSrc({ id: wallpaperId, kind: wallpaperKind, original_url: wallpaperOriginalUrl })}
          alt=""
          draggable={false}
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute object-cover"
          style={wallpaperImgStyle(theme.background.zoom, theme.background.ox, theme.background.oy)}
        />
      ) : null}
      {wallpaperId && theme.background.overlayOpacity > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
          style={{ background: theme.background.color, opacity: theme.background.overlayOpacity }}
        />
      ) : null}
      {order.map((key) => {
        const clock = clockById.get(key);
        if (clock) {
          return (
            <ThemeLayer key={key} x={clock.x} y={clock.y} containerSize={containerSize}>
              <CanvasClockWidget widget={clock} now={now} zoom={zoom} />
            </ThemeLayer>
          );
        }
        const system = systemById.get(key);
        if (system) {
          return (
            <ThemeLayer key={key} x={system.x} y={system.y} containerSize={containerSize}>
              <CanvasSystemWidget widget={system} zoom={zoom} />
            </ThemeLayer>
          );
        }
        const icon = iconById.get(key);
        if (icon) {
          return (
            <ThemeLayer key={icon.id} x={icon.x} y={icon.y} containerSize={containerSize}>
              {icon.style === "card" && providerSupportsCard(icon.provider) ? (
                <IconCard
                  provider={icon.provider}
                  color={icon.color}
                  showBackground={icon.showBackground}
                  bgColor={icon.bgColor}
                  scale={icon.scale}
                  zoom={zoom}
                  usage={usage}
                  lang={lang}
                />
              ) : (
                <IconChip
                  provider={icon.provider}
                  metric={icon.metric}
                  color={icon.color}
                  showBackground={icon.showBackground}
                  bgColor={icon.bgColor}
                  scale={icon.scale}
                  zoom={zoom}
                  usage={usage}
                  tftWidth={canvasSize.width}
                />
              )}
            </ThemeLayer>
          );
        }
        const txt = textById.get(key);
        if (txt) {
          return (
            <ThemeLayer key={key} x={txt.x} y={txt.y} containerSize={containerSize}>
              <span
                className="whitespace-nowrap rounded-md bg-black/35 px-2 py-1 font-semibold text-white"
                style={{ color: txt.color || undefined, fontSize: `${12 * txt.scale * zoom}px` }}
              >
                {txt.text || "…"}
              </span>
            </ThemeLayer>
          );
        }
        return null;
      })}
    </div>
  );

  if (!fullscreen) return canvas;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black", className)}>
      {canvas}
    </div>
  );
}
