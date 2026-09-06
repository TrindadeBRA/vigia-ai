import type { IssPayload } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { cardLabel, emptyNote, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

export function issAllowedSizes(): CardSize[] {
    return ["sm", "md", "lg", "free"];
}

export function issSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return `${t.cardSmallPrefix} ${t.issAltitude}`;
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "free") return t.cardFree;
    return t.cardXl;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtCoord(v: number | null): string {
    if (v == null) return "--";
    return v.toFixed(1) + "°";
}

function fmtKm(v: number | null): string {
    if (v == null) return "--";
    return `${Math.round(v).toLocaleString("pt-BR")} km`;
}

function fmtKmh(v: number | null): string {
    if (v == null) return "--";
    return `${Math.round(v).toLocaleString("pt-BR")} km/h`;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function IssIcon({ compact }: { compact?: boolean }) {
    if (compact) {
        return (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                <span className="text-[13px]">🛰️</span>
            </div>
        );
    }
    return (
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            <span className="text-[20px]">🛰️</span>
        </div>
    );
}

function IssHeader({ iss, compact, onOpen, t }: { iss: IssPayload; compact?: boolean; onOpen?: () => void; t: T }) {
    const visLabel = iss.visibility === "daylight" ? t.issDaylight : iss.visibility === "eclipsed" ? t.issEclipsed : "--";
    const inner = (
        <>
            <div className="relative shrink-0">
                <IssIcon compact={compact} />
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", iss.ok ? "bg-good" : "bg-bad")} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{t.iss}</div>
                <div className={cardLabel}>{visLabel}</div>
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

/* ── Board (widget único, sem conta) ───────────────────────────────── */

export function IssBoardCard({ iss, t, size, onOpen }: { iss: IssPayload | null | undefined; t: T; size: CardSize; onOpen: () => void }) {
    const ns = normalizeSize(size);
    const isCompact = ns === "sm";

    if (!iss || !iss.ok) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <div className={cn("flex min-w-0 shrink-0 items-center", isCompact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>
                    <IssIcon compact={isCompact} />
                    <div className="min-w-0 flex-1">
                        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", isCompact ? "text-[12.5px]" : "text-[14px]")}>{t.iss}</div>
                    </div>
                </div>
                <div className="flex flex-1 items-center">
                    <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{iss?.error || t.noData}</div>
                </div>
            </div>
        );
    }

    if (ns === "sm") {
        return (
            <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                    <IssIcon />
                    <span className="absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full bg-good shadow-[0_0_0_2px_var(--panel)]" />
                </div>
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{t.issAltitude}</div>
                    <div className={cn(num, "mt-1 text-[16px] font-[750] leading-tight")}>{fmtKm(iss.altitude_km)}</div>
                    <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{fmtKmh(iss.velocity_kmh)}</div>
                </button>
            </div>
        );
    }

    if (ns === "md") {
        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <IssHeader iss={iss} onOpen={onOpen} t={t} />
                <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                    <div className="flex gap-1.5">
                        <StatChip label={t.issAltitude} value={fmtKm(iss.altitude_km)} />
                        <StatChip label={t.issVelocity} value={fmtKmh(iss.velocity_kmh)} />
                    </div>
                </button>
            </div>
        );
    }

    // lg / free: posição completa
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <IssHeader iss={iss} onOpen={onOpen} t={t} />
            <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
                <div className="flex gap-1.5">
                    <StatChip label={t.issAltitude} value={fmtKm(iss.altitude_km)} />
                    <StatChip label={t.issVelocity} value={fmtKmh(iss.velocity_kmh)} />
                </div>
                <div className="text-[11px] text-ink3">lat {fmtCoord(iss.latitude)} · lon {fmtCoord(iss.longitude)}</div>
                <div className="text-[11px] text-ink3">{t.issNextOrbit}</div>
            </button>
        </div>
    );
}

/* ── Detail (página da conta) ─────────────────────────────────────── */

export function IssDetail({ iss, t }: { iss: IssPayload | null | undefined; t: T }) {
    if (!iss) {
        return (
            <div className="rounded-2xl border border-edge bg-panel p-4">
                <div className={emptyNote}>{t.noData}</div>
            </div>
        );
    }
    return (
        <div className="rounded-2xl border border-edge bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-full", iss.ok ? "bg-good" : "bg-bad")} />
                <h3 className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold text-ink">{t.iss}</h3>
            </div>
            {!iss.ok ? (
                <div className={errorText}>{iss.error || t.noData}</div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        <StatChip label={t.issAltitude} value={fmtKm(iss.altitude_km)} />
                        <StatChip label={t.issVelocity} value={fmtKmh(iss.velocity_kmh)} />
                        <StatChip label="lat" value={fmtCoord(iss.latitude)} />
                        <StatChip label="lon" value={fmtCoord(iss.longitude)} />
                    </div>
                    <div className="text-[12px] text-ink2">{iss.visibility === "daylight" ? t.issDaylight : iss.visibility === "eclipsed" ? t.issEclipsed : "--"}</div>
                    <div className="text-[11px] text-ink3">{t.issNextOrbit}</div>
                </div>
            )}
        </div>
    );
}
