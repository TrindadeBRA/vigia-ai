import { useEffect, useRef, useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote } from "../../tw";

/** Widget de player Spotify — não vem de "conta"/usage, tem estado e ações próprias. */
export function spotifyAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg", "free"];
}

export function spotifySizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.widgetSmall;
  if (s === "md") return t.cardNormal;
  if (s === "free") return t.cardFree;
  return t.cardLarge;
}

type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  album: string;
  duration_ms: number | null;
  image_url: string | null;
  external_url: string | null;
};

type SpotifyState = {
  ok: boolean;
  configured: boolean;
  error: string | null;
  is_playing: boolean;
  progress_ms: number | null;
  track: SpotifyTrack | null;
};

const POLL_MS = 15000;
const AFTER_ACTION_MS = 550;

async function postAction(path: string): Promise<void> {
  try {
    await fetch(path, { method: "POST" });
  } catch {
    // ignora — o próximo poll reconcilia o estado real
  }
}

function fmtTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "--:--";
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useSpotifyState(): { state: SpotifyState | null; refresh: () => void } {
  const [state, setState] = useState<SpotifyState | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      // aba em background não precisa saber o que tá tocando agora —
      // visibilitychange abaixo refresca assim que volta a ficar visível
      if (document.hidden) return;
      try {
        const res = await fetch("/api/spotify", { cache: "no-store" });
        const data = (await res.json()) as SpotifyState;
        if (alive) setState(data);
      } catch {
        if (alive) {
          setState((prev) =>
            prev
              ? { ...prev, ok: false, error: "offline" }
              : { ok: false, configured: true, error: "offline", is_playing: false, progress_ms: null, track: null },
          );
        }
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refresh = () => {
    fetch("/api/spotify", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setState(data as SpotifyState))
      .catch(() => { });
  };

  return { state, refresh };
}

function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function PauseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>;
}
function PrevIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z" /></svg>;
}
function NextIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>;
}

function SpotifyLogo({ size = 34 }: { size?: number }) {
  return <img src={PROVIDER_ICON.spotify} alt="" width={size} height={size} className="shrink-0 rounded-full" draggable={false} />;
}

function Controls({
  isPlaying,
  busy,
  onPlayPause,
  onPrev,
  onNext,
  t,
  compact,
}: {
  isPlaying: boolean;
  busy: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  t: T;
  compact?: boolean;
}) {
  const sideBtn = cn(
    "flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-chip text-ink hover:enabled:bg-accent hover:enabled:text-accent-ink disabled:opacity-50",
    compact ? "size-6" : "size-8",
  );
  const mainBtn = cn(
    "flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-accent text-accent-ink hover:enabled:brightness-110 disabled:opacity-60",
    compact ? "size-7" : "size-9",
  );
  return (
    <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
      <button type="button" className={sideBtn} title={t.spotifyPrevious} aria-label={t.spotifyPrevious} disabled={busy} onClick={onPrev}>
        <PrevIcon />
      </button>
      <button type="button" className={mainBtn} title={isPlaying ? t.spotifyPause : t.spotifyPlay} aria-label={isPlaying ? t.spotifyPause : t.spotifyPlay} disabled={busy} onClick={onPlayPause}>
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button type="button" className={sideBtn} title={t.spotifyNext} aria-label={t.spotifyNext} disabled={busy} onClick={onNext}>
        <NextIcon />
      </button>
    </div>
  );
}

export function SpotifyBoardCard({ t, size }: { t: T; size: CardSize }) {
  const ns = normalizeSize(size);
  const { state, refresh } = useSpotifyState();
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const lastTrackId = useRef<string | null>(null);

  useEffect(() => {
    if (state?.track?.id !== lastTrackId.current) {
      lastTrackId.current = state?.track?.id ?? null;
      setOptimisticPlaying(null);
    } else if (state) {
      setOptimisticPlaying(null);
    }
  }, [state?.track?.id, state?.is_playing]);

  function act(kind: "play" | "pause" | "next" | "previous") {
    if (busy) return;
    setBusy(true);
    if (kind === "play") setOptimisticPlaying(true);
    if (kind === "pause") setOptimisticPlaying(false);
    void postAction(`/api/spotify/${kind}`).then(() => {
      window.setTimeout(() => { refresh(); setBusy(false); }, AFTER_ACTION_MS);
    });
  }

  if (!state) {
    return <div className="flex h-full min-h-0 w-full items-center justify-center opacity-60"><SpotifyLogo size={28} /></div>;
  }

  if (!state.configured) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
        <SpotifyLogo size={32} />
        <div className={emptyNote}>{t.spotifyConnectHint}</div>
      </div>
    );
  }

  const track = state.track;
  const isPlaying = optimisticPlaying ?? state.is_playing;
  const isCompact = ns === "sm";

  if (!track) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
        <SpotifyLogo size={isCompact ? 24 : 32} />
        <div className={cardLabel}>{t.spotifyNothingPlaying}</div>
        {state.error ? <div className="text-[10.5px] leading-snug text-bad">{state.error}</div> : null}
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        {track.image_url ? (
          <img src={track.image_url} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <SpotifyLogo size={36} />
        )}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-[650] leading-tight">{track.name}</div>
          <div className={cardLabel}>{track.artists}</div>
        </div>
        <Controls isPlaying={isPlaying} busy={busy} onPlayPause={() => act(isPlaying ? "pause" : "play")} onPrev={() => act("previous")} onNext={() => act("next")} t={t} compact />
      </div>
    );
  }

  const big = ns === "lg" || ns === "free";
  const pct = track.duration_ms ? Math.min(100, ((state.progress_ms ?? 0) / track.duration_ms) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {track.image_url ? (
          <img src={track.image_url} alt="" className={cn("shrink-0 rounded-xl object-cover shadow-[0_2px_10px_rgba(0,0,0,.25)]", big ? "size-20" : "size-14")} />
        ) : (
          <div className={cn("flex shrink-0 items-center justify-center rounded-xl bg-chip", big ? "size-20" : "size-14")}>
            <SpotifyLogo size={28} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-tight", big ? "text-[15px]" : "text-[13.5px]")}>{track.name}</div>
          <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-ink2">{track.artists}</div>
          {big ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{track.album}</div> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-chip">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-ink3">
            <span>{fmtTime(state.progress_ms)}</span>
            <span>{fmtTime(track.duration_ms)}</span>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Controls isPlaying={isPlaying} busy={busy} onPlayPause={() => act(isPlaying ? "pause" : "play")} onPrev={() => act("previous")} onNext={() => act("next")} t={t} />
        </div>
        {state.error ? <div className="text-center text-[10.5px] leading-snug text-bad">{state.error}</div> : null}
      </div>
    </div>
  );
}
