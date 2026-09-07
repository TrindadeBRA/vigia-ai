import { useEffect, useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { emptyNote } from "../../tw";

/** Widget de vídeo ao vivo de câmera IP local (protótipo) — <img> consumindo
 * multipart/x-mixed-replace de /api/camera/stream, sem "conta"/usage. O browser
 * atualiza os frames sozinho; só reconectamos (nova key) se o stream cair. */
export function cameraAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg", "free"];
}

export function cameraSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.widgetSmall;
  if (s === "free") return t.cardFree;
  return s === "lg" ? t.cardLarge : t.cardNormal;
}

const RECONNECT_MS = 3000;

function CameraIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

export function CameraBoardCard({ t, size }: { t: T; size: CardSize }) {
  void size;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/camera/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => { if (alive) setConfigured(Boolean(data.configured)); })
      .catch(() => { if (alive) setConfigured(false); });
    return () => { alive = false; };
  }, []);

  // Só reconecta (bump de key -> novo <img>, novo request, novo ffmpeg no
  // coletor) quando o stream anterior quebrou — sem polling nenhum enquanto
  // ele está saudável, o browser cuida de repintar cada frame sozinho.
  useEffect(() => {
    if (!configured || !broken) return;
    const timer = window.setTimeout(() => setTick((n) => n + 1), RECONNECT_MS);
    return () => window.clearTimeout(timer);
  }, [configured, broken]);

  if (configured === null) {
    return <div className="flex h-full min-h-0 w-full items-center justify-center"><CameraIcon /></div>;
  }

  if (!configured) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
        <CameraIcon size={32} />
        <div className={emptyNote}>{t.cameraNeedsConfigHint}</div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl bg-chip">
      <img
        key={tick}
        src="/api/camera/stream"
        alt=""
        className={cn("h-full w-full object-cover transition-opacity", broken && "opacity-30")}
        onLoad={() => setBroken(false)}
        onError={() => setBroken(true)}
      />
      {broken ? (
        <div className="absolute inset-0 flex items-center justify-center bg-panel/70 px-3 text-center text-[11px] leading-snug text-ink3">
          {t.cameraOfflineHint}
        </div>
      ) : null}
    </div>
  );
}
