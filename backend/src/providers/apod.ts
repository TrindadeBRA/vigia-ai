/**
 * NASA Astronomy Picture of the Day (APOD).
 * https://api.nasa.gov/planetary/apod
 *
 * A rota sem `date` costuma falhar (HTTP 500) quando o APOD do dia ainda
 * não foi publicado — bug recorrente da NASA. Por isso sempre passamos `date`
 * explícito e voltamos alguns dias se necessário.
 */
import { utcNow } from "../formatting.js";

const FETCH_TIMEOUT_MS = 15_000;
const NASA_APOD_URL = "https://api.nasa.gov/planetary/apod";
const MAX_DAYS_BACK = 14;

export type ApodResult = {
    ok: boolean;
    error: string | null;
    updated_at: string;
    date: string | null;
    title: string | null;
    explanation: string | null;
    url: string | null;
    hdurl: string | null;
    media_type: string | null;
    copyright: string | null;
    service_version: string | null;
};

function resolveApiKey(cfg: Record<string, unknown>): string {
    const apodCfg = (cfg.apod ?? {}) as Record<string, unknown>;
    const key = String(apodCfg.api_key ?? "").trim();
    return key || "DEMO_KEY";
}

/** Data civil do APOD (calendário US Eastern, como a NASA usa). */
export function apodDateString(daysBack = 0): string {
    const eastern = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    eastern.setDate(eastern.getDate() - daysBack);
    const y = eastern.getFullYear();
    const m = String(eastern.getMonth() + 1).padStart(2, "0");
    const d = String(eastern.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function pickImageUrl(data: Record<string, unknown>): string | null {
    const mediaType = String(data.media_type ?? "").toLowerCase();
    if (mediaType === "video") {
        const thumb = data.thumbnail_url;
        if (typeof thumb === "string" && thumb.trim()) return thumb.trim();
        return null;
    }
    const hd = data.hdurl;
    if (typeof hd === "string" && hd.trim()) return hd.trim();
    const url = data.url;
    if (typeof url === "string" && url.trim()) return url.trim();
    return null;
}

function nasaErrorMessage(data: Record<string, unknown>, status: number, raw: string): string {
    if (typeof data.msg === "string" && data.msg.trim()) return data.msg.trim();
    const err = data.error;
    if (err && typeof err === "object") {
        const rec = err as Record<string, unknown>;
        if (typeof rec.message === "string" && rec.message.trim()) return rec.message.trim();
        if (typeof rec.code === "string") return rec.code;
    }
    if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
    return raw.slice(0, 300) || `HTTP ${status}`;
}

function isRetryableNasaError(status: number, msg: string): boolean {
    if (status === 404 || status === 500 || status === 502 || status === 503) return true;
    const lower = msg.toLowerCase();
    return lower.includes("internal service error")
        || lower.includes("no data available")
        || lower.includes("not yet been published")
        || lower.includes("not yet published");
}

function isApodPayload(data: Record<string, unknown>): boolean {
    if (typeof data.code === "number" && data.code >= 400) return false;
    if (data.error && typeof data.error === "object") return false;
    return typeof data.title === "string" && data.title.trim().length > 0;
}

function resultFromPayload(data: Record<string, unknown>): ApodResult {
    const imageUrl = pickImageUrl(data);
    return {
        ok: true,
        error: null,
        updated_at: utcNow(),
        date: data.date != null ? String(data.date) : null,
        title: data.title != null ? String(data.title) : null,
        explanation: data.explanation != null ? String(data.explanation).slice(0, 2000) : null,
        url: imageUrl,
        hdurl: data.hdurl != null ? String(data.hdurl) : null,
        media_type: data.media_type != null ? String(data.media_type) : null,
        copyright: data.copyright != null ? String(data.copyright) : null,
        service_version: data.service_version != null ? String(data.service_version) : null,
    };
}

function failResult(error: string): ApodResult {
    return {
        ok: false,
        error: error.slice(0, 500),
        updated_at: utcNow(),
        date: null,
        title: null,
        explanation: null,
        url: null,
        hdurl: null,
        media_type: null,
        copyright: null,
        service_version: null,
    };
}

async function fetchApodForDate(apiKey: string, date: string): Promise<{ status: number; data: Record<string, unknown>; raw: string }> {
    const url = `${NASA_APOD_URL}?api_key=${encodeURIComponent(apiKey)}&date=${encodeURIComponent(date)}&thumbs=true`;
    const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "VigiaAI/1.0 (apod)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const raw = await resp.text();
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
        throw new Error(`resposta inválida da NASA (HTTP ${resp.status})`);
    }
    return { status: resp.status, data, raw };
}

export async function fetchApod(cfg: Record<string, unknown>): Promise<ApodResult> {
    const apiKey = resolveApiKey(cfg);
    let lastError = "APOD indisponível";

    try {
        for (let daysBack = 0; daysBack <= MAX_DAYS_BACK; daysBack++) {
            const date = apodDateString(daysBack);
            const { status, data, raw } = await fetchApodForDate(apiKey, date);

            if (isApodPayload(data)) {
                return resultFromPayload(data);
            }

            const msg = nasaErrorMessage(data, status, raw);
            lastError = msg;

            if (status === 403 || msg.toLowerCase().includes("api key")) {
                return failResult("Chave da NASA inválida — confira em api.nasa.gov");
            }
            if (status === 429 || msg.toLowerCase().includes("rate limit")) {
                return failResult("Limite da NASA atingido — aguarde ou use sua própria API key");
            }
            if (isRetryableNasaError(status, msg)) {
                continue;
            }

            return failResult(msg);
        }

        return failResult(lastError === "Internal Service Error"
            ? "APOD de hoje ainda não publicado pela NASA — tente de novo mais tarde"
            : lastError);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return failResult(msg);
    }
}

export function mockApodPayload(): ApodResult {
    return {
        ok: true,
        error: null,
        updated_at: utcNow(),
        date: new Date().toISOString().slice(0, 10),
        title: "Vigia AI — APOD demo",
        explanation: "Imagem de demonstração do card NASA APOD no painel Vigia AI.",
        url: "https://apod.nasa.gov/apod/image/2409/MilkyWayHaoWu.jpg",
        hdurl: null,
        media_type: "image",
        copyright: "NASA (demo)",
        service_version: "v1",
    };
}

export const fetch_apod = fetchApod;
export const mock_apod_payload = mockApodPayload;
