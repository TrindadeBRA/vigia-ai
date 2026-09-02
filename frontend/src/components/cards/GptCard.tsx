import { cn } from "../../cn";
import type { GptAccount } from "../../api/types";
import type { Metric } from "../../pages/Display";
import { barColor, barGlow, clamp, fmtCountdown, fmtPct, fmtRemain, fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON, type ThemeName, PALETTES } from "../../theme";
import { barFill, barTrack, cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Dados ──────────────────────────────────────────────────────────── */

export function getGptMetrics(g: GptAccount, t: T, nowMs: number): Metric[] {
  const out: Metric[] = [];
  if (g.session_percent != null) {
    out.push({ label: t.session5h, pct: g.session_percent, sub: t.remainingPrefix + fmtRemain(g.session_percent), countdownAt: g.session_resets_at });
  } else {
    const until = g.session_resets_at || g.weekly_resets_at;
    if (until) out.push({ label: t.resetIn, pct: null, sub: fmtCountdown(until, nowMs), countdownAt: until });
  }
  if (g.weekly_percent != null || g.weekly_resets_at) {
    out.push({ label: t.weekLimit, pct: g.weekly_percent, sub: g.weekly_percent != null ? t.remainingPrefix + fmtRemain(g.weekly_percent) : null, countdownAt: g.weekly_resets_at });
  }
  if (!out.length) out.push({ label: t.weekLimit, pct: null, sub: t.noData });
  return out;
}

export function gptAllowedSizes(_g: GptAccount | null, _metrics?: Metric[]): CardSize[] {
  return ["sm", "sw", "md", "lg"];
}

export const GPT_ALLOWED_ALL: CardSize[] = ["sm", "sw", "md", "lg"];

export function gptSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return "Pequeno · 5h";
  if (s === "sw") return "Pequeno · semana";
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

function Icon({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-3.5 object-contain" src={PROVIDER_ICON.gpt} alt="gpt" draggable={false} />
      </div>
    );
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-[23px] object-contain" src={PROVIDER_ICON.gpt} alt="gpt" draggable={false} />
    </div>
  );
}

function GptHeader({ label, compact, ok, title, onOpen }: { label: string; compact?: boolean; ok: boolean; title: string; onOpen?: () => void }) {
  const inner = (
    <>
      <div className="relative shrink-0">
        <Icon compact={compact} />
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

function CompactRow({ m, pal, t, nowMs }: { m: Metric; pal: (typeof PALETTES)[ThemeName]; t: T; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{m.label}</span>
        <span className={cn(num, "min-w-0 text-[15px] font-bold leading-tight [overflow-wrap:anywhere]")}>{m.sub || "--"}</span>
        {clock && m.sub !== clock ? <span className={cn(num, "text-[11px] font-[550] text-ink2")}>{clock}</span> : null}
      </div>
    );
  }
  const extra = clock || `${t.left} ${fmtRemain(m.pct)}`;
  return (
    <div className="mt-1.5 min-w-0 first:mt-0">
      <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{m.label}</span>
        <span className={`${num} shrink-0 text-[12px] font-bold text-ink`}>{fmtPct(m.pct)}</span>
      </div>
      <div className={cn(barTrack, "h-[5px]")}>
        <div className={barFill} style={barStyle(m.pct, pal)} />
      </div>
      <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{extra}</div>
    </div>
  );
}

function Row({ m, pal, t, nowMs }: { m: Metric; pal: (typeof PALETTES)[ThemeName]; t: T; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        </div>
        <div className={cn(num, "text-[15px] font-bold")}>{m.sub || "--"}</div>
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
      <div className="mt-[5px] text-[11.5px] leading-tight text-ink3">
        <span>{t.left} {fmtRemain(m.pct)}</span>
        {clock ? <span className={cn(num, "font-[550] text-ink2")}> · {t.resetIn} {clock}</span> : null}
      </div>
    </div>
  );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function GptBoardCard({
  metrics: metricsProp,
  label,
  title,
  ok,
  error,
  t,
  pal,
  nowMs,
  size,
  onOpen,
}: {
  metrics?: Metric[];
  label: string;
  title: string;
  ok: boolean;
  error: string | null;
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
        <GptHeader label={label} title={title} compact={isCompact} ok={ok} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{error || t.noData}</div>
        </div>
      </div>
    );
  }

  if (ns === "sm" || ns === "sw") {
    const isWeek = ns === "sw";
    const single = isWeek ? metrics[1] || metrics[0] : metrics[0];
    const clock = single?.countdownAt ? fmtCountdown(single.countdownAt, nowMs) : null;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            <img className="size-[23px] object-contain" src={PROVIDER_ICON.gpt} alt="gpt" draggable={false} />
          </div>
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {single ? (
            <>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{single.label}</div>
              <div className={cn(num, "mt-1 text-[18px] font-[800] leading-none")}>{single.pct != null ? fmtPct(single.pct) : "--"}</div>
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
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <GptHeader label={label} title={title} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-0 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-0 overflow-hidden">
            {metrics.slice(0, 2).map((m, i) => (
              <CompactRow key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
            ))}
          </div>
        </button>
      </div>
    );
  }

  if (ns === "lg") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <GptHeader label={label} title={title} ok={ok} onOpen={onOpen} />
        <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 2).map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <GptHeader label={label} title={title} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-2 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 2).map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <GptHeader label={label} title={title} ok={ok} onOpen={onOpen} />
      <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-1 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        {metrics.slice(0, 2).map((m, i) => (
          <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
        ))}
      </button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

function remainLine(t: T, pct: number | null | undefined, resetsAt?: string | null): string | null {
  if (pct == null) return null;
  const parts: string[] = [`${t.left} ${fmtRemain(pct)}`];
  if (resetsAt) parts.push(`${t.resetPrefix}${fmtWhen(resetsAt)}`);
  return parts.join("  ·  ");
}

export function GptDetail({
  account,
  updatedAt,
  t,
  pal,
  nowMs,
}: {
  account: GptAccount;
  updatedAt: string;
  t: T;
  pal: (typeof PALETTES)[ThemeName];
  nowMs: number;
}) {
  const resetAt = account.session_resets_at || account.weekly_resets_at;
  return (
    <>
      <div className="grid w-full overflow-hidden rounded-2xl border border-edge bg-edge [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-px">
        <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
          <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.updated}</span>
          <span className={`${num} overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]`}>{fmtWhen(updatedAt)}</span>
        </div>
        {account.plan ? (
          <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
            <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.plan}</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]">{account.plan}</span>
          </div>
        ) : null}
      </div>
      <div className={metricsGrid}>
        {account.session_percent != null ? (
          <div className={metricCard}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-ink2">{t.window5h}</span>
              <span className={`${num} text-[22px] font-[750]`}>{fmtPct(account.session_percent)}</span>
            </div>
            <div className={`${barTrack} h-[9px]`}>
              <div className={barFill} style={barStyle(account.session_percent, pal)} />
            </div>
            <div className="mt-2.5 text-[12.5px] text-ink3">{remainLine(t, account.session_percent, account.session_resets_at)}</div>
            {account.session_resets_at ? <div className={cn(num, "mt-1 text-[12.5px] font-[550] text-ink2")}>{t.resetIn} {fmtCountdown(account.session_resets_at, nowMs) || fmtWhen(account.session_resets_at)}</div> : null}
          </div>
        ) : (
          <div className={metricCard}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-ink2">{t.resetIn}</span>
              <span className={`${num} text-[22px] font-[750]`}>{fmtCountdown(resetAt, nowMs) || "--"}</span>
            </div>
          </div>
        )}
        <div className={metricCard}>
          <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="text-ink2">{t.weekLimit}</span>
            {account.weekly_percent != null ? <span className={`${num} text-[22px] font-[750]`}>{fmtPct(account.weekly_percent)}</span> : null}
          </div>
          {account.weekly_percent != null ? (
            <div className={`${barTrack} h-[9px]`}>
              <div className={barFill} style={barStyle(account.weekly_percent, pal)} />
            </div>
          ) : null}
          <div className="mt-2.5 text-[12.5px] text-ink3">{remainLine(t, account.weekly_percent, account.weekly_resets_at) || t.noData}</div>
        </div>
      </div>
    </>
  );
}
