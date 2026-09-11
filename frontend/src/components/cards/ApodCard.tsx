import { useState } from "react";
import type { ApodPayload } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { cardLabel, emptyNote, errorText } from "../../tw";

export function apodAllowedSizes(): CardSize[] {
    return ["sm", "md", "lg", "xl", "wl", "wm", "wxl", "free"];
}

export function apodSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return `${t.cardSmallPrefix} APOD`;
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "xl") return t.cardXl;
    if (s === "wl") return t.cardWl;
    if (s === "wm") return "Médio alto";
    if (s === "wxl") return t.cardWxl;
    if (s === "free") return t.cardFree;
    return t.cardNormal;
}

function formatApodDate(raw: string | null | undefined): string {
    if (!raw) return "";
    try {
        const d = new Date(`${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return raw;
    }
}

export function ApodBoardCard({
    apod,
    t,
    size,
    onOpen,
}: {
    apod?: ApodPayload | null;
    t: T;
    size: CardSize;
    onOpen?: () => void;
}) {
    const s = normalizeSize(size);
    const compact = s === "sm" || s === "xs";
    const [err, setErr] = useState(false);

    if (!apod || (!apod.ok && apod.error)) {
        return (
            <div className={cn("flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 p-3 text-center", compact && "p-2")}>
                <span className="text-[28px]" aria-hidden>🛰️</span>
                <span className={errorText}>{apod?.error || t.apodEmpty || "APOD indisponível"}</span>
            </div>
        );
    }

    const imageUrl = apod.url;
    const title = apod.title || t.apod || "NASA APOD";
    const dateLabel = formatApodDate(apod.date);
    const isVideo = (apod.media_type || "").toLowerCase() === "video";

    if (!imageUrl || err) {
        return (
            <button type="button" className="flex h-full min-h-0 w-full flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                <div className={cn("flex h-full min-h-0 flex-1 flex-col justify-between rounded-[10px] bg-chip p-3", compact && "p-2")}>
                    <div className="flex items-center gap-2">
                        <span className="text-[22px]" aria-hidden>🛰️</span>
                        <div className="min-w-0">
                            <div className={cn("font-[650] leading-tight text-ink", compact ? "text-[13px]" : "text-[15px]")}>{title}</div>
                            {dateLabel ? <div className={cardLabel}>{dateLabel}</div> : null}
                        </div>
                    </div>
                    <p className={cn("m-0 line-clamp-4 text-ink2", compact ? "text-[11px]" : "text-[12.5px]")}>
                        {isVideo ? (t.apodVideoToday || "Hoje é um vídeo APOD.") : (apod.explanation || emptyNote)}
                    </p>
                </div>
            </button>
        );
    }

    return (
        <button type="button" className="relative flex h-full min-h-0 w-full flex-1 cursor-pointer overflow-hidden rounded-[10px] border-0 bg-black/5 p-0 text-left" onClick={onOpen}>
            <img
                src={imageUrl}
                alt={title}
                draggable={false}
                className="h-full w-full object-cover"
                onError={() => setErr(true)}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-3 pt-10">
                <div className={cn("font-[650] leading-tight text-white", compact ? "text-[13px] line-clamp-2" : "text-[15px] line-clamp-3")}>{title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/75">
                    {dateLabel ? <span>{dateLabel}</span> : null}
                    {isVideo ? <span>{t.apodVideoBadge || "Vídeo"}</span> : null}
                    {apod.copyright ? <span className="truncate">© {apod.copyright}</span> : null}
                </div>
            </div>
        </button>
    );
}

export function ApodDetail({ apod, t }: { apod?: ApodPayload | null; t: T }) {
    if (!apod?.ok) {
        return <p className={errorText}>{apod?.error || t.apodEmpty || "APOD indisponível"}</p>;
    }
    const imageUrl = apod.url;
    return (
        <div className="flex flex-col gap-4">
            {imageUrl ? (
                <img src={imageUrl} alt={apod.title || "APOD"} className="max-h-[420px] w-full rounded-xl object-contain bg-black/5" />
            ) : null}
            <div>
                <h2 className="m-0 text-lg font-bold">{apod.title}</h2>
                {apod.date ? <p className="mt-1 text-sm text-ink3">{formatApodDate(apod.date)}</p> : null}
            </div>
            {apod.explanation ? <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-ink2">{apod.explanation}</p> : null}
            {apod.copyright ? <p className="m-0 text-xs text-ink3">© {apod.copyright}</p> : null}
            <a href="https://apod.nasa.gov/apod/astropix.html" target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                {t.apodArchiveLink || "Ver arquivo APOD na NASA"} ↗
            </a>
        </div>
    );
}
