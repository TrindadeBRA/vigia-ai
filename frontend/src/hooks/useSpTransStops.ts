import { useCallback, useEffect, useState } from "react";
import { fetchSpTransStops, removeSpTransStop } from "../api/client";
import type { SpTransStop } from "../api/types";

const POLL_MS = 30000;

async function fetchQuiet(): Promise<SpTransStop[]> {
  try {
    return await fetchSpTransStops();
  } catch {
    return [];
  }
}

export function useSpTransStops() {
  const [items, setItems] = useState<SpTransStop[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const stops = await fetchQuiet();
    setItems(stops);
    setReady(true);
    return stops;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function tick() {
      if (!document.hidden) {
        const stops = await fetchQuiet();
        if (cancelled) return;
        setItems(stops);
        setReady(true);
      }
      timer = window.setTimeout(tick, POLL_MS);
    }

    tick();

    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    try {
      await removeSpTransStop(id);
    } catch { }
    await refresh();
  }, [refresh]);

  return { items, ready, refresh, remove };
}
