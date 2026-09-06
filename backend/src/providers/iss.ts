/**
 * Provedor ISS: posição atual da Estação Espacial Internacional.
 * API pública wheretheiss.at, sem autenticação.
 */
import { utcNow } from "../formatting.js";

const FETCH_TIMEOUT_MS = 10_000;
// Período orbital médio da ISS — constante conhecida, usada só como estimativa
// aproximada de "tempo por volta" no card, não vem da API.
export const ISS_ORBIT_MINUTES = 92.68;

export type IssPosition = {
    ok: boolean;
    error: string | null;
    updated_at: string | null;
    latitude: number | null;
    longitude: number | null;
    altitude_km: number | null;
    velocity_kmh: number | null;
    visibility: "daylight" | "eclipsed" | null;
    timestamp: number | null;
};

export function issFail(msg: string): IssPosition {
    return {
        ok: false,
        error: msg,
        updated_at: utcNow(),
        latitude: null,
        longitude: null,
        altitude_km: null,
        velocity_kmh: null,
        visibility: null,
        timestamp: null,
    };
}

export async function fetchIssPosition(): Promise<IssPosition> {
    try {
        const resp = await fetch("https://api.wheretheiss.at/v1/satellites/25544", {
            headers: { "User-Agent": "VigiaAI/1.0 (iss)" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => "");
            return issFail(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
        }
        const data = await resp.json() as Record<string, unknown>;
        const visibility = data.visibility === "daylight" || data.visibility === "eclipsed" ? data.visibility : null;
        return {
            ok: true, error: null, updated_at: utcNow(),
            latitude: typeof data.latitude === "number" ? data.latitude : null,
            longitude: typeof data.longitude === "number" ? data.longitude : null,
            altitude_km: typeof data.altitude === "number" ? data.altitude : null,
            velocity_kmh: typeof data.velocity === "number" ? data.velocity : null,
            visibility,
            timestamp: typeof data.timestamp === "number" ? data.timestamp : null,
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return issFail(msg.slice(0, 300));
    }
}

export function mockIssPayload(): Record<string, unknown> {
    return {
        ok: true, error: null, updated_at: utcNow(),
        latitude: -22.9, longitude: -43.2,
        altitude_km: 417.5, velocity_kmh: 27580.3,
        visibility: "daylight",
        timestamp: Math.floor(Date.now() / 1000),
    };
}
