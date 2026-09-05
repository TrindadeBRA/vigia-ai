import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { ntcGenerateReadableColor } from "../../hooks/useNameToColor";
import type { Lang } from "../../i18n";
import { IconCard } from "./themeCanvas/IconCard";
import { IconChip } from "./themeCanvas/IconChip";
import { formatThemeClock, providerSupportsCard, type ThemeState } from "./themeCanvas/state";
import { ThemeLayer } from "./themeCanvas/ThemeLayer";

export { providerSupportsCard, DEFAULT_THEME, formatThemeClock, migrateTheme, loadThemeDraft, parseSavedThemeJson, type ThemeIconStyle, type ThemeIcon, type ThemeText, type ThemeClock, type ThemeState } from "./themeCanvas/state";
export { IconCard } from "./themeCanvas/IconCard";

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
            />
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
