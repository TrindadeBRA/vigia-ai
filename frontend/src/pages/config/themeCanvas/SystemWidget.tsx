import { cn } from "../../../cn";
import { fmtGb, fmtLoad, fmtMb, fmtUptime, useSystemStatus } from "../../../components/cards/SystemCard";
import { barFill, barTrack, num } from "../../../tw";
import type { ThemeSystemWidget } from "./state";

function barColor(pct: number): string {
  if (pct < 70) return "var(--good)";
  if (pct < 90) return "var(--warn)";
  return "var(--bad)";
}

function memPct(heapUsed: number, heapTotal: number): number {
  if (!heapTotal || heapTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (heapUsed / heapTotal) * 100));
}

function cpuPct(load1: number, cores: number): number {
  const c = Math.max(1, cores);
  return Math.max(0, Math.min(100, (load1 / c) * 100));
}

/** Widget de sistema do canvas — minimal (uptime), compact (+mem/cpu) ou full (+ciclo/armazenamento). */
export function CanvasSystemWidget({ widget, zoom }: { widget: ThemeSystemWidget; zoom: number }) {
  const state = useSystemStatus();
  const fs = Math.max(9, 12 * widget.scale * zoom);
  const small = Math.max(8, fs * 0.62);
  const bg = widget.showBackground ? "bg-black/35" : "bg-transparent";
  const box: React.CSSProperties = {
    color: widget.color || undefined,
    background: widget.showBackground ? widget.bgColor || undefined : undefined,
  };

  if (state === "offline") {
    return (
      <span className={cn("rounded-md px-2 py-1 font-semibold text-white", bg)} style={{ ...box, fontSize: small }}>
        sistema offline
      </span>
    );
  }
  if (!state) {
    return (
      <span className={cn("rounded-md px-2 py-1 font-semibold text-white opacity-60", bg)} style={{ ...box, fontSize: small }}>
        …
      </span>
    );
  }

  const mp = memPct(state.memory.heap_used_mb, state.memory.heap_total_mb);
  const cp = cpuPct(state.cpu.load1, state.cpu.cores);
  const detail = widget.detail ?? "compact";

  return (
    <span
      className={cn("flex min-w-0 flex-col items-stretch gap-1 rounded-md px-2 py-1 text-white", bg)}
      style={{ ...box, fontSize: small, minWidth: `${Math.round(120 * widget.scale * zoom)}px` }}
    >
      <span className="flex items-center gap-1.5">
        <span className={cn("size-[7px] shrink-0 rounded-full", state.last_cycle?.ok === false ? "bg-bad" : "bg-good")} />
        <span className={cn(num, "font-bold leading-none tabular-nums")} style={{ fontSize: fs }}>
          {fmtUptime(state.uptime_s)}
        </span>
        <span className="truncate font-medium uppercase tracking-wide opacity-70" style={{ fontSize: small * 0.8 }}>
          uptime
        </span>
      </span>
      {detail === "minimal" ? null : (
        <span className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="opacity-70">mem</span>
            <span className={cn(num, "font-bold tabular-nums")}>{fmtMb(state.memory.rss_mb)}</span>
          </span>
          <span className={cn(barTrack, "h-[4px]")}>
            <span className={barFill} style={{ width: `${mp}%`, background: barColor(mp) }} />
          </span>
          <span className="flex items-baseline justify-between gap-2">
            <span className="opacity-70">cpu ×{state.cpu.cores}</span>
            <span className={cn(num, "font-bold tabular-nums")}>{fmtLoad(state.cpu.load1)}</span>
          </span>
          <span className={cn(barTrack, "h-[4px]")}>
            <span className={barFill} style={{ width: `${cp}%`, background: barColor(cp) }} />
          </span>
        </span>
      )}
      {detail === "full" ? (
        <span className="flex flex-col gap-0.5 opacity-80">
          {state.last_cycle?.at ? (
            <span className={cn(num, "tabular-nums")}>
              ciclo {state.last_cycle.at.slice(11, 16)}
              {state.last_cycle.duration_ms != null ? ` · ${state.last_cycle.duration_ms}ms` : ""}
            </span>
          ) : null}
          {state.storage?.[0] ? (
            <span className={cn(num, "tabular-nums")}>
              {fmtGb(state.storage[0].free_gb)} livre · {state.storage[0].use_percent}%
            </span>
          ) : null}
          <span className={cn(num, "tabular-nums")}>
            v{state.version} · {state.node_version}
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function systemWidgetTitle(widget: ThemeSystemWidget): string {
  if (widget.detail === "minimal") return "Sistema · resumido";
  if (widget.detail === "full") return "Sistema · completo";
  return "Sistema";
}
