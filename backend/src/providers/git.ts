/**
 * Provedor Git: monitora repositórios locais ou remotos e lista os últimos commits.
 * - source pode ser URL (https://github.com/org/repo, git@github.com:org/repo.git, etc.)
 *   ou caminho local absoluto (/home/user/projetos/meu-repo).
 * - Para URLs remotas: faz clone raso (--depth) em diretório temporário e lê o log.
 * - Para caminhos locais: lê direto do .git existente.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { utcNow } from "../formatting.js";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 25_000;
const CLONE_TIMEOUT_MS = 30_000;
const MAX_LIMIT = 50;
const MIN_LIMIT = 1;

// Separador improvável para parsear git log
const SEP = "\x1f";
const RECORD_SEP = "\x1e";

export type GitCommit = {
    hash: string;
    short_hash: string;
    author_name: string;
    author_email: string;
    date: string;
    subject: string;
    body: string;
};

export type GitRepoResult = {
    id: string;
    label: string;
    source: string;
    branch: string | null;
    limit: number;
    ok: boolean;
    error: string | null;
    commits: GitCommit[];
    updated_at: string | null;
    head: string | null;
    remote_url: string | null;
};

function clampLimit(n: unknown): number {
    const v = Number(n);
    if (!Number.isFinite(v)) return 5;
    return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.trunc(v)));
}

function isUrl(source: string): boolean {
    const s = source.trim();
    if (/^https?:\/\//i.test(s)) return true;
    if (/^git@/i.test(s)) return true;
    if (/^ssh:\/\//i.test(s)) return true;
    if (/^git:\/\//i.test(s)) return true;
    // scp-like: user@host:path
    if (/^[^/]+\@[^:]+:.+/.test(s)) return true;
    return false;
}

function normalizeSource(source: string): string {
    return source.trim();
}

function repoLabel(source: string, explicitLabel: string): string {
    if (explicitLabel.trim()) return explicitLabel.trim();
    const s = source.trim().replace(/\/$/, "").replace(/\.git$/, "");
    // tenta extrair org/repo ou último segmento
    const parts = s.split(/[/:]/).filter(Boolean);
    if (parts.length >= 2) {
        const last2 = parts.slice(-2).join("/");
        if (last2.length <= 60) return last2;
    }
    return parts[parts.length - 1] || s;
}

async function runGit(args: string[], cwd: string, timeoutMs = GIT_TIMEOUT_MS): Promise<string> {
    const { stdout } = await execFileAsync("git", args, { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
    return stdout;
}

async function resolveLocalRepo(source: string): Promise<string> {
    const abs = resolve(source.trim());
    if (!existsSync(abs)) throw new Error(`Pasta não encontrada: ${abs}`);
    // verifica se é repo git (pasta .git ou worktree)
    try {
        await execFileAsync("git", ["rev-parse", "--git-dir"], { cwd: abs, timeout: 5000 });
    } catch {
        throw new Error(`Não é um repositório git válido: ${abs}`);
    }
    return abs;
}

async function cloneRemote(source: string): Promise<{ dir: string; cleanup: () => void }> {
    const dir = mkdtempSync(join(tmpdir(), "vigia-git-"));
    const cleanup = () => {
        try { rmSync(dir, { recursive: true, force: true }); } catch { }
    };
    try {
        await execFileAsync("git", ["clone", "--depth", "50", "--no-single-branch", source, dir + "/repo"], { timeout: CLONE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 });
    } catch (e: unknown) {
        cleanup();
        const msg = e instanceof Error ? e.message : String(e);
        // mensagens mais amigáveis
        if (/authentication|permission denied|could not read/i.test(msg)) throw new Error(`Falha ao clonar (autenticação/permissão): ${msg.slice(0, 300)}`);
        if (/not found|repository not found|does not exist/i.test(msg)) throw new Error(`Repositório não encontrado: ${source}`);
        throw new Error(`Falha ao clonar: ${msg.slice(0, 400)}`);
    }
    return { dir: join(dir, "repo"), cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch { } } };
}

async function readCommits(cwd: string, limit: number, branch: string | null): Promise<{ commits: GitCommit[]; head: string | null; remoteUrl: string | null }> {
    const fmt = `%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%aI${SEP}%s${SEP}%b${RECORD_SEP}`;
    const args = ["log", `--pretty=format:${fmt}`, "-n", String(limit)];
    if (branch) {
        // verifica se branch existe
        try {
            await execFileAsync("git", ["rev-parse", "--verify", branch], { cwd, timeout: 5000 });
            args.push(branch);
        } catch {
            throw new Error(`Branch não encontrada: ${branch}`);
        }
    }
    let stdout: string;
    try {
        stdout = await runGit(args, cwd);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/does not have any commits|bad revision|unknown revision/i.test(msg)) return { commits: [], head: null, remoteUrl: null };
        throw new Error(msg.slice(0, 500));
    }

    const commits: GitCommit[] = [];
    const records = stdout.split(RECORD_SEP).filter((r) => r.trim().length > 0);
    for (const rec of records) {
        const trimmed = rec.startsWith("\n") ? rec.slice(1) : rec;
        const parts = trimmed.split(SEP);
        if (parts.length < 6) continue;
        const [hash, short_hash, author_name, author_email, date, subject, body = ""] = parts;
        if (!hash) continue;
        commits.push({
            hash: hash.trim(),
            short_hash: short_hash.trim(),
            author_name: author_name.trim(),
            author_email: author_email.trim(),
            date: date.trim(),
            subject: subject.trim(),
            body: body.replace(/\n+$/, "").trim(),
        });
    }

    let head: string | null = null;
    try {
        const h = await runGit(["rev-parse", "HEAD"], cwd);
        head = h.trim() || null;
    } catch { }

    let remoteUrl: string | null = null;
    try {
        const r = await runGit(["config", "--get", "remote.origin.url"], cwd);
        remoteUrl = r.trim() || null;
    } catch { }

    return { commits, head, remoteUrl };
}

export function gitFail(msg: string): Omit<GitRepoResult, "id" | "label" | "source" | "branch" | "limit"> {
    return { ok: false, error: msg, commits: [], updated_at: utcNow(), head: null, remote_url: null };
}

export async function fetchGitRepo(cfg: { id: string; source: string; label?: string; limit?: number; branch?: string | null }): Promise<GitRepoResult> {
    const id = String(cfg.id);
    const source = normalizeSource(cfg.source);
    const label = repoLabel(source, String(cfg.label ?? ""));
    const limit = clampLimit(cfg.limit ?? 5);
    const branch = cfg.branch ? String(cfg.branch).trim() || null : null;

    if (!source) {
        return { id, label, source, branch, limit, ...gitFail("Origem vazia"), updated_at: utcNow() };
    }

    const urlMode = isUrl(source);
    let cwd: string | null = null;
    let cleanup: (() => void) | null = null;

    try {
        if (urlMode) {
            const cloned = await cloneRemote(source);
            cwd = cloned.dir;
            cleanup = cloned.cleanup;
        } else {
            cwd = await resolveLocalRepo(source);
        }

        const { commits, head, remoteUrl } = await readCommits(cwd, limit, branch);
        return {
            id, label, source, branch, limit,
            ok: true, error: null,
            commits, updated_at: utcNow(),
            head, remote_url: remoteUrl,
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id, label, source, branch, limit, ...gitFail(msg), updated_at: utcNow() };
    } finally {
        if (cleanup) cleanup();
    }
}

export async function fetchGitRepos(cfg: Record<string, unknown>): Promise<GitRepoResult[]> {
    const gitCfg = (cfg.git ?? {}) as Record<string, unknown>;
    const repos = Array.isArray(gitCfg.repos) ? gitCfg.repos as Array<Record<string, unknown>> : [];
    if (repos.length === 0) return [];
    // busca em paralelo com limite simples (Promise.all é ok — poucos repos)
    const results = await Promise.all(
        repos.map((r) =>
            fetchGitRepo({
                id: String(r.id ?? ""),
                source: String(r.source ?? ""),
                label: String(r.label ?? ""),
                limit: clampLimit(r.limit ?? 5),
                branch: r.branch != null ? String(r.branch) : null,
            }),
        ),
    );
    return results;
}

export function mockGitPayload(): Record<string, unknown> {
    const now = utcNow();
    return {
        ok: true, error: null, updated_at: now,
        repos: [
            {
                id: "demo",
                label: "vigia-ai",
                source: "https://github.com/zonaro/vigia-ai",
                branch: null, limit: 5,
                ok: true, error: null,
                commits: [
                    { hash: "abc123def456abc123def456abc123def456abcd", short_hash: "abc123d", author_name: "Kaizonaro", author_email: "kaizonaro@example.com", date: now, subject: "feat: adiciona monitoramento git", body: "Detalhes do commit de exemplo" },
                    { hash: "def456abc123def456abc123def456abc123abce", short_hash: "def456a", author_name: "Kaizonaro", author_email: "kaizonaro@example.com", date: now, subject: "fix: corrige layout do board", body: "" },
                ],
                updated_at: now, head: "abc123def456abc123def456abc123def456abcd", remote_url: "https://github.com/zonaro/vigia-ai.git",
            },
        ],
    };
}

export const cleanGitSource = normalizeSource;
export const isGitUrl = isUrl;
export const clampGitLimit = clampLimit;
