import { useEffect, useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { cardLabel, errorText, num } from "../../tw";

/** Widget "Sistema" — saúde do próprio coletor (uptime/memória/CPU), sem "conta"/OAuth. */
export function systemAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg", "free"];
}

export function systemSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.widgetSmall;
  if (s === "md") return t.cardNormal;
  if (s === "free") return t.cardFree;
  return t.cardLarge;
}

type SystemLastCycle = {
  at: string | null;
  duration_ms: number | null;
  ok: boolean | null;
  error: string | null;
  interval_s: number;
};

type SystemStatus = {
  ok: boolean;
  version: string;
  node_version: string;
  platform: string;
  started_at: string;
  uptime_s: number;
  memory: { rss_mb: number; heap_used_mb: number; heap_total_mb: number };
  cpu: { cores: number; load1: number; load5: number; load15: number };
  last_cycle: SystemLastCycle | null;
};

const POLL_MS = 10000;

function useSystemStatus(): SystemStatus | null | "offline" {
  const [state, setState] = useState<SystemStatus | null | "offline">(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/system", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as SystemStatus;
        if (alive) setState(data);
      } catch {
        if (alive) setState("offline");
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  return state;
}

function fmtUptime(totalS: number): string {
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function fmtMb(n: number): string {
  return `${Math.round(n)} MB`;
}

function fmtLastCycle(lc: SystemLastCycle | null, t: T): string {
  if (!lc || !lc.at) return t.systemNever;
  const time = lc.at.slice(11, 16);
  return lc.duration_ms != null ? `${time} · ${lc.duration_ms}ms` : time;
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={cn("size-[7px] shrink-0 rounded-full", ok ? "bg-good" : "bg-bad")} />;
}

function Icon({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]", compact ? "size-7 rounded-[8px]" : "size-[42px]")}>
      <svg width={compact ? 14 : 22} height={compact ? 14 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-[12px]">
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{label}</span>
      <span className={cn(num, "shrink-0 font-bold text-ink")}>{value}</span>
    </div>
  );
}

export function SystemBoardCard({ t, size }: { t: T; size: CardSize }) {
  const ns = normalizeSize(size);
  const state = useSystemStatus();
  const isCompact = ns === "sm";

  if (state === "offline") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
        <Icon compact={isCompact} />
        <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{t.systemOffline}</div>
      </div>
    );
  }

  if (!state) {
    return <div className="flex h-full min-h-0 w-full items-center justify-center opacity-60"><Icon compact={isCompact} /></div>;
  }

  if (ns === "sm") {
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <Icon compact />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{t.systemUptime}</div>
          <div className={cn(num, "mt-1 text-[13px] font-[800] leading-tight")}>{fmtUptime(state.uptime_s)}</div>
        </div>
        <Dot ok={state.last_cycle?.ok ?? true} />
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="mb-2.5 flex items-center gap-2.5">
          <Icon />
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-[650] leading-none">{t.widgetSystem}</div>
            <div className={cardLabel}>{t.systemUptime} {fmtUptime(state.uptime_s)}</div>
          </div>
          <Dot ok={state.last_cycle?.ok ?? true} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5">
          <Row label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} />
          <Row label={t.systemCpuLoad} value={state.cpu.load1.toFixed(2)} />
        </div>
      </div>
    );
  }

  // lg/free — resumo completo
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="mb-3 flex items-center gap-2.5">
        <Icon />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-[650] leading-none">{t.widgetSystem}</div>
          <div className={cardLabel}>v{state.version} · {state.platform}</div>
        </div>
        <Dot ok={state.last_cycle?.ok ?? true} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        <Row label={t.systemUptime} value={fmtUptime(state.uptime_s)} />
        <Row label={t.systemMemory} value={`${fmtMb(state.memory.rss_mb)} (heap ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)})`} />
        <Row label={t.systemCpuLoad} value={`${state.cpu.load1.toFixed(2)} · ${state.cpu.cores} ${t.systemCores}`} />
        <Row label={t.systemLastCycle} value={fmtLastCycle(state.last_cycle, t)} />
      </div>
      {state.last_cycle?.error ? <div className={cn(errorText, "mt-2")}>{state.last_cycle.error}</div> : null}
    </div>
  );
}
