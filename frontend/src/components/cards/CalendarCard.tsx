import { useState } from "react";
import type { CalendarEvent, CalendarPayload } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */
// 3 variantes, não uma por tamanho bruto do grid: "hero" (célula minúscula —
// só o próximo evento/tarefa), "list" (card normal — lista compacta rolável,
// sem cortar itens abaixo do limite configurado) e "feed" (cards grandes —
// lista com data relativa/local/descrição). O grid tem ~13 tamanhos brutos
// (xs/sm/sw/.../wxl/free); cada um cai numa dessas 3 pelo espaço que oferece,
// não pelo nome.
export function calendarAllowedSizes(payload?: CalendarPayload | null): CardSize[] {
  const count = payload?.calendars?.length ?? 0;
  if (count === 0) return ["md", "free"];
  return ["sm", "md", "lg", "wl", "wxl", "free"];
}

export const CALENDAR_ALLOWED_ALL: CardSize[] = ["sm", "md", "lg", "wl", "wxl"];

export function calendarSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return `${t.cardSmallPrefix} ${t.calendarEvents}`;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  if (s === "free") return t.cardFree;
  return t.cardXl;
}

type Bucket = "hero" | "list" | "feed";

function bucketFor(size: CardSize): Bucket {
  const s = normalizeSize(size);
  if (s === "xs" || s === "sm" || s === "sw" || s === "sx" || s === "sc" || s === "scw") return "hero";
  if (s === "md" || s === "wm") return "list";
  return "feed"; // lg, xl, wl, wxl, free
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtCalendarDate(iso: string | null, allDay?: boolean): string {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    if (allDay) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso.slice(0, 16); }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    if (mins < 60) return diff >= 0 ? `em ${mins} min` : `há ${mins} min`;
    const hours = Math.round(abs / 3600000);
    if (hours < 24) return diff >= 0 ? `em ${hours}h` : `há ${hours}h`;
    const days = Math.round(abs / 86400000);
    return diff >= 0 ? `em ${days}d` : `há ${days}d`;
  } catch { return ""; }
}

function eventWhen(ev: CalendarEvent): string | null {
  return ev.kind === "tasks" ? (ev.due || ev.dtstart) : ev.dtstart;
}

// Lista única, ordenada do agora pra frente — um calendário é uma agenda,
// não faz sentido separar por fonte quando o card só tem espaço pra 1 lista.
type MergedEvent = CalendarEvent & { calLabel: string };

function mergeEvents(payload: CalendarPayload | null | undefined): MergedEvent[] {
  const cals = payload?.calendars ?? [];
  const merged: MergedEvent[] = [];
  for (const c of cals) {
    if (!c.ok) continue;
    for (const ev of c.events ?? []) merged.push({ ...ev, calLabel: c.label || "" });
  }
  merged.sort((a, b) => {
    const ta = eventWhen(a);
    const tb = eventWhen(b);
    const na = ta ? new Date(ta).getTime() : Infinity;
    const nb = tb ? new Date(tb).getTime() : Infinity;
    return (Number.isNaN(na) ? Infinity : na) - (Number.isNaN(nb) ? Infinity : nb);
  });
  return merged;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function CalendarIcon({ compact }: { compact?: boolean }) {
  const icon = PROVIDER_ICON.calendar;
  if (compact) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        {icon ? <img className="size-3.5 object-contain" src={icon} alt="" draggable={false} /> : <span className="text-[13px]">📅</span>}
      </div>
    );
  }
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      {icon ? <img className="size-[23px] object-contain" src={icon} alt="" draggable={false} /> : <span className="text-[20px]">📅</span>}
    </div>
  );
}

function CalendarHeader({ payload, compact, onOpen }: { payload: CalendarPayload | null | undefined; compact?: boolean; onOpen?: () => void }) {
  const cals = payload?.calendars ?? [];
  const totalEvents = cals.reduce((acc, c) => acc + (c.events?.length ?? 0), 0);
  const single = cals.length === 1 ? cals[0] : null;
  const label = single ? (single.label || single.url?.replace(/^https?:\/\//, "").slice(0, 32) || "Calendário") : cals.length > 1 ? `${cals.length} calendários` : "Calendário";
  const ok = cals.some((c) => c.ok);
  const inner = (
    <>
      <div className="relative shrink-0">
        <CalendarIcon compact={compact} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{label}</div>
        <div className={cardLabel}>{totalEvents} {totalEvents === 1 ? "item" : "itens"}</div>
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

function EventRow({ ev, showSource }: { ev: MergedEvent; showSource?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const when = eventWhen(ev);
  const rel = fmtRelative(when);
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-edge bg-chip px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink">{ev.summary}</span>
        {ev.allDay ? <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">dia todo</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink3">
        <span className={cn(num, "text-[11px]")}>{fmtCalendarDate(when, ev.allDay)}</span>
        {rel ? <span className="rounded bg-canvas px-1 py-0.5 text-[10px] font-semibold text-ink2">{rel}</span> : null}
        {ev.location ? <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">· {ev.location}</span> : null}
        {showSource && ev.calLabel ? <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">· {ev.calLabel}</span> : null}
      </div>
      {ev.description ? (
        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={() => setExpanded((v) => !v)}>
          <span className={cn("line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-snug text-ink2", expanded && "line-clamp-none")}>{ev.description}</span>
          {!expanded ? <span className="mt-1 text-[11px] text-accent">+ detalhes</span> : null}
        </button>
      ) : null}
    </div>
  );
}

function CompactRow({ ev, showSource }: { ev: MergedEvent; showSource?: boolean }) {
  const when = eventWhen(ev);
  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-edge bg-chip px-2.5 py-2">
      <span className={cn("size-1.5 shrink-0 rounded-full", ev.kind === "tasks" ? "bg-accent" : "bg-good")} />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium text-ink">{ev.summary}</span>
      {showSource && ev.calLabel ? <span className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{ev.calLabel}</span> : null}
      <span className={cn(num, "shrink-0 text-[11px] text-ink3")}>{fmtCalendarDate(when, ev.allDay)}</span>
    </div>
  );
}

/* ── Board ──────────────────────────────────────────────────────────── */

export function CalendarBoardCard({
  calendar,
  t,
  size,
  onOpen,
}: {
  calendar: CalendarPayload | null | undefined;
  t: T;
  size: CardSize;
  onOpen: () => void;
}) {
  const cals = calendar?.calendars ?? [];
  const ok = !!calendar?.ok && cals.length > 0;
  const bucket = bucketFor(size);
  const isCompact = bucket === "hero";
  const events = mergeEvents(calendar);
  const showSource = cals.length > 1;

  if (!calendar || cals.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CalendarHeader payload={null} compact={isCompact} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{calendar?.error || t.calendarEmpty}</div>
        </div>
      </div>
    );
  }

  // hero: próximo evento/tarefa em destaque, sem lista.
  if (bucket === "hero") {
    const ev = events[0];
    const when = ev ? eventWhen(ev) : null;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <CalendarIcon />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{when ? fmtRelative(when) : t.calendarEvents}</div>
          <div className={cn(num, "mt-1 line-clamp-2 text-[12px] font-[700] leading-tight")}>{ev?.summary || t.calendarNoEvents}</div>
          {when ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{fmtCalendarDate(when, ev?.allDay)}</div> : null}
        </button>
      </div>
    );
  }

  // list: card normal — lista compacta, rolável, sem cortar abaixo do que
  // veio da API (que já respeita o limite configurado por calendário).
  if (bucket === "list") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CalendarHeader payload={calendar} onOpen={onOpen} />
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {!ok ? (
            <div className={errorText}>{calendar?.error || t.noData}</div>
          ) : events.length === 0 ? (
            <div className={emptyNote}>{t.calendarNoEvents}</div>
          ) : (
            events.map((ev, idx) => <CompactRow key={ev.uid || `${ev.summary}-${idx}`} ev={ev} showSource={showSource} />)
          )}
        </div>
      </div>
    );
  }

  // feed: cards grandes — lista com data relativa, local e descrição.
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CalendarHeader payload={calendar} onOpen={onOpen} />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {!ok ? (
          <div className={errorText}>{calendar?.error || t.noData}</div>
        ) : events.length === 0 ? (
          <div className={emptyNote}>{t.calendarNoEvents}</div>
        ) : (
          events.map((ev, idx) => <EventRow key={ev.uid || `${ev.summary}-${idx}`} ev={ev} showSource={showSource} />)
        )}
      </div>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

export function CalendarDetail({ calendar, t }: { calendar: CalendarPayload | null | undefined; t: T }) {
  if (!calendar || !calendar.calendars?.length) {
    return <div className="px-5 py-12 text-center text-sm text-ink3">{t.calendarEmpty}</div>;
  }
  return (
    <div className="flex w-full flex-col gap-4">
      {calendar.calendars.map((cal) => (
        <div key={cal.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", cal.ok ? "bg-good" : "bg-bad")} />
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-ink">{cal.label || cal.url.slice(0, 40)}</span>
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold", cal.kind === "tasks" ? "bg-accent text-accent-ink" : "bg-chip text-ink2")}>{cal.kind === "tasks" ? t.calendarTasks : t.calendarEvents}</span>
            <span className="shrink-0 text-[11px] text-ink3">{cal.events.length} {cal.events.length === 1 ? "item" : "itens"}</span>
          </div>
          {cal.url ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{cal.url}</div> : null}
          {!cal.ok ? (
            <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] text-bad">{cal.error || t.noData}</div>
          ) : cal.events.length === 0 ? (
            <div className={emptyNote}>{t.calendarNoEvents}</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {cal.events.map((ev, idx) => (
                <EventRow key={ev.uid || `${ev.summary}-${idx}`} ev={{ ...ev, calLabel: cal.label || "" }} />
              ))}
            </div>
          )}
        </div>
      ))}
      {calendar.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {calendar.updated_at.slice(11, 16)}</div> : null}
    </div>
  );
}
