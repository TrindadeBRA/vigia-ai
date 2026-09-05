import type { RetroAchievementsAccount } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import type { Metric } from "../../pages/display/types";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";

/* ── Dados ──────────────────────────────────────────────────────────── */

export function getRetroMetrics(a: RetroAchievementsAccount, t: T): Metric[] {
    const metrics: Metric[] = [];
    if (a.total_points != null) {
        metrics.push({
            label: "Pontos hardcore",
            pct: null,
            value: String(a.total_points),
            sub: a.rank != null && a.total_ranked != null ? `#${a.rank} de ${a.total_ranked}` : a.rank != null ? `#${a.rank}` : null,
        });
    }
    if (a.total_true_points != null) {
        metrics.push({
            label: "True points",
            pct: null,
            value: String(a.total_true_points),
            sub: a.total_softcore_points != null ? `softcore ${a.total_softcore_points}` : null,
        });
    }
    if (a.awards) {
        const aw = a.awards;
        const mastery = aw.mastery_awards_count ?? 0;
        const beaten = (aw.beaten_hardcore_awards_count ?? 0) + (aw.beaten_softcore_awards_count ?? 0);
        if (mastery || beaten) {
            metrics.push({
                label: "Conquistas",
                pct: null,
                value: `${mastery} mastery · ${beaten} beaten`,
                sub: aw.total_awards_count != null ? `${aw.total_awards_count} prêmios no total` : null,
            });
        }
    }
    if (a.last_game_title) {
        metrics.push({
            label: "Último jogo",
            pct: null,
            value: a.last_game_title,
            sub: a.last_game_console || a.rich_presence_msg || null,
        });
    }
    if (!metrics.length) {
        metrics.push({ label: "RetroAchievements", pct: null, sub: t.noData });
    }
    return metrics;
}

export function retroAllowedSizes(_a: RetroAchievementsAccount | null, _metrics?: Metric[]): CardSize[] {
    return ["sm", "sw", "md", "lg", "xl"];
}

export const RETRO_ALLOWED_ALL: CardSize[] = ["sm", "sw", "md", "lg", "xl"];

export function retroSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return "Pequeno · pontos";
    if (s === "sw") return "Pequeno · último jogo";
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "wl") return t.cardWl;
    if (s === "wxl") return t.cardWxl;
    return t.cardXl;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function Icon({ pic, compact }: { pic?: string | null; compact?: boolean }) {
    if (compact) {
        return (
            <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                {pic ? (
                    <img className="size-7 object-cover" src={pic} alt="" draggable={false} />
                ) : (
                    <img className="size-3.5 object-contain" src={PROVIDER_ICON.retroachievements} alt="RA" draggable={false} />
                )}
            </div>
        );
    }
    return (
        <div className="flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            {pic ? (
                <img className="size-[42px] object-cover" src={pic} alt="" draggable={false} />
            ) : (
                <img className="size-[23px] object-contain" src={PROVIDER_ICON.retroachievements} alt="RA" draggable={false} />
            )}
        </div>
    );
}

function RetroHeader({ account, compact, ok, onOpen }: { account: RetroAchievementsAccount; compact?: boolean; ok: boolean; onOpen?: () => void }) {
    const name = account.username || account.label || "RetroAchievements";
    const sub = account.motto || (account.status ? `Status: ${account.status}` : null);
    const inner = (
        <>
            <div className="relative shrink-0">
                <Icon pic={account.user_pic} compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{name}</div>
                {sub ? <div className={cardLabel}>{sub}</div> : account.rank != null ? <div className={cardLabel}>#{account.rank}{account.total_ranked ? ` de ${account.total_ranked}` : ""}</div> : null}
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

function ValueRow({ m, compact }: { m: Metric; compact?: boolean }) {
    if (compact) {
        return (
            <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{m.label}</span>
                <span className={cn(num, "min-w-0 text-[13px] font-bold leading-tight [overflow-wrap:anywhere]")}>{m.value || "--"}</span>
            </div>
        );
    }
    return (
        <div className="min-w-0">
            <div className="mb-1 text-[12.5px] text-ink2">{m.label}</div>
            <div className={cn(num, "text-[15px] font-bold leading-tight [overflow-wrap:anywhere]")}>{m.value || "--"}</div>
            {m.sub ? <div className="mt-1 text-[11px] leading-snug text-ink3">{m.sub}</div> : null}
        </div>
    );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function RetroAchievementsBoardCard({
    account,
    metrics: metricsProp,
    t,
    size,
    onOpen,
}: {
    account: RetroAchievementsAccount;
    metrics?: Metric[];
    t: T;
    size: CardSize;
    onOpen: () => void;
}) {
    const metrics = metricsProp ?? getRetroMetrics(account, t);
    const ns = normalizeSize(size);
    const isCompact = ns === "sm" || ns === "sw";
    const ok = account.ok;

    if (!ok) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <RetroHeader account={account} compact={isCompact} ok={ok} onOpen={onOpen} />
                <div className="flex flex-1 items-center">
                    <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{account.error || t.noData}</div>
                </div>
            </div>
        );
    }

    if (ns === "sm" || ns === "sw") {
        // sm = pontos hardcore, sw = último jogo
        const single = ns === "sw"
            ? metrics.find((m) => m.label === "Último jogo") || metrics[0]
            : metrics.find((m) => m.label === "Pontos hardcore") || metrics[0];
        return (
            <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                    <Icon pic={account.user_pic} />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
                </div>
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    {single ? (
                        <>
                            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{single.label}</div>
                            <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[800] leading-tight py-0.5")}>{single.value || "--"}</div>
                            {single.sub ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{single.sub}</div> : null}
                        </>
                    ) : null}
                </button>
            </div>
        );
    }

    if (ns === "md") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <RetroHeader account={account} ok={ok} onOpen={onOpen} />
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-0 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden">
                        {metrics.slice(0, 3).map((m, i) => (
                            <ValueRow key={i} m={m} compact />
                        ))}
                    </div>
                </button>
            </div>
        );
    }

    if (ns === "lg") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <RetroHeader account={account} ok={ok} onOpen={onOpen} />
                <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    {metrics.slice(0, 4).map((m, i) => (
                        <ValueRow key={i} m={m} compact />
                    ))}
                </button>
            </div>
        );
    }

    // xl — mostra tudo + lista de conquistas recentes
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <RetroHeader account={account} ok={ok} onOpen={onOpen} />
            <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col gap-2 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                <div className="grid grid-cols-2 gap-3">
                    {metrics.slice(0, 4).map((m, i) => (
                        <ValueRow key={i} m={m} compact />
                    ))}
                </div>
                {account.recent_achievements?.length ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden border-t border-edge pt-2">
                        <div className="text-[11px] font-bold uppercase tracking-[.4px] text-ink3">Conquistas recentes</div>
                        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                            {account.recent_achievements.slice(0, 3).map((ach) => (
                                <div key={String(ach.id)} className="flex items-center gap-2 overflow-hidden rounded-lg bg-chip px-2 py-1.5">
                                    {ach.badge_url ? <img src={ach.badge_url} alt="" className="size-6 shrink-0 rounded object-cover" draggable={false} /> : null}
                                    <div className="min-w-0 flex-1">
                                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold leading-none">{ach.title}</div>
                                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{ach.game_title}</div>
                                    </div>
                                    {ach.points != null ? <span className={cn(num, "shrink-0 text-[11px] font-bold")}>{ach.points} pts</span> : null}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </button>
        </div>
    );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

function fmtDate(s: string | null | undefined): string {
    if (!s) return "--";
    try {
        const d = new Date(s.replace(" ", "T"));
        if (Number.isNaN(d.getTime())) return s;
        return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
        return s;
    }
}

export function RetroAchievementsDetail({
    account,
    t: _t,
}: {
    account: RetroAchievementsAccount;
    t: T;
}) {
    return (
        <>
            {/* Header com avatar grande */}
            <div className="flex items-start gap-4">
                {account.user_pic ? (
                    <img src={account.user_pic} alt={account.username || ""} className="size-16 shrink-0 rounded-xl object-cover shadow-[inset_0_0_0_1px_var(--card-border)]" draggable={false} />
                ) : null}
                <div className="min-w-0 flex-1">
                    <div className="text-[18px] font-[750] leading-none">{account.username || account.label || "RetroAchievements"}</div>
                    {account.motto ? <div className="mt-1 text-[13px] italic leading-snug text-ink2">“{account.motto}”</div> : null}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-ink3">
                        {account.member_since ? <span>Membro desde {fmtDate(account.member_since)}</span> : null}
                        {account.status ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", account.status === "Online" ? "bg-good text-white" : "bg-chip text-ink3")}>{account.status}</span> : null}
                    </div>
                    {account.rich_presence_msg ? (
                        <div className="mt-2 rounded-lg bg-chip px-2.5 py-1.5 text-[12px] leading-snug text-ink2">
                            <span className="font-semibold">Jogando:</span> {account.rich_presence_msg}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Métricas principais */}
            <div className={metricsGrid}>
                <div className={metricCard}>
                    <div className="mb-2.5 text-[13.5px] text-ink2">Pontos hardcore</div>
                    <div className={cn(num, "text-[22px] font-[750]")}>{account.total_points ?? "--"}</div>
                    {account.rank != null ? <div className="mt-1 text-[11px] text-ink3">#{account.rank}{account.total_ranked ? ` de ${account.total_ranked.toLocaleString("pt-BR")}` : ""} no ranking</div> : null}
                </div>
                <div className={metricCard}>
                    <div className="mb-2.5 text-[13.5px] text-ink2">True points</div>
                    <div className={cn(num, "text-[22px] font-[750]")}>{account.total_true_points ?? "--"}</div>
                    {account.total_softcore_points != null ? <div className="mt-1 text-[11px] text-ink3">softcore {account.total_softcore_points}</div> : null}
                </div>
                {account.awards ? (
                    <>
                        <div className={metricCard}>
                            <div className="mb-2.5 text-[13.5px] text-ink2">Mastery</div>
                            <div className={cn(num, "text-[22px] font-[750]")}>{account.awards.mastery_awards_count ?? "--"}</div>
                            <div className="mt-1 text-[11px] text-ink3">{account.awards.completion_awards_count ?? 0} completion</div>
                        </div>
                        <div className={metricCard}>
                            <div className="mb-2.5 text-[13.5px] text-ink2">Beaten</div>
                            <div className={cn(num, "text-[22px] font-[750]")}>{(account.awards.beaten_hardcore_awards_count ?? 0) + (account.awards.beaten_softcore_awards_count ?? 0)}</div>
                            <div className="mt-1 text-[11px] text-ink3">{account.awards.beaten_hardcore_awards_count ?? 0} hardcore · {account.awards.beaten_softcore_awards_count ?? 0} softcore</div>
                        </div>
                    </>
                ) : null}
            </div>

            {/* Último jogo */}
            {account.last_game_title ? (
                <div className="flex items-center gap-3 rounded-2xl border border-edge bg-panel px-4 py-3">
                    {account.last_game_image_icon ? <img src={account.last_game_image_icon} alt="" className="size-10 shrink-0 rounded-lg object-cover" draggable={false} /> : null}
                    <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-[.4px] text-ink3">Último jogo</div>
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-[650]">{account.last_game_title}</div>
                        {account.last_game_console ? <div className="text-[12px] text-ink3">{account.last_game_console}</div> : null}
                    </div>
                    {account.completion_progress?.total != null ? (
                        <div className="shrink-0 text-right">
                            <div className={cn(num, "text-[13px] font-bold")}>{account.completion_progress.total} jogos</div>
                            <div className="text-[11px] text-ink3">com progresso</div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* Jogos recentes */}
            {account.recently_played?.length ? (
                <div className="flex flex-col gap-2">
                    <div className="px-1 text-[13px] font-bold">Jogos recentes</div>
                    <div className="grid gap-2">
                        {account.recently_played.map((g) => (
                            <div key={String(g.game_id)} className="flex items-center gap-3 rounded-xl border border-edge bg-chip px-3 py-2.5">
                                {g.image_icon ? <img src={g.image_icon} alt="" className="size-9 shrink-0 rounded-lg object-cover" draggable={false} /> : <div className="size-9 shrink-0 rounded-lg bg-edge" />}
                                <div className="min-w-0 flex-1">
                                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[650]">{g.title}</div>
                                    <div className="text-[11px] text-ink3">{g.console_name}{g.last_played ? ` · ${fmtDate(g.last_played)}` : ""}</div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className={cn(num, "text-[13px] font-bold")}>{g.num_achieved ?? 0}/{g.achievements_total ?? "--"}</div>
                                    <div className="text-[11px] text-ink3">{g.score_achieved ?? 0} pts</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Conquistas recentes */}
            {account.recent_achievements?.length ? (
                <div className="flex flex-col gap-2">
                    <div className="px-1 text-[13px] font-bold">Conquistas recentes</div>
                    <div className="grid gap-2">
                        {account.recent_achievements.map((ach) => (
                            <div key={String(ach.id)} className="flex items-center gap-3 rounded-xl border border-edge bg-panel px-3 py-2.5">
                                {ach.badge_url ? <img src={ach.badge_url} alt="" className="size-10 shrink-0 rounded-lg object-cover" draggable={false} /> : <div className="size-10 shrink-0 rounded-lg bg-edge" />}
                                <div className="min-w-0 flex-1">
                                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[650]">{ach.title}</div>
                                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{ach.description}</div>
                                    <div className="mt-0.5 text-[11px] text-ink3">{ach.game_title}{ach.date_awarded ? ` · ${fmtDate(ach.date_awarded)}` : ""}</div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    {ach.points != null ? <span className={cn(num, "rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink")}>{ach.points} pts</span> : null}
                                    {ach.hardcore ? <span className="rounded-full bg-good px-1.5 py-0.5 text-[10px] font-bold text-white">hardcore</span> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Link para perfil */}
            {account.username ? (
                <a
                    href={`https://retroachievements.org/user/${encodeURIComponent(account.username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-edge bg-chip px-4 py-2.5 text-[13px] font-semibold text-ink no-underline hover:bg-edge"
                >
                    Ver perfil no RetroAchievements
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
            ) : null}
        </>
    );
}
