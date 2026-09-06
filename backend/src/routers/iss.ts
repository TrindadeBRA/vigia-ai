import type { FastifyInstance } from "fastify";
import { load, updateSync as update } from "../store.js";

export async function createIssRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/iss/config", async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.iss ?? { enabled: false, hidden: false }) as Record<string, unknown>;
    });

    app.patch("/api/iss/config", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        update((cfg: Record<string, unknown>) => {
            const i = (cfg.iss ?? {}) as Record<string, unknown>;
            if (!cfg.iss) cfg.iss = i;
            if (body.enabled !== undefined && body.enabled !== null) { i.enabled = Boolean(body.enabled); i.hidden = !Boolean(body.enabled); }
            else if (body.hidden !== undefined && body.hidden !== null) { i.hidden = Boolean(body.hidden); i.enabled = !Boolean(body.hidden); }
        });
        const cfg = load() as Record<string, unknown>;
        return (cfg.iss ?? {}) as Record<string, unknown>;
    });

    app.get("/api/iss", async () => {
        const cfg = load() as Record<string, unknown>;
        const i = (cfg.iss ?? {}) as Record<string, unknown>;
        if (i.hidden || !i.enabled) return { ok: true, error: null, updated_at: null };
        if (cfg.mock) {
            const { mockIssPayload } = await import("../providers/iss.js");
            return mockIssPayload();
        }
        const { fetchIssPosition } = await import("../providers/iss.js");
        return fetchIssPosition();
    });
}
