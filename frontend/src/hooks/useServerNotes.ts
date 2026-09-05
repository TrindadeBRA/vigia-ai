import { useCallback, useEffect, useState } from "react";
import type { NoteColorId } from "../components/cards/NoteCard";

export type ServerNote = {
    id: string;
    text: string;
    color: NoteColorId;
    createdAt: string;
    createdBy?: string | null;
};

const POLL_MS = 5000;

async function fetchServerNotes(): Promise<ServerNote[]> {
    try {
        const res = await fetch("/api/notes", { cache: "no-store" });
        if (!res.ok) return [];
        const data = (await res.json()) as { notes?: unknown };
        if (!Array.isArray(data.notes)) return [];
        return (data.notes as unknown[]).filter(
            (x) => x && typeof x === "object" && typeof (x as Record<string, unknown>).id === "string",
        ) as ServerNote[];
    } catch {
        return [];
    }
}

export function useServerNotes() {
    const [items, setItems] = useState<ServerNote[]>([]);
    const [ready, setReady] = useState(false);

    const refresh = useCallback(async () => {
        const notes = await fetchServerNotes();
        setItems(notes);
        setReady(true);
        return notes;
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timer: number | null = null;

        async function tick() {
            const notes = await fetchServerNotes();
            if (cancelled) return;
            setItems(notes);
            setReady(true);
            timer = window.setTimeout(tick, POLL_MS);
        }

        tick();

        const onFocus = () => {
            void refresh();
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") void refresh();
        };
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
            await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
        } catch {
            /* ignore */
        }
        await refresh();
    }, [refresh]);

    const update = useCallback(async (id: string, patch: Partial<Pick<ServerNote, "text" | "color">>) => {
        try {
            await fetch(`/api/notes/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
        } catch {
            /* ignore */
        }
        await refresh();
    }, [refresh]);

    const duplicate = useCallback(async (id: string) => {
        const src = items.find((n) => n.id === id);
        if (!src) return;
        try {
            await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: src.text, color: src.color }),
            });
        } catch {
            /* ignore */
        }
        await refresh();
    }, [items, refresh]);

    return { items, ready, refresh, remove, update, duplicate };
}
