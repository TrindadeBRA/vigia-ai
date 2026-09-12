import { useEffect, useState } from "react";

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

let sharedState: SpotifyState | null = null;
let listeners: Set<(s: SpotifyState | null) => void> = new Set();
let interval: number | null = null;

async function fetchState(): Promise<void> {
  try {
    const res = await fetch("/api/spotify", { cache: "no-store" });
    const data = (await res.json()) as SpotifyState;
    sharedState = data;
    listeners.forEach((cb) => cb(data));
  } catch {
    const err: SpotifyState = {
      ok: false,
      configured: true,
      error: "offline",
      is_playing: false,
      progress_ms: null,
      track: null,
    };
    sharedState = err;
    listeners.forEach((cb) => cb(err));
  }
}

function ensurePolling() {
  if (interval != null) return;
  void fetchState();
  interval = window.setInterval(() => { void fetchState(); }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void fetchState();
  });
}

export function refreshSpotifyPreview(): void {
  void fetchState();
}

export function useSpotifyPreview(): SpotifyState | null {
  const [state, setState] = useState<SpotifyState | null>(sharedState);

  useEffect(() => {
    ensurePolling();
    listeners.add(setState);
    if (sharedState) setState(sharedState);
    else void fetchState();
    return () => {
      listeners.delete(setState);
      if (listeners.size === 0 && interval != null) {
        window.clearInterval(interval);
        interval = null;
      }
    };
  }, []);

  return state;
}
