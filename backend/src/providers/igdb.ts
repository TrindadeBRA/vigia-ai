import { load } from "../store.js";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API = "https://api.igdb.com/v4";

let cachedToken: { token: string; expiresAt: number } | null = null;

function igdbCfg(): { clientId: string; clientSecret: string } {
    const cfg = load() as Record<string, unknown>;
    const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
    const igdb = (emu.igdb ?? {}) as Record<string, unknown>;
    return {
        clientId: String(igdb.clientId ?? "").trim(),
        clientSecret: String(igdb.clientSecret ?? "").trim(),
    };
}

export function igdbConfigured(): boolean {
    const { clientId, clientSecret } = igdbCfg();
    return Boolean(clientId && clientSecret);
}

export async function getIgdbToken(force = false): Promise<string> {
    const { clientId, clientSecret } = igdbCfg();
    if (!clientId || !clientSecret) throw new Error("IGDB não configurado — preencha Client ID e Client Secret em Configurações > Emulador");
    if (!force && cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
    const url = `${TWITCH_TOKEN_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Twitch OAuth falhou (${res.status}): ${body.slice(0, 300)}`);
    }
    const j = await res.json() as { access_token: string; expires_in: number };
    if (!j.access_token) throw new Error("Twitch não retornou access_token");
    cachedToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
}

export type IgdbGame = {
    id: number;
    name: string;
    summary?: string | null;
    storyline?: string | null;
    cover?: { id: number; image_id: string } | null;
    first_release_date?: number | null;
    rating?: number | null;
    aggregated_rating?: number | null;
    total_rating?: number | null;
    rating_count?: number | null;
    url?: string | null;
    genres?: Array<{ id: number; name: string }>;
    themes?: Array<{ id: number; name: string }>;
    game_modes?: Array<{ id: number; name: string }>;
    player_perspectives?: Array<{ id: number; name: string }>;
    platforms?: Array<{ id: number; name: string; abbreviation?: string }>;
    involved_companies?: Array<{ company: { id: number; name: string }; developer: boolean; publisher: boolean; supporting: boolean }>;
    screenshots?: Array<{ id: number; image_id: string }>;
    artworks?: Array<{ id: number; image_id: string }>;
    videos?: Array<{ id: number; name: string; video_id: string }>;
    release_dates?: Array<{ id: number; date: number; platform: number; human: string; region: number }>;
    similar_games?: Array<{ id: number; name: string; cover?: { image_id: string } | null }>;
};

const IGDB_SEARCH_FIELDS = [
    "id", "name", "summary", "storyline", "cover.image_id",
    "first_release_date", "rating", "aggregated_rating", "total_rating", "rating_count", "url",
    "genres.name", "themes.name", "game_modes.name", "player_perspectives.name",
    "platforms.name", "platforms.abbreviation",
    "involved_companies.company.name", "involved_companies.developer", "involved_companies.publisher",
    "screenshots.image_id", "artworks.image_id", "videos.name", "videos.video_id",
    "release_dates.date", "release_dates.human", "release_dates.region",
].join(",");

const IGDB_DETAIL_FIELDS = IGDB_SEARCH_FIELDS;

export async function searchIgdbGames(query: string, limit = 10): Promise<IgdbGame[]> {
    const { clientId } = igdbCfg();
    const token = await getIgdbToken();
    const q = query.replace(/"/g, '\\"').slice(0, 120);
    const body = `search "${q}"; fields ${IGDB_SEARCH_FIELDS}; limit ${Math.max(1, Math.min(20, limit))};`;
    const res = await fetch(`${IGDB_API}/games`, {
        method: "POST",
        headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "text/plain",
        },
        body,
        signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401) {
        // token expirado — tenta renovar uma vez
        const fresh = await getIgdbToken(true);
        const retry = await fetch(`${IGDB_API}/games`, {
            method: "POST",
            headers: { "Client-ID": clientId, "Authorization": `Bearer ${fresh}`, "Content-Type": "text/plain" },
            body,
            signal: AbortSignal.timeout(12_000),
        });
        if (!retry.ok) {
            const b = await retry.text().catch(() => "");
            throw new Error(`IGDB search falhou (${retry.status}): ${b.slice(0, 300)}`);
        }
        return await retry.json() as IgdbGame[];
    }
    if (!res.ok) {
        const b = await res.text().catch(() => "");
        throw new Error(`IGDB search falhou (${res.status}): ${b.slice(0, 300)}`);
    }
    return await res.json() as IgdbGame[];
}

export async function getIgdbGameById(id: number): Promise<IgdbGame | null> {
    const { clientId } = igdbCfg();
    const token = await getIgdbToken();
    const body = `fields ${IGDB_DETAIL_FIELDS}; where id = ${id}; limit 1;`;
    const res = await fetch(`${IGDB_API}/games`, {
        method: "POST",
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}`, "Content-Type": "text/plain" },
        body,
        signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
        const b = await res.text().catch(() => "");
        throw new Error(`IGDB fetch falhou (${res.status}): ${b.slice(0, 300)}`);
    }
    const arr = await res.json() as IgdbGame[];
    return arr[0] ?? null;
}

export function igdbCoverUrl(imageId: string, size: "cover_small" | "cover_big" | "720p" | "1080p" = "cover_big"): string {
    // https://api-docs.igdb.com/#images
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function igdbScreenshotUrl(imageId: string, size: "screenshot_med" | "screenshot_big" | "screenshot_huge" | "720p" | "1080p" = "screenshot_big"): string {
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function igdbArtworkUrl(imageId: string, size: "720p" | "1080p" = "720p"): string {
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function clearIgdbTokenCache() {
    cachedToken = null;
}
