import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config.js";

export type NoteColorId = "yellow" | "pink" | "blue" | "green" | "orange" | "purple" | "mint" | "gray";
export const NOTE_COLORS: NoteColorId[] = ["yellow", "pink", "blue", "green", "orange", "purple", "mint", "gray"];

export type Note = {
    id: string;
    text: string;
    color: NoteColorId;
    createdAt: string;
    createdBy?: string | null;
};

function notesPath(): string {
    return join(dataDir(), "notes.json");
}

function normalizeColor(c: unknown): NoteColorId {
    const s = String(c ?? "yellow").trim().toLowerCase();
    if ((NOTE_COLORS as string[]).includes(s)) return s as NoteColorId;
    return "yellow";
}

export function loadNotes(): Note[] {
    const p = notesPath();
    if (!existsSync(p)) return [];
    try {
        const raw = JSON.parse(readFileSync(p, "utf-8")) as unknown;
        if (!Array.isArray(raw)) {
            // support { notes: [] } wrapper
            if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).notes)) {
                return normalizeList((raw as Record<string, unknown>).notes as unknown[]);
            }
            return [];
        }
        return normalizeList(raw);
    } catch {
        return [];
    }
}

function normalizeList(arr: unknown[]): Note[] {
    const out: Note[] = [];
    for (const item of arr) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const r = item as Record<string, unknown>;
        const id = String(r.id ?? "").trim();
        if (!id) continue;
        const text = String(r.text ?? "");
        const color = normalizeColor(r.color);
        const createdAt = String(r.createdAt ?? r.created_at ?? new Date().toISOString());
        const createdBy = r.createdBy != null ? String(r.createdBy) : r.created_by != null ? String(r.created_by) : null;
        out.push({ id, text, color, createdAt, createdBy });
    }
    return out;
}

export function saveNotes(notes: Note[]): void {
    const p = notesPath();
    mkdirSync(dataDir(), { recursive: true });
    const tmp = p + ".tmp";
    writeFileSync(tmp, JSON.stringify(notes, null, 2) + "\n", "utf-8");
    renameSync(tmp, p);
}

export function createNote(text: string, opts: { color?: NoteColorId; createdBy?: string | null } = {}): Note {
    const notes = loadNotes();
    const id = `note:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
    const color = normalizeColor(opts.color ?? "yellow");
    const note: Note = {
        id,
        text: String(text ?? ""),
        color,
        createdAt: new Date().toISOString(),
        createdBy: opts.createdBy ?? null,
    };
    notes.push(note);
    saveNotes(notes);
    return note;
}

export function updateNote(id: string, patch: Partial<Pick<Note, "text" | "color">>): Note | null {
    const notes = loadNotes();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    if (patch.text !== undefined) notes[idx].text = String(patch.text);
    if (patch.color !== undefined) notes[idx].color = normalizeColor(patch.color);
    saveNotes(notes);
    return notes[idx];
}

export function deleteNote(id: string): boolean {
    const notes = loadNotes();
    const next = notes.filter((n) => n.id !== id);
    if (next.length === notes.length) return false;
    saveNotes(next);
    return true;
}

export function getNote(id: string): Note | null {
    return loadNotes().find((n) => n.id === id) ?? null;
}
