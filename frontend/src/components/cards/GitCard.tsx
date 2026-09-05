import { useState } from "react";
import type { GitCommit, GitPayload, GitRepo } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

export function gitAllowedSizes(repo?: GitRepo | null): CardSize[] {
    const count = repo?.commits?.length ?? 0;
    if (count <= 1) return ["sm", "md", "free"];
    if (count <= 3) return ["sm", "md", "lg", "free"];
    return ["sm", "md", "lg", "wl", "wxl", "free"];
}

export const GIT_ALLOWED_ALL: CardSize[] = ["sm", "md", "lg", "wl", "wxl"];

export function gitSizeLabel(size: CardSize, t: T, repo?: GitRepo | null): string {
    const s = normalizeSize(size);
    const count = repo?.commits?.length ?? 0;
    if (s === "sm") return `${t.cardSmallPrefix} ${t.gitLastCommit}`;
    if (s === "md") return t.cardNormal;
    if (s === "lg") return count <= 3 ? t.cardLarge : `${t.cardLarge} · ${count} commits`;
    if (s === "wl") return t.cardWl;
    if (s === "wxl") return t.cardWxl;
    if (s === "free") return t.cardFree;
    return t.cardXl;
}

export function getGitMetrics(repo: GitRepo, t: T): { label: string; pct: number | null; value: string | null; sub: string | null }[] {
    if (!repo.ok) return [{ label: shortRepoName(repo), pct: null, value: null, sub: repo.error || t.gitNoCommits }];
    if (repo.commits.length === 0) return [{ label: shortRepoName(repo), pct: null, value: null, sub: t.gitNoCommits }];
    return repo.commits.slice(0, 6).map((c) => ({
        label: c.short_hash,
        pct: null,
        value: c.subject.slice(0, 40),
        sub: `${c.author_name} · ${fmtGitDate(c.date)}`,
    }));
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtGitDate(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
        return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return iso.slice(0, 16); }
}

function shortRepoName(repo: GitRepo): string {
    return repo.label || repo.source.split("/").pop()?.replace(/\.git$/, "") || repo.source.slice(0, 24);
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function GitIcon({ compact }: { compact?: boolean }) {
    const hasIcon = Boolean(PROVIDER_ICON.git);
    if (compact) {
        return (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                {hasIcon ? <img className="size-3.5 object-contain" src={PROVIDER_ICON.git} alt="git" draggable={false} /> : <span className="text-[13px]">🌿</span>}
            </div>
        );
    }
    return (
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            {hasIcon ? <img className="size-[23px] object-contain" src={PROVIDER_ICON.git} alt="git" draggable={false} /> : <span className="text-[20px]">🌿</span>}
        </div>
    );
}

function GitHeader({ repo, ok, compact, onOpen }: { repo: GitRepo; ok: boolean; compact?: boolean; onOpen?: () => void }) {
    const name = shortRepoName(repo);
    const sub = repo.branch ? `${repo.branch} · ${repo.commits.length} ${repo.commits.length === 1 ? "commit" : "commits"}` : `${repo.commits.length} ${repo.commits.length === 1 ? "commit" : "commits"}`;
    const inner = (
        <>
            <div className="relative shrink-0">
                <GitIcon compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{name}</div>
                <div className={cardLabel}>{sub}</div>
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

function CommitRow({ c, compact }: { c: GitCommit; compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className={cn("flex flex-col gap-1 rounded-xl border border-edge bg-chip px-3 py-2.5", compact && "px-2.5 py-2")}>
            <div className="flex items-start justify-between gap-2">
                <span className={cn(num, "shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[11px] font-bold text-ink2")}>{c.short_hash}</span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-right text-[11px] text-ink3">{fmtGitDate(c.date)}</span>
            </div>
            <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-left"
                onClick={() => setExpanded((v) => !v)}
                title={c.body ? "Ver detalhes" : undefined}
            >
                <span className={cn("line-clamp-2 text-[13px] font-semibold leading-snug text-ink", expanded && "line-clamp-none")}>{c.subject}</span>
                {c.body ? (
                    <span className={cn("mt-1 line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-snug text-ink2", expanded ? "line-clamp-none" : "hidden sm:line-clamp-2", !expanded && "hidden")}>
                        {c.body}
                    </span>
                ) : null}
                {c.body && !expanded ? <span className="mt-1 text-[11px] text-accent">+ detalhes</span> : null}
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-ink3">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{c.author_name}</span>
                <span className="shrink-0 text-[10px] text-ink3">{c.author_email}</span>
            </div>
        </div>
    );
}

/* ── Board (um card por repositório) ───────────────────────────────── */

export function GitBoardCard({
    repo,
    git,
    t,
    size,
    onOpen,
}: {
    repo: GitRepo | null | undefined;
    git?: GitPayload | null | undefined;
    t: T;
    size: CardSize;
    onOpen: () => void;
}) {
    const ns = normalizeSize(size);
    const isCompact = ns === "sm";

    // Fallback: payload agregado sem repo individual (erro global)
    if (!repo) {
        const repos = git?.repos ?? [];
        if (repos.length === 0) {
            return (
                <div className="flex h-full min-h-0 w-full flex-col">
                    <div className={cn("flex min-w-0 shrink-0 items-center", isCompact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>
                        <GitIcon compact={isCompact} />
                        <div className="min-w-0 flex-1">
                            <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", isCompact ? "text-[12.5px]" : "text-[14px]")}>Git</div>
                            <div className={cardLabel}>0 repositórios</div>
                        </div>
                    </div>
                    <div className="flex flex-1 items-center">
                        <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{git?.error || t.gitEmpty}</div>
                    </div>
                </div>
            );
        }
        // fallback agregado: mostra resumo (compat)
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <div className={cn("flex min-w-0 shrink-0 items-center", isCompact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>
                    <GitIcon compact={isCompact} />
                    <div className="min-w-0 flex-1">
                        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", isCompact ? "text-[12.5px]" : "text-[14px]")}>Git</div>
                        <div className={cardLabel}>{repos.length} repositórios</div>
                    </div>
                </div>
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    {repos.slice(0, 4).map((r) => (
                        <div key={r.id} className="flex items-center gap-2 overflow-hidden rounded-lg border border-edge bg-chip px-2.5 py-2">
                            <span className={cn("size-1.5 shrink-0 rounded-full", r.ok ? "bg-good" : "bg-bad")} />
                            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-ink">{shortRepoName(r)}</span>
                            <span className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{r.commits[0]?.subject.slice(0, 28) || r.error?.slice(0, 28) || "--"}</span>
                        </div>
                    ))}
                </button>
            </div>
        );
    }

    if (!repo.ok) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <GitHeader repo={repo} ok={false} compact={isCompact} onOpen={onOpen} />
                <div className="flex flex-1 items-center">
                    <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{repo.error || t.noData}</div>
                </div>
                {repo.source ? <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{repo.source}</div> : null}
            </div>
        );
    }

    // sm: hero do último commit
    if (ns === "sm") {
        const commit = repo.commits[0];
        return (
            <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                    <GitIcon />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", repo.ok ? "bg-good" : "bg-bad")} />
                </div>
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{shortRepoName(repo)} · {commit?.short_hash || "--"}</div>
                    <div className={cn(num, "mt-1 line-clamp-2 text-[12px] font-[700] leading-tight")}>{commit?.subject || t.gitNoCommits}</div>
                    {commit ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{commit.author_name} · {fmtGitDate(commit.date)}</div> : null}
                </button>
            </div>
        );
    }

    if (ns === "md") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <GitHeader repo={repo} ok={repo.ok} onOpen={onOpen} />
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    {repo.commits.length === 0 ? (
                        <div className={emptyNote}>{t.gitNoCommits}</div>
                    ) : (
                        repo.commits.slice(0, 3).map((c) => (
                            <div key={c.hash} className="flex items-center gap-2 overflow-hidden rounded-lg border border-edge bg-chip px-2.5 py-2">
                                <span className={cn(num, "shrink-0 text-[11px] font-bold text-ink2")}>{c.short_hash}</span>
                                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium text-ink">{c.subject}</span>
                            </div>
                        ))
                    )}
                </button>
            </div>
        );
    }

    if (ns === "lg") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <GitHeader repo={repo} ok={repo.ok} onOpen={onOpen} />
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-1">
                    {repo.commits.slice(0, 5).map((c) => (
                        <CommitRow key={c.hash} c={c} />
                    ))}
                    {repo.commits.length === 0 ? <div className={cn(emptyNote, "py-2 text-[11px]")}>{t.gitNoCommits}</div> : null}
                </div>
            </div>
        );
    }

    // wl / wxl: lista completa com scroll
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <GitHeader repo={repo} ok={repo.ok} onOpen={onOpen} />
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto pr-1">
                {repo.commits.map((c) => (
                    <CommitRow key={c.hash} c={c} />
                ))}
                {repo.commits.length === 0 ? <div className={cn(emptyNote, "py-2 text-[11px]")}>{t.gitNoCommits}</div> : null}
            </div>
        </div>
    );
}

/* ── Detail (página da conta) ─────────────────────────────────────── */

export function GitDetail({ repo, git, t }: { repo?: GitRepo | null; git?: GitPayload | null | undefined; t: T }) {
    const target: GitRepo | null = repo ?? git?.repos?.[0] ?? null;
    const [copied, setCopied] = useState<string | null>(null);

    function copy(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(text);
            setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
        }).catch(() => { });
    }

    if (!target) {
        return (
            <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className={emptyNote}>{t.gitEmpty}</div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-edge bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-full", target.ok ? "bg-good" : "bg-bad")} />
                <h3 className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold text-ink">{shortRepoName(target)}</h3>
                {target.branch ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">{target.branch}</span> : null}
                <span className="shrink-0 text-[11px] text-ink3">{target.limit} {t.gitCommits}</span>
            </div>
            <div className="mb-3 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{target.source}</div>
            {target.remote_url && target.remote_url !== target.source ? (
                <div className="mb-3 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">remote: {target.remote_url}</div>
            ) : null}
            {!target.ok ? (
                <div className={errorText}>{target.error || t.noData}</div>
            ) : target.commits.length === 0 ? (
                <div className={emptyNote}>{t.gitNoCommits}</div>
            ) : (
                <div className="flex flex-col gap-2">
                    {target.commits.map((c) => (
                        <div key={c.hash} className="rounded-xl border border-edge bg-chip p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={cn(num, "rounded bg-canvas px-1.5 py-0.5 text-[11px] font-bold text-ink2")}>{c.short_hash}</span>
                                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{fmtGitDate(c.date)}</span>
                                <button
                                    type="button"
                                    className="shrink-0 cursor-pointer rounded border border-edge bg-canvas px-2 py-1 text-[11px] font-medium text-ink2 hover:border-accent hover:text-ink"
                                    onClick={() => copy(c.hash)}
                                >
                                    {copied === c.hash ? t.gitCopied : t.gitCopyHash}
                                </button>
                            </div>
                            <div className="mt-2 text-[13.5px] font-semibold leading-snug text-ink">{c.subject}</div>
                            {c.body ? <div className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink2">{c.body}</div> : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink3">
                                <span>{c.author_name}</span>
                                <span className="text-ink3">·</span>
                                <span>{c.author_email}</span>
                            </div>
                            <div className={cn(num, "mt-1 text-[10px] text-ink3")}>{c.hash}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
