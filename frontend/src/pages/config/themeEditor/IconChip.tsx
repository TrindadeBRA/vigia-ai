import type { UsagePayload } from "../../../api/types";
import { cn } from "../../../cn";
import { Logo } from "../../../components/Logo";
import { wmoEmoji, wmoLabel } from "../../../format";
import { useSpotifyPreview } from "../../../hooks/useSpotifyPreview";
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
  const spotify = useSpotifyPreview();
  if (provider === "spotify") {
    const track = spotify?.track;
    const isPlaying = spotify?.is_playing;
    const isConfigured = spotify?.configured !== false;
    const hasTrack = !!track;
    const title = hasTrack ? track.name : !isConfigured ? "Conecte Spotify" : spotify?.error ? "Erro" : "Nada tocando";
    const subtitle = hasTrack ? track.artists : !isConfigured ? "em Configurações" : isPlaying ? "Tocando" : "Pausado";
    const chipW = 140 * scale * zoom;
    const innerTextW = chipW - iconPx - 12 * scale * zoom - 16 * scale * zoom;
    return (
      <div
        className={cn("flex items-center gap-1.5 rounded-md px-2 py-1", showBackground && !bgColor && "bg-black/35")}
        style={{ width: chipW, background: showBackground ? bgColor || undefined : "transparent", border: showBackground && color ? `1.5px solid ${color}` : undefined }}
      >
        <div className="relative shrink-0">
          <img
            src={PROVIDER_ICON.spotify}
            alt=""
            draggable={false}
            style={{ width: iconPx, height: iconPx, objectFit: "contain" }}
            className="rounded-full"
          />
          {hasTrack ? (
            <span
              className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-panel text-[9px] shadow-[0_0_0_1px_var(--card-border)]"
              style={{ width: Math.max(14, 10 * scale * zoom), height: Math.max(14, 10 * scale * zoom), fontSize: `${7 * scale * zoom}px` }}
            >
              {isPlaying ? "▶" : "⏸"}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-none">
          <span
            className="truncate font-bold text-white"
            style={{ color: color || undefined, fontSize: `${10 * scale * zoom}px`, maxWidth: innerTextW }}
            title={hasTrack ? `${track.name} — ${track.artists}` : undefined}
          >
            {title.length > 24 ? `${title.slice(0, 24)}…` : title}
          </span>
          {subtitle ? (
            <span className="truncate font-medium text-white/70" style={{ fontSize: `${7 * scale * zoom}px`, marginTop: 1 }}>
              {subtitle.length > 28 ? `${subtitle.slice(0, 28)}…` : subtitle}
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  if (provider === "weather") {
    const emoji = weatherEmoji(usage);
    const code = usage?.weather?.current?.weather_code;
    const label = code != null ? wmoLabel(code) : null;
    const badgeEmoji = emoji || wmoEmoji(code);
    return (
      <div
        className={cn("flex items-center gap-1.5 rounded-md px-2 py-1", showBackground && !bgColor && "bg-black/35")}
        style={{ background: showBackground ? bgColor || undefined : "transparent", border: showBackground && color ? `1.5px solid ${color}` : undefined }}
      >
        <div className="relative shrink-0">
          <img
            src={PROVIDER_ICON.weather}
            alt=""
            draggable={false}
            style={{ width: iconPx, height: iconPx, objectFit: "contain" }}
          />
          <span
            className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-panel shadow-[0_0_0_1px_var(--card-border)]"
            style={{ width: Math.max(14, 10 * scale * zoom), height: Math.max(14, 10 * scale * zoom), fontSize: `${8 * scale * zoom}px`, lineHeight: 1 }}
          >
            {badgeEmoji}
          </span>
        </div>
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
