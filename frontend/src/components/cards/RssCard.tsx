import { useState } from "react";
import type { RssFeed, RssItem, RssPayload } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

export function rssAllowedSizes(payload?: RssPayload | null): CardSize[] {
    const count = payload?.feeds?.length ?? 0;
    if (count === 0) return ["md"];
    if (count === 1) return ["sm", "md", "lg", "wl"];
    return ["md", "lg", "wl", "wxl"];
}

export const RSS_ALLOWED_ALL: CardSize[] = ["sm", "md", "lg", "wl", "wxl"];

export function rssSizeLabel(size: CardSize, t: T, payload?: RssPayload | null): string {
    const s = normalizeSize(size);
    const count = payload?.feeds?.length ?? 0;
    if (s === "sm") return `${t.cardSmallPrefix} ${t.rssLatest || "Última notícia"}`;
    if (s === "md") return count <= 1 ? t.cardNormal : `${t.cardNormal} · ${count} feeds`;
    if (s === "lg") return t.cardLarge;
    if (s === "wl") return t.cardWl;
    if (s === "wxl") return t.cardWxl;
    return t.cardXl;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtRssDate(iso: string | null): string {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
        const now = Date.now();
        const diff = now - d.getTime();
        const mins = Math.round(diff / 60000);
        if (mins < 1) return "agora";
        if (mins < 60) return `há ${mins} min`;
        const hours = Math.round(diff / 3600000);
        if (hours < 24) return `há ${hours}h`;
        const days = Math.round(diff / 86400000);
        if (days < 7) return `há ${days}d`;
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch { return iso.slice(0, 16); }
}

function feedLabel(feed: RssFeed): string {
    return feed.label || feed.title || feed.url.replace(/^https?:\/\//, "").slice(0, 32) || "Feed";
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function RssIcon({ compact }: { compact?: boolean }) {
    const hasIcon = Boolean(PROVIDER_ICON.rss);
    if (compact) {
        return (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                {hasIcon ? <img className="size-3.5 object-contain" src={PROVIDER_ICON.rss} alt="rss" draggable={false} /> : <span className="text-[13px]">📰</span>}
            </div>
        );
    }
    return (
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            {hasIcon ? <img className="size-[23px] object-contain" src={PROVIDER_ICON.rss} alt="rss" draggable={false} /> : <span className="text-[20px]">📰</span>}
        </div>
    );
}

function RssHeader({ feedCount, ok, compact, onOpen }: { feedCount: number; ok: boolean; compact?: boolean; onOpen?: () => void }) {
    const inner = (
        <>
            <div className="relative shrink-0">
                <RssIcon compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>RSS</div>
                <div className={cardLabel}>{feedCount === 1 ? "1 feed" : `${feedCount} feeds`}</div>
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

function RssItemRow({ item, compact }: { item: RssItem; compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const hasLink = !!item.link;
    const content = (
        <>
            <div className="flex items-start justify-between gap-2">
                <span className={cn("min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink", compact && "text-[12.5px] line-clamp-2")}>{item.title}</span>
                {item.pubDate ? <span className={cn(num, "shrink-0 text-[11px] text-ink3")}>{fmtRssDate(item.pubDate)}</span> : null}
            </div>
            {item.description ? (
                <span className={cn("line-clamp-2 text-[11.5px] leading-snug text-ink2", expanded && "line-clamp-none")}>{item.description}</span>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink3">
                {item.author ? <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.author}</span> : null}
                {item.categories.length ? <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink2">{item.categories.slice(0, 2).join(" · ")}</span> : null}
            </div>
        </>
    );

    if (hasLink) {
        return (
            <a
                href={item.link!}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("flex flex-col gap-1 rounded-xl border border-edge bg-chip px-3 py-2.5 no-underline hover:border-accent", compact && "px-2.5 py-2")}
            >
                {content}
            </a>
        );
    }
    return (
        <div className={cn("flex flex-col gap-1 rounded-xl border border-edge bg-chip px-3 py-2.5", compact && "px-2.5 py-2")}>
            {content}
            {item.description && !expanded ? (
                <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] text-accent" onClick={() => setExpanded(true)}>+ detalhes</button>
            ) : null}
        </div>
    );
}

function FeedBlock({ feed, t, compact }: { feed: RssFeed; t: T; compact?: boolean }) {
    if (!feed.ok) {
        return (
            <div className={cn("flex flex-col gap-1 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5", compact && "px-2.5 py-2")}>
                <span className="text-[12.5px] font-semibold text-bad">{feedLabel(feed)}</span>
                <span className="text-[11px] text-bad/80">{feed.error || t.noData}</span>
            </div>
        );
    }
    if (feed.items.length === 0) {
        return (
            <div className={cn("flex flex-col gap-1 rounded-xl border border-edge bg-chip px-3 py-2.5", compact && "px-2.5 py-2")}>
                <span className="text-[12.5px] font-semibold text-ink">{feedLabel(feed)}</span>
                <span className="text-[11px] text-ink3">Nenhum item no feed.</span>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 px-1">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-ink3">{feedLabel(feed)}</span>
                <span className="shrink-0 text-[10px] text-ink3">{feed.items.length} itens</span>
            </div>
            {feed.items.slice(0, compact ? 2 : 5).map((item, idx) => (
                <RssItemRow key={item.guid || `${item.title}-${idx}`} item={item} compact={compact} />
            ))}
        </div>
    );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function RssBoardCard({
    rss,
    t,
    size,
    onOpen,
}: {
    rss: RssPayload | null | undefined;
    t: T;
    size: CardSize;
    onOpen: () => void;
}) {
    const feeds = rss?.feeds ?? [];
    const ok = !!rss?.ok && feeds.length > 0;
    const ns = normalizeSize(size);
    const isCompact = ns === "sm";

    if (!rss || feeds.length === 0) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <RssHeader feedCount={0} ok={false} compact={isCompact} onOpen={onOpen} />
                <div className="flex flex-1 items-center">
                    <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{rss?.error || t.rssEmpty || "Nenhum feed configurado."}</div>
                </div>
            </div>
        );
    }

    // sm: hero da última notícia
    if (ns === "sm") {
        const firstFeed = feeds.find((f) => f.ok && f.items.length > 0) || feeds[0];
        const item = firstFeed?.items[0];
        return (
            <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                    <RssIcon />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
                </div>
                {item ? (
                    <a href={item.link || undefined} target={item.link ? "_blank" : undefined} rel={item.link ? "noopener noreferrer" : undefined} className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left no-underline">
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{feedLabel(firstFeed)} {item.pubDate ? `· ${fmtRssDate(item.pubDate)}` : ""}</div>
                        <div className={cn(num, "mt-1 line-clamp-2 text-[12px] font-[700] leading-tight text-ink")}>{item.title}</div>
                        {item.description ? <div className="mt-0.5 line-clamp-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{item.description}</div> : null}
                    </a>
                ) : (
                    <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{feedLabel(firstFeed)}</div>
                        <div className={cn(num, "mt-1 text-[12px] font-[700] leading-tight")}>{firstFeed.error || "Sem itens"}</div>
                    </button>
                )}
            </div>
        );
    }

    if (ns === "md") {
        const firstFeed = feeds.find((f) => f.ok && f.items.length > 0) || feeds[0];
        const items = firstFeed?.items ?? [];
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <RssHeader feedCount={feeds.length} ok={!!firstFeed?.ok} onOpen={onOpen} />
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                    {!firstFeed?.ok ? (
                        <div className={errorText}>{firstFeed?.error || t.noData}</div>
                    ) : items.length === 0 ? (
                        <div className={emptyNote}>Nenhum item no feed.</div>
                    ) : (
                        items.slice(0, 3).map((item, idx) => {
                            const hasLink = !!item.link;
                            const row = (
                                <>
                                    <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium text-ink">{item.title}</span>
                                    {item.pubDate ? <span className={cn(num, "shrink-0 text-[11px] text-ink3")}>{fmtRssDate(item.pubDate)}</span> : null}
                                </>
                            );
                            return hasLink ? (
                                <a key={item.guid || `${item.title}-${idx}`} href={item.link!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 overflow-hidden rounded-lg border border-edge bg-chip px-2.5 py-2 no-underline hover:border-accent">
                                    {row}
                                </a>
                            ) : (
                                <div key={item.guid || `${item.title}-${idx}`} className="flex items-center gap-2 overflow-hidden rounded-lg border border-edge bg-chip px-2.5 py-2">
                                    {row}
                                </div>
                            );
                        })
                    )}
                    {feeds.length > 1 ? <div className="px-1 text-[11px] text-ink3">+{feeds.length - 1} feed{feeds.length > 2 ? "s" : ""} · toque para ver todos</div> : null}
                </div>
            </div>
        );
    }

    if (ns === "lg") {
        const firstFeed = feeds.find((f) => f.ok && f.items.length > 0) || feeds[0];
        const items = firstFeed?.items ?? [];
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <RssHeader feedCount={feeds.length} ok={!!firstFeed?.ok} onOpen={onOpen} />
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                    {!firstFeed?.ok ? (
                        <div className={errorText}>{firstFeed?.error || t.noData}</div>
                    ) : items.length === 0 ? (
                        <div className={emptyNote}>Nenhum item no feed.</div>
                    ) : (
                        items.slice(0, 6).map((item, idx) => (
                            <RssItemRow key={item.guid || `${item.title}-${idx}`} item={item} />
                        ))
                    )}
                </div>
            </div>
        );
    }

    // wl / wxl: todos os feeds
    return (
        <div className="flex h-full min-h-0 w-full flex-col">
            <RssHeader feedCount={feeds.length} ok={ok} onOpen={onOpen} />
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {feeds.slice(0, ns === "wxl" ? 6 : 4).map((feed) => (
                    <FeedBlock key={feed.id} feed={feed} t={t} compact={ns === "wl"} />
                ))}
            </div>
        </div>
    );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

export function RssDetail({ rss, t }: { rss: RssPayload | null | undefined; t: T }) {
    if (!rss || !rss.feeds?.length) {
        return <div className="px-5 py-12 text-center text-sm text-ink3">{t.rssEmpty || "Nenhum feed configurado."}</div>;
    }
    return (
        <div className="flex w-full flex-col gap-4">
            {rss.feeds.map((feed) => (
                <div key={feed.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-full", feed.ok ? "bg-good" : "bg-bad")} />
                        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-ink">{feedLabel(feed)}</span>
                        <span className="shrink-0 text-[11px] text-ink3">{feed.items.length} {feed.items.length === 1 ? "item" : "itens"}</span>
                    </div>
                    {feed.url ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{feed.url}</div> : null}
                    {feed.title ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-ink2">{feed.title}</div> : null}
                    {!feed.ok ? (
                        <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] text-bad">{feed.error || t.noData}</div>
                    ) : feed.items.length === 0 ? (
                        <div className={emptyNote}>{t.rssNoItems || "Nenhuma notícia no feed."}</div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {feed.items.map((item, idx) => (
                                <RssItemRow key={item.guid || `${item.title}-${idx}`} item={item} />
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {rss.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {rss.updated_at.slice(11, 16)}</div> : null}
        </div>
    );
}
