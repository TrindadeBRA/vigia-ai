import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { fetchGitRepo } from "../providers/git.js";
import { load, updateSync as update } from "../store.js";

function clampLimit(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return 5;
    return Math.max(1, Math.min(50, Math.trunc(n)));
}

export async function createGitRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/git/config", async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.git ?? { enabled: false, hidden: false, repos: [] }) as Record<string, unknown>;
    });

    app.patch("/api/git/config", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.git ?? {}) as Record<string, unknown>;
            if (!cfg.git) cfg.git = g;
            if (body.enabled !== undefined && body.enabled !== null) { g.enabled = Boolean(body.enabled); g.hidden = !Boolean(body.enabled); }
            else if (body.hidden !== undefined && body.hidden !== null) { g.hidden = Boolean(body.hidden); g.enabled = !Boolean(body.hidden); }
        });
        const cfg = load() as Record<string, unknown>;
        return (cfg.git ?? {}) as Record<string, unknown>;
    });

    app.post("/api/git/repos", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.source !== "string" || !String(body.source).trim()) {
            return reply.code(400).send({ ok: false, error: "source é obrigatório (URL do repositório ou caminho local)" });
        }
        const source = String(body.source).trim();
        const label = String(body.label ?? "").trim();
        const limit = body.limit != null ? clampLimit(body.limit) : 5;
        const branch = body.branch != null && String(body.branch).trim() ? String(body.branch).trim() : null;

        // valida que o repo é acessível antes de salvar
        const probeId = randomBytes(4).toString("hex");
        const probe = await fetchGitRepo({ id: probeId, source, label, limit, branch });
        if (!probe.ok) {
            return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o repositório" });
        }

        const id = randomBytes(4).toString("hex");
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.git ?? {}) as Record<string, unknown>;
            if (!cfg.git) cfg.git = g;
            const repos = Array.isArray(g.repos) ? [...(g.repos as unknown[])] : [];
            repos.push({ id, source, label, limit, branch });
            g.repos = repos;
            g.enabled = true;
            g.hidden = false;
        });
        const cfg = load() as Record<string, unknown>;
        return { ok: true, id, config: cfg.git };
    });

    app.patch("/api/git/repos/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });

        const cfg = load() as Record<string, unknown>;
        const g = (cfg.git ?? {}) as Record<string, unknown>;
        const repos = Array.isArray(g.repos) ? g.repos as Array<Record<string, unknown>> : [];
        const idx = repos.findIndex((r) => String(r.id) === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "repositório não encontrado" });

        const current = repos[idx];
        const nextSource = body.source != null ? String(body.source).trim() : String(current.source);
        const nextLabel = body.label != null ? String(body.label).trim() : String(current.label ?? "");
        const nextLimit = body.limit != null ? clampLimit(body.limit) : Number(current.limit ?? 5);
        const nextBranch = body.branch !== undefined ? (body.branch != null && String(body.branch).trim() ? String(body.branch).trim() : null) : (current.branch as string | null);

        if (!nextSource) return reply.code(400).send({ ok: false, error: "source não pode ser vazio" });

        // valida se mudou source/branch
        if (nextSource !== String(current.source) || nextBranch !== (current.branch as string | null)) {
            const probe = await fetchGitRepo({ id, source: nextSource, label: nextLabel, limit: nextLimit, branch: nextBranch });
            if (!probe.ok) return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o repositório" });
        }

        update((c: Record<string, unknown>) => {
            const gg = (c.git ?? {}) as Record<string, unknown>;
            const rr = Array.isArray(gg.repos) ? gg.repos as Array<Record<string, unknown>> : [];
            const i = rr.findIndex((r) => String(r.id) === id);
            if (i === -1) return;
            rr[i] = { ...rr[i], source: nextSource, label: nextLabel, limit: nextLimit, branch: nextBranch };
            gg.repos = rr;
        });
        const updated = load() as Record<string, unknown>;
        return { ok: true, config: updated.git };
    });

    app.delete("/api/git/repos/:id", async (request) => {
        const { id } = request.params as { id: string };
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.git ?? {}) as Record<string, unknown>;
            if (!cfg.git) cfg.git = g;
            const repos = Array.isArray(g.repos) ? g.repos as Array<Record<string, unknown>> : [];
            g.repos = repos.filter((r) => String(r.id) !== id);
        });
        return { ok: true };
    });

    app.get("/api/git", async () => {
        const cfg = load() as Record<string, unknown>;
        const g = (cfg.git ?? {}) as Record<string, unknown>;
        if (g.hidden || !g.enabled) return { ok: true, error: null, updated_at: null, repos: [] };
        if (cfg.mock) {
            const { mockGitPayload } = await import("../providers/git.js");
            return mockGitPayload();
        }
        const { fetchGitRepos } = await import("../providers/git.js");
        const { utcNow } = await import("../formatting.js");
        try {
            const repos = await fetchGitRepos(cfg);
            return { ok: true, error: null, updated_at: utcNow(), repos };
        } catch (e) {
            const { utcNow: now } = await import("../formatting.js");
            return { ok: false, error: String(e), updated_at: now(), repos: [] };
        }
    });

    // preview: testa um source sem salvar
    app.post("/api/git/preview", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.source !== "string" || !String(body.source).trim()) {
            return reply.code(400).send({ ok: false, error: "source é obrigatório" });
        }
        const source = String(body.source).trim();
        const limit = body.limit != null ? clampLimit(body.limit) : 5;
        const branch = body.branch != null && String(body.branch).trim() ? String(body.branch).trim() : null;
        const result = await fetchGitRepo({ id: "preview", source, label: String(body.label ?? ""), limit, branch });
        return result;
    });
}
