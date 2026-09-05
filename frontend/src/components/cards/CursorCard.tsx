import { cn } from "../../cn";
import type { CursorAccount } from "../../api/types";
import type { Metric } from "../../pages/display/types";
import { barColor, barGlow, clamp, fmtCountdown, fmtPct, fmtRemain, fmtUsd, fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON, type ResolvedThemeName, PALETTES } from "../../theme";
import { barFill, barTrack, cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Dados ──────────────────────────────────────────────────────────── */

export function getCursorMetrics(c: CursorAccount, t: T): Metric[] {
  const ondemandBits: string[] = [];
  if (c.used_cents != null && c.limit_cents != null) ondemandBits.push(`${fmtUsd(c.used_cents)} / ${fmtUsd(c.limit_cents)}`);
  else if (c.used_cents != null) ondemandBits.push(`${t.used} ${fmtUsd(c.used_cents)}`);
  else if (c.limit_cents != null) ondemandBits.push(`${t.cap} ${fmtUsd(c.limit_cents)}`);
  if (c.remaining_cents != null) ondemandBits.push(`${t.left} ${fmtUsd(c.remaining_cents)}`);
  if ((c.bonus_cents || 0) > 0) ondemandBits.push(`${t.bonusPrefix}${fmtUsd(c.bonus_cents)}`);
  const ondemand = ondemandBits.join(" · ") || null;

  const out: Metric[] = [];
  if (c.percent != null || c.cycle_end) {
    out.push({ label: t.cursorModels, pct: c.percent, sub: t.remainingPrefix + (c.percent != null ? fmtRemain(c.percent) : ""), countdownAt: c.cycle_end });
  }
  if (c.other_percent != null) {
    out.push({ label: t.otherModels, pct: c.other_percent, sub: t.remainingPrefix + fmtRemain(c.other_percent) });
  }
  if (ondemand) {
    out.push({ label: t.ondemand, pct: null, sub: ondemand });
  }
  if (!out.length) out.push({ label: t.cursorModels, pct: null, sub: t.noData });
  return out;
}

export function cursorAllowedSizes(_c: CursorAccount | null, _metrics?: Metric[]): CardSize[] {
  return ["sm", "sw", "sx", "md", "lg", "free"];
}

export const CURSOR_ALLOWED_ALL: CardSize[] = ["sm", "sw", "sx", "md", "lg"];

export function cursorSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return `Pequeno · ${t.cursorModels}`; // Cursor
  if (s === "sw") return `Pequeno · ${t.otherModels}`; // Outros
  if (s === "sx") return `Pequeno · ${t.ondemand}`; // On-demand
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  if (s === "free") return t.cardFree;
  return t.cardXl;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function barStyle(pct: number, pal: (typeof PALETTES)[ResolvedThemeName]) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
}

function Icon({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-3.5 object-contain" src={PROVIDER_ICON.cursor} alt="cursor" draggable={false} />
      </div>
    );
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-[23px] object-contain" src={PROVIDER_ICON.cursor} alt="cursor" draggable={false} />
    </div>
  );
}

function CursorHeader({ label, compact, ok, title, onOpen }: { label: string; compact?: boolean; ok: boolean; title: string; onOpen?: () => void }) {
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

function CompactRow({ m, pal, t, nowMs }: { m: Metric; pal: (typeof PALETTES)[ResolvedThemeName]; t: T; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    const display = m.sub || "--";
    return (
      <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{m.label}</span>
        <span className={cn(num, "min-w-0 text-[13px] font-bold leading-tight [overflow-wrap:anywhere]")}>{display}</span>
        {clock ? <span className={cn(num, "text-[11px] font-[550] text-ink2")}>{t.resetIn} {clock}</span> : null}
      </div>
    );
  }
  const extra = clock ? `${t.resetIn} ${clock}` : `${t.left} ${fmtRemain(m.pct)}`;
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

function Row({ m, pal, t, nowMs }: { m: Metric; pal: (typeof PALETTES)[ResolvedThemeName]; t: T; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        </div>
        <div className={cn(num, "text-[13px] font-bold leading-tight [overflow-wrap:anywhere]")}>{m.sub || "--"}</div>
        {clock ? <div className={cn(num, "mt-1 text-[11px] font-[550] text-ink2")}>{t.resetIn} {clock}</div> : null}
      </div>
    );
  }
  const pctText = fmtPct(m.pct);
  const footerClock = clock ? `${t.resetIn} ${clock}` : null;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        <span className={`${num} shrink-0 text-sm font-bold`}>{pctText}</span>
      </div>
      <div className={barTrack}>
        <div className={barFill} style={barStyle(m.pct, pal)} />
      </div>
      <div className="mt-[5px] text-[11.5px] leading-tight text-ink3">
        <span>{t.left} {fmtRemain(m.pct)}</span>
        {footerClock ? <span className={cn(num, "font-[550] text-ink2")}> · {footerClock}</span> : null}
      </div>
    </div>
  );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function CursorBoardCard({
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
  pal: (typeof PALETTES)[ResolvedThemeName];
  nowMs?: number;
  size: CardSize;
  onOpen: () => void;
}) {
  const metrics = metricsProp ?? [];
  const ns = normalizeSize(size);
  const isCompact = ns === "sm" || ns === "sw" || ns === "sx";

  if (!ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CursorHeader label={label} title={title} compact={isCompact} ok={ok} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{error || t.noData}</div>
        </div>
      </div>
    );
  }

  if (ns === "sm" || ns === "sw" || ns === "sx") {
    let single: Metric | undefined;
    if (ns === "sm") single = metrics[0];
    else if (ns === "sw") single = metrics[1] || metrics[0];
    else if (ns === "sx") single = metrics[2] || metrics[0];
    const clock = single?.countdownAt ? fmtCountdown(single.countdownAt, nowMs) : null;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            <img className="size-[23px] object-contain" src={PROVIDER_ICON.cursor} alt="cursor" draggable={false} />
          </div>
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {single ? (
            <>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{single.label}</div>
              <div className={cn(num, "mt-1 text-[14px] font-[800] leading-tight [overflow-wrap:anywhere]")}>{single.pct != null ? fmtPct(single.pct) : single.sub || "--"}</div>
              {single.pct != null ? (
                <div className={cn(barTrack, "mt-1 h-[4px]")}>
                  <div className={barFill} style={barStyle(single.pct, pal)} />
                </div>
              ) : null}
              <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-[550] leading-none text-ink2")}>{clock || (single.pct != null ? `${t.left} ${fmtRemain(single.pct)}` : "")}</div>
            </>
          ) : null}
        </button>
      </div>
    );
  }

  if (ns === "md") {
    const shown = metrics.slice(0, 2);
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CursorHeader label={label} title={title} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-0 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-0 overflow-hidden">
            {shown.map((m, i) => (
              <CompactRow key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
            ))}
          </div>
        </button>
      </div>
    );
  }

  if (ns === "lg") {
    const shown = metrics.slice(0, 2);
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CursorHeader label={label} title={title} ok={ok} onOpen={onOpen} />
        <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {shown.map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
        {metrics[2] ? (
          <div className="mt-2 flex">
            <span className="inline-flex max-w-full items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink3">
              {metrics[2].label} <span className="font-bold text-ink">{metrics[2].sub}</span>
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CursorHeader label={label} title={title} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-2 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 3).map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  // xl/wxl ocultos mas mantém fallback
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CursorHeader label={label} title={title} ok={ok} onOpen={onOpen} />
      <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-1 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        {metrics.slice(0, 3).map((m, i) => (
          <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
        ))}
      </button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

function joinParts(...parts: Array<string | null | undefined>): string | null {
  const out = parts.filter((p): p is string => Boolean(p && p.trim()));
  return out.length ? out.join("  ·  ") : null;
}

export function CursorDetail({
  account,
  updatedAt,
  t,
  pal,
  nowMs,
}: {
  account: CursorAccount;
  updatedAt: string;
  t: T;
  pal: (typeof PALETTES)[ResolvedThemeName];
  nowMs: number;
}) {
  const ondemandBits: string[] = [];
  if (account.used_cents != null && account.limit_cents != null) ondemandBits.push(`${fmtUsd(account.used_cents)} / ${fmtUsd(account.limit_cents)}`);
  else if (account.used_cents != null) ondemandBits.push(`${t.used} ${fmtUsd(account.used_cents)}`);
  else if (account.limit_cents != null) ondemandBits.push(`${t.cap} ${fmtUsd(account.limit_cents)}`);
  if (account.remaining_cents != null) ondemandBits.push(`${t.left} ${fmtUsd(account.remaining_cents)}`);
  if ((account.bonus_cents || 0) > 0) ondemandBits.push(`${t.bonusPrefix}${fmtUsd(account.bonus_cents)}`);
  const cycleClock = fmtCountdown(account.cycle_end, nowMs);

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
        {cycleClock ? (
          <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
            <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.cycle}</span>
            <span className={`${num} text-[15px] font-[650]`}>{t.resetIn} {cycleClock}</span>
          </div>
        ) : account.cycle_end ? (
          <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
            <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.cycle}</span>
            <span className={`${num} text-[15px] font-[650]`}>{fmtWhen(account.cycle_end)}</span>
          </div>
        ) : null}
      </div>
      <div className={metricsGrid}>
        <div className={metricCard}>
          <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="text-ink2">{t.cursorModels}</span>
            {account.percent != null ? <span className={`${num} text-[22px] font-[750]`}>{fmtPct(account.percent)}</span> : null}
          </div>
          {account.percent != null ? (
            <div className={`${barTrack} h-[9px]`}>
              <div className={barFill} style={barStyle(account.percent, pal)} />
            </div>
          ) : null}
          <div className="mt-2.5 text-[12.5px] text-ink3">{account.percent != null ? `${t.left} ${fmtRemain(account.percent)}` : t.noData}</div>
          {cycleClock ? <div className={cn(num, "mt-1 text-[12.5px] font-[550] text-ink2")}>{t.resetIn} {cycleClock}</div> : null}
        </div>
        {account.other_percent != null ? (
          <div className={metricCard}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-ink2">{t.otherModels}</span>
              <span className={`${num} text-[22px] font-[750]`}>{fmtPct(account.other_percent)}</span>
            </div>
            <div className={`${barTrack} h-[9px]`}>
              <div className={barFill} style={barStyle(account.other_percent, pal)} />
            </div>
            <div className="mt-2.5 text-[12.5px] text-ink3">{t.left} {fmtRemain(account.other_percent)}</div>
          </div>
        ) : null}
        {(account.used_cents != null || account.limit_cents != null || account.remaining_cents != null) ? (
          <div className={metricCard}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-ink2">{t.ondemand}</span>
              {account.used_cents != null ? <span className={`${num} text-[18px] font-[750]`}>{fmtUsd(account.used_cents)}</span> : null}
            </div>
            {account.used_cents != null && account.limit_cents != null && account.limit_cents > 0 ? (
              <div className={`${barTrack} h-[9px]`}>
                <div className={barFill} style={{ width: `${clamp((account.used_cents / account.limit_cents) * 100, 0, 100)}%`, background: barColor((account.used_cents / account.limit_cents) * 100, pal) } as any} />
              </div>
            ) : null}
            <div className="mt-2.5 text-[12.5px] text-ink3">{joinParts(account.limit_cents != null ? `${t.cap} ${fmtUsd(account.limit_cents)}` : null, account.remaining_cents != null ? `${t.left} ${fmtUsd(account.remaining_cents)}` : null, (account.bonus_cents || 0) > 0 ? `${t.bonus} ${fmtUsd(account.bonus_cents)}` : null)}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}
