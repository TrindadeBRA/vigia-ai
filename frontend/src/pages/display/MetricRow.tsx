import { cn } from "../../cn";
import { CheckIcon } from "../../components/icons";
import { barColor, barGlow, clamp, fmtCountdown, fmtPct, fmtRemain } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { barFill, barTrack, iconChip, iconImg, num } from "../../tw";
import type { Metric, Pal } from "./types";

export function Badge({ secs, total, showCheck, pal, onClick }: { secs: number; total: number; showCheck: boolean; pal: Pal; onClick?: () => void }) {
  const pct = showCheck ? 100 : clamp(((total - secs) / total) * 100, 0, 100);
  const ringColor = showCheck ? pal.good : "var(--accent)";
  const inner = (
    <div className="flex size-full items-center justify-center rounded-full bg-canvas text-[11px] font-bold text-ink">
      {showCheck ? <CheckIcon size={14} /> : <span className={num}>{Math.min(99, secs)}</span>}
    </div>
  );
  const style = { background: `conic-gradient(${ringColor} ${pct}%, var(--track) 0)` };
  const ring = "ml-0.5 size-[30px] shrink-0 rounded-full p-[3px]";
  if (onClick) {
    return (
      <button className={`${ring} cursor-pointer border-0 bg-clip-padding transition-transform duration-100 hover:scale-110 active:scale-95`} style={style} onClick={onClick} title="Atualizar agora" aria-label="Atualizar agora">
        {inner}
      </button>
    );
  }
  return (
    <div className={ring} style={style}>
      {inner}
    </div>
  );
}

export function barFillStyle(pct: number, pal: Pal) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
}

export function shortMetricLabel(label: string, t: T): string {
  if (label === t.accountCredits) return t.credits;
  if (label === t.weekLimit) return t.week;
  if (label === t.resetIn) return t.reset;
  if (label === t.session5h) return "5h";
  if (label === t.monthLimit) return t.monthLimit.split(/\s+/).pop() || label;
  if (label === t.cursorModels) return "Cursor";
  if (label === t.otherModels) return t.otherModels.split(/\s+/)[0] || label;
  return label;
}

export function compactMoney(sub: string | null, t: T): string | null {
  if (!sub) return null;
  if (sub === t.noCredits) return "—";
  if (sub.startsWith(t.remainMoney)) return sub.slice(t.remainMoney.length).trim();
  if (sub.startsWith("$")) return sub;
  return null;
}

export function MetricRow({ label, pct, sub, pal, compact, countdownAt, nowMs, t, value }: Metric & { pal: Pal; compact?: boolean; nowMs?: number; t: T }) {
  const clock = countdownAt ? fmtCountdown(countdownAt, nowMs) : null;
  const name = compact ? shortMetricLabel(label, t) : label;
  const pctText = pct != null ? fmtPct(pct) : null;
  const remainText = pct != null ? fmtRemain(pct) : null;

  if (pct == null) {
    const money = compact ? (value || compactMoney(sub, t)) : (value || sub);
    const display = clock || money || sub || "--";
    const clockLine = clock ? `${t.resetIn} ${clock}` : null;
    // GPT free (e similares): o rótulo já é "Reset em" e o valor grande já é o
    // cronômetro — não repetir "Reset em 28d …" na mesma linha, senão os dois
    // textos se sobrepõem no card em tamanho real.
    const labelIsReset = name === t.resetIn || name === t.reset;
    const showHeaderClock = Boolean(clock && display !== clock && !labelIsReset);
    const showClockBelow = Boolean(clock && display !== clock && !showHeaderClock);
    const showSub = Boolean(sub && sub !== display && sub !== clock && sub !== clockLine && !showClockBelow);
    if (compact) {
      return (
        <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{name}</span>
          <span className={cn(num, "min-w-0 text-[15px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere]")}>{display}</span>
          {showClockBelow ? <span className={cn(num, "overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{clockLine}</span> : null}
          {showSub ? <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{sub}</span> : null}
        </div>
      );
    }
    return (
      <div className="mt-3 first:mt-0">
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{name}</span>
          {showHeaderClock ? <span className={cn(num, "shrink-0 text-[12px] font-[550] text-ink2")}>{clockLine}</span> : null}
        </div>
        <div className={cn(num, "text-[15px] font-bold")}>{display}</div>
        {showSub ? <div className="mt-1 text-[11.5px] leading-snug text-ink3">{sub}</div> : null}
        {showClockBelow ? <div className={cn(num, "mt-1 text-[11.5px] font-[550] text-ink2")}>{clockLine}</div> : null}
      </div>
    );
  }

  const headerValue = value ? `${pctText} · ${value}` : pctText;
  const footerRemain = remainText ? `${t.left} ${remainText}` : null;
  const footerClock = clock ? `${t.resetIn} ${clock}` : null;
  const footerSub = sub && sub !== footerRemain ? sub : null;
  const footerParts = [footerRemain, footerClock, footerSub].filter(Boolean) as string[];

  if (compact) {
    const compactExtra = clock ? `${t.resetIn} ${clock}` : value ? value : footerRemain || sub;
    const compactSecondLine = value && clock ? value : null;
    return (
      <div className="mt-1.5 min-w-0 first:mt-0">
        <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{name}</span>
          <span className={`${num} shrink-0 text-[12px] font-bold text-ink`}>{pctText}</span>
        </div>
        <div className={cn(barTrack, "h-[5px]")}>
          <div className={barFill} style={barFillStyle(pct, pal)} />
        </div>
        {compactExtra ? <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{compactExtra}</div> : null}
        {compactSecondLine ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none text-ink3">{compactSecondLine}</div> : null}
        {footerSub && !clock && !value ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none text-ink3">{footerSub}</div> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{name}</span>
        <span className={`${num} shrink-0 text-sm font-bold`}>{headerValue}</span>
      </div>
      <div className={barTrack}>
        <div className={barFill} style={barFillStyle(pct, pal)} />
      </div>
      {footerParts.length ? (
        <div className="mt-[5px] flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11.5px] leading-tight text-ink3">
          {footerParts.map((part, i) => (
            <span key={i} className={cn(i === 1 && footerClock ? "font-[550] text-ink2" : "", i === 1 && footerClock ? num : "")}>{part}{i < footerParts.length - 1 ? " ·" : ""}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Icon({ id, large, compact }: { id: string; large?: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-3.5 object-contain" src={PROVIDER_ICON[id]} alt={id} draggable={false} />
      </div>
    );
  }
  return (
    <div className={large ? "flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]" : iconChip}>
      <img className={large ? "size-[23px] object-contain" : iconImg} src={PROVIDER_ICON[id]} alt={id} draggable={false} />
    </div>
  );
}
