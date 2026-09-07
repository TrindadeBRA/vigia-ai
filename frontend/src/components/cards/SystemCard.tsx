import { useEffect, useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { barFill, barTrack, cardLabel, errorText, num } from "../../tw";

/**
 * Widget "Sistema" — saúde do próprio coletor (uptime/memória/CPU/último ciclo).
 * Inspirado em ClaudeCard/WeatherCard: 3 camadas (sm/sw/sx hero 2×1, md 2×2, lg 4×2, xl/wm/wl completos).
 *
 * Variações por tamanho (grid 1/4):
 *  xs  (1×1  ~84×44)  — ultra-compacto, só ícone + dot + uptime abreviado
 *  sm  (2×1) — hero UPTIME: ícone à esquerda, uptime grande, sub versão/plataforma
 *  sw  (2×1) — hero MEMÓRIA: heap bar + RSS/heap numbers
 *  sx  (2×1) — hero CPU: gauge/load + cores
 *  md  (2×2) — compacto: 2 barras (memória + CPU) + uptime no header
 *  lg  (4×2) — dashboard 2 colunas: uptime · memória · CPU · último ciclo
 *  xl  (4×4) — completo com gauges lado a lado + barras + meta pills
 *  wl  (4×8) — longo vertical, pilha espaçada, ideal pra 2×4 parede
 *  wm  (2×3) — médio-alto, entre md e wl
 *  free — livre, segue layout lg/xl com scroll
 *
 * Variações visuais inclusas: hero, barras, gauges circulares e lista detalhada.
 */

export function systemAllowedSizes(): CardSize[] {
  return ["xs", "sm", "sw", "sx", "md", "lg", "xl", "wm", "wl", "free"];
}

export function systemSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "xs") return t.widgetQuarter; // 1/4
  if (s === "sm") return `${t.cardSmallPrefix} uptime`;
  if (s === "sw") return `${t.cardSmallPrefix} memória`;
  if (s === "sx") return `${t.cardSmallPrefix} CPU`;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "xl") return t.cardXl;
  if (s === "wm") return "Médio · alto";
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  if (s === "free") return t.cardFree;
  return t.cardNormal;
}

type SystemLastCycle = {
  at: string | null;
  duration_ms: number | null;
  ok: boolean | null;
  error: string | null;
  interval_s: number;
};

type DiskInfo = {
  name: string;
  mount: string;
  filesystem: string;
  label: string;
  total_bytes: number;
  free_bytes: number;
  used_bytes: number;
  total_gb: number;
  free_gb: number;
  used_gb: number;
  use_percent: number;
};

type SystemDetails = {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  cpu_model: string;
  cpu_cores: number;
  total_mem_mb: number;
  free_mem_mb: number;
  used_mem_mb: number;
  mem_percent: number;
  uptime_s: number;
  load1: number;
  load5: number;
  load15: number;
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
  system?: SystemDetails | null;
  storage?: DiskInfo[] | null;
  last_cycle: SystemLastCycle | null;
};

const POLL_MS = 10000;

function useSystemStatus(): SystemStatus | null | "offline" {
  const [state, setState] = useState<SystemStatus | null | "offline">(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      // pausa poll quando aba oculta para economizar
      if (document.visibilityState === "hidden") return;
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
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return state;
}

// ── formatters ───────────────────────────────────────────────────────

function fmtUptime(totalS: number): string {
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${Math.max(0, Math.floor(totalS))}s`;
}

function fmtUptimeShort(totalS: number): string {
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

function fmtMb(n: number): string {
  if (!Number.isFinite(n)) return "--";
  return `${Math.round(n)} MB`;
}

function fmtLoad(v: number): string {
  if (!Number.isFinite(v)) return "--";
  return v.toFixed(2);
}

function fmtGb(n: number): string {
  if (!Number.isFinite(n)) return "--";
  if (n >= 1024) return `${(n / 1024).toFixed(1)} TB`;
  return `${n.toFixed(1)} GB`;
}

function fmtDiskLabel(d: DiskInfo): string {
  // prefer name, fallback to mount
  const raw = d.name || d.mount || d.filesystem;
  // shorten long paths
  if (raw.length > 22) return raw.slice(0, 22) + "…";
  return raw;
}

function fmtLastCycleShort(lc: SystemLastCycle | null, t: T): string {
  if (!lc || !lc.at) return t.systemNever;
  const time = lc.at.slice(11, 16);
  return lc.duration_ms != null ? `${time} · ${lc.duration_ms}ms` : time;
}

function fmtPlatformShort(p: string): string {
  // "linux x64" -> "linux x64", "darwin arm64" -> "mac arm64"
  if (!p) return "--";
  return p.replace("darwin", "mac").slice(0, 18);
}

function memPct(s: SystemStatus): number {
  const { heap_used_mb, heap_total_mb } = s.memory;
  if (!heap_total_mb || heap_total_mb <= 0) return 0;
  return Math.max(0, Math.min(100, (heap_used_mb / heap_total_mb) * 100));
}

function cpuPct(s: SystemStatus): number {
  const { load1, cores } = s.cpu;
  const c = Math.max(1, cores);
  return Math.max(0, Math.min(100, (load1 / c) * 100));
}

function barColorVar(pct: number): string {
  if (pct < 70) return "var(--good)";
  if (pct < 90) return "var(--warn)";
  return "var(--bad)";
}

function barGlowVar(pct: number): string {
  if (pct < 70) return "none";
  if (pct < 90) return "0 0 7px color-mix(in srgb, var(--warn) 38%, transparent)";
  return "0 0 10px color-mix(in srgb, var(--bad) 50%, transparent)";
}

// ── primitivos visuais ─────────────────────────────────────────────

function Dot({ ok, pulse }: { ok: boolean | null; pulse?: boolean }) {
  const isOk = ok !== false;
  return (
    <span
      className={cn(
        "size-[7px] shrink-0 rounded-full",
        isOk ? "bg-good" : "bg-bad",
        pulse && isOk && "shadow-[0_0_6px_var(--good)]",
      )}
    />
  );
}

function Icon({ compact, mini }: { compact?: boolean; mini?: boolean }) {
  // chip/CPU icon: more expressive than generic monitor
  if (mini) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
          <rect x="10" y="10" width="4" height="4" rx="0.5" className="fill-ink2/20" />
        </svg>
      </div>
    );
  }
  const size = compact ? 14 : 20;
  const box = compact ? "size-7 rounded-[8px]" : "size-[42px] rounded-[13px]";
  return (
    <div className={cn("flex shrink-0 items-center justify-center bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]", box)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.7" className="fill-ink2/15" />
      </svg>
    </div>
  );
}

function Header({
  state,
  compact,
  subtitle,
}: {
  state: SystemStatus;
  compact?: boolean;
  subtitle?: string;
}) {
  const ok = state.last_cycle?.ok ?? true;
  return (
    <div className={cn("flex items-center gap-2.5", compact ? "mb-1.5 gap-2" : "mb-2.5")}>
      <div className="relative shrink-0">
        <Icon compact={compact} />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]",
            ok ? "bg-good" : "bg-bad",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>Sistema</div>
        <div className={cardLabel}>{subtitle ?? `v${state.version} · ${fmtPlatformShort(state.platform)}`}</div>
      </div>
      <Dot ok={ok} pulse />
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-[12px]">
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{label}</span>
      <span className="flex shrink-0 items-baseline gap-1">
        <span className={cn(num, "font-bold text-ink")}>{value}</span>
        {sub ? <span className="text-[11px] text-ink3">{sub}</span> : null}
      </span>
    </div>
  );
}

function BarRow({
  label,
  value,
  pct,
  sub,
}: {
  label: string;
  value: string;
  pct: number;
  sub?: string | null;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{label}</span>
        <span className={cn(num, "shrink-0 text-[12px] font-bold text-ink")}>{value}</span>
      </div>
      <div className={cn(barTrack, "h-[5px]")}>
        <div className={barFill} style={{ width: `${p}%`, background: barColorVar(p), boxShadow: barGlowVar(p) } as React.CSSProperties} />
      </div>
      {sub ? <div className={cn(num, "mt-1 text-[11px] font-[500] text-ink2")}>{sub}</div> : null}
    </div>
  );
}

function Gauge({ pct, label, value }: { pct: number; label: string; value: string }) {
  const p = Math.max(0, Math.min(100, pct));
  // 100 = full circle, we use circumference 100 for easy math
  const color = barColorVar(p);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative size-[56px]">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--track)" strokeWidth="3.5" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${p} ${100 - p}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        </svg>
        <span className={cn(num, "pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-[800] leading-none")}>{value}</span>
      </div>
      <span className="text-[11px] font-semibold leading-none text-ink3">{label}</span>
    </div>
  );
}

function StorageSection({ storage, compact }: { storage: DiskInfo[]; compact?: boolean }) {
  if (!storage || storage.length === 0) return null;
  const disks = storage.slice(0, compact ? 2 : 6);
  return (
    <div className={cn("space-y-2", compact ? "mt-2" : "mt-1")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink3">Armazenamento</div>
      <div className="space-y-2">
        {disks.map((d) => (
          <div key={d.mount} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-ink2" title={`${d.name} · ${d.mount}`}>
                {fmtDiskLabel(d)}
              </span>
              <span className={cn(num, "shrink-0 text-[11px] font-bold text-ink")}>
                {fmtGb(d.free_gb)} livre
              </span>
            </div>
            <div className={cn(barTrack, "h-[5px]")}>
              <div
                className={barFill}
                style={{ width: `${d.use_percent}%`, background: barColorVar(d.use_percent), boxShadow: barGlowVar(d.use_percent) } as React.CSSProperties}
              />
            </div>
            <div className={cn(num, "mt-1 flex justify-between text-[11px] font-[500] text-ink2")}>
              <span>{fmtGb(d.used_gb)} usados</span>
              <span>{fmtGb(d.total_gb)} total · {d.use_percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemDetailsSection({ details }: { details: SystemDetails }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-edge bg-chip/40 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink3">Detalhes do sistema</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <span className="text-ink3">Host</span>
        <span className={cn(num, "truncate text-right font-semibold text-ink")} title={details.hostname}>{details.hostname}</span>
        <span className="text-ink3">CPU</span>
        <span className="truncate text-right text-ink2" title={details.cpu_model}>{details.cpu_model} · {details.cpu_cores} cores</span>
        <span className="text-ink3">SO</span>
        <span className="truncate text-right text-ink2">{details.platform} · {details.release}</span>
        <span className="text-ink3">RAM</span>
        <span className={cn(num, "text-right font-medium text-ink2")}>{details.used_mem_mb} / {details.total_mem_mb} MB · {details.mem_percent}%</span>
      </div>
    </div>
  );
}

// ── Board card ─────────────────────────────────────────────────────

export function SystemBoardCard({ t, size }: { t: T; size: CardSize }) {
  const ns = normalizeSize(size);
  const state = useSystemStatus();
  const isCompact = ns === "sm" || ns === "sw" || ns === "sx" || ns === "xs";

  if (state === "offline") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
        <Icon compact={isCompact} mini={ns === "xs"} />
        <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{t.systemOffline}</div>
        {ns !== "xs" && ns !== "sm" ? <div className="text-[11px] text-ink3">/api/system · 10s poll</div> : null}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center opacity-60">
        <Icon compact={isCompact} mini={ns === "xs"} />
      </div>
    );
  }

  const mp = memPct(state);
  const cp = cpuPct(state);
  const ok = state.last_cycle?.ok ?? true;

  // ── xs: 1×1 quarter — ultra-compacto
  if (ns === "xs") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 overflow-hidden p-1">
        <div className="relative">
          <Icon mini />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[6px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <div className={cn(num, "text-[11px] font-[800] leading-none")}>{fmtUptimeShort(state.uptime_s)}</div>
        <div className="text-[10px] leading-none text-ink3">{fmtMb(state.memory.rss_mb)}</div>
      </div>
    );
  }

  // ── sm: hero UPTIME
  if (ns === "sm") {
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <Icon compact={false} />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{t.systemUptime}</div>
          <div className={cn(num, "mt-1 text-[18px] font-[800] leading-none")}>{fmtUptime(state.uptime_s)}</div>
          <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none text-ink2">
            v{state.version} · {fmtPlatformShort(state.platform)}
          </div>
        </div>
        <Dot ok={ok} />
      </div>
    );
  }

  // ── sw: hero MEMÓRIA
  if (ns === "sw") {
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <Icon compact={false} />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{t.systemMemory}</div>
          <div className={cn(num, "mt-1 text-[18px] font-[800] leading-none")}>{fmtMb(state.memory.rss_mb)}</div>
          <div className={cn(barTrack, "mt-1.5 h-[4px]")}>
            <div className={barFill} style={{ width: `${mp}%`, background: barColorVar(mp), boxShadow: barGlowVar(mp) } as React.CSSProperties} />
          </div>
          <div className={cn(num, "mt-1 text-[10px] leading-none text-ink2")}>heap {fmtMb(state.memory.heap_used_mb)}/{fmtMb(state.memory.heap_total_mb)} · {Math.round(mp)}%</div>
        </div>
        <Dot ok={ok} />
      </div>
    );
  }

  // ── sx: hero CPU
  if (ns === "sx") {
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <Icon compact={false} />
          <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border border-edge bg-panel text-[10px] font-bold leading-none">
            ×{state.cpu.cores}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{t.systemCpuLoad}</div>
          <div className={cn(num, "mt-1 text-[18px] font-[800] leading-none")}>{fmtLoad(state.cpu.load1)}</div>
          <div className={cn(barTrack, "mt-1.5 h-[4px]")}>
            <div className={barFill} style={{ width: `${cp}%`, background: barColorVar(cp), boxShadow: barGlowVar(cp) } as React.CSSProperties} />
          </div>
          <div className={cn(num, "mt-1 text-[10px] leading-none text-ink2")}>{Math.round(cp)}% · {state.cpu.cores} {t.systemCores}</div>
        </div>
        <Dot ok={ok} />
      </div>
    );
  }

  // ── sc / scw fallback (aliases to sm)
  if (ns === "sc" || ns === "scw") {
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <Icon compact />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{t.widgetSystem}</div>
          <div className={cn(num, "mt-1 text-[13px] font-[800] leading-tight")}>{fmtUptime(state.uptime_s)} · {fmtMb(state.memory.rss_mb)}</div>
        </div>
        <Dot ok={ok} />
      </div>
    );
  }

  // ── md: 2×2 compacto — 2 barras + storage resumido
  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} compact />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto [scrollbar-width:thin]">
          <BarRow label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} pct={mp} sub={`heap ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)}`} />
          <BarRow label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} pct={cp} sub={`${state.cpu.cores} ${t.systemCores} · 5m ${fmtLoad(state.cpu.load5)}`} />
          {state.storage?.length ? <StorageSection storage={state.storage} compact /> : null}
        </div>
      </div>
    );
  }

  // ── lg: 4×2 largo — grade 2×2 + storage inline
  if (ns === "lg") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} />
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 content-center">
          <Row label={t.systemUptime} value={fmtUptime(state.uptime_s)} />
          <Row label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} sub={`${Math.round(mp)}%`} />
          <Row label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} sub={`×${state.cpu.cores}`} />
          <Row label={t.systemLastCycle} value={fmtLastCycleShort(state.last_cycle, t)} />
        </div>
        {state.storage?.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {state.storage.slice(0, 2).map((d) => (
              <div key={d.mount} className="min-w-0 rounded-lg border border-edge bg-chip/40 px-2 py-1.5">
                <div className="truncate text-[11px] font-semibold leading-none text-ink2" title={`${d.name} · ${d.mount}`}>{fmtDiskLabel(d)}</div>
                <div className={cn(num, "mt-1 text-[11px] leading-none text-ink3")}>{fmtGb(d.free_gb)} livre · {fmtGb(d.total_gb)} total</div>
                <div className={cn(barTrack, "mt-1.5 h-[4px]")}>
                  <div className={barFill} style={{ width: `${d.use_percent}%`, background: barColorVar(d.use_percent) } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {state.last_cycle?.error ? <div className={cn(errorText, "mt-2 line-clamp-2")}>{state.last_cycle.error}</div> : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink3">heap {fmtMb(state.memory.heap_used_mb)}/{fmtMb(state.memory.heap_total_mb)}</span>
          <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink3">{state.node_version}</span>
        </div>
      </div>
    );
  }

  // ── xl: 4×4 — gauges + barras + storage + meta
  if (ns === "xl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} subtitle={`${t.systemUptime} ${fmtUptime(state.uptime_s)} · ${state.node_version}`} />
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="flex min-w-[132px] shrink-0 flex-col items-center justify-center gap-3 rounded-xl border border-edge bg-chip px-3 py-3">
            <div className="flex items-center justify-center gap-3">
              <Gauge pct={mp} label="HEAP" value={`${Math.round(mp)}%`} />
              <Gauge pct={cp} label="CPU" value={fmtLoad(state.cpu.load1)} />
            </div>
            {state.storage?.length ? (
              <div className="w-full space-y-1.5 border-t border-edge pt-2">
                {state.storage.slice(0, 2).map((d) => (
                  <div key={d.mount} className="min-w-0">
                    <div className="truncate text-[10px] font-semibold leading-none text-ink2" title={`${d.name} · ${d.mount}`}>{fmtDiskLabel(d)}</div>
                    <div className={cn(barTrack, "mt-1 h-[3px]")}>
                      <div className={barFill} style={{ width: `${d.use_percent}%`, background: barColorVar(d.use_percent) } as React.CSSProperties} />
                    </div>
                    <div className={cn(num, "mt-0.5 text-[10px] leading-none text-ink3")}>{fmtGb(d.free_gb)} livre</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 overflow-y-auto [scrollbar-width:thin]">
            <Row label={t.systemMemory} value={`${fmtMb(state.memory.rss_mb)}`} sub={`heap ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)}`} />
            <div className={cn(barTrack, "h-[6px]")}>
              <div className={barFill} style={{ width: `${mp}%`, background: barColorVar(mp), boxShadow: barGlowVar(mp) } as React.CSSProperties} />
            </div>
            <Row label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} sub={`${state.cpu.cores} ${t.systemCores} · load5 ${fmtLoad(state.cpu.load5)}`} />
            <div className={cn(barTrack, "h-[6px]")}>
              <div className={barFill} style={{ width: `${cp}%`, background: barColorVar(cp), boxShadow: barGlowVar(cp) } as React.CSSProperties} />
            </div>
            <Row label={t.systemLastCycle} value={fmtLastCycleShort(state.last_cycle, t)} sub={state.last_cycle?.ok === false ? "erro" : `a cada ${state.last_cycle?.interval_s ?? "--"}s`} />
            {state.last_cycle?.error ? <div className={cn(errorText, "line-clamp-2 text-[11px]")}>{state.last_cycle.error}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  // ── wm: 2×3 médio-alto — mistura de md + detalhes + storage
  if (ns === "wm") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} />
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-2 overflow-y-auto [scrollbar-width:thin]">
          <Row label={t.systemUptime} value={fmtUptime(state.uptime_s)} />
          <BarRow label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} pct={mp} sub={`heap ${Math.round(mp)}% · ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)}`} />
          <BarRow label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} pct={cp} sub={`${state.cpu.cores} ${t.systemCores} · 15m ${fmtLoad(state.cpu.load15)}`} />
          <Row label={t.systemLastCycle} value={fmtLastCycleShort(state.last_cycle, t)} />
          {state.storage?.length ? <StorageSection storage={state.storage} compact /> : null}
        </div>
        {state.last_cycle?.error ? <div className={cn(errorText, "mt-2 line-clamp-2 text-[11px]")}>{state.last_cycle.error}</div> : null}
      </div>
    );
  }

  // ── wl / wxl / free — longo / super largo / livre: pilha detalhada + storage + detalhes
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <Header state={state} />
      <div className="flex min-h-0 flex-1 flex-col justify-start gap-2.5 overflow-y-auto [scrollbar-width:thin]">
        <Row label={t.systemUptime} value={fmtUptime(state.uptime_s)} sub={state.started_at ? new Date(state.started_at).toLocaleString() : null} />
        <div className="space-y-1">
          <Row label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} sub={`heap ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)} · ${Math.round(mp)}%`} />
          <div className={cn(barTrack, "h-[6px]")}>
            <div className={barFill} style={{ width: `${mp}%`, background: barColorVar(mp), boxShadow: barGlowVar(mp) } as React.CSSProperties} />
          </div>
        </div>
        <div className="space-y-1">
          <Row label={t.systemCpuLoad} value={`${fmtLoad(state.cpu.load1)} / ${fmtLoad(state.cpu.load5)} / ${fmtLoad(state.cpu.load15)}`} sub={`${state.cpu.cores} ${t.systemCores}`} />
          <div className={cn(barTrack, "h-[6px]")}>
            <div className={barFill} style={{ width: `${cp}%`, background: barColorVar(cp), boxShadow: barGlowVar(cp) } as React.CSSProperties} />
          </div>
        </div>
        <Row label={t.systemLastCycle} value={fmtLastCycleShort(state.last_cycle, t)} sub={state.last_cycle?.interval_s ? `a cada ${state.last_cycle.interval_s}s` : null} />
        {state.system ? <SystemDetailsSection details={state.system} /> : null}
        {state.storage?.length ? <StorageSection storage={state.storage} /> : null}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink3">v{state.version}</span>
          <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink3">{state.node_version}</span>
          <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink3">{fmtPlatformShort(state.platform)}</span>
        </div>
      </div>
      {state.last_cycle?.error ? <div className={cn(errorText, "mt-2 line-clamp-2")}>{state.last_cycle.error}</div> : null}
    </div>
  );
}

// ── Variações exportadas (para previews / testes visuais) ───────────
// Mantém compatibilidade: TileCards usa SystemBoardCard; estas são extras para
// demonstrar estilos alternativos sem duplicar lógica de dados.

// Alias legível para quem quiser forçar um hero específico sem depender de size.
export const SystemHeroUptimeCard = (props: { t: T }) => <SystemBoardCard t={props.t} size="sm" />;
export const SystemHeroMemoryCard = (props: { t: T }) => <SystemBoardCard t={props.t} size="sw" />;
export const SystemHeroCpuCard = (props: { t: T }) => <SystemBoardCard t={props.t} size="sx" />;
export const SystemGaugesCard = (props: { t: T }) => <SystemBoardCard t={props.t} size="xl" />;
export const SystemVitalsCard = (props: { t: T }) => <SystemBoardCard t={props.t} size="wm" />;
