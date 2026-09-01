import { useEffect, useRef, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, closestCorners, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { fetchHealth, fetchUsage, openUsageEvents } from "../api/client";
import type { ClaudeAccount, CreditsAccount, CursorAccount, GptAccount, OpenCodeAccount, UsagePayload } from "../api/types";
import { Skeleton } from "../components/Skeleton";
import { Logo } from "../components/Logo";
import { CheckIcon, ChipIcon, ClockIcon, CloseIcon, GitHubIcon, GridIcon, GripIcon, MenuIcon, PaletteIcon, SettingsIcon, SlidersIcon } from "../components/icons";
import { cn } from "../cn";
import { FETCH_OK_FLASH_MS, FRESH_PAYLOAD_MS, POLL_MS, barColor, barGlow, clamp, countdownSecs, fmtClock, fmtCountdown, fmtPct, fmtRemain, fmtUsd, fmtWhen, nextFetchAtMs, payloadAgeMs } from "../format";
import { STR, WEEKDAYS, type Lang, type T } from "../i18n";
import { ACCENTS, PALETTES, PROVIDER_ICON, applyThemeVars, inverseOn, type ThemeName } from "../theme";
import { accentLink, barFill, barTrack, cardLabel, emptyNote, errorText, iconBtn, iconChip, iconImg, metricCard, metricsGrid, num, overviewBoard, shell, sideItem, sideItemActive, viewFade } from "../tw";
import type { ConfigOutlet } from "./config/ConfigPage";
import { CELL_GAP, colsForWidth, displayBoard, dropTarget, emptyBoard, emptyCells, packBoard, padRowsForHeight, placeCard, rowPxFor, sameBoard, setCardSize, slotKey, spanFor, syncBoard, type BoardLayout, type CardSize } from "../board";

const boardCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

type Prefs = { theme: ThemeName; accent: number; lang: Lang; board?: BoardLayout };
type Pal = (typeof PALETTES)[ThemeName];
type Metric = { label: string; pct: number | null; sub: string | null; countdownAt?: string | null; value?: string | null };
type ProviderMeta = {
  id: string;
  provider: string;
  ok: boolean;
  error: string | null;
  title: string;
  label: string;
  metrics: Metric[];
};

function usePrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void] {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      const raw = localStorage.getItem("vigia_display_prefs");
      if (raw) return { theme: "dark", accent: 0, lang: "pt", ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { theme: "dark", accent: 0, lang: "pt" };
  });
  useEffect(() => {
    try {
      localStorage.setItem("vigia_display_prefs", JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);
  return [prefs, (fn) => setPrefs(fn)];
}

function Badge({ secs, total, showCheck, pal, onClick }: { secs: number; total: number; showCheck: boolean; pal: Pal; onClick?: () => void }) {
  const pct = showCheck ? 100 : clamp(((total - secs) / total) * 100, 0, 100);
  const ringColor = showCheck ? pal.good : "var(--accent)";
  const inner = (
    <div className="flex size-full items-center justify-center rounded-full bg-canvas text-[10px] font-bold text-ink">
      {showCheck ? <CheckIcon size={12} /> : <span className={num}>{Math.min(99, secs)}</span>}
    </div>
  );
  const style = { background: `conic-gradient(${ringColor} ${pct}%, var(--track) 0)` };
  const ring = "ml-0.5 size-[26px] shrink-0 rounded-full p-[3px]";
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

function barFillStyle(pct: number, pal: Pal) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
}

function shortMetricLabel(label: string, t: T): string {
  if (label === t.accountCredits) return t.credits;
  if (label === t.weekLimit) return t.week;
  if (label === t.resetIn) return t.reset;
  if (label === t.session5h) return "5h";
  if (label === t.monthLimit) return t.monthLimit.split(/\s+/).pop() || label;
  if (label === t.cursorModels) return "Cursor";
  if (label === t.otherModels) return t.otherModels.split(/\s+/)[0] || label;
  return label;
}

function compactMoney(sub: string | null, t: T): string | null {
  if (!sub) return null;
  if (sub === t.noCredits) return "—";
  if (sub.startsWith(t.remainMoney)) return sub.slice(t.remainMoney.length).trim();
  if (sub.startsWith("$")) return sub;
  return null;
}

function MetricRow({ label, pct, sub, pal, compact, countdownAt, nowMs, t, value }: Metric & { pal: Pal; compact?: boolean; nowMs?: number; t: T }) {
  const clock = countdownAt ? fmtCountdown(countdownAt, nowMs) : null;
  const name = compact ? shortMetricLabel(label, t) : label;
  if (pct == null) {
    const money = compact ? (value || compactMoney(sub, t)) : (value || sub);
    const display = clock || money || sub || "--";
    if (compact) {
      return (
        <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{name}</span>
          <span className={cn(num, "min-w-0 text-[15px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere]")}>{display}</span>
        </div>
      );
    }
    return (
      <div className="mt-3 first:mt-0">
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{name}</span>
        </div>
        <div className={cn(num, "text-[15px] font-bold")}>{display}</div>
      </div>
    );
  }
  if (compact) {
    const extra = countdownAt ? clock : value || compactMoney(sub, t);
    return (
      <div className="mt-1.5 min-w-0 first:mt-0">
        <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{name}</span>
          <span className={`${num} shrink-0 text-[12px] font-bold text-ink`}>{fmtPct(pct)}</span>
        </div>
        <div className={cn(barTrack, "h-[5px]")}>
          <div className={barFill} style={barFillStyle(pct, pal)} />
        </div>
        {extra ? <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-[550] text-ink2")}>{extra}</div> : null}
      </div>
    );
  }
  const largeClock = clock;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{label}</span>
        <span className={`${num} shrink-0 text-sm font-bold`}>{value || fmtPct(pct)}</span>
      </div>
      <div className={barTrack}>
        <div className={barFill} style={barFillStyle(pct, pal)} />
      </div>
      {largeClock ? (
        <div className={cn(num, "mt-[5px] text-[12.5px] font-[550] text-ink2")}>
          {t.resetIn} {largeClock}
        </div>
      ) : sub ? (
        <div className="mt-[5px] text-[11.5px] text-ink3">{sub}</div>
      ) : null}
    </div>
  );
}

function creditsMetric(
  t: T,
  acc: { percent: number | null; remaining_cents: number | null; used_cents: number | null; limit_cents: number | null },
): Metric {
  const bits: string[] = [];
  if (acc.used_cents != null) bits.push(`${t.used} ${fmtUsd(acc.used_cents)}`);
  if (acc.limit_cents != null) bits.push(`${t.cap} ${fmtUsd(acc.limit_cents)}`);
  return {
    label: t.credits,
    pct: acc.percent,
    value: acc.remaining_cents != null ? fmtUsd(acc.remaining_cents) : null,
    sub: bits.length ? bits.join(" · ") : acc.remaining_cents != null ? t.remainMoney + fmtUsd(acc.remaining_cents) : t.noCredits,
  };
}

function Icon({ id, large, compact }: { id: string; large?: boolean; compact?: boolean }) {
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

function gptSessionMetric(g: GptAccount, t: T, nowMs: number): Metric {
  if (g.session_percent != null) {
    return {
      label: t.session5h,
      pct: g.session_percent,
      sub: t.remainingPrefix + fmtRemain(g.session_percent) + (g.session_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(g.session_resets_at)}` : ""),
    };
  }
  const until = g.session_resets_at || g.weekly_resets_at;
  return { label: t.resetIn, pct: null, sub: fmtCountdown(until, nowMs), countdownAt: until };
}

function buildProviders(data: UsagePayload, t: T, nowMs = Date.now()): ProviderMeta[] {
  const list: ProviderMeta[] = [];
  for (const c of data.claude || []) {
    list.push({
      id: `claude:${c.id}`,
      provider: "claude",
      ok: c.ok,
      error: c.error,
      title: "Claude",
      label: c.label || "",
      metrics: [
        {
          label: t.session5h,
          pct: c.session_percent,
          sub: c.session_percent != null ? t.remainingPrefix + fmtRemain(c.session_percent) : null,
          countdownAt: c.session_resets_at,
        },
        {
          label: t.weekLimit,
          pct: c.weekly_percent,
          sub: c.weekly_percent != null ? t.remainingPrefix + fmtRemain(c.weekly_percent) + (c.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.weekly_resets_at)}` : "") : null,
        },
      ],
    });
  }
  for (const g of data.gpt || []) {
    list.push({
      id: `gpt:${g.id}`,
      provider: "gpt",
      ok: g.ok,
      error: g.error,
      title: g.plan ? `GPT ${g.plan}` : "GPT",
      label: g.label || "",
      metrics: [
        gptSessionMetric(g, t, nowMs),
        {
          label: t.weekLimit,
          pct: g.weekly_percent,
          sub: g.weekly_percent != null ? t.remainingPrefix + fmtRemain(g.weekly_percent) + (g.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(g.weekly_resets_at)}` : "") : null,
        },
      ],
    });
  }
  for (const c of data.cursor || []) {
    let ondemand = "";
    if (c.used_cents != null && c.limit_cents != null) ondemand = `${fmtUsd(c.used_cents)} / ${fmtUsd(c.limit_cents)}`;
    if ((c.bonus_cents || 0) > 0) ondemand += (ondemand ? "  " : "") + t.bonusPrefix + fmtUsd(c.bonus_cents);
    list.push({
      id: `cursor:${c.id}`,
      provider: "cursor",
      ok: c.ok,
      error: c.error,
      title: c.plan ? `Cursor ${c.plan}` : "Cursor",
      label: c.label || "",
      metrics: [
        { label: t.cursorModels, pct: c.percent, sub: c.cycle_end ? t.resetPrefix + fmtWhen(c.cycle_end) : null, countdownAt: c.cycle_end },
        { label: t.otherModels, pct: c.other_percent, sub: ondemand || null },
      ],
    });
  }
  for (const o of data.openrouter || []) {
    list.push({
      id: `openrouter:${o.id}`,
      provider: "openrouter",
      ok: o.ok,
      error: o.error,
      title: "OpenRouter",
      label: o.label || "",
      metrics: [creditsMetric(t, o)],
    });
  }
  for (const d of data.deepseek || []) {
    list.push({
      id: `deepseek:${d.id}`,
      provider: "deepseek",
      ok: d.ok,
      error: d.error,
      title: "DeepSeek",
      label: d.label || "",
      metrics: [creditsMetric(t, d)],
    });
  }
  for (const o of data.opencode || []) {
    const metrics: Metric[] = [];
    if (o.rolling_percent != null) {
      metrics.push({
        label: t.rolling,
        pct: o.rolling_percent,
        sub: t.remainingPrefix + fmtRemain(o.rolling_percent) + (o.rolling_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(o.rolling_resets_at)}` : ""),
      });
    }
    if (o.weekly_percent != null) {
      metrics.push({
        label: t.weekLimit,
        pct: o.weekly_percent,
        sub: t.remainingPrefix + fmtRemain(o.weekly_percent) + (o.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(o.weekly_resets_at)}` : ""),
      });
    }
    if (o.monthly_percent != null) {
      metrics.push({
        label: t.monthLimit,
        pct: o.monthly_percent,
        sub: t.remainingPrefix + fmtRemain(o.monthly_percent) + (o.monthly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(o.monthly_resets_at)}` : ""),
      });
    }
    if (o.remaining_cents != null) {
      metrics.push({
        label: t.accountCredits,
        pct: null,
        sub: t.remainMoney + fmtUsd(o.remaining_cents),
      });
    }
    list.push({
      id: `opencode:${o.id}`,
      provider: "opencode",
      ok: o.ok,
      error: o.error,
      title: "OpenCode",
      label: o.label || "",
      metrics,
    });
  }
  for (const f of data.fal || []) {
    list.push({
      id: `fal:${f.id}`,
      provider: "fal",
      ok: f.ok,
      error: f.error,
      title: "fal.ai",
      label: f.label || "",
      metrics: [creditsMetric(t, f)],
    });
  }
  return list;
}

function SizeToggle({ size, t, onChange }: { size: CardSize; t: T; onChange: (next: CardSize) => void }) {
  const next = size === "sm" ? "lg" : "sm";
  const label = next === "lg" ? t.cardLarge : t.cardSmall;
  return (
    <button
      type="button"
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink3 transition-colors duration-150 hover:bg-chip hover:text-ink"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(next);
      }}
    >
      {size === "sm" ? (
        <span className="block size-[7px] rounded-[2px] border-[1.5px] border-current" />
      ) : (
        <span className="grid size-[11px] grid-cols-2 gap-px">
          <span className="rounded-[1px] border-[1.4px] border-current" />
          <span className="rounded-[1px] border-[1.4px] border-current" />
          <span className="rounded-[1px] border-[1.4px] border-current" />
          <span className="rounded-[1px] border-[1.4px] border-current" />
        </span>
      )}
    </button>
  );
}

function ProviderCard({
  p,
  pal,
  size,
  dragging,
  lifted,
  t,
  nowMs,
  grip,
  onOpen,
  onSetSize,
}: {
  p: ProviderMeta;
  pal: Pal;
  size: CardSize;
  dragging?: boolean;
  lifted?: boolean;
  t: T;
  nowMs?: number;
  grip?: object;
  onOpen: () => void;
  onSetSize: (next: CardSize) => void;
}) {
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "group/tile relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border bg-panel shadow-card",
        sm ? "px-3 pb-2.5 pt-2.5" : "px-3.5 pb-3 pt-3",
        lifted && "border-accent shadow-card-hover rotate-[1.5deg] cursor-grabbing",
        dragging && !lifted && "border-dashed border-edge opacity-35",
        !dragging && !lifted && "border-edge transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover",
        "[.flat_&]:shadow-none [.flat_&]:hover:translate-y-0 [.flat_&]:rotate-0",
        !lifted && viewFade,
      )}
    >
      {!lifted ? (
      <div
        className={cn(
          "absolute right-1 top-1 z-[3] flex items-center rounded-lg border border-edge bg-chip",
          "opacity-0 pointer-events-none transition-opacity duration-150 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100",
          "max-[860px]:pointer-events-auto max-[860px]:opacity-100",
        )}
      >
        <button
          type="button"
          className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink3 touch-none hover:bg-chip hover:text-ink active:cursor-grabbing"
          aria-label={t.dragCard}
          title={t.dragCard}
          {...grip}
        >
          <GripIcon size={14} />
        </button>
        <SizeToggle size={size} t={t} onChange={onSetSize} />
      </div>
      ) : null}
      <button type="button" className={cn("flex min-w-0 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-ink", sm ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")} onClick={onOpen}>
        <div className="relative shrink-0">
          <Icon id={p.provider} compact={sm} large={!sm} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", p.ok ? "bg-good" : "bg-bad")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", sm ? "text-[12.5px]" : "text-[14px]")}>{p.title}</div>
          {p.label ? <div className={cardLabel}>{p.label}</div> : null}
        </div>
      </button>
      <button
        type="button"
        className={cn(
          "flex min-h-0 flex-1 cursor-pointer flex-col overflow-hidden border-0 bg-transparent p-0 text-left text-ink",
          sm ? "justify-center gap-0" : p.metrics.length > 1 ? "justify-evenly" : "justify-center",
        )}
        onClick={onOpen}
      >
        {!p.ok ? (
          <div className={cn(errorText, sm && "text-[11px] leading-snug")}>{p.error || ""}</div>
        ) : (
          (sm ? p.metrics.slice(0, 2) : p.metrics).map((m, i) => (
            <MetricRow key={i} {...m} pal={pal} compact={sm} nowMs={nowMs} t={t} />
          ))
        )}
      </button>
    </div>
  );
}

function EmptySlot({ id, active }: { id: string; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full min-h-0 rounded-2xl border border-dashed transition-colors duration-150",
        active ? "border-edge bg-chip/30" : "border-transparent",
        isOver && "border-accent bg-chip",
      )}
    />
  );
}

function BoardTile({
  p,
  pal,
  size,
  t,
  nowMs,
  col,
  row,
  span,
  onOpen,
  onSetSize,
}: {
  p: ProviderMeta;
  pal: Pal;
  size: CardSize;
  t: T;
  nowMs: number;
  col: number;
  row: number;
  span: number;
  onOpen: () => void;
  onSetSize: (next: CardSize) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: p.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: p.id });
  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={{ gridColumn: `${col + 1} / span ${span}`, gridRow: `${row + 1} / span ${span}`, zIndex: isDragging ? 2 : 1 }}
      className="min-h-0 min-w-0 h-full"
    >
      <ProviderCard
        p={p}
        pal={pal}
        size={size}
        t={t}
        nowMs={nowMs}
        dragging={isDragging}
        grip={{ ...attributes, ...listeners }}
        onOpen={onOpen}
        onSetSize={onSetSize}
      />
    </div>
  );
}

function Sidebar(props: {
  providers: ProviderMeta[];
  section: string;
  selectedId: string | null;
  open: boolean;
  onOverview: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  onNow: () => void;
  nowActive: boolean;
  configActive: boolean;
  setupActive: boolean;
  temaActive: boolean;
  t: T;
}) {
  const { providers, section, selectedId, open, onOverview, onSelect, onClose, onNow, nowActive, configActive, setupActive, temaActive, t } = props;
  const onPage = configActive || setupActive || temaActive;
  const heading = "mb-1.5 px-[9px] text-[10.5px] font-bold uppercase tracking-[.6px] text-ink3";
  return (
    <nav
      className={cn(
        "flex h-full min-h-0 w-[264px] shrink-0 flex-col overflow-hidden border-r border-edge px-2 pb-3 pt-3",
        "max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 max-[860px]:top-14 max-[860px]:z-30 max-[860px]:h-auto max-[860px]:w-[82vw] max-[860px]:max-w-[320px] max-[860px]:-translate-x-full max-[860px]:bg-canvas max-[860px]:transition-transform max-[860px]:duration-200",
        open && "max-[860px]:translate-x-0",
      )}
    >
      <div className="flex shrink-0 flex-col gap-px">
        <button className={cn(sideItem, section === "overview" && !nowActive && !onPage && sideItemActive)} onClick={() => { onOverview(); onClose(); }}>
          <GridIcon size={16} /> {t.overview}
        </button>
        <button className={cn(sideItem, nowActive && sideItemActive)} onClick={() => { onNow(); onClose(); }}>
          <ClockIcon size={16} /> {t.now}
        </button>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className={heading}>{t.accounts}</div>
        <div className="flex min-h-0 flex-1 flex-col gap-px overflow-hidden">
          {providers.length === 0 ? (
            <div className="px-[9px] py-1.5 text-[12.5px] text-ink3">
              {t.noProviders}{" "}
              <NavLink to="/display/config" className={accentLink} onClick={onClose}>
                {t.configCta}
              </NavLink>
            </div>
          ) : (
            providers.map((p) => (
              <button key={p.id} className={cn(sideItem, "shrink-0", section === "account" && selectedId === p.id && !onPage && sideItemActive)} onClick={() => { onSelect(p.id); onClose(); }}>
                <div className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
                  <img className="size-[13px] object-contain" src={PROVIDER_ICON[p.provider]} alt={p.provider} draggable={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold">{p.title}</div>
                  {p.label ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{p.label}</div> : null}
                </div>
                <span className={cn("size-1.5 shrink-0 rounded-full", p.ok ? "bg-good" : "bg-bad")} />
              </button>
            ))
          )}
        </div>
      </div>
      <div className="mt-3 flex shrink-0 flex-col gap-px border-t border-edge pt-3">
        <div className={heading}>{t.setup}</div>
        <NavLink to="/display/config" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <SlidersIcon size={16} /> {t.config}
        </NavLink>
        <NavLink to="/display/setup" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <ChipIcon size={16} /> {t.board}
        </NavLink>
        <NavLink to="/display/tema" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <PaletteIcon size={16} /> {t.tema}
        </NavLink>
        <a className={sideItem} href="https://github.com/TrindadeBRA/vigia-ai" target="_blank" rel="noopener noreferrer">
          <GitHubIcon size={16} /> GitHub
        </a>
      </div>
    </nav>
  );
}

function Overview({
  providers,
  updatedAt,
  now,
  t,
  pal,
  board,
  onBoard,
  onOpen,
}: {
  providers: ProviderMeta[];
  updatedAt: string;
  now: number;
  t: T;
  pal: Pal;
  board: BoardLayout;
  onBoard: (fn: (b: BoardLayout) => BoardLayout) => void;
  onOpen: (id: string) => void;
}) {
  const failing = providers.filter((p) => !p.ok).length;
  const age = payloadAgeMs(updatedAt, now);
  const agoS = age == null ? null : Math.max(0, Math.round(age / 1000));
  const byId = new Map(providers.map((p) => [p.id, p]));
  const ids = providers.map((p) => p.id);
  const idsKey = ids.join("|");
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  const [pad, setPad] = useState(3);
  const [fillPx, setFillPx] = useState(0);
  const [cellPx, setCellPx] = useState(104);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liftSize, setLiftSize] = useState<{ w: number; h: number } | null>(null);
  const rowPx = rowPxFor(cellPx);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const layout = displayBoard(ids, board, cols);
  const holes = emptyCells(ids, layout, cols, pad);
  const active = activeId ? byId.get(activeId) : null;
  const activeSize: CardSize = activeId && layout.size[activeId] === "sm" ? "sm" : "lg";

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth < 1) return;
      const nextCols = colsForWidth(el.clientWidth);
      setCols(nextCols);
      const cell = Math.max(80, Math.floor((el.clientWidth - CELL_GAP * Math.max(0, nextCols - 1)) / Math.max(1, nextCols)));
      setCellPx(cell);
      const main = el.closest("main");
      const gridBox = el.getBoundingClientRect();
      const mainBottom = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const tiles = [...el.children].filter((node) => node.querySelector('[aria-label="Arrastar"], [aria-label="Drag"], [aria-label="Arrastrar"]'));
      const lastBottom = tiles.reduce((max, node) => Math.max(max, node.getBoundingClientRect().bottom), gridBox.top);
      const leftover = Math.round(mainBottom - lastBottom);
      setFillPx(Math.max(0, Math.round(mainBottom - gridBox.top)));
      setPad(padRowsForHeight(leftover, rowPxFor(cell)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.closest("main")) ro.observe(el.closest("main") as Element);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [idsKey]);

  useEffect(() => {
    onBoard((b) => syncBoard(ids, b, b.layoutCols || cols));
  }, [idsKey]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    const box = e.active.rect.current.initial;
    setLiftSize(box ? { w: box.width, h: box.height } : null);
  }

  function onDragEnd(e: DragEndEvent) {
    const from = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setLiftSize(null);
    if (!over || over === from) return;
    const dest = dropTarget(over, layout);
    if (!dest) return;
    onBoard((b) => {
      const cur = displayBoard(ids, b, cols);
      return placeCard(ids, cur, from, dest, cols);
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mb-[18px] flex w-full flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px] max-[860px]:text-[19px]">{t.overview}</h1>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink2">
          <span className={cn("size-[7px] shrink-0 rounded-full", failing ? "bg-bad shadow-[0_0_5px_var(--bad)]" : "bg-good shadow-[0_0_5px_var(--good)]", "[.flat_&]:shadow-none")} />
          <span>{failing ? t.errorsCount(failing) : t.allOk}</span>
          <span className={num}>{agoS != null ? `· ${agoS < 3 ? t.agoNow : t.agoSecs(agoS)}` : ""}</span>
          <button
            type="button"
            className="ml-1 cursor-pointer rounded-lg border border-edge bg-chip px-2.5 py-1 text-[12px] font-medium text-ink2 hover:border-accent hover:text-ink"
            title={t.resetLayout}
            onClick={() => onBoard((b) => packBoard(ids, displayBoard(ids, b, cols), cols))}
          >
            {t.resetLayout}
          </button>
        </div>
      </div>
      {providers.length === 0 ? (
        <div className={emptyNote}>
          {t.noProviders}{" "}
          <Link to="/display/config" className={accentLink}>
            {t.configCta}
          </Link>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={boardCollision}
          autoScroll={{ threshold: { x: 0.08, y: 0.12 }, acceleration: 12 }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => { setActiveId(null); setLiftSize(null); }}
        >
          <div
            ref={gridRef}
            className={cn(overviewBoard, "min-h-0 flex-1")}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridAutoRows: rowPx,
              minHeight: fillPx > 0 ? fillPx : undefined,
            }}
          >
            {holes.map((cell) => (
              <div
                key={slotKey(cell.r, cell.c)}
                style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
                className="min-h-0 min-w-0 h-full"
              >
                <EmptySlot id={slotKey(cell.r, cell.c)} active={Boolean(activeId)} />
              </div>
            ))}
            {ids.map((id) => {
              const p = byId.get(id);
              const pos = layout.pos[id];
              if (!p || !pos) return null;
              const size = layout.size[id] === "sm" ? "sm" : "lg";
              return (
                <BoardTile
                  key={id}
                  p={p}
                  pal={pal}
                  size={size}
                  t={t}
                  nowMs={now}
                  col={pos.c}
                  row={pos.r}
                  span={spanFor(size, cols)}
                  onOpen={() => onOpen(id)}
                  onSetSize={(next) => onBoard((b) => setCardSize(ids, displayBoard(ids, b, cols), id, next, cols))}
                />
              );
            })}
          </div>
          <DragOverlay zIndex={80} dropAnimation={null}>
            {active ? (
              <div
                className="pointer-events-none cursor-grabbing"
                style={{ width: liftSize?.w || (activeSize === "sm" ? cellPx : cellPx * 2 + CELL_GAP), height: liftSize?.h || (activeSize === "sm" ? rowPx : rowPx * 2 + CELL_GAP) }}
              >
                <ProviderCard p={active} pal={pal} size={activeSize} t={t} nowMs={now} lifted onOpen={() => {}} onSetSize={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function NowRow({ p, pal }: { p: ProviderMeta; pal: Pal }) {
  const half = p.metrics.length === 1;
  return (
    <div className={cn("min-w-0 flex-[1_1_100%] rounded-[13px] border border-edge bg-panel px-3.5 py-3 shadow-now [.flat_&]:shadow-none", half && "basis-[calc(50%-4.5px)]")}>
      <div className="mb-2.5 flex items-center gap-[9px]">
        <Icon id={p.provider} />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650] leading-none">{p.title}</div>
          {p.label ? <div className={cardLabel}>{p.label}</div> : null}
        </div>
      </div>
      {!p.ok ? (
        <div className={errorText}>{p.error || ""}</div>
      ) : (
        <div className="flex gap-[18px]">
          {p.metrics.map((m, i) => (
            <div key={i} className="min-w-0 flex-1">
              <div className="mb-[5px] flex justify-between text-xs">
                <span className="text-ink2">{m.label}</span>
                {m.pct != null ? <span className={`${num} font-bold`}>{fmtPct(m.pct)}</span> : null}
              </div>
              {m.pct != null ? (
                <div className={barTrack}>
                  <div className={barFill} style={barFillStyle(m.pct, pal)} />
                </div>
              ) : (
                <div className={`${num} text-[13.5px] font-bold`}>{m.sub || "--"}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NowView({ data, prefs, t, pal, nowMs, driftMs, secs, pollS, showCheck, onClose }: { data: UsagePayload; prefs: Prefs; t: T; pal: Pal; nowMs: number; driftMs: number; secs: number; pollS: number; showCheck: boolean; onClose: () => void }) {
  const clockNow = new Date(nowMs + driftMs);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad2(clockNow.getHours())}:${pad2(clockNow.getMinutes())}:${pad2(clockNow.getSeconds())}`;
  const weekday = WEEKDAYS[prefs.lang][clockNow.getDay()];
  const dateStr = `${weekday}  ${pad2(clockNow.getDate())}/${pad2(clockNow.getMonth() + 1)}/${clockNow.getFullYear()}`;
  const providers = buildProviders(data, t, nowMs);
  return (
    <div className="relative flex h-full min-h-0 w-full cursor-pointer flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(900px_420px_at_50%_30%,var(--glow),transparent_65%),var(--bg)] px-3.5 py-7" onClick={onClose}>
      <div className="absolute right-3.5 top-3.5">
        <Badge secs={secs} total={pollS} showCheck={showCheck} pal={pal} />
      </div>
      <div className={`${num} text-[clamp(42px,12vw,66px)] font-[620] tracking-[-1px] [text-shadow:0_0_40px_var(--glow)] [.flat_&]:[text-shadow:none]`}>{timeStr}</div>
      <div className="mb-[26px] mt-1.5 text-sm capitalize tracking-[.2px] text-ink2">{dateStr}</div>
      <div className="flex w-full max-w-[480px] flex-wrap gap-[9px]">
        {providers.length === 0 ? <div className={emptyNote}>{t.noProviders}</div> : providers.map((p) => <NowRow key={p.id} p={p} pal={pal} />)}
      </div>
    </div>
  );
}

function joinParts(...parts: Array<string | null | undefined>): string | null {
  const out = parts.filter((p): p is string => Boolean(p && p.trim()));
  return out.length ? out.join("  ·  ") : null;
}

function remainLine(t: T, pct: number | null | undefined, resetsAt?: string | null): string | null {
  if (pct == null) return null;
  return joinParts(`${t.left} ${fmtRemain(pct)}`, resetsAt ? `${t.resetPrefix}${fmtWhen(resetsAt)}` : null);
}

function MetaChips({ items }: { items: { k: string; v: ReactNode }[] }) {
  const shown = items.filter((i) => i.v !== null && i.v !== undefined && i.v !== "");
  if (!shown.length) return null;
  return (
    <div className="grid w-full overflow-hidden rounded-2xl border border-edge bg-edge [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-px">
      {shown.map((i) => (
        <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3" key={i.k}>
          <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{i.k}</span>
          <span className={`${num} overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]`}>{i.v}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  pct,
  value,
  sub,
  pal,
  children,
}: {
  label: string;
  pct: number | null | undefined;
  value?: string | null;
  sub?: string | null;
  pal: Pal;
  children?: ReactNode;
}) {
  const display = value ?? (pct != null ? fmtPct(pct) : null);
  return (
    <div className={metricCard}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="text-ink2">{label}</span>
        {display ? <span className={`${num} text-[22px] font-[750]`}>{display}</span> : null}
      </div>
      {pct != null ? (
        <div className={`${barTrack} h-[9px]`}>
          <div className={barFill} style={barFillStyle(pct, pal)} />
        </div>
      ) : !display && sub ? (
        <div className={`${num} mt-0.5 text-[22px] font-[750]`}>{sub}</div>
      ) : null}
      {sub && (pct != null || display) ? <div className="mt-2.5 text-[12.5px] text-ink3">{sub}</div> : null}
      {children}
    </div>
  );
}

function MetricsGrid({ children }: { children: ReactNode }) {
  return <div className={metricsGrid}>{children}</div>;
}

function Kv({ k, v }: { k: string; v: ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex justify-between gap-3 border-b border-surface py-2 text-sm last:border-b-0">
      <span className="text-ink3">{k}</span>
      <span className={`${num} text-right font-[550] text-ink`}>{v}</span>
    </div>
  );
}

function ClaudeBody({ data, account, t, pal, nowMs }: { data: UsagePayload; account: ClaudeAccount; t: T; pal: Pal; nowMs: number }) {
  const c = account;
  const sessionClock = fmtCountdown(c.session_resets_at, nowMs);
  return (
    <>
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard
          label={t.window5h}
          pct={c.session_percent}
          pal={pal}
          sub={joinParts(
            c.session_percent != null ? `${t.left} ${fmtRemain(c.session_percent)}` : null,
            sessionClock ? `${t.resetIn} ${sessionClock}` : c.session_resets_at ? `${t.resetPrefix}${fmtWhen(c.session_resets_at)}` : null,
          )}
        />
        <MetricCard label={t.weekLimit} pct={c.weekly_percent} pal={pal} sub={remainLine(t, c.weekly_percent, c.weekly_resets_at)} />
        {c.sonnet_percent != null ? <MetricCard label={t.sonnetWeek} pct={c.sonnet_percent} pal={pal} sub={remainLine(t, c.sonnet_percent, c.sonnet_resets_at)} /> : null}
        {c.opus_percent != null ? <MetricCard label={t.opusWeek} pct={c.opus_percent} pal={pal} sub={remainLine(t, c.opus_percent, c.opus_resets_at)} /> : null}
      </MetricsGrid>
    </>
  );
}

function GptBody({ data, account, t, pal, nowMs }: { data: UsagePayload; account: GptAccount; t: T; pal: Pal; nowMs: number }) {
  const g = account;
  const resetAt = g.session_resets_at || g.weekly_resets_at;
  return (
    <>
      <MetaChips items={[{ k: t.plan, v: g.plan }, { k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        {g.session_percent != null ? (
          <MetricCard label={t.window5h} pct={g.session_percent} pal={pal} sub={remainLine(t, g.session_percent, g.session_resets_at)} />
        ) : (
          <MetricCard label={t.resetIn} pct={null} pal={pal} sub={fmtCountdown(resetAt, nowMs)} />
        )}
        <MetricCard label={t.weekLimit} pct={g.weekly_percent} pal={pal} sub={remainLine(t, g.weekly_percent, g.weekly_resets_at)} />
      </MetricsGrid>
    </>
  );
}

function CursorBody({ data, account, t, pal, nowMs }: { data: UsagePayload; account: CursorAccount; t: T; pal: Pal; nowMs: number }) {
  const c = account;
  const cycleClock = fmtCountdown(c.cycle_end, nowMs);
  const ondemandPct = c.used_cents != null && c.limit_cents != null && c.limit_cents > 0 ? clamp((c.used_cents / c.limit_cents) * 100, 0, 100) : null;
  const hasLegacy = c.requests_used != null && (c.requests_limit || 0) > 0;
  return (
    <>
      <MetaChips items={[{ k: t.plan, v: c.plan }, { k: t.cycle, v: cycleClock ? `${t.resetIn} ${cycleClock}` : fmtWhen(c.cycle_end) }, { k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.cursorModels} pct={c.percent} pal={pal} sub={remainLine(t, c.percent)} />
        <MetricCard label={t.otherModels} pct={c.other_percent} pal={pal} sub={remainLine(t, c.other_percent)} />
        <MetricCard
          label={t.ondemand}
          pct={ondemandPct}
          value={c.used_cents != null ? fmtUsd(c.used_cents) : null}
          pal={pal}
          sub={joinParts(
            c.limit_cents != null ? `${t.cap} ${fmtUsd(c.limit_cents)}` : null,
            c.remaining_cents != null ? `${t.left} ${fmtUsd(c.remaining_cents)}` : null,
            (c.bonus_cents || 0) > 0 ? `${t.bonus} ${fmtUsd(c.bonus_cents)}` : null,
          )}
        />
      </MetricsGrid>
      {hasLegacy ? (
        <div className={`${metricCard} w-full`}>
          <div className="mb-1.5 text-[12.5px] tracking-[.1px] text-ink3">{t.requestsLegacy}</div>
          <Kv k={t.usedCount} v={String(c.requests_used)} />
          <Kv k={t.limit} v={String(c.requests_limit)} />
        </div>
      ) : null}
    </>
  );
}

function OpenRouterBody({ data, account, t, pal }: { data: UsagePayload; account: CreditsAccount; t: T; pal: Pal }) {
  const o = account;
  const sub = joinParts(
    o.used_cents != null ? `${t.used} ${fmtUsd(o.used_cents)}` : null,
    o.remaining_cents != null ? `${t.left} ${fmtUsd(o.remaining_cents)}` : null,
    o.limit_cents != null ? `${t.cap} ${fmtUsd(o.limit_cents)}` : null,
  ) || (o.remaining_cents != null ? t.remainMoney + fmtUsd(o.remaining_cents) : t.noCredits);
  return (
    <>
      <div className="px-0.5 text-[12.5px] tracking-[.1px] text-ink3">{t.allKeysNote}</div>
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.credits} pct={o.percent} pal={pal} sub={sub} />
      </MetricsGrid>
    </>
  );
}

function DeepSeekBody({ data, account, t, pal }: { data: UsagePayload; account: CreditsAccount; t: T; pal: Pal }) {
  const d = account;
  const remain = d.remaining_cents != null ? t.remainMoney + fmtUsd(d.remaining_cents) : t.noCredits;
  return (
    <>
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.credits} pct={d.percent} pal={pal} sub={remain} />
      </MetricsGrid>
    </>
  );
}

function OpenCodeBody({ data, account, t, pal }: { data: UsagePayload; account: OpenCodeAccount; t: T; pal: Pal }) {
  const o = account;
  const remain = o.remaining_cents != null ? t.remainMoney + fmtUsd(o.remaining_cents) : null;
  return (
    <>
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        {o.rolling_percent != null && <MetricCard label={t.rolling} pct={o.rolling_percent} pal={pal} sub={remainLine(t, o.rolling_percent, o.rolling_resets_at)} />}
        {o.weekly_percent != null && <MetricCard label={t.weekLimit} pct={o.weekly_percent} pal={pal} sub={remainLine(t, o.weekly_percent, o.weekly_resets_at)} />}
        {o.monthly_percent != null && <MetricCard label={t.monthLimit} pct={o.monthly_percent} pal={pal} sub={remainLine(t, o.monthly_percent, o.monthly_resets_at)} />}
        {remain != null && <MetricCard label={t.credits} pct={o.percent} pal={pal} sub={remain} />}
      </MetricsGrid>
    </>
  );
}

function FalBody({ data, account, t, pal }: { data: UsagePayload; account: CreditsAccount; t: T; pal: Pal }) {
  const f = account;
  const remain = f.remaining_cents != null ? t.remainMoney + fmtUsd(f.remaining_cents) : t.noCredits;
  return (
    <>
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.credits} pct={f.percent} pal={pal} sub={remain} />
      </MetricsGrid>
    </>
  );
}

function AccountPage({ meta, account, data, t, pal, nowMs }: { meta: ProviderMeta; account: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | null; data: UsagePayload; t: T; pal: Pal; nowMs: number }) {
  let body: ReactNode = null;
  if (meta.ok && account) {
    if (meta.provider === "claude") body = <ClaudeBody data={data} account={account as ClaudeAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "gpt") body = <GptBody data={data} account={account as GptAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "cursor") body = <CursorBody data={data} account={account as CursorAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "openrouter") body = <OpenRouterBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "deepseek") body = <DeepSeekBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "opencode") body = <OpenCodeBody data={data} account={account as OpenCodeAccount} t={t} pal={pal} />;
    else if (meta.provider === "fal") body = <FalBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
  }
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id={meta.provider} large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{meta.title}</div>
          {meta.label ? <div className={cardLabel}>{meta.label}</div> : null}
        </div>
      </div>
      <div className="flex w-full flex-col gap-[14px]">{!meta.ok ? <div className={metricCard}><div className={errorText}>{meta.error || t.noData}</div></div> : body}</div>
    </div>
  );
}

function SettingsDrawer({ prefs, setPrefs, t, onRefresh, data, refreshing, fetchFailed, onClose }: { prefs: Prefs; setPrefs: (fn: (p: Prefs) => Prefs) => void; t: T; onRefresh: () => void; data: UsagePayload | null; refreshing: boolean; fetchFailed: boolean; onClose: () => void }) {
  const accents = ACCENTS[prefs.theme];
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 right-0 top-0 z-[41] w-[340px] max-w-[88vw] animate-slide-in overflow-y-auto border-l border-edge bg-panel px-[18px] pb-6 pt-4 shadow-drawer [.flat_&]:shadow-none">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="m-0 text-base font-[750]">{t.settings}</h2>
          <button className={iconBtn} onClick={onClose} title={t.closeSettings}>
            <CloseIcon size={18} />
          </button>
        </div>
        <Kv k={t.updated} v={data ? fmtWhen(data.updated_at) : "—"} />
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.themeSection}</div>
        <div className="flex gap-[3px] rounded-xl border border-edge bg-chip p-[3px]">
          {(["dark", "light", "contrast"] as ThemeName[]).map((k) => (
            <button
              key={k}
              className={cn(
                "flex-1 cursor-pointer rounded-[9px] border-0 bg-transparent px-1.5 py-[9px] text-[13px] font-semibold text-ink2 transition-[background-color,color,box-shadow] duration-150 hover:text-ink",
                prefs.theme === k && "bg-panel text-accent shadow-seg [.flat_&]:shadow-[inset_0_0_0_1.5px_var(--accent)]",
              )}
              onClick={() => setPrefs((p) => ({ ...p, theme: k }))}
            >
              {t[k]}
            </button>
          ))}
        </div>
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.accentSection}</div>
        <div className="flex flex-wrap gap-[9px]">
          {accents.map((c, i) => (
            <button
              key={i}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-[10px] border-2 border-transparent p-0 transition-[transform,border-color] duration-150 hover:-translate-y-px",
                prefs.accent === i && "border-ink",
              )}
              aria-label={`${t.accentSection} ${i + 1}`}
              style={{ background: c }}
              onClick={() => setPrefs((p) => ({ ...p, accent: i }))}
            >
              {prefs.accent === i ? <CheckIcon size={14} stroke={inverseOn(c)} /> : null}
            </button>
          ))}
        </div>
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.langSection}</div>
        <div className="flex gap-[3px] rounded-xl border border-edge bg-chip p-[3px]">
          {([["pt", "PT"], ["en", "EN"], ["es", "ES"]] as const).map(([k, label]) => (
            <button
              key={k}
              className={cn(
                "flex-1 cursor-pointer rounded-[9px] border-0 bg-transparent px-1.5 py-[9px] text-[13px] font-semibold text-ink2 transition-[background-color,color,box-shadow] duration-150 hover:text-ink",
                prefs.lang === k && "bg-panel text-accent shadow-seg [.flat_&]:shadow-[inset_0_0_0_1.5px_var(--accent)]",
              )}
              onClick={() => setPrefs((p) => ({ ...p, lang: k }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.refreshSection}</div>
        <button className="w-full cursor-pointer rounded-xl border-0 bg-accent p-[13px] text-[14.5px] font-bold text-accent-ink shadow-btn transition-[transform,box-shadow,opacity] duration-100 hover:-translate-y-px active:translate-y-0 active:opacity-90 [.flat_&]:shadow-none" onClick={onRefresh}>{refreshing ? "…" : t.refreshNow}</button>
        <div className="mt-3 text-xs leading-[1.55] text-ink3">{t.autoNote()}</div>
        {fetchFailed ? <div className="mt-1.5 text-xs text-bad">{t.fetchFail}</div> : null}
      </div>
    </>
  );
}

export default function Display() {
  const navigate = useNavigate();
  const isConfig = Boolean(useMatch("/display/config"));
  const isSetup = Boolean(useMatch("/display/setup"));
  const isTema = Boolean(useMatch("/display/tema"));
  const isNested = isConfig || isSetup || isTema;
  const [prefs, setPrefs] = usePrefs();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [section, setSection] = useState<"overview" | "account">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nowOpen, setNowOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pollMs, setPollMs] = useState(POLL_MS);
  const [nextFetchAt, setNextFetchAt] = useState(Date.now() + POLL_MS);
  const [okFlashAt, setOkFlashAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [driftMs, setDriftMs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const pollMsRef = useRef(POLL_MS);
  const lastUpdatedAtRef = useRef<string | null>(null);
  pollMsRef.current = pollMs;

  const pal = PALETTES[prefs.theme];
  const flat = prefs.theme === "contrast";
  const accent = ACCENTS[prefs.theme][prefs.accent] || ACCENTS[prefs.theme][0];
  const t = STR[prefs.lang];
  const outlet: ConfigOutlet = { lang: prefs.lang };
  const shellClass = cn(shell, flat && "flat");
  const pollS = pollMs / 1000;
  const showCheck = Boolean(okFlashAt && now - okFlashAt < FETCH_OK_FLASH_MS);
  const secsLeft = countdownSecs(nextFetchAt, now, pollS);

  useEffect(() => {
    applyThemeVars(pal, accent, flat);
  }, [pal, accent, flat]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchHealth()
      .then((h) => {
        if (typeof h.interval_s === "number" && h.interval_s >= 15) {
          setPollMs(h.interval_s * 1000);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const updatedAt = lastUpdatedAtRef.current;
    if (!updatedAt) return;
    setNextFetchAt(nextFetchAtMs(updatedAt, pollMs));
  }, [pollMs]);

  async function loadUsage() {
    setRefreshing(true);
    try {
      const json = await fetchUsage();
      applyPayload(json);
    } catch {
      setFetchFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  function applyPayload(json: UsagePayload) {
    const isNew = json.updated_at !== lastUpdatedAtRef.current;
    lastUpdatedAtRef.current = json.updated_at;
    setData(json);
    setFetchFailed(false);
    const intervalMs = pollMsRef.current;
    const serverMs = Date.parse(json.updated_at);
    if (!Number.isNaN(serverMs)) setDriftMs(serverMs - Date.now());
    setNextFetchAt(nextFetchAtMs(json.updated_at, intervalMs));
    const age = payloadAgeMs(json.updated_at);
    if (isNew && (age == null || age < FRESH_PAYLOAD_MS)) setOkFlashAt(Date.now());
  }

  useEffect(() => {
    let got = false;
    const stop = openUsageEvents((json) => {
      got = true;
      applyPayload(json);
    }, () => setFetchFailed(true));
    const watchdog = window.setTimeout(() => {
      if (!got) setFetchFailed(true);
    }, 12000);
    return () => {
      window.clearTimeout(watchdog);
      stop();
    };
  }, []);

  useEffect(() => {
    if (!data || section !== "account") return;
    const providers = buildProviders(data, t);
    if (!providers.some((p) => p.id === selectedId)) setSection("overview");
  }, [data, section, selectedId, t]);

  function goOverview() {
    navigate("/display");
    setSection("overview");
    setNowOpen(false);
  }

  if (nowOpen && data) {
    return (
      <div className={shellClass}>
        <NowView data={data} prefs={prefs} t={t} pal={pal} nowMs={now} driftMs={driftMs} secs={secsLeft} pollS={pollS} showCheck={showCheck} onClose={() => setNowOpen(false)} />
      </div>
    );
  }

  const providers = data ? buildProviders(data, t, now) : [];
  let meta: ProviderMeta | null = null;
  let rawAccount: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | null = null;
  if (data && section === "account") {
    meta = providers.find((p) => p.id === selectedId) || null;
    if (meta) {
      const idx = meta.id.indexOf(":");
      const accountId = meta.id.slice(idx + 1);
      const key = meta.provider as "claude" | "gpt" | "cursor" | "openrouter" | "deepseek" | "opencode" | "fal";
      rawAccount = (data[key] || []).find((a) => a.id === accountId) ?? null;
    }
  }

  return (
    <div className={shellClass}>
      <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 bg-[var(--bg-translucent)] px-3 shadow-[0_1px_0_var(--card-border)] backdrop-blur-[14px] backdrop-saturate-150 [.flat_&]:bg-canvas [.flat_&]:backdrop-blur-none">
        <button className={`${iconBtn} hidden max-[860px]:flex`} onClick={() => setSidebarOpen(true)}><MenuIcon size={19} /></button>
        <button className="group/brand flex cursor-pointer items-center gap-[9px] rounded-[9px] border-0 bg-transparent px-1.5 py-1 text-ink transition-colors duration-150 hover:bg-chip" onClick={goOverview}>
          <Logo size={28} />
        </button>
        <div className="flex-1" />
        <button className={`${num} flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[9px] border-0 bg-transparent px-2.5 py-[7px] text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:bg-chip`} onClick={() => { if (data) setNowOpen(true); }} title={t.now}>
          <span className="size-1.5 shrink-0 rounded-full bg-good shadow-[0_0_5px_var(--good)] [.flat_&]:shadow-none" />
          {fmtClock(now + driftMs)}
        </button>
        <button className={cn(iconBtn, settingsOpen && "text-accent")} onClick={() => setSettingsOpen((v) => !v)} title={t.settings}>
          <SettingsIcon size={19} />
        </button>
        <Badge secs={secsLeft} total={pollS} showCheck={showCheck} pal={pal} onClick={() => void loadUsage()} />
      </div>
      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? <div className="fixed inset-x-0 bottom-0 top-14 z-[25] bg-black/45 min-[861px]:hidden" onClick={() => setSidebarOpen(false)} /> : null}
        <Sidebar
          providers={providers}
          section={section}
          selectedId={selectedId}
          open={sidebarOpen}
          t={t}
          nowActive={nowOpen}
          configActive={isConfig}
          setupActive={isSetup}
          temaActive={isTema}
          onOverview={goOverview}
          onSelect={(id) => { navigate("/display"); setSection("account"); setSelectedId(id); setNowOpen(false); }}
          onNow={() => { if (data) setNowOpen(true); }}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-5 pb-12 pt-5 max-[860px]:px-4 max-[860px]:pb-16 max-[860px]:pt-[18px]">
          {isNested ? (
            <Outlet context={outlet} />
          ) : !data ? (
            fetchFailed ? (
              <div className={emptyNote}>{t.fetchFail}</div>
            ) : (
              <Skeleton page={section === "account" ? "account" : "overview"} />
            )
          ) : (
            <>
              {section === "overview" ? (
                <Overview
                  providers={providers}
                  updatedAt={data.updated_at}
                  now={now}
                  t={t}
                  pal={pal}
                  board={prefs.board || emptyBoard()}
                  onBoard={(fn) =>
                    setPrefs((p) => {
                      const ids = providers.map((x) => x.id);
                      const next = fn(p.board || emptyBoard());
                      if (sameBoard(p.board, next, ids)) return p;
                      return { ...p, board: next };
                    })
                  }
                  onOpen={(id) => { setSection("account"); setSelectedId(id); }}
                />
              ) : null}
              {section === "account" && meta ? <AccountPage key={meta.id} meta={meta} account={rawAccount} data={data} t={t} pal={pal} nowMs={now} /> : null}
            </>
          )}
        </main>
      </div>
      {settingsOpen ? <SettingsDrawer prefs={prefs} setPrefs={setPrefs} t={t} onRefresh={() => void loadUsage()} data={data} refreshing={refreshing} fetchFailed={fetchFailed} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
