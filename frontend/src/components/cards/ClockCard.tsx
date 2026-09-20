import { useEffect, useRef, useState } from "react";
import { cn } from "../../cn";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { fmtCountdown } from "../../format";
import type { T } from "../../i18n";
import { num } from "../../tw";

/** Widget de relógio — não vem de conta/backend, é só visual.
 * Cada card do dashboard tem sua própria config (por id, em prefs.clockConfig),
 * então o mesmo relógio pode aparecer várias vezes com modos diferentes. */
export function clockAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg", "free"];
}

export function clockSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.widgetSmall;
  if (s === "md") return t.cardNormal;
  if (s === "free") return t.cardFree;
  return t.cardLarge;
}

export type ClockMode = "clock" | "countdown" | "stopwatch" | "pomodoro";

export type ClockConfig = {
  mode: ClockMode;
  /** Rótulo custom do card (ex.: nome da cidade). */
  label?: string | null;
  /** IANA timezone (ex.: "America/New_York"). null = horário local. */
  timezone?: string | null;
  showSeconds?: boolean;
  /** ISO datetime do alvo (modo countdown) — mesmo formato do card de imagem. */
  countdownAt?: string | null;
  countdownLabel?: string | null;
  pomodoroFocusMin?: number;
  pomodoroShortMin?: number;
  pomodoroLongMin?: number;
  pomodoroCycles?: number;
};

export const DEFAULT_CLOCK_CONFIG: ClockConfig = {
  mode: "clock",
  label: null,
  timezone: null,
  showSeconds: true,
  countdownAt: null,
  countdownLabel: null,
  pomodoroFocusMin: 25,
  pomodoroShortMin: 5,
  pomodoroLongMin: 15,
  pomodoroCycles: 4,
};

/** Cidades curadas (IANA) pro seletor de fuso — cobre os fusos mais usados. */
export const CLOCK_TIMEZONES: Array<{ city: string; tz: string }> = [
  { city: "São Paulo", tz: "America/Sao_Paulo" },
  { city: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },
  { city: "Santiago", tz: "America/Santiago" },
  { city: "Bogotá", tz: "America/Bogota" },
  { city: "Cidade do México", tz: "America/Mexico_City" },
  { city: "Nova York", tz: "America/New_York" },
  { city: "Chicago", tz: "America/Chicago" },
  { city: "Los Angeles", tz: "America/Los_Angeles" },
  { city: "Honolulu", tz: "Pacific/Honolulu" },
  { city: "Lisboa", tz: "Europe/Lisbon" },
  { city: "Londres", tz: "Europe/London" },
  { city: "Madri", tz: "Europe/Madrid" },
  { city: "Paris", tz: "Europe/Paris" },
  { city: "Berlim", tz: "Europe/Berlin" },
  { city: "Roma", tz: "Europe/Rome" },
  { city: "Moscou", tz: "Europe/Moscow" },
  { city: "Dubai", tz: "Asia/Dubai" },
  { city: "Mumbai", tz: "Asia/Kolkata" },
  { city: "Singapura", tz: "Asia/Singapore" },
  { city: "Hong Kong", tz: "Asia/Hong_Kong" },
  { city: "Xangai", tz: "Asia/Shanghai" },
  { city: "Tóquio", tz: "Asia/Tokyo" },
  { city: "Seul", tz: "Asia/Seoul" },
  { city: "Sydney", tz: "Australia/Sydney" },
  { city: "Auckland", tz: "Pacific/Auckland" },
];

export function isValidTimezone(tz: string | null | undefined): boolean {
  if (!tz) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function timePartsInTimezone(nowMs: number, tz: string | null | undefined): { h: string; m: string; s: string; date: string } {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(new Date(nowMs));
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
      const date = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date(nowMs));
      return { h: get("hour"), m: get("minute"), s: get("second"), date };
    } catch {
      // timezone inválido — cai no horário local abaixo
    }
  }
  const d = new Date(nowMs);
  return {
    h: pad2(d.getHours()),
    m: pad2(d.getMinutes()),
    s: pad2(d.getSeconds()),
    date: d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" }),
  };
}

function cityForTimezone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  return CLOCK_TIMEZONES.find((c) => c.tz === tz)?.city ?? tz;
}

/** Bipe curto de fim de fase (pomodoro) — WebAudio, sem assets. */
function beep(times = 2) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    times = Math.max(1, Math.min(3, times));
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const t0 = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    }
    window.setTimeout(() => void ctx.close().catch(() => {}), times * 250 + 300);
  } catch {
    // áudio bloqueado/indisponível — só visual mesmo
  }
}

function ControlButton({ onClick, title, children, primary }: { onClick: (e: React.MouseEvent) => void; title: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors",
        primary
          ? "border-0 bg-accent text-accent-ink hover:brightness-110"
          : "border-edge bg-chip text-ink2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ── Modo: relógio (com fuso) ────────────────────────────────────────────

function ClockView({ config, nowMs, size, t }: { config: ClockConfig; nowMs: number; size: CardSize; t: T }) {
  const s = normalizeSize(size);
  const big = s !== "sm";
  const showSeconds = config.showSeconds !== false;
  const parts = timePartsInTimezone(nowMs, config.timezone);
  const city = (config.label?.trim() || cityForTimezone(config.timezone) || null) ?? undefined;
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1">
      {city && big ? <div className="max-w-full truncate text-[11px] font-semibold uppercase tracking-wide text-ink3">{city}</div> : null}
      <div className={cn(num, "font-[800] leading-none tabular-nums", big ? "text-[34px]" : "text-[22px]")}>
        {parts.h}:{parts.m}
        {big && showSeconds ? <span className="text-ink3">:{parts.s}</span> : null}
      </div>
      {big ? <div className="text-[12px] font-medium capitalize text-ink3">{parts.date}</div> : null}
      {!big && city ? <div className="max-w-full truncate text-[10px] font-medium text-ink3">{city}</div> : null}
      {config.timezone && !isValidTimezone(config.timezone) ? (
        <div className="text-[10px] text-warn">{t.clockInvalidTimezone ?? "Fuso inválido — mostrando horário local"}</div>
      ) : null}
    </div>
  );
}

// ── Modo: countdown (reaproveita fmtCountdown do card de imagem) ────────

function CountdownView({ config, nowMs, size, t, onConfigure }: { config: ClockConfig; nowMs: number; size: CardSize; t: T; onConfigure?: () => void }) {
  const s = normalizeSize(size);
  const big = s !== "sm";
  const targetMs = config.countdownAt ? Date.parse(config.countdownAt) : NaN;
  if (!config.countdownAt || Number.isNaN(targetMs)) {
    return (
      <button
        type="button"
        className="flex h-full min-h-0 w-full flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent p-0 text-ink3"
        onClick={onConfigure}
        aria-label={t.clockConfigure ?? "Configurar"}
      >
        <span className={cn("font-semibold", big ? "text-[13px]" : "text-[11px]")}>{t.clockCountdownEmpty ?? "Sem data alvo"}</span>
        <span className="text-[11px]">{t.clockCountdownEmptyHint ?? "Clique para configurar"}</span>
      </button>
    );
  }
  // Mesma lógica do overlay do ImageCard: alvo <= agora = lançado.
  const launched = targetMs <= nowMs;
  const clock = launched ? null : fmtCountdown(config.countdownAt, nowMs);
  if (!launched && !clock) return null;
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 text-center">
      {config.countdownLabel || config.label ? (
        <div className={cn("max-w-[94%] truncate font-semibold uppercase tracking-wide text-ink3", big ? "text-[11px]" : "text-[10px]")}>
          {config.countdownLabel?.trim() || config.label?.trim()}
        </div>
      ) : null}
      <div className={cn(num, "font-[800] leading-none tabular-nums", big ? "text-[26px]" : "text-[18px]")}>
        {launched ? (t.imageCountdownDone ?? "Lançado!") : clock}
      </div>
      {!launched && big ? (
        <div className="text-[11px] font-medium text-ink3">
          {new Date(targetMs).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </div>
      ) : null}
    </div>
  );
}

// ── Modo: cronômetro ────────────────────────────────────────────────────

function fmtStopwatch(elapsedMs: number): string {
  const cs = Math.floor(elapsedMs / 100);
  const s = Math.floor(cs / 10);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${pad2(h)}:${pad2(m % 60)}:${pad2(s % 60)}`;
  return `${pad2(m)}:${pad2(s % 60)}.${Math.floor(cs % 10)}`;
}

function StopwatchView({ size, t }: { size: CardSize; t: T }) {
  const s = normalizeSize(size);
  const big = s !== "sm";
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
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5">
      <div className={cn(num, "font-[800] leading-none tabular-nums", big ? "text-[30px]" : "text-[20px]")}>
        {fmtStopwatch(elapsed)}
      </div>
      <div className="flex items-center gap-1.5" data-gamepad-content="true">
        <ControlButton
          primary={!running}
          title={running ? (t.clockPause ?? "Pausar") : (t.clockStart ?? "Iniciar")}
          onClick={() => (running ? setRunning(false) : setRunning(true))}
        >
          {running ? (t.clockPause ?? "Pausar") : (t.clockStart ?? "Iniciar")}
        </ControlButton>
        <ControlButton
          title={t.clockReset ?? "Zerar"}
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
        >
          {t.clockReset ?? "Zerar"}
        </ControlButton>
      </div>
    </div>
  );
}

// ── Modo: pomodoro ──────────────────────────────────────────────────────

type PomodoroPhase = "focus" | "short" | "long";

function PomodoroView({ config, size, t }: { config: ClockConfig; size: CardSize; t: T }) {
  const s = normalizeSize(size);
  const big = s !== "sm";
  const focusMin = Math.max(1, Math.min(180, config.pomodoroFocusMin ?? 25));
  const shortMin = Math.max(1, Math.min(60, config.pomodoroShortMin ?? 5));
  const longMin = Math.max(1, Math.min(90, config.pomodoroLongMin ?? 15));
  const cycles = Math.max(2, Math.min(8, config.pomodoroCycles ?? 4));
  const secsFor = (ph: PomodoroPhase) => (ph === "focus" ? focusMin : ph === "short" ? shortMin : longMin) * 60;

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

  const total = secsFor(phase);
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const phaseLabel =
    phase === "focus" ? (t.clockPomodoroFocus ?? "Foco") : phase === "short" ? (t.clockPomodoroShort ?? "Pausa") : (t.clockPomodoroLong ?? "Pausa longa");
  const mm = pad2(Math.floor(remaining / 60));
  const ss = pad2(remaining % 60);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", phase === "focus" ? "bg-accent text-accent-ink" : "bg-chip text-ink2")}>
          {phaseLabel}
        </span>
        {big ? (
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: cycles }).map((_, i) => (
              <span key={i} className={cn("size-1.5 rounded-full", i < doneFocus % cycles || (doneFocus > 0 && doneFocus % cycles === 0) ? "bg-good" : "bg-edge")} />
            ))}
          </span>
        ) : null}
      </div>
      <div className={cn(num, "font-[800] leading-none tabular-nums", big ? "text-[32px]" : "text-[20px]")}>
        {mm}:{ss}
      </div>
      {big ? (
        <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-chip">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      ) : null}
      <div className="flex items-center gap-1.5" data-gamepad-content="true">
        <ControlButton primary={!running} title={running ? (t.clockPause ?? "Pausar") : (t.clockStart ?? "Iniciar")} onClick={() => setRunning((v) => !v)}>
          {running ? (t.clockPause ?? "Pausar") : (t.clockStart ?? "Iniciar")}
        </ControlButton>
        <ControlButton
          title={t.clockPomodoroSkip ?? "Pular fase"}
          onClick={() => {
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
          }}
        >
          {t.clockPomodoroSkip ?? "Pular"}
        </ControlButton>
        <ControlButton
          title={t.clockReset ?? "Zerar"}
          onClick={() => {
            setRunning(false);
            setPhase("focus");
            setRemaining(focusMin * 60);
            setDoneFocus(0);
          }}
        >
          {t.clockReset ?? "Zerar"}
        </ControlButton>
      </div>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────

export function ClockBoardCard({ config, nowMs, size, t, onConfigure }: { config: ClockConfig; nowMs: number; size: CardSize; t: T; onConfigure?: () => void }) {
  const mode = config.mode ?? "clock";
  if (mode === "countdown") return <CountdownView config={config} nowMs={nowMs} size={size} t={t} onConfigure={onConfigure} />;
  if (mode === "stopwatch") return <StopwatchView size={size} t={t} />;
  if (mode === "pomodoro") return <PomodoroView config={config} size={size} t={t} />;
  return <ClockView config={config} nowMs={nowMs} size={size} t={t} />;
}

export function clockTitle(config: ClockConfig | null | undefined, t: T): string {
  const c = config ?? DEFAULT_CLOCK_CONFIG;
  const base = c.label?.trim() || cityForTimezone(c.timezone) || t.widgetClock;
  if (c.mode === "countdown") return c.countdownLabel?.trim() || base;
  if (c.mode === "stopwatch") return c.label?.trim() || (t.clockStopwatch ?? "Cronômetro");
  if (c.mode === "pomodoro") return c.label?.trim() || (t.clockPomodoro ?? "Pomodoro");
  return base;
}
