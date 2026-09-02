import { cn } from "../../cn";
import type { CurrenciesPayload, CurrencyQuote } from "../../api/types";
import { fmtCurrencyAmount } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, errorText, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

function cryptoItems(items?: CurrencyQuote[] | null): CurrencyQuote[] {
  return (items ?? []).filter((it) => it.kind === "crypto");
}

// sm/sw = 1 cotação em destaque cada, por posição na lista toda (só fazem
// sentido com 2+ itens); sc/scw = idem, mas só entre os itens kind=crypto
// (só fazem sentido com 1+/2+ criptos configuradas); md/lg/wl = lista com
// N cotações — quanto maior o card, mais cabe.
export function currenciesAllowedSizes(items?: CurrencyQuote[] | null): CardSize[] {
  const cryptos = cryptoItems(items);
  const out: CardSize[] = ["sm"];
  if ((items?.length ?? 0) >= 2) out.push("sw");
  if (cryptos.length >= 1) out.push("sc");
  if (cryptos.length >= 2) out.push("scw");
  out.push("md", "lg", "wl");
  return out;
}

export const CURRENCIES_ALLOWED_ALL: CardSize[] = ["sm", "sw", "sc", "scw", "md", "lg", "wl"];

export function currenciesSizeLabel(size: CardSize, t: T, items?: CurrencyQuote[] | null): string {
  const s = normalizeSize(size);
  const cryptos = cryptoItems(items);
  if (s === "sm") return `${t.cardSmallPrefix} ${items?.[0]?.code || "1"}`;
  if (s === "sw") return `${t.cardSmallPrefix} ${items?.[1]?.code || items?.[0]?.code || "2"}`;
  if (s === "sc") return `${t.cardSmallPrefix} ${cryptos[0]?.code || "cripto 1"}`;
  if (s === "scw") return `${t.cardSmallPrefix} ${cryptos[1]?.code || cryptos[0]?.code || "cripto 2"}`;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function Icon({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-3.5 object-contain" src={PROVIDER_ICON.currencies} alt="" draggable={false} />
      </div>
    );
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-[23px] object-contain" src={PROVIDER_ICON.currencies} alt="" draggable={false} />
    </div>
  );
}

function CurrenciesHeader({ base, t, compact, ok, onOpen }: { base: string; t: T; compact?: boolean; ok: boolean; onOpen?: () => void }) {
  const inner = (
    <>
      <div className="relative shrink-0">
        <Icon compact={compact} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{t.currencies}</div>
        <div className={cardLabel}>{base}</div>
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

function QuoteRow({ it, base, big }: { it: CurrencyQuote; base: string; big?: boolean }) {
  const value = it.ok && it.price != null ? fmtCurrencyAmount(it.price, base) : null;
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2", big ? "text-[13.5px]" : "text-[12px]")}>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{it.label || it.code}</span>
      {value ? (
        <span className={cn(num, "shrink-0 font-bold text-ink")}>{value}</span>
      ) : (
        <span className="shrink-0 text-[11px] text-bad">{it.error || "--"}</span>
      )}
    </div>
  );
}

function HeroQuote({ it, base }: { it: CurrencyQuote | undefined; base: string }) {
  const value = it && it.ok && it.price != null ? fmtCurrencyAmount(it.price, base) : null;
  return (
    <>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{it ? it.label || it.code : "--"}</div>
      <div className={cn(num, "mt-1 text-[13px] font-[800] leading-tight py-0.5 [overflow-wrap:anywhere]")}>{value || it?.error || "--"}</div>
    </>
  );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function CurrenciesBoardCard({
  currencies,
  t,
  size,
  onOpen,
}: {
  currencies: CurrenciesPayload | null | undefined;
  t: T;
  size: CardSize;
  onOpen: () => void;
}) {
  const items = currencies?.items ?? [];
  const cryptos = cryptoItems(items);
  const base = currencies?.base || "";
  const ok = !!currencies?.ok && items.length > 0;
  const ns = normalizeSize(size);
  const isCompact = ns === "sm" || ns === "sw" || ns === "sc" || ns === "scw";

  if (!currencies || !items.length) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader base={base} t={t} compact={isCompact} ok={false} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{currencies?.error || t.currenciesEmpty}</div>
        </div>
      </div>
    );
  }

  if (ns === "sm" || ns === "sw" || ns === "sc" || ns === "scw") {
    const item = ns === "sw" ? items[1] || items[0]
      : ns === "sc" ? cryptos[0]
      : ns === "scw" ? cryptos[1] || cryptos[0]
      : items[0];
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <Icon />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-visible border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <HeroQuote it={item} base={base} />
        </button>
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {items.slice(0, 4).map((it) => (
            <QuoteRow key={it.id} it={it} base={base} />
          ))}
        </button>
      </div>
    );
  }

  if (ns === "lg") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
        <button type="button" className="grid min-h-0 flex-1 cursor-pointer auto-rows-min grid-cols-2 gap-x-3 gap-y-2 overflow-hidden border-0 bg-transparent p-0 text-left content-center" onClick={onOpen}>
          {items.slice(0, 8).map((it) => (
            <QuoteRow key={it.id} it={it} base={base} big />
          ))}
        </button>
      </div>
    );
  }

  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-start gap-2.5 overflow-hidden border-0 bg-transparent p-0 pt-1 text-left" onClick={onOpen}>
          {items.slice(0, 10).map((it) => (
            <QuoteRow key={it.id} it={it} base={base} big />
          ))}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
      <button type="button" className="grid min-h-0 flex-1 cursor-pointer auto-rows-min grid-cols-2 gap-x-4 gap-y-2.5 overflow-hidden border-0 bg-transparent p-0 text-left content-center" onClick={onOpen}>
        {items.slice(0, 10).map((it) => (
          <QuoteRow key={it.id} it={it} base={base} big />
        ))}
      </button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

export function CurrenciesDetail({ currencies, t }: { currencies: CurrenciesPayload | null | undefined; t: T }) {
  if (!currencies || !currencies.items?.length) {
    return <div className="px-5 py-12 text-center text-sm text-ink3">{t.currenciesEmpty}</div>;
  }
  return (
    <div className="flex w-full flex-col gap-[10px]">
      <div className={cardLabel}>{t.currencies} · {currencies.base}</div>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-edge bg-panel px-[18px] py-4">
        {currencies.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{it.label || it.code} <span className="text-ink3">{it.code}</span></span>
            <span className="shrink-0 font-bold text-ink">{it.ok && it.price != null ? fmtCurrencyAmount(it.price, currencies.base) : it.error || "--"}</span>
          </div>
        ))}
      </div>
      {currencies.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {currencies.updated_at.slice(11, 16)}</div> : null}
    </div>
  );
}
