import { useCallback, useEffect, useState } from "react";
import type { NoteColorId } from "../components/cards/NoteCard";

export type ServerNote = {
    id: string;
    text: string;
    color: NoteColorId;
    createdAt: string;
    createdBy?: string | null;
};

// Notas mudam pouco — 5s de poll de fundo era exagero. O refresh no
// foco/visibilitychange abaixo já cobre o caso "voltei pra aba, quero ver
// na hora"; o intervalo aqui é só a rede de segurança pra outra aba/aparelho
// editando enquanto esta fica parada olhando.
const POLL_MS = 15000;

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

// Migração única de notas que só existiam no localStorage deste navegador
// (versão anterior, sem backend). Reenvia pro servidor pra passar a valer
// em qualquer tela/dispositivo; o que falhar (ex.: offline) fica guardado
// pra tentar de novo na próxima carga.
const LEGACY_LS_KEY = "vigia_note_widgets";

async function migrateLegacyLocalNotes(): Promise<boolean> {
    let raw: string | null;
    try {
        raw = localStorage.getItem(LEGACY_LS_KEY);
    } catch {
        return false;
    }
    if (!raw) return false;

    let list: Array<{ text?: unknown; color?: unknown }>;
    try {
        const j = JSON.parse(raw);
        list = Array.isArray(j) ? j : [];
    } catch {
        list = [];
    }
    const pending = list.filter((x) => x && typeof x === "object" && String(x.text ?? "").trim());
    if (pending.length === 0) {
        try { localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
        return false;
    }

    const remaining: typeof pending = [];
    let migratedAny = false;
    for (const item of pending) {
        try {
            const res = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: String(item.text ?? ""), color: String(item.color ?? "yellow") }),
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
        void migrateLegacyLocalNotes().then((didMigrate) => {
            if (didMigrate) void refresh();
        });
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        let timer: number | null = null;

        async function tick() {
            // aba em background não precisa de dado fresco — só reagenda,
            // sem gastar request; visibilitychange abaixo já refresca na volta
            if (!document.hidden) {
                const notes = await fetchServerNotes();
                if (cancelled) return;
                setItems(notes);
                setReady(true);
            }
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

    const add = useCallback(async (text = "", color: NoteColorId = "yellow") => {
        let note: ServerNote | null = null;
        try {
            const res = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, color }),
            });
            if (res.ok) {
                const data = (await res.json()) as { note?: ServerNote };
                note = data.note ?? null;
            }
        } catch {
            /* ignore */
        }
        await refresh();
        return note;
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

    return { items, ready, refresh, add, remove, update, duplicate };
}
