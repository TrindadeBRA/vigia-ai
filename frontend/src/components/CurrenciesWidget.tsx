import type { CurrenciesPayload } from "../api/types";
import { cn } from "../cn";
import { fmtCurrencyAmount } from "../format";
import type { T } from "../i18n";
import { cardLabel, emptyNote, errorText, metricCard } from "../tw";

function QuoteRow({ code, label, kind, price, ok, error, base, compact }: { code: string; label: string; kind: string; price: number | null; ok: boolean; error: string | null; base: string; compact?: boolean }) {
    return (
        <div className={compact ? "flex items-center justify-between gap-2 text-[11.5px]" : "flex items-center justify-between gap-3 text-[13px]"}>
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">
                {label || code}
                {kind === "crypto" ? <span className="ml-1 text-ink3">{code.length <= 6 ? code.toUpperCase() : ""}</span> : null}
            </span>
            {ok ? (
                <span className="shrink-0 font-bold text-ink">{fmtCurrencyAmount(price, base)}</span>
            ) : (
                <span className="shrink-0 text-[11px] text-bad">{error || "--"}</span>
            )}
        </div>
    );
}

// ── Card compacto para o board (grid) — sem chrome próprio, quem desenha a
// caixa é o tile que a envolve (Display.tsx), igual ao WeatherBoardCard. ──

export function CurrenciesBoardCard({ currencies, t, compact, onOpen }: { currencies: CurrenciesPayload | null | undefined; t: T; compact?: boolean; onOpen?: () => void }) {
    if (!currencies || !currencies.items.length) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col">
                <div className="mb-2 flex items-center gap-2">
                    <span className="text-[18px]">💱</span>
                    <span className="text-[13px] font-bold">{t.currencies}</span>
                </div>
                <div className={cn(errorText, compact && "text-xs")}>{currencies?.error || t.currenciesEmpty}</div>
            </div>
        );
    }

    const shown = compact ? currencies.items.slice(0, 3) : currencies.items.slice(0, 6);

    return (
        <button type="button" onClick={onOpen} className="flex h-full min-h-0 w-full cursor-pointer flex-col overflow-hidden border-0 bg-transparent p-0 text-left">
            <div className={compact ? "mb-1.5 flex items-center gap-2" : "mb-2.5 flex items-center gap-2.5"}>
                <span className={compact ? "text-[18px]" : "text-[22px]"}>💱</span>
                <div className="min-w-0 flex-1">
                    <div className={compact ? "text-[12.5px] font-bold leading-none" : "text-[14px] font-bold leading-none"}>{t.currencies}</div>
                    <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{currencies.base}</div>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
                {shown.map((it) => (
                    <QuoteRow key={it.id} code={it.code} label={it.label} kind={it.kind} price={it.price} ok={it.ok} error={it.error} base={currencies.base} compact={compact} />
                ))}
            </div>
        </button>
    );
}

// ── Página de detalhe ────────────────────────────────────────────────

export function CurrenciesDetail({ currencies, t }: { currencies: CurrenciesPayload | null | undefined; t: T }) {
    if (!currencies) {
        return <div className={emptyNote}>{t.currenciesEmpty}</div>;
    }
    if (!currencies.ok && currencies.error) {
        return <div className={metricCard}><div className={errorText}>{currencies.error}</div></div>;
    }
    if (!currencies.items.length) {
        return <div className={emptyNote}>{t.currenciesEmpty}</div>;
    }
    return (
        <div className="flex w-full flex-col gap-[10px]">
            <div className={cardLabel}>{t.currencies} · {currencies.base}</div>
            <div className={`${metricCard} flex flex-col gap-2.5`}>
                {currencies.items.map((it) => (
                    <QuoteRow key={it.id} code={it.code} label={it.label} kind={it.kind} price={it.price} ok={it.ok} error={it.error} base={currencies.base} />
                ))}
            </div>
            {currencies.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {currencies.updated_at.slice(11, 16)}</div> : null}
        </div>
    );
}
