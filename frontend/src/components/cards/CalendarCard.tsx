import { useState } from "react";
import type { CalendarEvent, CalendarPayload, CalendarSource } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote, errorText, num } from "../../tw";

/* ── Tamanhos ───────────────────────────────────────────────────────── */
// Eventos e tarefas são subtipos diferentes: cada calendário tem kind próprio.
// O card mostra 1 calendário por vez (o primeiro ok, ou o primeiro da lista).
// Tamanhos: sm = próximo evento/tarefa em destaque; md = lista compacta;
// lg = lista com detalhes; wl/wxl = lista expandida com mais itens.
export function calendarAllowedSizes(payload?: CalendarPayload | null): CardSize[] {
  const count = payload?.calendars?.length ?? 0;
  if (count === 0) return ["md"];
  const hasEvents = payload?.calendars?.some((c) => c.kind === "events");
  const hasTasks = payload?.calendars?.some((c) => c.kind === "tasks");
  if (hasEvents && hasTasks) return ["sm", "md", "lg", "wl", "wxl"];
  if (hasEvents || hasTasks) return ["sm", "md", "lg", "wl"];
  return ["md", "lg"];
}

export const CALENDAR_ALLOWED_ALL: CardSize[] = ["sm", "md", "lg", "wl", "wxl"];

export function calendarSizeLabel(size: CardSize, t: T, payload?: CalendarPayload | null): string {
  const s = normalizeSize(size);
  const first = payload?.calendars?.[0];
  const kindLabel = first?.kind === "tasks" ? t.calendarTasks : t.calendarEvents;
  if (s === "sm") return `${t.cardSmallPrefix} ${kindLabel}`;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtCalendarDate(iso: string | null, allDay?: boolean): string {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    if (allDay) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function primaryCalendar(payload: CalendarPayload | null | undefined): CalendarSource | null {
  if (!payload?.calendars?.length) return null;
  return payload.calendars.find((c) => c.ok && c.events.length > 0) || payload.calendars[0] || null;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function CalendarIcon({ kind, compact }: { kind?: string; compact?: boolean }) {
  const isTasks = kind === "tasks";
  const icon = isTasks ? PROVIDER_ICON.calendarTasks || PROVIDER_ICON.calendar : PROVIDER_ICON.calendar || PROVIDER_ICON.git;
  const fallback = isTasks ? "✓" : "📅";
  if (compact) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        {icon ? <img className="size-3.5 object-contain" src={icon} alt="" draggable={false} /> : <span className="text-[13px]">{fallback}</span>}
      </div>
    );
  }
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      {icon ? <img className="size-[23px] object-contain" src={icon} alt="" draggable={false} /> : <span className="text-[20px]">{fallback}</span>}
    </div>
  );
}

function CalendarHeader({ cal, ok, compact, onOpen }: { cal: CalendarSource | null; ok: boolean; compact?: boolean; onOpen?: () => void }) {
  const label = cal?.label || cal?.url?.replace(/^https?:\/\//, "").slice(0, 32) || "Calendário";
  const kind = cal?.kind || "events";
  const inner = (
    <>
      <div className="relative shrink-0">
        <CalendarIcon kind={kind} compact={compact} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{label}</div>
        <div className={cardLabel}>{kind === "tasks" ? "Tarefas" : "Eventos"} {cal?.events?.length ? `· ${cal.events.length}` : ""}</div>
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

function EventRow({ ev, compact }: { ev: CalendarEvent; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const when = ev.kind === "tasks" ? (ev.due || ev.dtstart) : ev.dtstart;
  const rel = fmtRelative(when);
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border border-edge bg-chip px-3 py-2.5", compact && "px-2.5 py-2")}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink", compact && "text-[12.5px]")}>{ev.summary}</span>
        {ev.allDay ? <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">dia todo</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink3">
        <span className={cn(num, "text-[11px]")}>{fmtCalendarDate(when, ev.allDay)}</span>
        {rel ? <span className="rounded bg-canvas px-1 py-0.5 text-[10px] font-semibold text-ink2">{rel}</span> : null}
        {ev.location ? <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">· {ev.location}</span> : null}
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
  const ns = normalizeSize(size);
  const isCompact = ns === "sm";
  const primary = primaryCalendar(calendar);

  if (!calendar || cals.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <CalendarHeader cal={null} ok={false} compact={isCompact} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{calendar?.error || t.calendarEmpty}</div>
        </div>
      </div>
    );
  }

  // sm: hero do próximo evento/tarefa
  if (ns === "sm") {
    const ev = primary?.events?.[0];
    const when = ev ? (ev.kind === "tasks" ? (ev.due || ev.dtstart) : ev.dtstart) : null;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <CalendarIcon kind={primary?.kind} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{primary?.label || (primary?.kind === "tasks" ? t.calendarTasks : t.calendarEvents)} {when ? `· ${fmtRelative(when)}` : ""}</div>
          <div className={cn(num, "mt-1 line-clamp-2 text-[12px] font-[700] leading-tight")}>{ev?.summary || t.calendarNoEvents}</div>
          {when ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{fmtCalendarDate(when, ev?.allDay)}</div> : null}
        </button>
      </div>
    );
  }

  if (ns === "md") {
    const events = primary?.events ?? [];
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CalendarHeader cal={primary} ok={!!primary?.ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col gap-1.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {!primary?.ok ? (
            <div className={errorText}>{primary?.error || t.noData}</div>
          ) : events.length === 0 ? (
            <div className={emptyNote}>{t.calendarNoEvents}</div>
          ) : (
            events.slice(0, 3).map((ev, idx) => {
              const when = ev.kind === "tasks" ? (ev.due || ev.dtstart) : ev.dtstart;
              return (
                <div key={ev.uid || `${ev.summary}-${idx}`} className="flex items-center gap-2 overflow-hidden rounded-lg border border-edge bg-chip px-2.5 py-2">
                  <span className={cn("size-1.5 shrink-0 rounded-full", ev.kind === "tasks" ? "bg-accent" : "bg-good")} />
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium text-ink">{ev.summary}</span>
                  <span className={cn(num, "shrink-0 text-[11px] text-ink3")}>{fmtCalendarDate(when, ev.allDay).slice(0, 11)}</span>
                </div>
              );
            })
          )}
        </button>
      </div>
    );
  }

  if (ns === "lg") {
    const events = primary?.events ?? [];
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <CalendarHeader cal={primary} ok={!!primary?.ok} onOpen={onOpen} />
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {!primary?.ok ? (
            <div className={errorText}>{primary?.error || t.noData}</div>
          ) : events.length === 0 ? (
            <div className={emptyNote}>{t.calendarNoEvents}</div>
          ) : (
            events.slice(0, 6).map((ev, idx) => (
              <EventRow key={ev.uid || `${ev.summary}-${idx}`} ev={ev} />
            ))
          )}
        </div>
      </div>
    );
  }

  // wl / wxl: lista expandida
  const events = primary?.events ?? [];
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CalendarHeader cal={primary} ok={!!primary?.ok} onOpen={onOpen} />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {!primary?.ok ? (
          <div className={errorText}>{primary?.error || t.noData}</div>
        ) : events.length === 0 ? (
          <div className={emptyNote}>{t.calendarNoEvents}</div>
        ) : (
          events.slice(0, ns === "wxl" ? 12 : 8).map((ev, idx) => (
            <EventRow key={ev.uid || `${ev.summary}-${idx}`} ev={ev} />
          ))
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
                <EventRow key={ev.uid || `${ev.summary}-${idx}`} ev={ev} />
              ))}
            </div>
          )}
        </div>
      ))}
      {calendar.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {calendar.updated_at.slice(11, 16)}</div> : null}
    </div>
  );
}
