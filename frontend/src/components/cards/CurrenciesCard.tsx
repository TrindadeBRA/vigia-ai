import { useState } from "react";
import type { CurrenciesPayload, CurrencyQuote } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import { fmtCurrencyAmount as _fmtCurrencyAmount } from "../../format";
void _fmtCurrencyAmount;
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

function cryptoItems(items?: CurrencyQuote[] | null): CurrencyQuote[] {
  return (items ?? []).filter((it) => it.kind === "crypto");
}

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

/* ── Helpers ────────────────────────────────────────────────────────── */

function parsePtNumber(str: string): number | null {
  const s = str.trim().replace(/\s/g, "");
  if (!s) return null;
  // pt-BR: "1.234,56" -> "1234.56" ; "1,5" -> "1.5" ; "1.5" -> "1.5"
  let normalized: string;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatForInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  // use pt-BR with 2-6 decimals, no currency
  const abs = Math.abs(n);
  const maxFrac = abs >= 1 ? 2 : 6;
  try {
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: maxFrac }).format(n);
  } catch {
    return n.toFixed(2).replace(".", ",");
  }
}

function formatFactor(n: number): string {
  if (!Number.isFinite(n)) return "1";
  // keep up to 6 decimals, trim zeros
  let s = n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  // if integer, keep as is
  return s.replace(".", ",");
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

function EditableQuoteRow({
  it,
  base,
  big,
  factor,
  onFactorChange,
}: {
  it: CurrencyQuote;
  base: string;
  big?: boolean;
  factor: number;
  onFactorChange: (newFactor: number) => void;
}) {
  const original = it.price;
  const displayPrice = it.ok && original != null ? original * factor : null;
  const [editing, setEditing] = useState(false);
  const [editStr, setEditStr] = useState("");

  // for input, show numeric without currency symbol when editing
  const inputValue = editing ? editStr : displayPrice != null ? formatForInput(displayPrice) : "";

  if (!it.ok || original == null) {
    return (
      <div className={cn("flex min-w-0 items-center justify-between gap-2", big ? "text-[13.5px]" : "text-[12px]")}>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{it.label || it.code}</span>
        <span className="shrink-0 text-[11px] text-bad">{it.error || "--"}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2", big ? "text-[13.5px]" : "text-[12px]")}>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{it.label || it.code}</span>
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onFocus={() => {
          setEditing(true);
          setEditStr(displayPrice != null ? formatForInput(displayPrice) : "");
        }}
        onBlur={() => {
          setEditing(false);
          // if user left empty or invalid, keep factor
          const n = parsePtNumber(editStr);
          if (n != null && n > 0 && original !== 0) {
            const newFactor = n / original;
            if (Number.isFinite(newFactor) && newFactor > 0) onFactorChange(newFactor);
          }
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.,]/g, "");
          setEditStr(v);
          const n = parsePtNumber(v);
          if (n != null && n > 0 && original !== 0) {
            const newFactor = n / original;
            if (Number.isFinite(newFactor) && newFactor > 0) onFactorChange(newFactor);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 min-w-0 max-w-[110px] rounded-[8px] border border-edge bg-canvas px-2 text-right text-[12px] font-bold text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent",
          big && "h-7 text-[13px]",
          num,
        )}
        aria-label={`${it.label || it.code} em ${base}`}
      />
    </div>
  );
}

function EditableHeroQuote({
  it,
  base,
  factor,
  onFactorChange,
}: {
  it: CurrencyQuote | undefined;
  base: string;
  factor: number;
  onFactorChange: (newFactor: number) => void;
}) {
  const original = it?.price;
  const displayPrice = it && it.ok && original != null ? original * factor : null;
  const [editing, setEditing] = useState(false);
  const [editStr, setEditStr] = useState("");

  if (!it || !it.ok || original == null) {
    return (
      <>
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{it ? it.label || it.code : "--"}</div>
        <div className={cn(num, "mt-1 text-[13px] font-[800] leading-tight py-0.5 [overflow-wrap:anywhere]")}>{it?.error || "--"}</div>
      </>
    );
  }

  const inputValue = editing ? editStr : displayPrice != null ? formatForInput(displayPrice) : "";

  return (
    <>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{it.label || it.code}</div>
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onFocus={() => {
          setEditing(true);
          setEditStr(displayPrice != null ? formatForInput(displayPrice) : "");
        }}
        onBlur={() => {
          setEditing(false);
          const n = parsePtNumber(editStr);
          if (n != null && n > 0 && original !== 0) {
            const newFactor = n / original;
            if (Number.isFinite(newFactor) && newFactor > 0) onFactorChange(newFactor);
          }
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.,]/g, "");
          setEditStr(v);
          const n = parsePtNumber(v);
          if (n != null && n > 0 && original !== 0) {
            const newFactor = n / original;
            if (Number.isFinite(newFactor) && newFactor > 0) onFactorChange(newFactor);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(num, "mt-1 h-7 w-full max-w-[140px] rounded-[8px] border border-edge bg-canvas px-2 text-left text-[13px] font-[800] leading-tight text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent")}
        aria-label={`${it.label || it.code} em ${base}`}
      />
      <div className="mt-1 text-[10px] text-ink3">{base}</div>
    </>
  );
}

function BaseValueField({ base, value, onChange }: { base: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <span className="shrink-0 text-[11px] font-medium text-ink3">1 {base} =</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-[72px] rounded-[8px] border border-edge bg-canvas px-2 text-center text-[12px] font-semibold text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        placeholder="1"
        aria-label={`Valor da moeda base ${base}`}
      />
      <span className="shrink-0 text-[11px] text-ink3">{base}</span>
    </div>
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
  const [factorStr, setFactorStr] = useState("1");
  const factor = (() => {
    const n = parsePtNumber(factorStr);
    return n != null && Number.isFinite(n) && n > 0 ? n : 1;
  })();

  const handleFactorChange = (newFactor: number) => {
    setFactorStr(formatFactor(newFactor));
  };

  const handleBaseChange = (v: string) => {
    setFactorStr(v);
  };

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
      <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
        <div className="flex w-full items-center gap-2.5 overflow-hidden">
          <div className="relative shrink-0">
            <Icon />
            <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
          </div>
          <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-visible border-0 bg-transparent p-0 text-left" onClick={onOpen}>
            <EditableHeroQuote it={item} base={base} factor={factor} onFactorChange={handleFactorChange} />
          </button>
        </div>
        <BaseValueField base={base} value={factorStr} onChange={handleBaseChange} />
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
        <BaseValueField base={base} value={factorStr} onChange={handleBaseChange} />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
          {items.slice(0, 4).map((it) => (
            <EditableQuoteRow key={it.id} it={it} base={base} factor={factor} onFactorChange={handleFactorChange} />
          ))}
        </div>
        <button type="button" className="mt-1 text-left text-[11px] font-medium text-ink3 hover:text-ink" onClick={onOpen}>ver detalhes →</button>
      </div>
    );
  }

  if (ns === "lg") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
        <BaseValueField base={base} value={factorStr} onChange={handleBaseChange} />
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-x-3 gap-y-2 overflow-hidden content-center">
          {items.slice(0, 8).map((it) => (
            <EditableQuoteRow key={it.id} it={it} base={base} big factor={factor} onFactorChange={handleFactorChange} />
          ))}
        </div>
        <button type="button" className="mt-1 text-left text-[11px] font-medium text-ink3 hover:text-ink" onClick={onOpen}>ver detalhes →</button>
      </div>
    );
  }

  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
        <BaseValueField base={base} value={factorStr} onChange={handleBaseChange} />
        <div className="flex min-h-0 flex-1 flex-col justify-start gap-2.5 overflow-hidden pt-1">
          {items.slice(0, 10).map((it) => (
            <EditableQuoteRow key={it.id} it={it} base={base} big factor={factor} onFactorChange={handleFactorChange} />
          ))}
        </div>
        <button type="button" className="mt-1 text-left text-[11px] font-medium text-ink3 hover:text-ink" onClick={onOpen}>ver detalhes →</button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CurrenciesHeader base={base} t={t} ok={ok} onOpen={onOpen} />
      <BaseValueField base={base} value={factorStr} onChange={handleBaseChange} />
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-x-4 gap-y-2.5 overflow-hidden content-center">
        {items.slice(0, 10).map((it) => (
          <EditableQuoteRow key={it.id} it={it} base={base} big factor={factor} onFactorChange={handleFactorChange} />
        ))}
      </div>
      <button type="button" className="mt-1 text-left text-[11px] font-medium text-ink3 hover:text-ink" onClick={onOpen}>ver detalhes →</button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

export function CurrenciesDetail({ currencies, t }: { currencies: CurrenciesPayload | null | undefined; t: T }) {
  const [factorStr, setFactorStr] = useState("1");
  const factor = (() => {
    const n = parsePtNumber(factorStr);
    return n != null && Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const handleFactorChange = (newFactor: number) => setFactorStr(formatFactor(newFactor));
  if (!currencies || !currencies.items?.length) {
    return <div className="px-5 py-12 text-center text-sm text-ink3">{t.currenciesEmpty}</div>;
  }
  return (
    <div className="flex w-full flex-col gap-[10px]">
      <div className={cardLabel}>{t.currencies} · {currencies.base}</div>
      <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel px-3 py-2">
        <span className="text-xs font-medium text-ink3">Valor da moeda base · 1 {currencies.base} =</span>
        <input
          type="text"
          inputMode="decimal"
          value={factorStr}
          onChange={(e) => setFactorStr(e.target.value.replace(/[^0-9.,]/g, ""))}
          className="h-8 w-24 rounded-[8px] border border-edge bg-canvas px-2 text-center text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="1"
          aria-label={`Valor da moeda base ${currencies.base}`}
        />
        <span className="text-xs text-ink3">{currencies.base}</span>
      </div>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-edge bg-panel px-[18px] py-4">
        {currencies.items.map((it) => (
          <EditableQuoteRow key={it.id} it={it} base={currencies.base} factor={factor} onFactorChange={handleFactorChange} />
        ))}
      </div>
      {currencies.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {currencies.updated_at.slice(11, 16)}</div> : null}
    </div>
  );
}
