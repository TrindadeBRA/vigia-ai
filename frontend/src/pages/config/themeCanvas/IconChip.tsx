import type { UsagePayload } from "../../../api/types";
import { cn } from "../../../cn";
import { Logo } from "../../../components/Logo";
import { wmoLabel } from "../../../format";
import { PROVIDER_ICON } from "../../../theme";
import { SpotifyThemeWidget } from "../SpotifyThemeWidget";
import { formatThemeMetric, weatherEmoji, weatherIconUrl, type ThemeProvider } from "../themeMetrics";

export function IconChip({
  provider,
  metric,
  color,
  showBackground,
  bgColor,
  scale,
  zoom,
  usage,
  tftWidth = 480,
}: {
  provider: ThemeProvider;
  metric: string;
  color: string | null;
  showBackground: boolean;
  bgColor: string | null;
  scale: number;
  zoom: number;
  usage: UsagePayload | null;
  tftWidth?: number;
}) {
  const value = formatThemeMetric(usage, provider, metric);
  const iconPx = 20 * scale * zoom;
  if (provider === "spotify") {
    return <SpotifyThemeWidget color={color} showBackground={showBackground} bgColor={bgColor} scale={scale} zoom={zoom} tftWidth={tftWidth} />;
  }
  if (provider === "weather") {
    const code = usage?.weather?.current?.weather_code;
    const label = code != null ? wmoLabel(code) : null;
    return (
      <div
        className={cn("flex items-center gap-1.5 rounded-md px-2 py-1", showBackground && !bgColor && "bg-black/35")}
        style={{ background: showBackground ? bgColor || undefined : "transparent", border: showBackground && color ? `1.5px solid ${color}` : undefined }}
      >
        <img
          src={weatherIconUrl(usage)}
          alt={weatherEmoji(usage)}
          draggable={false}
          className="shrink-0"
          style={{ width: iconPx, height: iconPx, objectFit: "contain" }}
        />
        <div className="flex flex-col leading-none">
          <span className="whitespace-nowrap font-mono font-bold text-white" style={{ color: color || undefined, fontSize: `${11 * scale * zoom}px` }}>
            {value || "--"}
          </span>
          {label ? (
            <span className="whitespace-nowrap font-medium text-white/70" style={{ fontSize: `${7.5 * scale * zoom}px`, marginTop: 1 }}>
              {label}
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  // O olho da marca na placa é só o olho animado (ui/nav.cpp uiTickEye), sem
  // caixa nem texto — a prévia segue igual.
  if (provider === "brand") {
    return <Logo size={iconPx} showText={false} />;
  }
  const glyph = (
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
    <div
      className={cn("flex items-center gap-1.5 rounded-md px-2 py-1", showBackground && !bgColor && "bg-black/35")}
      style={{ background: showBackground ? bgColor || undefined : "transparent", border: showBackground && color ? `1.5px solid ${color}` : undefined }}
    >
      {glyph}
      <span className="whitespace-nowrap font-mono font-bold text-white" style={{ color: color || undefined, fontSize: `${11 * scale * zoom}px` }}>
        {value}
      </span>
    </div>
  );
}
