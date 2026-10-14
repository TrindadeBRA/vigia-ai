import { useEffect, useRef, useState } from "react";
import { cn } from "../../../cn";
import { beep, cityForTimezone, fmtStopwatch, isValidTimezone, timePartsInTimezone } from "../../../components/cards/ClockCard";
import { fmtCountdown } from "../../../format";
import { num } from "../../../tw";
import type { ThemeClockWidget } from "./state";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function CanvasControlButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="cursor-pointer rounded-md border border-white/25 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white transition-colors hover:bg-black/65"
    >
      {children}
    </button>
  );
}

function Shell({
  widget,
  zoom,
  children,
}: {
  widget: ThemeClockWidget;
  zoom: number;
  children: React.ReactNode;
}) {
  const bg = widget.showBackground ? "bg-black/35" : "bg-transparent";
  return (
    <span
      className={cn("flex flex-col items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1", bg)}
      style={{ color: widget.color || undefined, fontSize: `${13 * widget.scale * zoom}px` }}
    >
      {children}
    </span>
  );
}

function ClockModeView({ widget, now, zoom }: { widget: ThemeClockWidget; now: Date; zoom: number }) {
  const format24h = widget.format24h !== false;
  const parts = timePartsInTimezone(now.getTime(), widget.timezone, format24h);
  const city = widget.label?.trim() || cityForTimezone(widget.timezone);
  const showSeconds = widget.showSeconds !== false;
  const showDate = widget.showDate !== false;
  const fs = Math.max(9, 13 * widget.scale * zoom);
  const small = Math.max(8, fs * 0.62);
  return (
    <Shell widget={widget} zoom={zoom}>
      {city ? (
        <span className="max-w-full truncate font-semibold uppercase tracking-wide opacity-70" style={{ fontSize: small * 0.72 }}>
          {city}
        </span>
      ) : null}
      <span className={cn(num, "font-bold leading-none tabular-nums")} style={{ fontSize: fs }}>
        {parts.h}:{parts.m}
        {showSeconds ? <span className="opacity-60">:{parts.s}</span> : null}
      </span>
      {showDate ? (
        <span className="font-medium capitalize opacity-70" style={{ fontSize: small }}>
          {parts.date}
        </span>
      ) : null}
      {widget.timezone && !isValidTimezone(widget.timezone) ? <span style={{ fontSize: small }}>fuso inválido</span> : null}
    </Shell>
  );
}

function CountdownModeView({ widget, now, zoom }: { widget: ThemeClockWidget; now: Date; zoom: number }) {
  const fs = Math.max(9, 12 * widget.scale * zoom);
  const targetMs = widget.countdownAt ? Date.parse(widget.countdownAt) : NaN;
  if (!widget.countdownAt || Number.isNaN(targetMs)) {
    return (
      <Shell widget={widget} zoom={zoom}>
        <span className="font-semibold opacity-70" style={{ fontSize: fs }}>
          sem data alvo
        </span>
      </Shell>
    );
  }
  const launched = targetMs <= now.getTime();
  const clock = launched ? null : fmtCountdown(widget.countdownAt, now.getTime());
  return (
    <Shell widget={widget} zoom={zoom}>
      {widget.countdownLabel?.trim() || widget.label?.trim() ? (
        <span className="max-w-full truncate font-semibold uppercase tracking-wide opacity-70" style={{ fontSize: fs * 0.55 }}>
          {widget.countdownLabel?.trim() || widget.label?.trim()}
        </span>
      ) : null}
      <span className={cn(num, "font-bold leading-none tabular-nums")} style={{ fontSize: fs }}>
        {launched ? "Lançado!" : (clock ?? "—")}
      </span>
    </Shell>
  );
}

function StopwatchModeView({ widget, zoom }: { widget: ThemeClockWidget; zoom: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const baseRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    baseRef.current = Date.now() - elapsed;
    const id = window.setInterval(() => setElapsed(Date.now() - baseRef.current), 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const fs = Math.max(9, 13 * widget.scale * zoom);
  return (
    <Shell widget={widget} zoom={zoom}>
      <span className={cn(num, "font-bold leading-none tabular-nums")} style={{ fontSize: fs }}>
        {fmtStopwatch(elapsed)}
      </span>
      <span className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <CanvasControlButton title={running ? "Pausar" : "Iniciar"} onClick={() => setRunning((v) => !v)}>
          {running ? "❚❚" : "▶"}
        </CanvasControlButton>
        <CanvasControlButton
          title="Zerar"
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
        >
          ↺
        </CanvasControlButton>
      </span>
    </Shell>
  );
}

type PomodoroPhase = "focus" | "short" | "long";

function PomodoroModeView({ widget, zoom }: { widget: ThemeClockWidget; zoom: number }) {
  const focusMin = Math.max(1, Math.min(180, widget.pomodoroFocusMin ?? 25));
  const shortMin = Math.max(1, Math.min(60, widget.pomodoroShortMin ?? 5));
  const longMin = Math.max(1, Math.min(90, widget.pomodoroLongMin ?? 15));
  const cycles = Math.max(2, Math.min(8, widget.pomodoroCycles ?? 4));
  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const [remaining, setRemaining] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [doneFocus, setDoneFocus] = useState(0);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      beep(phase === "focus" ? 2 : 1);
      if (phase === "focus") {
        const next = doneFocus + 1;
        setDoneFocus(next);
        if (next % cycles === 0) {
          setPhase("long");
          setRemaining(longMin * 60);
        } else {
          setPhase("short");
          setRemaining(shortMin * 60);
        }
      } else {
        setPhase("focus");
        setRemaining(focusMin * 60);
      }
      return;
    }
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running, remaining, phase, doneFocus, cycles, focusMin, shortMin, longMin]);

  const total = (phase === "focus" ? focusMin : phase === "short" ? shortMin : longMin) * 60;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const phaseLabel = phase === "focus" ? "Foco" : phase === "short" ? "Pausa" : "Pausa longa";
  const fs = Math.max(9, 13 * widget.scale * zoom);
  const skip = () => {
    setRunning(false);
    if (phase === "focus") {
      const next = doneFocus + 1;
      setDoneFocus(next);
      if (next % cycles === 0) {
        setPhase("long");
        setRemaining(longMin * 60);
      } else {
        setPhase("short");
        setRemaining(shortMin * 60);
      }
    } else {
      setPhase("focus");
      setRemaining(focusMin * 60);
    }
  };
  return (
    <Shell widget={widget} zoom={zoom}>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-bold uppercase tracking-wide",
          phase === "focus" ? "bg-accent text-accent-ink" : "bg-white/15 text-white",
        )}
        style={{ fontSize: Math.max(8, fs * 0.5) }}
      >
        {phaseLabel}
      </span>
      <span className={cn(num, "font-bold leading-none tabular-nums")} style={{ fontSize: fs }}>
        {pad2(Math.floor(remaining / 60))}:{pad2(remaining % 60)}
      </span>
      <span className="h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-white/20">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(pct * 100)}%` }} />
      </span>
      <span className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <CanvasControlButton title={running ? "Pausar" : "Iniciar"} onClick={() => setRunning((v) => !v)}>
          {running ? "❚❚" : "▶"}
        </CanvasControlButton>
        <CanvasControlButton title="Pular fase" onClick={skip}>
          ⏭
        </CanvasControlButton>
        <CanvasControlButton
          title="Zerar"
          onClick={() => {
            setRunning(false);
            setPhase("focus");
            setRemaining(focusMin * 60);
            setDoneFocus(0);
          }}
        >
          ↺
        </CanvasControlButton>
      </span>
    </Shell>
  );
}

/** Widget de relógio do canvas — um widget por modo (relógio/fuso, contagem, cronômetro, pomodoro). */
export function CanvasClockWidget({ widget, now, zoom }: { widget: ThemeClockWidget; now: Date; zoom: number }) {
  if (widget.mode === "countdown") return <CountdownModeView widget={widget} now={now} zoom={zoom} />;
  if (widget.mode === "stopwatch") return <StopwatchModeView widget={widget} zoom={zoom} />;
  if (widget.mode === "pomodoro") return <PomodoroModeView widget={widget} zoom={zoom} />;
  return <ClockModeView widget={widget} now={now} zoom={zoom} />;
}

export function clockWidgetTitle(widget: ThemeClockWidget): string {
  const base = widget.label?.trim() || cityForTimezone(widget.timezone);
  if (widget.mode === "countdown") return widget.countdownLabel?.trim() || base || "Contagem regressiva";
  if (widget.mode === "stopwatch") return widget.label?.trim() || "Cronômetro";
  if (widget.mode === "pomodoro") return widget.label?.trim() || "Pomodoro";
  return base || "Relógio";
}
