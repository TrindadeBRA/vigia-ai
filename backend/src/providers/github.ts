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

const GITHUB_RATE_LIMIT =
    "Limite de requisições do GitHub atingido (API pública sem token, tente novamente em alguns minutos)";
const GITHUB_TIMEOUT = "O GitHub demorou demais para responder";
const GITHUB_NETWORK = "Não foi possível conectar ao GitHub";
const GITHUB_UNAVAILABLE = "O GitHub está indisponível no momento";
const GITHUB_UNKNOWN = "Não foi possível atualizar os dados do GitHub";

function errorChainText(err: unknown): string {
    const parts: string[] = [];
    let current: unknown = err;
    const seen = new Set<unknown>();
    for (let i = 0; i < 6 && current != null && !seen.has(current); i++) {
        seen.add(current);
        if (typeof current === "string") {
            parts.push(current);
            break;
        }
        if (typeof current !== "object") {
            parts.push(String(current));
            break;
        }
        const o = current as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
        if (typeof o.name === "string") parts.push(o.name);
        if (typeof o.message === "string") parts.push(o.message);
        if (typeof o.code === "string" || typeof o.code === "number") parts.push(String(o.code));
        current = o.cause;
    }
    return parts.join(" ");
}

/** Traduz falhas de rede/timeout/HTTP em texto curto para o card (evita "fetch failed"). */
export function describeGithubError(err: unknown): string {
    const blob = errorChainText(err).toLowerCase();
    if (/timeout|timed out|etimedout|aborted|aborterror|timeouterror|und_err_connect_timeout|und_err_headers_timeout|und_err_body_timeout/.test(blob)) {
        return GITHUB_TIMEOUT;
    }
    if (/enotfound|eai_again|econnrefused|econnreset|enetunreach|ehostunreach|und_err|fetch failed|failed to fetch|networkerror|socket/.test(blob)) {
        return GITHUB_NETWORK;
    }
    const msg = err instanceof Error ? err.message : String(err);
    const trimmed = msg.trim();
    if (!trimmed || /^typeerror$/i.test(trimmed) || trimmed.toLowerCase() === "fetch failed") {
        return GITHUB_UNKNOWN;
    }
    return trimmed.slice(0, 300);
}

export function describeGithubHttpError(status: number, kind: "repo" | "user" | "search" = "repo"): string {
    if (status === 404) {
        if (kind === "user") return "Usuário não encontrado";
        if (kind === "search") return "Busca do GitHub falhou";
        return "Repositório não encontrado";
    }
    if (status === 401) return "GitHub recusou o acesso";
    if (status === 403 || status === 429) return GITHUB_RATE_LIMIT;
    if (status >= 500) return GITHUB_UNAVAILABLE;
    return `GitHub retornou HTTP ${status}`;
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
        if (!resp.ok) {
            return { id, label, repo, ...githubFail(describeGithubHttpError(resp.status, "repo")) };
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
        return { id, label, repo, ...githubFail(describeGithubError(e)) };
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

/**
 * Explorar GitHub: "em alta" e "top repos" via Search API pública
 * (https://api.github.com/search/repositories), já que o GitHub não
 * expõe endpoint oficial para a página trending.github.com. A Search
 * API tem limite de 10 req/min sem token, então cacheamos cada query
 * por EXPLORE_TTL_MS e devolvemos o último resultado bom em caso de
 * erro/limite (fica "meio velho" em vez de vazio).
 */
export type GithubExploreRepo = {
    full_name: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
    html_url: string;
    owner_avatar: string | null;
};

export type GithubExploreResult = {
    ok: boolean;
    error: string | null;
    repos: GithubExploreRepo[];
    updated_at: string;
};

const EXPLORE_TTL_MS = 10 * 60 * 1000;
type ExploreCacheEntry = { at: number; data: GithubExploreRepo[] };
const exploreCache = new Map<string, ExploreCacheEntry>();

async function searchGithubRepos(query: string, cacheKey: string): Promise<GithubExploreResult> {
    const cached = exploreCache.get(cacheKey);
    if (cached && Date.now() - cached.at < EXPLORE_TTL_MS) {
        return { ok: true, error: null, repos: cached.data, updated_at: utcNow() };
    }
    try {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;
        const resp = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github+json",
                "User-Agent": "VigiaAI/1.0 (github-explore)",
            },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!resp.ok) {
            const error = describeGithubHttpError(resp.status, "search");
            if (cached) return { ok: true, error, repos: cached.data, updated_at: utcNow() };
            return { ok: false, error, repos: [], updated_at: utcNow() };
        }
        const data = await resp.json() as { items?: Array<Record<string, unknown>> };
        const repos: GithubExploreRepo[] = (data.items ?? [])
            .map((it): GithubExploreRepo | null => {
                const fullName = typeof it.full_name === "string" ? it.full_name : "";
                if (!fullName) return null;
                const owner = (it.owner ?? {}) as Record<string, unknown>;
                return {
                    full_name: fullName,
                    description: typeof it.description === "string" ? it.description : null,
                    stars: typeof it.stargazers_count === "number" ? it.stargazers_count : 0,
                    forks: typeof it.forks_count === "number" ? it.forks_count : 0,
                    language: typeof it.language === "string" ? it.language : null,
                    html_url: typeof it.html_url === "string" ? it.html_url : `https://github.com/${fullName}`,
                    owner_avatar: typeof owner.avatar_url === "string" ? owner.avatar_url : null,
                };
            })
            .filter((r): r is GithubExploreRepo => r !== null);
        exploreCache.set(cacheKey, { at: Date.now(), data: repos });
        return { ok: true, error: null, repos, updated_at: utcNow() };
    } catch (e: unknown) {
        const error = describeGithubError(e);
        if (cached) return { ok: true, error, repos: cached.data, updated_at: utcNow() };
        return { ok: false, error, repos: [], updated_at: utcNow() };
    }
}

export async function fetchGithubTrending(): Promise<GithubExploreResult> {
    const sinceDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return searchGithubRepos(`created:>${sinceDate}`, "trending:7d");
}

const TOP_PERIOD_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
export const GITHUB_TOP_PERIODS = ["day", "week", "month", "year", "all"] as const;
export type GithubTopPeriod = typeof GITHUB_TOP_PERIODS[number];

export function isValidGithubLanguage(raw: string): boolean {
    return /^[A-Za-z0-9+#. -]{0,40}$/.test(raw);
}

export async function fetchGithubTop(params: { language?: string | null; period?: string | null }): Promise<GithubExploreResult> {
    const language = String(params.language ?? "").trim();
    const period = (GITHUB_TOP_PERIODS as readonly string[]).includes(String(params.period)) ? String(params.period) as GithubTopPeriod : "all";
    if (language && !isValidGithubLanguage(language)) {
        return { ok: false, error: "Linguagem inválida", repos: [], updated_at: utcNow() };
    }

    let query = "stars:>1";
    if (language) query += ` language:${language}`;
    const days = TOP_PERIOD_DAYS[period];
    if (days) {
        const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
        query += ` created:>${sinceDate}`;
    }
    return searchGithubRepos(query, `top:${language || "any"}:${period}`);
}

/**
 * Perfil GitHub: dados básicos (nome, bio, seguidores) via REST API oficial
 * (/users/:username) + repositórios fixados via scraping da página pública
 * do perfil, já que o GitHub só expõe "pinned items" pela API GraphQL
 * autenticada (sem token aqui). O HTML é razoavelmente estável
 * (classe `pinned-item-list-item`), mas é scraping mesmo — se a página
 * mudar de marcação, cai para "sem fixados" em vez de quebrar.
 */
export type GithubPinnedRepo = {
    full_name: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
    html_url: string;
};

export type GithubProfileResult = {
    id: string;
    label: string;
    ok: boolean;
    error: string | null;
    username: string;
    name: string | null;
    avatar_url: string | null;
    bio: string | null;
    followers: number | null;
    public_repos: number | null;
    html_url: string;
    pinned: GithubPinnedRepo[];
    updated_at: string;
};

/** Toggles independentes dos dois cards de config (repos vs perfis). Config antiga só tinha `enabled`/`hidden`. */
export function githubSectionFlags(gh: Record<string, unknown>): { repos: boolean; profiles: boolean } {
    const legacyOn = Boolean(gh.enabled) && !Boolean(gh.hidden);
    return {
        repos: typeof gh.reposEnabled === "boolean" ? gh.reposEnabled : legacyOn,
        profiles: typeof gh.profilesEnabled === "boolean" ? gh.profilesEnabled : legacyOn,
    };
}

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
export function isValidGithubUsername(raw: string): boolean {
    return USERNAME_RE.test(raw.trim());
}

function parseCompactCount(raw: string): number {
    const s = raw.trim().toLowerCase().replace(/,/g, "");
    const m = /^([\d.]+)([km]?)$/.exec(s);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    if (Number.isNaN(n)) return 0;
    if (m[2] === "k") return Math.round(n * 1_000);
    if (m[2] === "m") return Math.round(n * 1_000_000);
    return Math.round(n);
}

function parsePinnedItems(html: string): GithubPinnedRepo[] {
    const items: GithubPinnedRepo[] = [];
    const liRe = /<li\s[^>]*\bpinned-item-list-item\b[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = liRe.exec(html)) !== null) {
        const block = m[1];
        const hrefM = /href="\/([^"/]+)\/([^"/?#]+)"[^>]*>\s*<span class="repo">([^<]+)<\/span>/.exec(block);
        if (!hrefM) continue;
        const owner = hrefM[1];
        const repoSlug = hrefM[2];
        const descM = /pinned-item-desc[^>]*>([\s\S]*?)<\/p>/.exec(block);
        const description = descM ? descM[1].replace(/\s+/g, " ").trim() || null : null;
        const langM = /itemprop="programmingLanguage">([^<]+)</.exec(block);
        const language = langM ? langM[1].trim() : null;
        const starsM = /stargazers"[^>]*>[\s\S]*?<\/svg>\s*([\d.,km]+)/i.exec(block);
        const forksM = /\/forks"[^>]*>[\s\S]*?<\/svg>\s*([\d.,km]+)/i.exec(block);
        items.push({
            full_name: `${owner}/${repoSlug}`,
            description,
            stars: starsM ? parseCompactCount(starsM[1]) : 0,
            forks: forksM ? parseCompactCount(forksM[1]) : 0,
            language,
            html_url: `https://github.com/${owner}/${repoSlug}`,
        });
    }
    return items;
}

const PROFILE_TTL_MS = 10 * 60 * 1000;
type ProfileCacheEntry = { at: number; data: GithubProfileResult };
const profileCache = new Map<string, ProfileCacheEntry>();

function profileFail(username: string, error: string): GithubProfileResult {
    return {
        id: "", label: "",
        ok: false, error, username,
        name: null, avatar_url: null, bio: null, followers: null, public_repos: null,
        html_url: username ? `https://github.com/${username}` : "",
        pinned: [], updated_at: utcNow(),
    };
}

export async function fetchGithubProfile(usernameRaw: string): Promise<GithubProfileResult> {
    const username = String(usernameRaw ?? "").trim();
    if (!username) return profileFail(username, "Usuário vazio");
    if (!isValidGithubUsername(username)) return profileFail(username, "Nome de usuário inválido");

    const cacheKey = username.toLowerCase();
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached.data;

    try {
        const [userResp, htmlResp] = await Promise.all([
            fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
                headers: { "Accept": "application/vnd.github+json", "User-Agent": "VigiaAI/1.0 (github-profile)" },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            }),
            fetch(`https://github.com/${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; VigiaAI/1.0; +https://github.com)" },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            }).catch(() => null),
        ]);

        if (!userResp.ok) {
            const error = describeGithubHttpError(userResp.status, "user");
            if (cached) return { ...cached.data, error };
            return profileFail(username, error);
        }

        const userData = await userResp.json() as Record<string, unknown>;
        const html = htmlResp && htmlResp.ok ? await htmlResp.text().catch(() => "") : "";
        const pinned = html ? parsePinnedItems(html) : [];

        const result: GithubProfileResult = {
            id: "", label: "",
            ok: true, error: null, username,
            name: typeof userData.name === "string" ? userData.name : null,
            avatar_url: typeof userData.avatar_url === "string" ? userData.avatar_url : null,
            bio: typeof userData.bio === "string" ? userData.bio : null,
            followers: typeof userData.followers === "number" ? userData.followers : null,
            public_repos: typeof userData.public_repos === "number" ? userData.public_repos : null,
            html_url: typeof userData.html_url === "string" ? userData.html_url : `https://github.com/${username}`,
            pinned,
            updated_at: utcNow(),
        };
        profileCache.set(cacheKey, { at: Date.now(), data: result });
        return result;
    } catch (e: unknown) {
        const error = describeGithubError(e);
        if (cached) return { ...cached.data, error };
        return profileFail(username, error);
    }
}

export async function fetchGithubProfiles(cfg: Record<string, unknown>): Promise<GithubProfileResult[]> {
    const ghCfg = (cfg.github ?? {}) as Record<string, unknown>;
    const profiles = Array.isArray(ghCfg.profiles) ? ghCfg.profiles as Array<Record<string, unknown>> : [];
    if (profiles.length === 0) return [];
    return Promise.all(profiles.map(async (p) => {
        const id = String(p.id ?? "");
        const label = String(p.label ?? "");
        const result = await fetchGithubProfile(String(p.username ?? ""));
        return { ...result, id, label };
    }));
}

export function mockGithubProfile(): GithubProfileResult {
    const now = utcNow();
    return {
        id: "demo-profile", label: "",
        ok: true, error: null, username: "octocat",
        name: "The Octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
        bio: "Mascote do GitHub", followers: 12345, public_repos: 8,
        html_url: "https://github.com/octocat",
        pinned: [
            { full_name: "octocat/Hello-World", description: "My first repository on GitHub!", stars: 2800, forks: 2600, language: "JavaScript", html_url: "https://github.com/octocat/Hello-World" },
        ],
        updated_at: now,
    };
}

export function mockGithubExplore(): GithubExploreResult {
    const now = utcNow();
    return {
        ok: true, error: null, updated_at: now,
        repos: [
            { full_name: "TrindadeBRA/vigia-ai", description: "Painel de monitoramento de contas de IA", stars: 42, forks: 7, language: "TypeScript", html_url: "https://github.com/TrindadeBRA/vigia-ai", owner_avatar: null },
        ],
    };
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
        profiles: [mockGithubProfile()],
    };
}

export const isGithubRepo = isValidGithubRepo;
