import type { UsagePayload } from "../../../api/types";
import { cn } from "../../../cn";
import { Logo } from "../../../components/Logo";
import { PROVIDER_ICON } from "../../../theme";
import { formatThemeMetric, weatherEmoji, type ThemeProvider } from "../themeMetrics";

export function IconChip({
  provider,
  metric,
  color,
  showBackground,
  bgColor,
  scale,
  zoom,
  usage,
}: {
  provider: ThemeProvider;
  metric: string;
  color: string | null;
  showBackground: boolean;
  bgColor: string | null;
  scale: number;
  zoom: number;
  usage: UsagePayload | null;
}) {
  const value = formatThemeMetric(usage, provider, metric);
  const iconPx = 20 * scale * zoom;
  if (provider === "weather") {
    return (
      <div
        className={cn("flex items-center gap-1 rounded-md px-2 py-1", showBackground && !bgColor && "bg-black/35")}
        style={{ background: showBackground ? bgColor || undefined : "transparent", border: showBackground && color ? `1.5px solid ${color}` : undefined }}
      >
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
