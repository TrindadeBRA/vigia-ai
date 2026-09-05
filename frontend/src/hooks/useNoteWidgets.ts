import { useCallback, useEffect, useState } from "react";
import type { NoteColorId } from "../components/cards/NoteCard";

export type NoteWidget = {
    id: string;
    text: string;
    color: NoteColorId;
    createdAt: string;
};

const LS_KEY = "vigia_note_widgets";

function read(): NoteWidget[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const j = JSON.parse(raw);
        if (!Array.isArray(j)) return [];
        return j.filter((x: unknown) => x && typeof x === "object" && typeof (x as Record<string, unknown>).id === "string");
    } catch {
        return [];
    }
}

function write(list: NoteWidget[]) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}

export function useNoteWidgets() {
    const [items, setItems] = useState<NoteWidget[]>(() => read());

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === LS_KEY) setItems(read());
        };
        window.addEventListener("storage", onStorage);
        const onCustom = () => setItems(read());
        window.addEventListener("vigia:note-widgets-updated", onCustom as EventListener);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("vigia:note-widgets-updated", onCustom as EventListener);
        };
    }, []);

    const persist = useCallback((next: NoteWidget[]) => {
        setItems(next);
        write(next);
        window.dispatchEvent(new CustomEvent("vigia:note-widgets-updated"));
    }, []);

    const add = useCallback((text = "", color: NoteColorId = "yellow") => {
        const id = `note:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
        const w: NoteWidget = { id, text, color, createdAt: new Date().toISOString() };
        const next = [...read(), w];
        persist(next);
        return w;
    }, [persist]);

    const update = useCallback((id: string, patch: Partial<Pick<NoteWidget, "text" | "color">>) => {
        const next = read().map((w) => w.id === id ? { ...w, ...patch } : w);
        persist(next);
    }, [persist]);

    const remove = useCallback((id: string) => {
        const next = read().filter((w) => w.id !== id);
        persist(next);
    }, [persist]);

    const duplicate = useCallback((id: string) => {
        const src = read().find((w) => w.id === id);
        if (!src) return null;
        return add(src.text, src.color);
    }, [add]);

    return { items, add, update, remove, duplicate, refresh: () => setItems(read()) };
}
