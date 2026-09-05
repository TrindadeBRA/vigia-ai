import { cn } from "../../cn";
import type { AdsenseAccount } from "../../api/types";
import type { Metric } from "../../pages/display/types";
import { fmtMoney, fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Dados ──────────────────────────────────────────────────────────── */
// AdSense só tem 2 números (sem % — não é uma janela de cota como
// Claude/GPT/Cursor): ganhos estimados de hoje e saldo não pago na carteira.

export function getAdsenseMetrics(a: AdsenseAccount, t: T): Metric[] {
  return [
    { label: t.adsenseToday, pct: null, value: a.today_cents != null ? fmtMoney(a.today_cents, a.currency) : null, sub: null },
    { label: t.adsenseWallet, pct: null, value: a.unpaid_cents != null ? fmtMoney(a.unpaid_cents, a.currency) : null, sub: null },
  ];
}

export function adsenseAllowedSizes(_a?: AdsenseAccount | null, _metrics?: Metric[] | null): CardSize[] {
  return ["sm", "sw", "md", "lg"];
}

export const ADSENSE_ALLOWED_ALL: CardSize[] = ["sm", "sw", "md", "lg"];

export function adsenseSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return `${t.cardSmallPrefix} ${t.adsenseToday}`;
  if (s === "sw") return `${t.cardSmallPrefix} ${t.adsenseWallet}`;
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
        <img className="size-3.5 object-contain" src={PROVIDER_ICON.adsense} alt="adsense" draggable={false} />
      </div>
    );
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-[23px] object-contain" src={PROVIDER_ICON.adsense} alt="adsense" draggable={false} />
    </div>
  );
}

function AdsenseHeader({ label, compact, ok, onOpen }: { label: string; compact?: boolean; ok: boolean; onOpen?: () => void }) {
  const inner = (
    <>
      <div className="relative shrink-0">
        <Icon compact={compact} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>AdSense</div>
        {label ? <div className={cardLabel}>{label}</div> : null}
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
    </div>
  );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function AdsenseBoardCard({
  metrics: metricsProp,
  label,
  ok,
  error,
  t,
  size,
  onOpen,
}: {
  metrics?: Metric[];
  label: string;
  ok: boolean;
  error: string | null;
  t: T;
  size: CardSize;
  onOpen: () => void;
}) {
  const metrics = metricsProp ?? [];
  const ns = normalizeSize(size);
  const isCompact = ns === "sm" || ns === "sw";

  if (!ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <AdsenseHeader label={label} compact={isCompact} ok={ok} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{error || t.noData}</div>
        </div>
      </div>
    );
  }

  if (ns === "sm" || ns === "sw") {
    const single = ns === "sw" ? metrics[1] || metrics[0] : metrics[0];
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            <img className="size-[23px] object-contain" src={PROVIDER_ICON.adsense} alt="adsense" draggable={false} />
          </div>
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {single ? (
            <>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{single.label}</div>
              <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-[800] leading-tight py-0.5")}>{single.value || "--"}</div>
            </>
          ) : null}
        </button>
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <AdsenseHeader label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-0 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden">
            {metrics.slice(0, 2).map((m, i) => (
              <ValueRow key={i} m={m} compact />
            ))}
          </div>
        </button>
      </div>
    );
  }

  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <AdsenseHeader label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 2).map((m, i) => (
            <ValueRow key={i} m={m} />
          ))}
        </button>
      </div>
    );
  }

  // lg / xl / wxl — mesma grade 2 colunas, sobra espaço mas mantém consistência
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <AdsenseHeader label={label} ok={ok} onOpen={onOpen} />
      <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        {metrics.slice(0, 2).map((m, i) => (
          <ValueRow key={i} m={m} />
        ))}
      </button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

export function AdsenseDetail({
  account,
  updatedAt,
  t,
}: {
  account: AdsenseAccount;
  updatedAt: string;
  t: T;
}) {
  return (
    <>
      {account.account_name ? <div className="px-0.5 text-[12.5px] tracking-[.1px] text-ink3">{account.account_name}</div> : null}
      <div className="grid w-full overflow-hidden rounded-2xl border border-edge bg-edge [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-px">
        <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
          <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.updated}</span>
          <span className={`${num} overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]`}>{fmtWhen(updatedAt)}</span>
        </div>
      </div>
      <div className={metricsGrid}>
        <div className={metricCard}>
          <div className="mb-2.5 text-[13.5px] text-ink2">{t.adsenseToday}</div>
          <div className={cn(num, "text-[18px] font-[750] [overflow-wrap:anywhere]")}>{account.today_cents != null ? fmtMoney(account.today_cents, account.currency) : t.noData}</div>
        </div>
        <div className={metricCard}>
          <div className="mb-2.5 text-[13.5px] text-ink2">{t.adsenseWallet}</div>
          <div className={cn(num, "text-[18px] font-[750] [overflow-wrap:anywhere]")}>{account.unpaid_cents != null ? fmtMoney(account.unpaid_cents, account.currency) : t.noData}</div>
        </div>
      </div>
    </>
  );
}
