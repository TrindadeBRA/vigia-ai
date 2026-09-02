import { cn } from "../../cn";
import type { CurrencyQuote } from "../../api/types";
import type { Metric } from "../../pages/Display";
import { fmtCurrencyAmount } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Dados ──────────────────────────────────────────────────────────── */

export function getCurrencyMetrics(q: CurrencyQuote, base: string): Metric[] {
  return [
    {
      label: q.label || q.code,
      pct: null,
      value: q.ok && q.price != null ? fmtCurrencyAmount(q.price, base) : null,
      sub: q.ok ? null : q.error || null,
    },
  ];
}

export function currenciesAllowedSizes(): CardSize[] {
  return ["md", "lg"];
}

export const CURRENCIES_ALLOWED_ALL: CardSize[] = ["md", "lg"];

export function currenciesSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  return t.cardNormal;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function CurrenciesHeader({ code, label, base, compact, ok, onOpen }: { code: string; label: string; base: string; compact?: boolean; ok: boolean; onOpen?: () => void }) {
  const inner = (
    <>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <span className="text-[14px] leading-none">💱</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{label || code}</div>
        <div className={cardLabel}>{base} · {code}</div>
      </div>
      <span className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-good" : "bg-bad")} />
    </>
  );
  if (onOpen) {
    return (
      <button type="button" className={cn("flex min-w-0 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-ink", compact ? "gap-2" : "gap-2.5")} onClick={onOpen}>
        {inner}
      </button>
    );
  }
  return <div className={cn("flex min-w-0 shrink-0 items-center", compact ? "gap-2" : "gap-2.5")}>{inner}</div>;
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function CurrenciesBoardCard({
  quote,
  base,
  t,
  size,
  onOpen,
}: {
  quote: CurrencyQuote;
  base: string;
  t: T;
  size: CardSize;
  onOpen: () => void;
}) {
  const ns = normalizeSize(size);
  const ok = quote.ok;
  const price = ok && quote.price != null ? fmtCurrencyAmount(quote.price, base) : null;

  if (!ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader code={quote.code} label={quote.label} base={base} compact={ns === "md"} ok={ok} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={errorText}>{quote.error || "--"}</div>
        </div>
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader code={quote.code} label={quote.label} base={base} compact ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className={cn(num, "text-[18px] font-[800] leading-none")}>{price || "--"}</div>
          <div className="mt-1 text-[11px] text-ink3">{base}</div>
        </button>
      </div>
    );
  }

  // lg 4×2 largo — valor grande + base
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CurrenciesHeader code={quote.code} label={quote.label} base={base} ok={ok} onOpen={onOpen} />
      <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        <div className={cn(num, "text-[24px] font-[800] leading-none")}>{price || "--"}</div>
        <div className="mt-1.5 text-[12px] text-ink3">1 {quote.code} = {price || "--"} {base}</div>
      </button>
    </div>
  );
}

export function CurrenciesDetail({ quote, base, t }: { quote: CurrencyQuote; base: string; t: T }) {
  return (
    <div className="flex w-full flex-col gap-[14px]">
      <div className="flex items-center gap-3">
        <span className="text-[28px]">💱</span>
        <div>
          <div className="text-[19px] font-[750]">{quote.label || quote.code} · {base}</div>
          <div className={cardLabel}>{quote.code}</div>
        </div>
      </div>
      <div className={metricsGrid}>
        <div className={metricCard}>
          <div className="mb-2.5 text-[13.5px] text-ink2">{quote.label || quote.code}</div>
          <div className={cn(num, "text-[22px] font-[750]")}>{quote.ok && quote.price != null ? fmtCurrencyAmount(quote.price, base) : quote.error || "--"}</div>
        </div>
      </div>
    </div>
  );
}
