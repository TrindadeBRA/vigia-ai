import { useCallback, useEffect, useState } from "react";

export type ImageTransform = { x: number; y: number; scale: number };

export type ImageWidget = {
    id: string;
    src: string;
    fit: "cover" | "contain";
    label?: string;
    createdAt: string;
    transform?: ImageTransform;
};

const LS_KEY = "vigia_image_widgets";

function read(): ImageWidget[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const j = JSON.parse(raw);
        if (!Array.isArray(j)) return [];
        return j.filter((x: unknown) => x && typeof x === "object" && typeof (x as Record<string, unknown>).id === "string" && typeof (x as Record<string, unknown>).src === "string");
    } catch {
        return [];
    }
}

function write(list: ImageWidget[]) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}

export function useImageWidgets() {
    const [items, setItems] = useState<ImageWidget[]>(() => read());

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === LS_KEY) setItems(read());
        };
        window.addEventListener("storage", onStorage);
        const onCustom = () => setItems(read());
        window.addEventListener("vigia:image-widgets-updated", onCustom as EventListener);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("vigia:image-widgets-updated", onCustom as EventListener);
        };
    }, []);

    const persist = useCallback((next: ImageWidget[]) => {
        setItems(next);
        write(next);
        window.dispatchEvent(new CustomEvent("vigia:image-widgets-updated"));
    }, []);

    const add = useCallback((src: string, fit: "cover" | "contain" = "cover", label?: string) => {
        const id = `img:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
        const w: ImageWidget = { id, src: src.trim(), fit, label: label?.trim() || undefined, createdAt: new Date().toISOString() };
        const next = [...read(), w];
        persist(next);
        return w;
    }, [persist]);

    const update = useCallback((id: string, patch: Partial<Pick<ImageWidget, "src" | "fit" | "label" | "transform">>) => {
        const next = read().map((w) => w.id === id ? { ...w, ...patch, src: patch.src !== undefined ? patch.src.trim() : w.src } : w);
        persist(next);
    }, [persist]);

    const remove = useCallback((id: string) => {
        const next = read().filter((w) => w.id !== id);
        persist(next);
    }, [persist]);

    return { items, add, update, remove, refresh: () => setItems(read()) };
}

export function imageWidgetSrcIsDataUrl(src: string): boolean {
    return src.trim().startsWith("data:image/");
}
