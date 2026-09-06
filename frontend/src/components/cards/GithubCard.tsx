import type { GithubPayload, GithubRepo } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { cardLabel, emptyNote, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

export function githubAllowedSizes(repo?: GithubRepo | null): CardSize[] {
    if (!repo || !repo.ok) return ["sm", "md", "free"];
    return ["sm", "md", "lg", "free"];
}

export function githubSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return `${t.cardSmallPrefix} ${t.githubStars}`;
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "free") return t.cardFree;
    return t.cardXl;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtCompactNumber(n: number | null): string {
    if (n == null) return "--";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

function fmtPushDate(iso: string | null): string {
    if (!iso) return "--";
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
        return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return iso.slice(0, 16); }
}

function shortRepoName(repo: GithubRepo): string {
    return repo.label || repo.full_name || repo.repo;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function GithubIcon({ compact }: { compact?: boolean }) {
    if (compact) {
        return (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                <span className="text-[13px]">🐙</span>
            </div>
        );
    }
    return (
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            <span className="text-[20px]">🐙</span>
        </div>
    );
}

function GithubHeader({ repo, compact, onOpen }: { repo: GithubRepo; compact?: boolean; onOpen?: () => void }) {
    const name = shortRepoName(repo);
    const inner = (
        <>
            <div className="relative shrink-0">
                <GithubIcon compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", repo.ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{name}</div>
                <div className={cardLabel}>{repo.default_branch || "--"}</div>
            </div>
        </>
    );
    if (onOpen) {
        return (
            <button type="button" className={cn("flex min-w-0 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-ink", compact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")} onClick={onOpen}>
                {inner}
            </button>
        );
    }
    return <div className={cn("flex min-w-0 shrink-0 items-center", compact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>{inner}</div>;
}

function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-edge bg-chip px-2 py-2">
            <span className={cn(num, "text-[15px] font-[750] leading-none")}>{value}</span>
            <span className="text-[10px] leading-none text-ink3">{label}</span>
        </div>
    );
}

/* ── Board (um card por repositório) ───────────────────────────────── */

export function GithubBoardCard({
    repo,
    github,
    t,
    size,
    onOpen,
}: {
    repo: GithubRepo | null | undefined;
    github?: GithubPayload | null | undefined;
    t: T;
    size: CardSize;
    onOpen: () => void;
}) {
    const ns = normalizeSize(size);
    const isCompact = ns === "sm";

    if (!repo) {
        const repos = github?.repos ?? [];
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <div className={cn("flex min-w-0 shrink-0 items-center", isCompact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>
                    <GithubIcon compact={isCompact} />
                    <div className="min-w-0 flex-1">
                        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", isCompact ? "text-[12.5px]" : "text-[14px]")}>{t.github}</div>
                        <div className={cardLabel}>{repos.length} {repos.length === 1 ? "repo" : "repos"}</div>
                    </div>
                </div>
                <div className="flex flex-1 items-center">
                    <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{github?.error || t.githubEmpty}</div>
                </div>
            </div>
        );
    }

    if (!repo.ok) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <GithubHeader repo={repo} compact={isCompact} onOpen={onOpen} />
                <div className="flex flex-1 items-center">
                    <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{repo.error || t.noData}</div>
                </div>
            </div>
        );
    }

    // sm: hero de estrelas
    if (ns === "sm") {
        return (
            <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                    <GithubIcon />
                    <span className="absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full bg-good shadow-[0_0_0_2px_var(--panel)]" />
                </div>
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{shortRepoName(repo)}</div>
                    <div className={cn(num, "mt-1 text-[16px] font-[750] leading-tight")}>⭐ {fmtCompactNumber(repo.stars)}</div>
                    <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{fmtCompactNumber(repo.open_issues)} {t.githubIssues}</div>
                </button>
            </div>
        );
    }

    if (ns === "md") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <GithubHeader repo={repo} onOpen={onOpen} />
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="flex gap-1.5">
                        <StatChip label={t.githubStars} value={fmtCompactNumber(repo.stars)} />
                        <StatChip label={t.githubForks} value={fmtCompactNumber(repo.forks)} />
                    </div>
                    <div className="flex gap-1.5">
                        <StatChip label={t.githubIssues} value={fmtCompactNumber(repo.open_issues)} />
                    </div>
                </button>
            </div>
        );
    }

    // lg / free: estatísticas completas + descrição
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <GithubHeader repo={repo} onOpen={onOpen} />
            <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                <div className="flex gap-1.5">
                    <StatChip label={t.githubStars} value={fmtCompactNumber(repo.stars)} />
                    <StatChip label={t.githubForks} value={fmtCompactNumber(repo.forks)} />
                    <StatChip label={t.githubIssues} value={fmtCompactNumber(repo.open_issues)} />
                </div>
                {repo.description ? <div className="line-clamp-2 text-[12px] leading-snug text-ink2">{repo.description}</div> : null}
                <div className="text-[11px] text-ink3">{t.githubLastPush}: {fmtPushDate(repo.pushed_at)}</div>
            </button>
        </div>
    );
}

/* ── Detail (página da conta) ─────────────────────────────────────── */

export function GithubDetail({ repo, github, t }: { repo?: GithubRepo | null; github?: GithubPayload | null | undefined; t: T }) {
    const target: GithubRepo | null = repo ?? github?.repos?.[0] ?? null;

    if (!target) {
        return (
            <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className={emptyNote}>{t.githubEmpty}</div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-edge bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-full", target.ok ? "bg-good" : "bg-bad")} />
                <h3 className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold text-ink">{shortRepoName(target)}</h3>
                {target.default_branch ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">{target.default_branch}</span> : null}
            </div>
            {!target.ok ? (
                <div className={errorText}>{target.error || t.noData}</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {target.description ? <div className="text-[13px] leading-relaxed text-ink2">{target.description}</div> : null}
                    <div className="flex flex-wrap gap-2">
                        <StatChip label={t.githubStars} value={fmtCompactNumber(target.stars)} />
                        <StatChip label={t.githubForks} value={fmtCompactNumber(target.forks)} />
                        <StatChip label={t.githubIssues} value={fmtCompactNumber(target.open_issues)} />
                        {target.watchers != null ? <StatChip label="watchers" value={fmtCompactNumber(target.watchers)} /> : null}
                    </div>
                    <div className="text-[11px] text-ink3">{t.githubLastPush}: {fmtPushDate(target.pushed_at)}</div>
                    {target.html_url ? (
                        <a className="text-[12px] font-medium text-accent no-underline hover:underline" href={target.html_url} target="_blank" rel="noopener noreferrer">
                            {target.html_url}
                        </a>
                    ) : null}
                </div>
            )}
        </div>
    );
}
