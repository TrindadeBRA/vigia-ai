import type { FastifyInstance } from "fastify";
import { fetchApod, mockApodPayload } from "../providers/apod.js";
import { load, updateSync as update } from "../store.js";
import { utcNow } from "../formatting.js";

export async function createApodRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/apod/config", { schema: { tags: ["APOD"] } }, async () => {
        const cfg = load() as Record<string, unknown>;
        const apod = (cfg.apod ?? { enabled: false, hidden: false, api_key: "" }) as Record<string, unknown>;
        return {
            enabled: Boolean(apod.enabled),
            hidden: Boolean(apod.hidden),
            api_key: String(apod.api_key ?? ""),
            has_key: Boolean(String(apod.api_key ?? "").trim()),
        };
    });

    app.patch("/api/apod/config", { schema: { tags: ["APOD"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        update((cfg: Record<string, unknown>) => {
            const a = (cfg.apod ?? {}) as Record<string, unknown>;
            if (!cfg.apod) cfg.apod = a;
            if (body.enabled !== undefined && body.enabled !== null) {
                a.enabled = Boolean(body.enabled);
                a.hidden = !Boolean(body.enabled);
            } else if (body.hidden !== undefined && body.hidden !== null) {
                a.hidden = Boolean(body.hidden);
                a.enabled = !Boolean(body.hidden);
            }
            if (body.api_key !== undefined && body.api_key !== null) {
                a.api_key = String(body.api_key).trim();
            }
        });
        const cfg = load() as Record<string, unknown>;
        const apod = (cfg.apod ?? {}) as Record<string, unknown>;
        return {
            ok: true,
            enabled: Boolean(apod.enabled),
            hidden: Boolean(apod.hidden),
            api_key: String(apod.api_key ?? ""),
            has_key: Boolean(String(apod.api_key ?? "").trim()),
        };
    });

    app.get("/api/apod", { schema: { tags: ["APOD"] } }, async () => {
        const cfg = load() as Record<string, unknown>;
        const apodCfg = (cfg.apod ?? {}) as Record<string, unknown>;
        if (apodCfg.hidden || !apodCfg.enabled) {
            return { ok: true, error: null, updated_at: utcNow(), date: null, title: null, explanation: null, url: null, hdurl: null, media_type: null, copyright: null, service_version: null };
        }
        if (cfg.mock) return mockApodPayload();
        return fetchApod(cfg);
    });
}
