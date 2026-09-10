import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { fetchGithubProfile, fetchGithubRepo, fetchGithubTop, fetchGithubTrending, githubSectionFlags, isValidGithubRepo, isValidGithubUsername } from "../providers/github.js";
import { load, updateSync as update } from "../store.js";

export async function createGithubRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/github/config", { schema: { tags: ["GitHub"] } }, async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.github ?? { enabled: false, hidden: false, reposEnabled: false, profilesEnabled: false, repos: [], profiles: [] }) as Record<string, unknown>;
    });

    app.patch("/api/github/config", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            const hasRepos = body.reposEnabled !== undefined && body.reposEnabled !== null;
            const hasProfiles = body.profilesEnabled !== undefined && body.profilesEnabled !== null;
            if (hasRepos) g.reposEnabled = Boolean(body.reposEnabled);
            if (hasProfiles) g.profilesEnabled = Boolean(body.profilesEnabled);
            if (!hasRepos && !hasProfiles) {
                const next = body.enabled !== undefined && body.enabled !== null
                    ? Boolean(body.enabled)
                    : (body.hidden !== undefined && body.hidden !== null ? !Boolean(body.hidden) : undefined);
                if (next !== undefined) {
                    g.reposEnabled = next;
                    g.profilesEnabled = next;
                }
            }
            g.enabled = Boolean(g.reposEnabled) || Boolean(g.profilesEnabled);
            g.hidden = !g.enabled;
        });
        const cfg = load() as Record<string, unknown>;
        return (cfg.github ?? {}) as Record<string, unknown>;
    });

    app.post("/api/github/repos", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
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
            g.reposEnabled = true;
            g.enabled = true;
            g.hidden = false;
        });
        const cfg = load() as Record<string, unknown>;
        return { ok: true, id, config: cfg.github };
    });

    app.patch("/api/github/repos/:id", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
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

    app.delete("/api/github/repos/:id", { schema: { tags: ["GitHub"] } }, async (request) => {
        const { id } = request.params as { id: string };
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            const repos = Array.isArray(g.repos) ? g.repos as Array<Record<string, unknown>> : [];
            g.repos = repos.filter((r) => String(r.id) !== id);
        });
        return { ok: true };
    });

    // ── Perfis (para ver bio + repositórios fixados) ──────────────────

    app.post("/api/github/profiles", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.username !== "string" || !String(body.username).trim()) {
            return reply.code(400).send({ ok: false, error: "usuário é obrigatório" });
        }
        const username = String(body.username).trim();
        const label = String(body.label ?? "").trim();
        if (!isValidGithubUsername(username)) return reply.code(400).send({ ok: false, error: "Nome de usuário inválido" });

        const probe = await fetchGithubProfile(username);
        if (!probe.ok) {
            return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o perfil" });
        }

        const id = randomBytes(4).toString("hex");
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            const profiles = Array.isArray(g.profiles) ? [...(g.profiles as unknown[])] : [];
            profiles.push({ id, username, label });
            g.profiles = profiles;
            g.profilesEnabled = true;
            g.enabled = true;
            g.hidden = false;
        });
        const cfg = load() as Record<string, unknown>;
        return { ok: true, id, config: cfg.github };
    });

    app.patch("/api/github/profiles/:id", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });

        const cfg = load() as Record<string, unknown>;
        const g = (cfg.github ?? {}) as Record<string, unknown>;
        const profiles = Array.isArray(g.profiles) ? g.profiles as Array<Record<string, unknown>> : [];
        const idx = profiles.findIndex((p) => String(p.id) === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "perfil não encontrado" });

        const current = profiles[idx];
        const nextUsername = body.username != null ? String(body.username).trim() : String(current.username);
        const nextLabel = body.label != null ? String(body.label).trim() : String(current.label ?? "");

        if (!nextUsername) return reply.code(400).send({ ok: false, error: "usuário não pode ser vazio" });
        if (!isValidGithubUsername(nextUsername)) return reply.code(400).send({ ok: false, error: "Nome de usuário inválido" });

        if (nextUsername !== String(current.username)) {
            const probe = await fetchGithubProfile(nextUsername);
            if (!probe.ok) return reply.code(400).send({ ok: false, error: probe.error || "Não foi possível acessar o perfil" });
        }

        update((c: Record<string, unknown>) => {
            const gg = (c.github ?? {}) as Record<string, unknown>;
            const pp = Array.isArray(gg.profiles) ? gg.profiles as Array<Record<string, unknown>> : [];
            const i = pp.findIndex((p) => String(p.id) === id);
            if (i === -1) return;
            pp[i] = { ...pp[i], username: nextUsername, label: nextLabel };
            gg.profiles = pp;
        });
        const updated = load() as Record<string, unknown>;
        return { ok: true, config: updated.github };
    });

    app.delete("/api/github/profiles/:id", { schema: { tags: ["GitHub"] } }, async (request) => {
        const { id } = request.params as { id: string };
        update((cfg: Record<string, unknown>) => {
            const g = (cfg.github ?? {}) as Record<string, unknown>;
            if (!cfg.github) cfg.github = g;
            const profiles = Array.isArray(g.profiles) ? g.profiles as Array<Record<string, unknown>> : [];
            g.profiles = profiles.filter((p) => String(p.id) !== id);
        });
        return { ok: true };
    });

    // preview: testa um perfil sem salvar
    app.post("/api/github/profiles/preview", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.username !== "string" || !String(body.username).trim()) {
            return reply.code(400).send({ ok: false, error: "usuário é obrigatório" });
        }
        const username = String(body.username).trim();
        const result = await fetchGithubProfile(username);
        return result;
    });

    app.get("/api/github", { schema: { tags: ["GitHub"] } }, async () => {
        const cfg = load() as Record<string, unknown>;
        const g = (cfg.github ?? {}) as Record<string, unknown>;
        const flags = githubSectionFlags(g);
        if (!flags.repos && !flags.profiles) return { ok: true, error: null, updated_at: null, repos: [], profiles: [] };
        if (cfg.mock) {
            const { mockGithubPayload } = await import("../providers/github.js");
            const mock = mockGithubPayload();
            if (!flags.repos) mock.repos = [];
            if (!flags.profiles) mock.profiles = [];
            return mock;
        }
        const { fetchGithubRepos, fetchGithubProfiles } = await import("../providers/github.js");
        const { utcNow } = await import("../formatting.js");
        try {
            const [repos, profiles] = await Promise.all([
                flags.repos ? fetchGithubRepos(cfg) : Promise.resolve([]),
                flags.profiles ? fetchGithubProfiles(cfg) : Promise.resolve([]),
            ]);
            return { ok: true, error: null, updated_at: utcNow(), repos, profiles };
        } catch (e) {
            const { utcNow: now } = await import("../formatting.js");
            return { ok: false, error: String(e), updated_at: now(), repos: [], profiles: [] };
        }
    });

    // repositórios "em alta" (Search API, criados nos últimos 7 dias, mais estrelas primeiro)
    app.get("/api/github/trending", { schema: { tags: ["GitHub"] } }, async () => {
        const cfg = load() as Record<string, unknown>;
        if (cfg.mock) {
            const { mockGithubExplore } = await import("../providers/github.js");
            return mockGithubExplore();
        }
        return fetchGithubTrending();
    });

    // top repositórios por estrelas, com filtro opcional de linguagem/período
    app.get("/api/github/top", { schema: { tags: ["GitHub"] } }, async (request) => {
        const query = request.query as { language?: string; period?: string };
        const cfg = load() as Record<string, unknown>;
        if (cfg.mock) {
            const { mockGithubExplore } = await import("../providers/github.js");
            return mockGithubExplore();
        }
        return fetchGithubTop({ language: query.language, period: query.period });
    });

    // preview: testa um repo sem salvar
    app.post("/api/github/preview", { schema: { tags: ["GitHub"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body || typeof body.repo !== "string" || !String(body.repo).trim()) {
            return reply.code(400).send({ ok: false, error: "repo é obrigatório" });
        }
        const repo = String(body.repo).trim();
        const result = await fetchGithubRepo({ id: "preview", repo, label: String(body.label ?? "") });
        return result;
    });
}
