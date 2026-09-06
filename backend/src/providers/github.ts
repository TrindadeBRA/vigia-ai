/**
 * Provedor GitHub: estatísticas públicas de repositórios (stars, issues, forks).
 * API pública do GitHub, sem autenticação — rate limit de 60 req/h por IP.
 */
import { utcNow } from "../formatting.js";

const FETCH_TIMEOUT_MS = 15_000;
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export type GithubRepoResult = {
    id: string;
    label: string;
    repo: string;
    ok: boolean;
    error: string | null;
    full_name: string | null;
    description: string | null;
    stars: number | null;
    forks: number | null;
    open_issues: number | null;
    watchers: number | null;
    default_branch: string | null;
    html_url: string | null;
    pushed_at: string | null;
    updated_at: string | null;
};

export function isValidGithubRepo(raw: string): boolean {
    return REPO_RE.test(raw.trim());
}

export function githubFail(msg: string): Omit<GithubRepoResult, "id" | "label" | "repo"> {
    return {
        ok: false,
        error: msg,
        full_name: null,
        description: null,
        stars: null,
        forks: null,
        open_issues: null,
        watchers: null,
        default_branch: null,
        html_url: null,
        pushed_at: null,
        updated_at: utcNow(),
    };
}

export async function fetchGithubRepo(cfg: { id: string; repo: string; label?: string }): Promise<GithubRepoResult> {
    const id = String(cfg.id);
    const repo = String(cfg.repo ?? "").trim();
    const label = String(cfg.label ?? "").trim();

    if (!repo) {
        return { id, label, repo, ...githubFail("Repositório vazio") };
    }
    if (!isValidGithubRepo(repo)) {
        return { id, label, repo, ...githubFail("Formato inválido — use owner/repo") };
    }

    try {
        const resp = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: {
                "Accept": "application/vnd.github+json",
                "User-Agent": "VigiaAI/1.0 (github)",
            },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (resp.status === 404) {
            return { id, label, repo, ...githubFail("Repositório não encontrado") };
        }
        if (resp.status === 403 || resp.status === 429) {
            return { id, label, repo, ...githubFail("Limite de requisições do GitHub atingido (API pública sem token, tente novamente em alguns minutos)") };
        }
        if (!resp.ok) {
            const body = await resp.text().catch(() => "");
            return { id, label, repo, ...githubFail(`HTTP ${resp.status}: ${body.slice(0, 200)}`) };
        }
        const data = await resp.json() as Record<string, unknown>;
        return {
            id, label, repo,
            ok: true, error: null,
            full_name: typeof data.full_name === "string" ? data.full_name : repo,
            description: typeof data.description === "string" ? data.description : null,
            stars: typeof data.stargazers_count === "number" ? data.stargazers_count : null,
            forks: typeof data.forks_count === "number" ? data.forks_count : null,
            open_issues: typeof data.open_issues_count === "number" ? data.open_issues_count : null,
            watchers: typeof data.subscribers_count === "number" ? data.subscribers_count : (typeof data.watchers_count === "number" ? data.watchers_count : null),
            default_branch: typeof data.default_branch === "string" ? data.default_branch : null,
            html_url: typeof data.html_url === "string" ? data.html_url : `https://github.com/${repo}`,
            pushed_at: typeof data.pushed_at === "string" ? data.pushed_at : null,
            updated_at: utcNow(),
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id, label, repo, ...githubFail(msg.slice(0, 300)) };
    }
}

export async function fetchGithubRepos(cfg: Record<string, unknown>): Promise<GithubRepoResult[]> {
    const ghCfg = (cfg.github ?? {}) as Record<string, unknown>;
    const repos = Array.isArray(ghCfg.repos) ? ghCfg.repos as Array<Record<string, unknown>> : [];
    if (repos.length === 0) return [];
    const results = await Promise.all(
        repos.map((r) =>
            fetchGithubRepo({
                id: String(r.id ?? ""),
                repo: String(r.repo ?? ""),
                label: String(r.label ?? ""),
            }),
        ),
    );
    return results;
}

export function mockGithubPayload(): Record<string, unknown> {
    const now = utcNow();
    return {
        ok: true, error: null, updated_at: now,
        repos: [
            {
                id: "demo",
                label: "",
                repo: "TrindadeBRA/vigia-ai",
                ok: true, error: null,
                full_name: "TrindadeBRA/vigia-ai",
                description: "Painel de monitoramento de contas de IA",
                stars: 42, forks: 7, open_issues: 3, watchers: 5,
                default_branch: "main",
                html_url: "https://github.com/TrindadeBRA/vigia-ai",
                pushed_at: now, updated_at: now,
            },
        ],
    };
}

export const isGithubRepo = isValidGithubRepo;
