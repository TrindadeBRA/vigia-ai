import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { fetchGithubRepo, isValidGithubRepo } from "../providers/github.js";
import { load, updateSync as update } from "../store.js";

export async function createGithubRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/github/config", async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.github ?? { enabled: false, hidden: false, repos: [] }) as Record<string, unknown>;
    });

    app.patch("/api/github/config", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            if (body.enabled !== undefined && body.enabled !== null) { g.enabled = Boolean(body.enabled); g.hidden = !Boolean(body.enabled); }
            else if (body.hidden !== undefined && body.hidden !== null) { g.hidden = Boolean(body.hidden); g.enabled = !Boolean(body.hidden); }
        });
        const cfg = load() as Record<string, unknown>;
        return (cfg.github ?? {}) as Record<string, unknown>;
    });

    app.post("/api/github/repos", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.repo !== "string" || !String(body.repo).trim()) {
            return reply.code(400).send({ ok: false, error: "repo é obrigatório (formato owner/repo)" });
        }
        const repo = String(body.repo).trim();
        const label = String(body.label ?? "").trim();
        if (!isValidGithubRepo(repo)) return reply.code(400).send({ ok: false, error: "Formato inválido — use owner/repo" });

        const probeId = randomBytes(4).toString("hex");
        const probe = await fetchGithubRepo({ id: probeId, repo, label });
        if (!probe.ok) {
            return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o repositório" });
        }

        const id = randomBytes(4).toString("hex");
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            const repos = Array.isArray(g.repos) ? [...(g.repos as unknown[])] : [];
            repos.push({ id, repo, label });
            g.repos = repos;
            g.enabled = true;
            g.hidden = false;
        });
        const cfg = load() as Record<string, unknown>;
        return { ok: true, id, config: cfg.github };
    });

    app.patch("/api/github/repos/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });

        const cfg = load() as Record<string, unknown>;
        const g = (cfg.github ?? {}) as Record<string, unknown>;
        const repos = Array.isArray(g.repos) ? g.repos as Array<Record<string, unknown>> : [];
        const idx = repos.findIndex((r) => String(r.id) === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "repositório não encontrado" });

        const current = repos[idx];
        const nextRepo = body.repo != null ? String(body.repo).trim() : String(current.repo);
        const nextLabel = body.label != null ? String(body.label).trim() : String(current.label ?? "");

        if (!nextRepo) return reply.code(400).send({ ok: false, error: "repo não pode ser vazio" });
        if (!isValidGithubRepo(nextRepo)) return reply.code(400).send({ ok: false, error: "Formato inválido — use owner/repo" });

        if (nextRepo !== String(current.repo)) {
            const probe = await fetchGithubRepo({ id, repo: nextRepo, label: nextLabel });
            if (!probe.ok) return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o repositório" });
        }

        update((c: Record<string, unknown>) => {
            const gg = (c.github ?? {}) as Record<string, unknown>;
            const rr = Array.isArray(gg.repos) ? gg.repos as Array<Record<string, unknown>> : [];
            const i = rr.findIndex((r) => String(r.id) === id);
            if (i === -1) return;
            rr[i] = { ...rr[i], repo: nextRepo, label: nextLabel };
            gg.repos = rr;
        });
        const updated = load() as Record<string, unknown>;
        return { ok: true, config: updated.github };
    });

    app.delete("/api/github/repos/:id", async (request) => {
        const { id } = request.params as { id: string };
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            const repos = Array.isArray(g.repos) ? g.repos as Array<Record<string, unknown>> : [];
            g.repos = repos.filter((r) => String(r.id) !== id);
        });
        return { ok: true };
    });

    app.get("/api/github", async () => {
        const cfg = load() as Record<string, unknown>;
        const g = (cfg.github ?? {}) as Record<string, unknown>;
        if (g.hidden || !g.enabled) return { ok: true, error: null, updated_at: null, repos: [] };
        if (cfg.mock) {
            const { mockGithubPayload } = await import("../providers/github.js");
            return mockGithubPayload();
        }
        const { fetchGithubRepos } = await import("../providers/github.js");
        const { utcNow } = await import("../formatting.js");
        try {
            const repos = await fetchGithubRepos(cfg);
            return { ok: true, error: null, updated_at: utcNow(), repos };
        } catch (e) {
            const { utcNow: now } = await import("../formatting.js");
            return { ok: false, error: String(e), updated_at: now(), repos: [] };
        }
    });

    // preview: testa um repo sem salvar
    app.post("/api/github/preview", async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.repo !== "string" || !String(body.repo).trim()) {
            return reply.code(400).send({ ok: false, error: "repo é obrigatório" });
        }
        const repo = String(body.repo).trim();
        const result = await fetchGithubRepo({ id: "preview", repo, label: String(body.label ?? "") });
        return result;
    });
}
