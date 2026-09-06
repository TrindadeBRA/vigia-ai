import { useCallback, useEffect, useState } from "react";

export type ImageTransform = { x: number; y: number; scale: number };

export type ImageWidget = {
    id: string;
    src: string;
    fit: "cover" | "contain";
    label?: string;
    createdAt: string;
    transform?: ImageTransform | null;
};

type ServerImage = Omit<ImageWidget, "label"> & { label: string | null };

const POLL_MS = 15000;

async function fetchServerImages(): Promise<ImageWidget[]> {
    try {
        const res = await fetch("/api/images", { cache: "no-store" });
        if (!res.ok) return [];
        const data = (await res.json()) as { images?: unknown };
        if (!Array.isArray(data.images)) return [];
        const images = (data.images as unknown[]).filter(
            (x) => x && typeof x === "object" && typeof (x as Record<string, unknown>).id === "string",
        ) as ServerImage[];
        return images.map((img) => ({ ...img, label: img.label ?? undefined }));
    } catch {
        return [];
    }
}

// Migração única das imagens que só existiam no localStorage deste navegador
// (versão anterior, sem backend) — mesmo mecanismo usado pras notas em
// useServerNotes.ts. O que falhar (ex.: offline) fica guardado pra tentar de
// novo na próxima carga.
const LEGACY_LS_KEY = "vigia_image_widgets";

async function migrateLegacyLocalImages(): Promise<boolean> {
    let raw: string | null;
    try {
        raw = localStorage.getItem(LEGACY_LS_KEY);
    } catch {
        return false;
    }
    if (!raw) return false;

    let list: Array<{ src?: unknown; fit?: unknown; label?: unknown }>;
    try {
        const j = JSON.parse(raw);
        list = Array.isArray(j) ? j : [];
    } catch {
        list = [];
    }
    const pending = list.filter((x) => x && typeof x === "object" && String(x.src ?? "").trim());
    if (pending.length === 0) {
        try { localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
        return false;
    }

    const remaining: typeof pending = [];
    let migratedAny = false;
    for (const item of pending) {
        try {
            const res = await fetch("/api/images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    src: String(item.src ?? ""),
                    fit: item.fit === "contain" ? "contain" : "cover",
                    label: item.label != null ? String(item.label) : undefined,
                }),
            });
            if (res.ok) migratedAny = true;
            else remaining.push(item);
        } catch {
            remaining.push(item);
        }
    }
    try {
        if (remaining.length > 0) localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(remaining));
        else localStorage.removeItem(LEGACY_LS_KEY);
    } catch { /* ignore */ }
    return migratedAny;
}

export function useImageWidgets() {
    const [items, setItems] = useState<ImageWidget[]>([]);
    const [ready, setReady] = useState(false);

    const refresh = useCallback(async () => {
        const images = await fetchServerImages();
        setItems(images);
        setReady(true);
        return images;
    }, []);

    useEffect(() => {
        void migrateLegacyLocalImages().then((didMigrate) => {
            if (didMigrate) void refresh();
        });
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        let timer: number | null = null;

        async function tick() {
            if (!document.hidden) {
                const images = await fetchServerImages();
                if (cancelled) return;
                setItems(images);
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

    const add = useCallback(async (src: string, fit: "cover" | "contain" = "cover", label?: string) => {
        let image: ImageWidget | null = null;
        try {
            const res = await fetch("/api/images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ src: src.trim(), fit, label: label?.trim() || undefined }),
            });
            if (res.ok) {
                const data = (await res.json()) as { image?: ImageWidget };
                image = data.image ?? null;
            }
        } catch {
            /* ignore */
        }
        await refresh();
        return image;
    }, [refresh]);

    const update = useCallback(async (id: string, patch: Partial<Pick<ImageWidget, "src" | "fit" | "label" | "transform">>) => {
        try {
            await fetch(`/api/images/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
        } catch {
            /* ignore */
        }
        await refresh();
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        try {
            await fetch(`/api/images/${encodeURIComponent(id)}`, { method: "DELETE" });
        } catch {
            /* ignore */
        }
        await refresh();
    }, [refresh]);

    return { items, ready, refresh, add, update, remove };
}
