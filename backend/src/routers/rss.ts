import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { fetchRssFeed } from "../providers/rss.js";
import { load, updateSync as update } from "../store.js";

function clampLimit(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.min(50, Math.trunc(n)));
}

export async function createRssRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/rss/config", async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.rss ?? { enabled: false, hidden: false, feeds: [] }) as Record<string, unknown>;
    });

    app.patch("/api/rss/config", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        update((cfg: Record<string, unknown>) => {
            const r = (cfg.rss ?? {}) as Record<string, unknown>;
            if (!cfg.rss) cfg.rss = r;
            if (body.enabled !== undefined && body.enabled !== null) { r.enabled = Boolean(body.enabled); r.hidden = !Boolean(body.enabled); }
            else if (body.hidden !== undefined && body.hidden !== null) { r.hidden = Boolean(body.hidden); r.enabled = !Boolean(body.hidden); }
        });
        const cfg = load() as Record<string, unknown>;
        return (cfg.rss ?? {}) as Record<string, unknown>;
    });

    app.post("/api/rss/feeds", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.url !== "string" || !String(body.url).trim()) {
            return reply.code(400).send({ ok: false, error: "url é obrigatória (link do feed RSS/Atom)" });
        }
        const url = String(body.url).trim();
        const label = String(body.label ?? "").trim();
        const limit = body.limit != null ? clampLimit(body.limit) : 10;

        try { new URL(url); } catch { return reply.code(400).send({ ok: false, error: "URL inválida" }); }
        if (!/^https?:\/\//i.test(url)) return reply.code(400).send({ ok: false, error: "URL deve ser http(s)" });

        const probeId = randomBytes(4).toString("hex");
        const probe = await fetchRssFeed({ id: probeId, url, label, limit });
        if (!probe.ok) {
            return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o feed" });
        }

        const id = randomBytes(4).toString("hex");
        update((cfg: Record<string, unknown>) => {
            const r = (cfg.rss ?? {}) as Record<string, unknown>;
            if (!cfg.rss) cfg.rss = r;
            const list = Array.isArray(r.feeds) ? [...(r.feeds as unknown[])] : [];
            list.push({ id, url, label, limit });
            r.feeds = list;
            r.enabled = true;
            r.hidden = false;
        });
        const cfg = load() as Record<string, unknown>;
        return { ok: true, id, config: cfg.rss };
    });

    app.patch("/api/rss/feeds/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });

        const cfg = load() as Record<string, unknown>;
        const r = (cfg.rss ?? {}) as Record<string, unknown>;
        const list = Array.isArray(r.feeds) ? r.feeds as Array<Record<string, unknown>> : [];
        const idx = list.findIndex((x) => String(x.id) === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "feed não encontrado" });

        const current = list[idx];
        const nextUrl = body.url != null ? String(body.url).trim() : String(current.url);
        const nextLabel = body.label != null ? String(body.label).trim() : String(current.label ?? "");
        const nextLimit = body.limit != null ? clampLimit(body.limit) : Number(current.limit ?? 10);

        if (!nextUrl) return reply.code(400).send({ ok: false, error: "url não pode ser vazia" });
        try { new URL(nextUrl); } catch { return reply.code(400).send({ ok: false, error: "URL inválida" }); }

        if (nextUrl !== String(current.url)) {
            const probe = await fetchRssFeed({ id, url: nextUrl, label: nextLabel, limit: nextLimit });
            if (!probe.ok) return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o feed" });
        }

        update((cfg2: Record<string, unknown>) => {
            const rr = (cfg2.rss ?? {}) as Record<string, unknown>;
            const ll = Array.isArray(rr.feeds) ? rr.feeds as Array<Record<string, unknown>> : [];
            const i = ll.findIndex((x) => String(x.id) === id);
            if (i === -1) return;
            ll[i] = { ...ll[i], url: nextUrl, label: nextLabel, limit: nextLimit };
            rr.feeds = ll;
        });
        const updated = load() as Record<string, unknown>;
        return { ok: true, config: updated.rss };
    });

    app.delete("/api/rss/feeds/:id", async (request) => {
        const { id } = request.params as { id: string };
        update((cfg: Record<string, unknown>) => {
            const r = (cfg.rss ?? {}) as Record<string, unknown>;
            if (!cfg.rss) cfg.rss = r;
            const list = Array.isArray(r.feeds) ? r.feeds as Array<Record<string, unknown>> : [];
            r.feeds = list.filter((x) => String(x.id) !== id);
        });
        return { ok: true };
    });

    app.get("/api/rss", async () => {
        const cfg = load() as Record<string, unknown>;
        const r = (cfg.rss ?? {}) as Record<string, unknown>;
        if (r.hidden || !r.enabled) return { ok: true, error: null, updated_at: null, feeds: [] };
        if (cfg.mock) {
            const { mockRssPayload } = await import("../providers/rss.js");
            return mockRssPayload();
        }
        const { fetchRssFeeds } = await import("../providers/rss.js");
        const { utcNow } = await import("../formatting.js");
        try {
            const feeds = await fetchRssFeeds(cfg);
            const ok = feeds.every((x) => x.ok);
            return { ok, error: ok ? null : feeds.find((x) => !x.ok)?.error || null, updated_at: utcNow(), feeds };
        } catch (e) {
            const { utcNow: now } = await import("../formatting.js");
            return { ok: false, error: String(e), updated_at: now(), feeds: [] };
        }
    });

    app.post("/api/rss/preview", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.url !== "string" || !String(body.url).trim()) {
            return reply.code(400).send({ ok: false, error: "url é obrigatória" });
        }
        const url = String(body.url).trim();
        const limit = body.limit != null ? clampLimit(body.limit) : 10;
        const result = await fetchRssFeed({ id: "preview", url, label: String(body.label ?? ""), limit });
        return result;
    });
}
