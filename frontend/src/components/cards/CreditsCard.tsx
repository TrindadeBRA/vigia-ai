import { cn } from "../../cn";
import type { CreditsAccount, OpenCodeAccount } from "../../api/types";
import type { Metric } from "../../pages/Display";
import { barColor, barGlow, clamp, fmtCountdown, fmtPct, fmtRemain, fmtUsd, fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON, type ThemeName, PALETTES } from "../../theme";
import { barFill, barTrack, cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Dados ──────────────────────────────────────────────────────────── */
// Provedores "só saldo" (OpenRouter / DeepSeek / fal.ai) usam o mesmo
// CreditsAccount — um único metric de créditos. OpenCode soma isso a até
// 3 janelas de assinatura (rolling/weekly/monthly), então usa o mesmo card,
// só que com mais metrics.

export function getCreditsMetrics(acc: CreditsAccount, t: T): Metric[] {
  const bits: string[] = [];
  if (acc.used_cents != null) bits.push(`${t.used} ${fmtUsd(acc.used_cents)}`);
  if (acc.limit_cents != null) bits.push(`${t.cap} ${fmtUsd(acc.limit_cents)}`);
  const hasLimits = bits.length > 0;
  const sub = hasLimits ? bits.join(" · ") : acc.percent == null && acc.remaining_cents != null ? null : acc.remaining_cents != null ? t.remainMoney + fmtUsd(acc.remaining_cents) : t.noCredits;
  return [{ label: t.credits, pct: acc.percent, value: acc.remaining_cents != null ? fmtUsd(acc.remaining_cents) : null, sub }];
}

export function getOpenCodeMetrics(o: OpenCodeAccount, t: T): Metric[] {
  const out: Metric[] = [];
  if (o.rolling_percent != null) {
    out.push({ label: t.rolling, pct: o.rolling_percent, sub: t.remainingPrefix + fmtRemain(o.rolling_percent), countdownAt: o.rolling_resets_at });
  }
  if (o.weekly_percent != null) {
    out.push({ label: t.weekLimit, pct: o.weekly_percent, sub: t.remainingPrefix + fmtRemain(o.weekly_percent), countdownAt: o.weekly_resets_at });
  }
  if (o.monthly_percent != null) {
    out.push({ label: t.monthLimit, pct: o.monthly_percent, sub: t.remainingPrefix + fmtRemain(o.monthly_percent), countdownAt: o.monthly_resets_at });
  }
  if (o.remaining_cents != null) {
    out.push({
      label: t.accountCredits,
      pct: o.percent,
      value: fmtUsd(o.remaining_cents),
      sub: o.limit_cents != null ? `${t.cap} ${fmtUsd(o.limit_cents)}` : t.remainMoney + fmtUsd(o.remaining_cents),
    });
  }
  if (!out.length) out.push({ label: t.rolling, pct: null, sub: t.noData });
  return out;
}

/* ── Tamanhos ───────────────────────────────────────────────────────── */
// sw só faz sentido com 2+ metrics (OpenRouter/DeepSeek/fal.ai têm só 1 —
// o saldo — então ficam sem hero duplo); wl só com 3+ (OpenCode completo).
export function creditsAllowedSizes(metrics?: Metric[] | null): CardSize[] {
  const n = metrics?.length ?? 1;
  if (n >= 3) return ["sm", "sw", "md", "lg", "wl"];
  if (n >= 2) return ["sm", "sw", "md", "lg"];
  return ["sm", "md", "lg"];
}

export const CREDITS_ALLOWED_ALL: CardSize[] = ["sm", "sw", "md", "lg", "wl"];

// sm/sw mostram o nome do próprio metric (rolling/weekly/monthly/créditos
// variam por provedor — não tem um "5h"/"semana" fixo como Claude/GPT).
export function creditsSizeLabel(size: CardSize, t: T, metrics?: Metric[] | null): string {
  const s = normalizeSize(size);
  if (s === "sm") return `${t.cardSmallPrefix} ${metrics?.[0]?.label || "1"}`;
  if (s === "sw") return `${t.cardSmallPrefix} ${metrics?.[1]?.label || metrics?.[0]?.label || "2"}`;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function barStyle(pct: number, pal: (typeof PALETTES)[ThemeName]) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
}

function Icon({ providerId, compact }: { providerId: string; compact?: boolean }) {
  if (compact)
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-3.5 object-contain" src={PROVIDER_ICON[providerId]} alt="" draggable={false} />
      </div>
    );
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-[23px] object-contain" src={PROVIDER_ICON[providerId]} alt="" draggable={false} />
    </div>
  );
}

function CreditsHeader({ providerId, title, label, compact, ok, onOpen }: { providerId: string; title: string; label: string; compact?: boolean; ok: boolean; onOpen?: () => void }) {
  const inner = (
    <>
      <div className="relative shrink-0">
        <Icon providerId={providerId} compact={compact} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{title}</div>
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

function CompactRow({ m, pal, nowMs }: { m: Metric; pal: (typeof PALETTES)[ThemeName]; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{m.label}</span>
        <span className={cn(num, "min-w-0 text-[15px] font-bold leading-tight [overflow-wrap:anywhere]")}>{m.value || m.sub || "--"}</span>
        {clock && m.sub !== clock ? <span className={cn(num, "text-[11px] font-[550] text-ink2")}>{clock}</span> : null}
      </div>
    );
  }
  const extra = clock || m.sub;
  return (
    <div className="mt-1.5 min-w-0 first:mt-0">
      <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{m.label}</span>
        <span className={`${num} shrink-0 text-[12px] font-bold text-ink`}>{fmtPct(m.pct)}</span>
      </div>
      <div className={cn(barTrack, "h-[5px]")}>
        <div className={barFill} style={barStyle(m.pct, pal)} />
      </div>
      {extra ? <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{extra}</div> : null}
    </div>
  );
}

function Row({ m, pal, nowMs }: { m: Metric; pal: (typeof PALETTES)[ThemeName]; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        </div>
        <div className={cn(num, "text-[15px] font-bold")}>{m.value || m.sub || "--"}</div>
        {clock && m.sub !== clock ? <div className={cn(num, "mt-1 text-[11px] font-[550] text-ink2")}>{clock}</div> : null}
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        <span className={`${num} shrink-0 text-sm font-bold`}>{fmtPct(m.pct)}</span>
      </div>
      <div className={barTrack}>
        <div className={barFill} style={barStyle(m.pct, pal)} />
      </div>
      {m.sub ? <div className="mt-[5px] text-[11.5px] leading-tight text-ink3">{m.sub}</div> : null}
    </div>
  );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function CreditsBoardCard({
  providerId,
  title,
  label,
  ok,
  error,
  metrics: metricsProp,
  t,
  pal,
  nowMs,
  size,
  onOpen,
}: {
  providerId: string;
  title: string;
  label: string;
  ok: boolean;
  error: string | null;
  metrics?: Metric[];
  t: T;
  pal: (typeof PALETTES)[ThemeName];
  nowMs?: number;
  size: CardSize;
  onOpen: () => void;
}) {
  const metrics = metricsProp ?? [];
  const ns = normalizeSize(size);
  const isCompact = ns === "sm" || ns === "sw";

  if (!ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CreditsHeader providerId={providerId} title={title} label={label} compact={isCompact} ok={ok} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{error || t.noData}</div>
        </div>
      </div>
    );
  }

  if (ns === "sm" || ns === "sw") {
    const single = ns === "sw" ? metrics[1] || metrics[0] : metrics[0];
    const clock = single?.countdownAt ? fmtCountdown(single.countdownAt, nowMs) : null;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <Icon providerId={providerId} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {single ? (
            <>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{single.label}</div>
              <div className={cn(num, "mt-1 text-[18px] font-[800] leading-none")}>{single.value || (single.pct != null ? fmtPct(single.pct) : "--")}</div>
              {single.pct != null ? (
                <div className={cn(barTrack, "mt-1 h-[4px]")}>
                  <div className={barFill} style={barStyle(single.pct, pal)} />
                </div>
              ) : null}
              {clock ? <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[600] leading-none text-ink2")}>{clock}</div> : null}
            </>
          ) : null}
        </button>
      </div>
    );
  }

  if (ns === "md") {
    const shown = metrics.slice(0, 2);
    const hidden = metrics.length - shown.length;
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CreditsHeader providerId={providerId} title={title} label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-0 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-0 overflow-hidden">
            {shown.map((m, i) => (
              <CompactRow key={i} m={m} pal={pal} nowMs={nowMs} />
            ))}
          </div>
          {hidden > 0 ? <span className="mt-1 shrink-0 text-[11px] font-semibold leading-none text-accent">+{hidden}</span> : null}
        </button>
      </div>
    );
  }

  if (ns === "lg") {
    const shown = metrics.slice(0, 2);
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CreditsHeader providerId={providerId} title={title} label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {shown.map((m, i) => (
            <Row key={i} m={m} pal={pal} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CreditsHeader providerId={providerId} title={title} label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-2 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 4).map((m, i) => (
            <Row key={i} m={m} pal={pal} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CreditsHeader providerId={providerId} title={title} label={label} ok={ok} onOpen={onOpen} />
      <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-1 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        {metrics.slice(0, 4).map((m, i) => (
          <Row key={i} m={m} pal={pal} nowMs={nowMs} />
        ))}
      </button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

export function CreditsDetail({
  metrics,
  updatedAt,
  note,
  t,
  pal,
  nowMs,
}: {
  metrics: Metric[];
  updatedAt: string;
  note?: string | null;
  t: T;
  pal: (typeof PALETTES)[ThemeName];
  nowMs?: number;
}) {
  return (
    <>
      {note ? <div className="px-0.5 text-[12.5px] tracking-[.1px] text-ink3">{note}</div> : null}
      <div className="grid w-full overflow-hidden rounded-2xl border border-edge bg-edge [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-px">
        <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
          <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.updated}</span>
          <span className={`${num} overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]`}>{fmtWhen(updatedAt)}</span>
        </div>
      </div>
      <div className={metricsGrid}>
        {metrics.map((m, i) => {
          const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
          const display = m.value ?? (m.pct != null ? fmtPct(m.pct) : null);
          return (
            <div key={i} className={metricCard}>
              <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="text-ink2">{m.label}</span>
                {display ? <span className={`${num} text-[22px] font-[750]`}>{display}</span> : null}
              </div>
              {m.pct != null ? (
                <div className={`${barTrack} h-[9px]`}>
                  <div className={barFill} style={barStyle(m.pct, pal)} />
                </div>
              ) : null}
              {m.sub ? <div className="mt-2.5 text-[12.5px] text-ink3">{m.sub}</div> : null}
              {clock ? <div className={cn(num, "mt-1 text-[12.5px] font-[550] text-ink2")}>{t.resetIn} {clock}</div> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
