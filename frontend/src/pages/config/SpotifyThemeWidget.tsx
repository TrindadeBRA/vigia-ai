import { useState, type ReactNode } from "react";
import { cn } from "../../cn";
import { refreshSpotifyPreview, useSpotifyPreview } from "../../hooks/useSpotifyPreview";
import { PROVIDER_ICON } from "../../theme";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

async function postAction(kind: "play" | "pause" | "next" | "previous"): Promise<void> {
  try {
    await fetch(`/api/spotify/${kind}`, { method: "POST" });
  } catch {
    // o próximo poll reconcilia
  }
}

function CtrlBtn({
  label,
  onClick,
  children,
  width,
  height,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  width: number;
  height: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex shrink-0 cursor-pointer items-center justify-center border-white/35 bg-transparent text-white hover:bg-white/15"
      style={{ width, height, borderWidth: Math.max(1, width * 0.04), borderStyle: "solid", borderRadius: Math.max(2, height * 0.18) }}
    >
      {children}
    </button>
  );
}

/** Espelha `drawThemeSpotify` em `firmware/src/ui/customtheme.cpp`:
 * clamp em pixels da TFT, depois × zoom da prévia. Sem isso, capa/botões/fonte
 * cresciam com `scale × zoom` sem teto e o player ficava bem maior que na placa. */
export function SpotifyThemeWidget({
  color,
  showBackground,
  bgColor,
  scale,
  zoom,
  tftWidth = 480,
}: {
  color: string | null;
  showBackground: boolean;
  bgColor: string | null;
  scale: number;
  zoom: number;
  tftWidth?: number;
}) {
  const spotify = useSpotifyPreview();
  const [busy, setBusy] = useState(false);
  const track = spotify?.track;
  const isPlaying = spotify?.is_playing;
  const isConfigured = spotify?.configured !== false;
  const hasTrack = !!track;
  const title = hasTrack ? track.name : !isConfigured ? "Conecte Spotify" : spotify?.error ? "Erro" : "Nada tocando";
  const subtitle = hasTrack ? track.artists : !isConfigured ? "em Configurações" : isPlaying ? "Tocando" : "Pausado";
  const coverUrl = hasTrack ? track.image_url : null;
  const hasCover = !!coverUrl;

  const boxWTft = clamp(Math.round(128 * scale), 96, Math.max(96, tftWidth - 4));
  const coverTft = clamp(Math.round(26 * scale), 20, 44);
  const logoTft = clamp(Math.round(20 * scale), 6, 80);
  const btnWTft = clamp(Math.round(26 * scale), 22, 36);
  const btnHTft = clamp(Math.round(20 * scale), 18, 28);
  const artTft = hasCover ? coverTft : logoTft;
  const chipW = boxWTft * zoom;
  const artPx = artTft * zoom;
  const btnW = btnWTft * zoom;
  const btnH = btnHTft * zoom;
  const padX = 6 * zoom;
  const padY = 4 * zoom;
  const artGap = 6 * zoom;
  const btnGap = 6 * zoom;
  const rowGap = 4 * zoom;
  const titlePx = 11 * zoom;
  const subPx = 8 * zoom;
  const glyph = Math.max(6, btnH * 0.42);
  const coverSrc = coverUrl || PROVIDER_ICON.spotify;

  function act(kind: "play" | "pause" | "next" | "previous") {
    if (busy) return;
    setBusy(true);
    void postAction(kind).then(() => {
      window.setTimeout(() => {
        refreshSpotifyPreview();
        setBusy(false);
      }, 550);
    });
  }

  return (
    <div
      className={cn("flex flex-col", showBackground && !bgColor && "bg-black/35")}
      style={{
        width: chipW,
        padding: `${padY}px ${padX}px`,
        gap: hasTrack ? rowGap : 0,
        borderRadius: 6 * zoom,
        background: showBackground ? bgColor || undefined : "transparent",
        border: showBackground && color ? `${Math.max(1, 1.5 * zoom)}px solid ${color}` : undefined,
        boxSizing: "border-box",
      }}
    >
      <div className="flex min-w-0 items-center" style={{ gap: artGap }}>
        <img
          src={coverSrc}
          alt=""
          draggable={false}
          style={{ width: artPx, height: artPx, objectFit: hasCover ? "cover" : "contain" }}
          className={cn("shrink-0", hasCover ? "rounded-sm" : "rounded-full")}
        />
        <div className="flex min-w-0 flex-1 flex-col leading-none">
          <span
            className="truncate font-bold text-white"
            style={{ color: color || undefined, fontSize: `${titlePx}px` }}
            title={hasTrack ? `${track.name} — ${track.artists}` : undefined}
          >
            {title}
          </span>
          {subtitle ? (
            <span className="truncate font-medium text-white/70" style={{ fontSize: `${subPx}px`, marginTop: 2 * zoom }}>
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      {hasTrack ? (
        <div className="flex items-center justify-center" style={{ gap: btnGap }}>
          <CtrlBtn label="Anterior" width={btnW} height={btnH} onClick={() => act("previous")}>
            <svg width={glyph} height={glyph} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M10 2v8L4 6l6-4z" />
              <rect x="2" y="2" width="1.6" height="8" />
            </svg>
          </CtrlBtn>
          <CtrlBtn label={isPlaying ? "Pausar" : "Tocar"} width={btnW} height={btnH} onClick={() => act(isPlaying ? "pause" : "play")}>
            {isPlaying ? (
              <svg width={glyph} height={glyph} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <rect x="2" y="2" width="3" height="8" />
                <rect x="7" y="2" width="3" height="8" />
              </svg>
            ) : (
              <svg width={glyph} height={glyph} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <path d="M3 1.5v9l8-4.5-8-4.5z" />
              </svg>
            )}
          </CtrlBtn>
          <CtrlBtn label="Próxima" width={btnW} height={btnH} onClick={() => act("next")}>
            <svg width={glyph} height={glyph} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M2 2v8l6-4-6-4z" />
              <rect x="8.4" y="2" width="1.6" height="8" />
            </svg>
          </CtrlBtn>
        </div>
      ) : null}
    </div>
  );
}
