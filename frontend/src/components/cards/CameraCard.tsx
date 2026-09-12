import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sendCameraPtz } from "../../api/client";
import type { CameraItem, PtzAction } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import { MaximizeIcon } from "../icons";
import type { T } from "../../i18n";
import { emptyNote } from "../../tw";

/** Widget de vídeo ao vivo de câmera IP local (protótipo) — <img> consumindo
 * multipart/x-mixed-replace de /api/camera/cameras/:id/stream, sem "conta"/
 * usage. O browser atualiza os frames sozinho; só reconectamos (nova key) se
 * o stream cair. Cada câmera cadastrada em Configurações vira um bloco
 * próprio — este componente já recebe a câmera específica via prop, não
 * busca mais config global nenhuma. */
export function cameraAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg", "free"];
}

export function cameraSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.widgetSmall;
  if (s === "free") return t.cardFree;
  return s === "lg" ? t.cardLarge : t.cardNormal;
}

function CameraIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function ArrowIcon({ rotate }: { rotate: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

function ZoomIcon({ plus }: { plus: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M11 8v6" />
      {plus ? <path d="M8 11h6" /> : null}
    </svg>
  );
}

function PtzButton({ className, action, onAction, children, label }: { className?: string; action: PtzAction; onAction: (a: PtzAction) => void; children: React.ReactNode; label: string }) {
  const stop = () => onAction("stop");
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60 active:bg-black/75",
        className,
      )}
      onPointerDown={(e) => { e.preventDefault(); onAction(action); }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  );
}

function PtzPad({ cameraId, t }: { cameraId: string; t: T }) {
  const act = (action: PtzAction) => { void sendCameraPtz(cameraId, action); };
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5">
        <span />
        <PtzButton action="up" onAction={act} label={t.cameraPtzUp}><ArrowIcon rotate={0} /></PtzButton>
        <span />
        <PtzButton action="left" onAction={act} label={t.cameraPtzLeft}><ArrowIcon rotate={-90} /></PtzButton>
        <span />
        <PtzButton action="right" onAction={act} label={t.cameraPtzRight}><ArrowIcon rotate={90} /></PtzButton>
        <span />
        <PtzButton action="down" onAction={act} label={t.cameraPtzDown}><ArrowIcon rotate={180} /></PtzButton>
        <span />
      </div>
      <div className="flex flex-col gap-1">
        <PtzButton action="zoom_in" onAction={act} label={t.cameraPtzZoomIn}><ZoomIcon plus /></PtzButton>
        <PtzButton action="zoom_out" onAction={act} label={t.cameraPtzZoomOut}><ZoomIcon plus={false} /></PtzButton>
      </div>
    </div>
  );
}

function CameraFullscreenOverlay({ camera, t, onClose }: { camera: CameraItem; t: T; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <img
        src={`/api/camera/cameras/${camera.id}/stream`}
        alt=""
        className="max-h-full max-w-full cursor-default rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {camera.ptzEnabled ? (
        <div onClick={(e) => e.stopPropagation()}>
          <PtzPad cameraId={camera.id} t={t} />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

export function CameraBoardCard({ camera, t, size }: { camera: CameraItem | null; t: T; size: CardSize }) {
  void size;
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [broken, setBroken] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const reconnect = () => {
    setLoading(true);
    setBroken(false);
    setTick((n) => n + 1);
  };

  // Reconecta (bump de key -> novo <img>, novo request, novo ffmpeg no
  // coletor) quando a câmera trocou — sem polling nenhum enquanto ele está
  // saudável, o browser cuida de repintar cada frame sozinho. Se o stream
  // cair, a reconexão é manual (botão "tentar novamente"), sem retry
  // automático em loop.
  useEffect(() => {
    setLoading(true);
    setBroken(false);
    setFullscreen(false);
    setTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera?.id]);

  if (!camera) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
        <CameraIcon size={32} />
        <div className={emptyNote}>{t.cameraNeedsConfigHint}</div>
      </div>
    );
  }

  if (!camera.configured) {
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
        src={`/api/camera/cameras/${camera.id}/stream`}
        alt=""
        className={cn("h-full w-full object-cover transition-opacity", (loading || broken) && "opacity-0")}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setBroken(true); }}
      />
      {loading && !broken ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-chip">
          <CameraIcon size={28} />
          <div className="h-1.5 w-16 animate-pulse rounded-full bg-ink3/25" />
        </div>
      ) : null}
      {broken ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-panel/85 px-3 text-center">
          <CameraIcon size={28} />
          <div className={cn(emptyNote, "max-w-[26ch]")}>{t.cameraOfflineHint}</div>
          <button
            type="button"
            onClick={reconnect}
            className="mt-0.5 rounded-lg border border-edge bg-chip px-2.5 py-1 text-[11px] font-medium text-ink2 hover:border-accent hover:text-ink"
          >
            {t.cameraRetryNow}
          </button>
        </div>
      ) : null}
      {!broken && !loading ? (
        <button
          type="button"
          aria-label={t.cameraFullscreen}
          title={t.cameraFullscreen}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60 active:bg-black/75"
          onClick={() => setFullscreen(true)}
        >
          <MaximizeIcon size={14} />
        </button>
      ) : null}
      {!broken && !loading && camera.ptzEnabled ? <PtzPad cameraId={camera.id} t={t} /> : null}
      {fullscreen ? <CameraFullscreenOverlay camera={camera} t={t} onClose={() => setFullscreen(false)} /> : null}
    </div>
  );
}
