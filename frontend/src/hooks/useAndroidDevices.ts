import { useCallback, useEffect, useState } from "react";
import { fetchAndroidDevices, removeAndroidDevice } from "../api/client";
import type { AndroidDevice } from "../api/types";

const POLL_MS = 15000;

async function fetchQuiet(): Promise<AndroidDevice[]> {
    try {
        return await fetchAndroidDevices();
    } catch {
        return [];
    }
}

export function useAndroidDevices() {
    const [items, setItems] = useState<AndroidDevice[]>([]);
    const [ready, setReady] = useState(false);

    const refresh = useCallback(async () => {
        const devices = await fetchQuiet();
        setItems(devices);
        setReady(true);
        return devices;
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timer: number | null = null;

        async function tick() {
            if (!document.hidden) {
                const devices = await fetchQuiet();
                if (cancelled) return;
                setItems(devices);
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
            await removeAndroidDevice(id);
        } catch { }
        await refresh();
    }, [refresh]);

    return { items, ready, refresh, remove };
}
