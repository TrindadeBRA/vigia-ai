import { useEffect, useState } from "react";
import { fetchGithubTop, fetchGithubTrending } from "../../api/client";
import type { GithubExploreRepo, GithubPayload, GithubProfile, GithubRepo, GithubTopPeriod } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import { FlameIcon, TrophyIcon } from "../icons";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote, num } from "../../tw";

export function friendlyGithubError(raw: string | null | undefined, t: T): string {
    if (!raw) return t.githubErrorUnknown;
    const s = raw.toLowerCase();
    if (/fetch failed|failed to fetch|networkerror|enotfound|eai_again|econnrefused|econnreset|und_err|socket|não foi possível conectar|could not connect|no se pudo conectar/.test(s)) {
        return t.githubErrorNetwork;
    }
    if (/timeout|timed out|aborted|etimedout|demorou demais|took too long|tardó demasiado/.test(s)) {
        return t.githubErrorTimeout;
    }
    if (/limite de requisi|rate limit|too many requests|límite de solicitudes/.test(s)) {
        return t.githubErrorRateLimit;
    }
    if (/http 5\d\d|indisponível|unavailable|no está disponible/.test(s)) {
        return t.githubErrorUnavailable;
    }
    if (/^http \d+|typeerror|^error:/.test(s)) {
        return t.githubErrorUnknown;
    }
    return raw;
}

function GithubErrorNote({ message, compact, t, hint }: { message: string | null | undefined; compact?: boolean; t: T; hint?: boolean }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
            <div className={cn("font-semibold text-bad", compact ? "text-[11px] leading-snug" : "text-[13px] leading-snug")}>
                {friendlyGithubError(message, t)}
            </div>
            {hint && !compact ? <div className="text-[11px] leading-snug text-ink3">{t.githubErrorHint}</div> : null}
        </div>
    );
}

type GithubView = "repo" | "trending" | "top";
const GITHUB_TOP_LANGUAGES = ["", "JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin"];

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

export function githubProfileAllowedSizes(profile?: GithubProfile | null): CardSize[] {
    if (!profile || !profile.ok) return ["sm", "md", "free"];
    return ["sm", "md", "lg", "free"];
}

export function githubProfileSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return `${t.cardSmallPrefix} ${t.githubProfileFollowers}`;
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
    const hasIcon = Boolean(PROVIDER_ICON.github);
    if (compact) {
        return (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                {hasIcon ? <img className="size-3.5 object-contain" src={PROVIDER_ICON.github} alt="github" draggable={false} /> : <span className="text-[13px]">🐙</span>}
            </div>
        );
    }
    return (
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            {hasIcon ? <img className="size-[23px] object-contain" src={PROVIDER_ICON.github} alt="github" draggable={false} /> : <span className="text-[20px]">🐙</span>}
        </div>
    );
}

function GithubHeader({ repo, compact, onOpen, t }: { repo: GithubRepo; compact?: boolean; onOpen?: () => void; t: T }) {
    const name = shortRepoName(repo);
    const inner = (
        <>
            <div className="relative shrink-0">
                <GithubIcon compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", repo.ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{name}</div>
                <div className={cardLabel}>{repo.ok ? (repo.default_branch || "--") : t.githubErrorLabel}</div>
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

/* ── Explorar (Em alta / Top repos) ────────────────────────────────── */

function useGithubExplore(view: GithubView, language: string, period: GithubTopPeriod) {
    const [repos, setRepos] = useState<GithubExploreRepo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (view === "repo") return;
        let cancelled = false;
        setLoading(true);
        const req = view === "trending" ? fetchGithubTrending() : fetchGithubTop(language, period);
        req
            .then((res) => {
                if (cancelled) return;
                setRepos(res.repos);
                setError(res.error);
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [view, language, period]);

    return { repos, error, loading };
}

function GithubViewTabs({ view, onChange, t }: { view: GithubView; onChange: (v: GithubView) => void; t: T }) {
    const tabs: Array<{ id: GithubView; label: string; icon: React.ReactNode }> = [
        { id: "repo", label: t.githubTabRepo, icon: null },
        { id: "trending", label: t.githubTabTrending, icon: <FlameIcon size={12} /> },
        { id: "top", label: t.githubTabTop, icon: <TrophyIcon size={12} /> },
    ];
    return (
        <div className="mb-1.5 flex shrink-0 gap-1">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                        view === tab.id ? "border-accent bg-accent text-accent-ink" : "border-edge bg-chip text-ink3 hover:text-ink2",
                    )}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

type GithubListItem = { full_name: string; description: string | null; stars: number; forks: number; language: string | null; html_url: string };

function GithubExploreRow({ repo }: { repo: GithubListItem }) {
    return (
        <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-0.5 rounded-xl border border-edge bg-chip px-2.5 py-2 no-underline hover:border-accent"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-ink">{repo.full_name}</span>
                <span className={cn(num, "shrink-0 text-[11px] font-bold text-ink2")}>★ {fmtCompactNumber(repo.stars)}</span>
            </div>
            {repo.description ? <span className="line-clamp-1 text-[11px] leading-snug text-ink3">{repo.description}</span> : null}
            {repo.language ? <span className="text-[10px] font-medium text-ink3">{repo.language}</span> : null}
        </a>
    );
}

function GithubExploreList({ repos, loading, error, t, emptyLabel }: { repos: GithubListItem[]; loading: boolean; error: string | null; t: T; emptyLabel?: string }) {
    if (loading && repos.length === 0) {
        return <div className="flex flex-1 items-center"><div className={emptyNote}>{t.githubExploreLoading}</div></div>;
    }
    if (error && repos.length === 0) {
        return <GithubErrorNote message={error} t={t} />;
    }
    if (repos.length === 0) {
        return <div className="flex flex-1 items-center"><div className={emptyNote}>{emptyLabel ?? t.githubExploreEmpty}</div></div>;
    }
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {repos.map((r) => <GithubExploreRow key={r.full_name} repo={r} />)}
        </div>
    );
}

function GithubTopFilters({ language, period, onLanguage, onPeriod, t }: { language: string; period: GithubTopPeriod; onLanguage: (v: string) => void; onPeriod: (v: GithubTopPeriod) => void; t: T }) {
    const periods: Array<{ id: GithubTopPeriod; label: string }> = [
        { id: "day", label: t.githubTopPeriodDay },
        { id: "week", label: t.githubTopPeriodWeek },
        { id: "month", label: t.githubTopPeriodMonth },
        { id: "year", label: t.githubTopPeriodYear },
        { id: "all", label: t.githubTopPeriodAll },
    ];
    return (
        <div className="mb-1.5 flex shrink-0 gap-1.5">
            <select
                value={language}
                onChange={(e) => onLanguage(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-edge bg-chip px-1.5 py-1 text-[11px] font-medium text-ink2"
            >
                {GITHUB_TOP_LANGUAGES.map((lang) => (
                    <option key={lang || "any"} value={lang}>{lang || t.githubTopLanguageAny}</option>
                ))}
            </select>
            <select
                value={period}
                onChange={(e) => onPeriod(e.target.value as GithubTopPeriod)}
                className="shrink-0 rounded-lg border border-edge bg-chip px-1.5 py-1 text-[11px] font-medium text-ink2"
            >
                {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
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

    const [view, setView] = useState<GithubView>("repo");
    const [language, setLanguage] = useState("");
    const [period, setPeriod] = useState<GithubTopPeriod>("all");
    const explore = useGithubExplore(view, language, period);

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
                {github?.error ? (
                    <GithubErrorNote message={github.error} compact={isCompact} t={t} hint />
                ) : (
                    <div className="flex flex-1 items-center"><div className={emptyNote}>{t.githubEmpty}</div></div>
                )}
            </div>
        );
    }

    if (!repo.ok) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <GithubHeader repo={repo} compact={isCompact} onOpen={onOpen} t={t} />
                <GithubErrorNote message={repo.error} compact={isCompact} t={t} hint />
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
                <GithubHeader repo={repo} onOpen={onOpen} t={t} />
                <GithubViewTabs view={view} onChange={setView} t={t} />
                {view === "repo" ? (
                    <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                        <div className="flex gap-1.5">
                            <StatChip label={t.githubStars} value={fmtCompactNumber(repo.stars)} />
                            <StatChip label={t.githubForks} value={fmtCompactNumber(repo.forks)} />
                        </div>
                        <div className="flex gap-1.5">
                            <StatChip label={t.githubIssues} value={fmtCompactNumber(repo.open_issues)} />
                        </div>
                    </button>
                ) : (
                    <>
                        {view === "top" ? <GithubTopFilters language={language} period={period} onLanguage={setLanguage} onPeriod={setPeriod} t={t} /> : null}
                        <GithubExploreList repos={explore.repos} loading={explore.loading} error={explore.error} t={t} />
                    </>
                )}
            </div>
        );
    }

    // lg / free: estatísticas completas + descrição
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <GithubHeader repo={repo} onOpen={onOpen} t={t} />
            <GithubViewTabs view={view} onChange={setView} t={t} />
            {view === "repo" ? (
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="flex gap-1.5">
                        <StatChip label={t.githubStars} value={fmtCompactNumber(repo.stars)} />
                        <StatChip label={t.githubForks} value={fmtCompactNumber(repo.forks)} />
                        <StatChip label={t.githubIssues} value={fmtCompactNumber(repo.open_issues)} />
                    </div>
                    {repo.description ? <div className="line-clamp-2 text-[12px] leading-snug text-ink2">{repo.description}</div> : null}
                    <div className="text-[11px] text-ink3">{t.githubLastPush}: {fmtPushDate(repo.pushed_at)}</div>
                </button>
            ) : (
                <>
                    {view === "top" ? <GithubTopFilters language={language} period={period} onLanguage={setLanguage} onPeriod={setPeriod} t={t} /> : null}
                    {view === "trending" ? <div className="mb-1 shrink-0 text-[10px] text-ink3">{t.githubTrendingHint}</div> : null}
                    <GithubExploreList repos={explore.repos} loading={explore.loading} error={explore.error} t={t} />
                </>
            )}
        </div>
    );
}

/* ── Board (um card por perfil — bio + fixados) ────────────────────── */

function GithubProfileAvatar({ profile, compact }: { profile: GithubProfile; compact?: boolean }) {
    const size = compact ? "size-7" : "size-[42px]";
    if (profile.avatar_url) {
        return <img className={cn(size, "shrink-0 rounded-full object-cover shadow-[inset_0_0_0_1px_var(--card-border)]")} src={profile.avatar_url} alt="" draggable={false} />;
    }
    return (
        <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]", size)}>
            {PROVIDER_ICON.github ? <img className={compact ? "size-3.5 object-contain" : "size-[23px] object-contain"} src={PROVIDER_ICON.github} alt="" draggable={false} /> : <span className={compact ? "text-[13px]" : "text-[20px]"}>🐙</span>}
        </div>
    );
}

function GithubProfileHeader({ profile, compact, onOpen }: { profile: GithubProfile; compact?: boolean; onOpen?: () => void }) {
    const name = profile.label || profile.name || profile.username;
    const inner = (
        <>
            <div className="relative shrink-0">
                <GithubProfileAvatar profile={profile} compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", profile.ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{name}</div>
                <div className={cardLabel}>@{profile.username}</div>
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

export function GithubProfileBoardCard({
    profile,
    t,
    size,
    onOpen,
}: {
    profile: GithubProfile | null | undefined;
    t: T;
    size: CardSize;
    onOpen: () => void;
}) {
    const ns = normalizeSize(size);
    const isCompact = ns === "sm";

    if (!profile) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <div className={cn("flex min-w-0 shrink-0 items-center", isCompact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>
                    <GithubIcon compact={isCompact} />
                    <div className="min-w-0 flex-1">
                        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", isCompact ? "text-[12.5px]" : "text-[14px]")}>{t.github}</div>
                    </div>
                </div>
                <div className="flex flex-1 items-center">
                    <div className={emptyNote}>{t.githubEmpty}</div>
                </div>
            </div>
        );
    }

    if (!profile.ok) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <GithubProfileHeader profile={profile} compact={isCompact} onOpen={onOpen} />
                <GithubErrorNote message={profile.error} compact={isCompact} t={t} hint />
            </div>
        );
    }

    // sm: hero de seguidores
    if (ns === "sm") {
        return (
            <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                    <GithubProfileAvatar profile={profile} />
                    <span className="absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full bg-good shadow-[0_0_0_2px_var(--panel)]" />
                </div>
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{profile.label || profile.name || profile.username}</div>
                    <div className={cn(num, "mt-1 text-[16px] font-[750] leading-tight")}>{fmtCompactNumber(profile.followers)} {t.githubProfileFollowers}</div>
                    <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{profile.pinned.length} {t.githubProfilePinned.toLowerCase()}</div>
                </button>
            </div>
        );
    }

    const pinnedLabel = t.githubProfileNoPinned;
    if (ns === "md") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <GithubProfileHeader profile={profile} onOpen={onOpen} />
                <GithubExploreList repos={profile.pinned.slice(0, 3)} loading={false} error={null} t={t} emptyLabel={pinnedLabel} />
            </div>
        );
    }

    // lg / free: bio + fixados completos
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <GithubProfileHeader profile={profile} onOpen={onOpen} />
            {profile.bio ? <div className="mb-1.5 shrink-0 line-clamp-2 text-[11.5px] leading-snug text-ink2">{profile.bio}</div> : null}
            <div className="mb-1 flex shrink-0 gap-1.5">
                <StatChip label={t.githubProfileFollowers} value={fmtCompactNumber(profile.followers)} />
                <StatChip label={t.githubProfilePublicRepos} value={fmtCompactNumber(profile.public_repos)} />
            </div>
            <GithubExploreList repos={profile.pinned} loading={false} error={null} t={t} emptyLabel={pinnedLabel} />
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
                <GithubErrorNote message={target.error} t={t} hint />
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

export function GithubProfileDetail({ profile, t }: { profile?: GithubProfile | null; t: T }) {
    if (!profile) {
        return (
            <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className={emptyNote}>{t.githubEmpty}</div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-edge bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <GithubProfileAvatar profile={profile} />
                <div className="min-w-0 flex-1">
                    <h3 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold text-ink">{profile.label || profile.name || profile.username}</h3>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">@{profile.username}</div>
                </div>
                <span className={cn("size-2.5 shrink-0 rounded-full", profile.ok ? "bg-good" : "bg-bad")} />
            </div>
            {!profile.ok ? (
                <GithubErrorNote message={profile.error} t={t} hint />
            ) : (
                <div className="flex flex-col gap-3">
                    {profile.bio ? <div className="text-[13px] leading-relaxed text-ink2">{profile.bio}</div> : null}
                    <div className="flex flex-wrap gap-2">
                        <StatChip label={t.githubProfileFollowers} value={fmtCompactNumber(profile.followers)} />
                        <StatChip label={t.githubProfilePublicRepos} value={fmtCompactNumber(profile.public_repos)} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink3">{t.githubProfilePinned}</div>
                        {profile.pinned.length ? (
                            <div className="flex flex-col gap-1.5">
                                {profile.pinned.map((r) => <GithubExploreRow key={r.full_name} repo={r} />)}
                            </div>
                        ) : (
                            <div className={emptyNote}>{t.githubProfileNoPinned}</div>
                        )}
                    </div>
                    <a className="text-[12px] font-medium text-accent no-underline hover:underline" href={profile.html_url} target="_blank" rel="noopener noreferrer">
                        {profile.html_url}
                    </a>
                </div>
            )}
        </div>
    );
}
