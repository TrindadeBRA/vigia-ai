/**
 * Sincronização de saves do EmulatorJS com o backend.
 * SRAM (.srm) e save states (.state) são salvos em `backend/data/emulator-saves/`
 * para sincronizar entre dispositivos. O IndexedDB local continua como cache,
 * mas o servidor é a fonte da verdade.
 */

export type SaveKind = "sram" | "state";

function sanitize(s: string): string {
    return s.replace(/[\/\\:\0]/g, "_").replace(/[^a-zA-Z0-9._\-+()\[\] ]/g, "_").slice(0, 120) || "_";
}

export async function uploadSave(platform: string, game: string, kind: SaveKind, data: Uint8Array): Promise<boolean> {
    const plat = sanitize(platform);
    const g = sanitize(game);
    try {
        const res = await fetch(`/api/emulator/saves/${encodeURIComponent(plat)}/${encodeURIComponent(g)}/${kind}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: data as unknown as BodyInit,
        });
        if (!res.ok) {
            console.warn("[emulator-saves] upload falhou", plat, g, kind, res.status, await res.text().catch(() => ""));
            return false;
        }
        console.log("[emulator-saves] upload ok", plat, g, kind, data.byteLength);
        return true;
    } catch (e) {
        console.warn("[emulator-saves] upload erro", e);
        return false;
    }
}

export async function downloadSave(platform: string, game: string, kind: SaveKind): Promise<Uint8Array | null> {
    const plat = sanitize(platform);
    const g = sanitize(game);
    try {
        const res = await fetch(`/api/emulator/saves/${encodeURIComponent(plat)}/${encodeURIComponent(g)}/${kind}`, {
            cache: "no-store",
        });
        if (res.status === 404) return null;
        if (!res.ok) {
            console.warn("[emulator-saves] download falhou", plat, g, kind, res.status);
            return null;
        }
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) return null;
        return new Uint8Array(buf);
    } catch (e) {
        console.warn("[emulator-saves] download erro", e);
        return null;
    }
}

export async function deleteSave(platform: string, game: string, kind: SaveKind): Promise<boolean> {
    const plat = sanitize(platform);
    const g = sanitize(game);
    try {
        const res = await fetch(`/api/emulator/saves/${encodeURIComponent(plat)}/${encodeURIComponent(g)}/${kind}`, {
            method: "DELETE",
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function listSaves(): Promise<Array<{ platform: string; game: string; kind: SaveKind; file: string; size: number; mtime: string | null }>> {
    try {
        const res = await fetch("/api/emulator/saves", { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; saves?: Array<{ platform: string; game: string; kind: SaveKind; file: string; size: number; mtime: string | null }> };
        if (!j.ok) return [];
        return j.saves ?? [];
    } catch {
        return [];
    }
}
