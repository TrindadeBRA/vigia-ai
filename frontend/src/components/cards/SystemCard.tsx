import { useEffect, useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { barFill, barTrack, cardLabel, errorText, num } from "../../tw";

/**
 * Widget "Sistema" — saúde do próprio coletor (uptime/memória/CPU/último ciclo + rede/temperatura/fans/bateria).
 * Inspirado em ClaudeCard/WeatherCard: 3 camadas (sm/sw/sx hero 2×1, md 2×2, lg 4×2, xl/wm/wl completos).
 *
 * Variações por tamanho (grid 1/4):
 *  xs  (1×1  ~84×44)  — ultra-compacto, só ícone + dot + uptime abreviado
 *  sm  (2×1) — hero UPTIME: ícone à esquerda, uptime grande, sub versão/plataforma
 *  sw  (2×1) — hero MEMÓRIA: heap bar + RSS/heap numbers
 *  sx  (2×1) — hero CPU: gauge/load + cores
 *  md  (2×2) — compacto: 2 barras (memória + CPU) + rede/bateria/temperatura compactos
 *  lg  (4×2) — dashboard 2 colunas: uptime · memória · CPU · último ciclo + rede/thermal/bateria inline
 *  xl  (4×4) — completo com gauges lado a lado + barras + rede/thermal/fans/bateria
 *  wl  (4×8) — longo vertical, pilha espaçada, ideal pra 2×4 parede
 *  wm  (2×3) — médio-alto, entre md e wl
 *  free — livre, segue layout lg/xl com scroll
 *
 * Variações visuais inclusas: hero, barras, gauges circulares e lista detalhada.
 * Seções de rede/temperatura/fans/bateria são omitidas quando indisponíveis (sem sensores/bateria).
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

type NetworkInfo = {
  name: string;
  type: "wired" | "wifi" | "virtual" | "unknown";
  speed_mbps: number | null;
  rx_bytes: number;
  tx_bytes: number;
  rx_rate_bps: number | null;
  tx_rate_bps: number | null;
  ip: string | null;
  mac: string | null;
  is_up: boolean;
};

type ThermalSensor = {
  label: string;
  value_c: number;
  type: "cpu" | "gpu" | "other";
  critical_c?: number | null;
};

type FanInfo = {
  label: string;
  rpm: number;
};

type BatteryInfo = {
  percent: number;
  is_charging: boolean;
  is_present: boolean;
  time_remaining_min?: number | null;
  health_percent?: number | null;
  model?: string | null;
  status?: string | null;
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
  network?: NetworkInfo[] | null;
  thermal?: ThermalSensor[] | null;
  fans?: FanInfo[] | null;
  battery?: BatteryInfo | null;
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

function fmtTemp(c: number): string {
  if (!Number.isFinite(c)) return "--";
  return `${Math.round(c)}°C`;
}

function fmtSpeed(mbps: number | null): string {
  if (mbps == null || !Number.isFinite(mbps)) return "--";
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Gbps`;
  return `${Math.round(mbps)} Mbps`;
}

function fmtBps(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return "";
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(1)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${Math.round(bps)} bps`;
}

function fmtRpm(rpm: number): string {
  if (!Number.isFinite(rpm)) return "--";
  return `${Math.round(rpm).toLocaleString("pt-BR")} RPM`;
}

function fmtBatteryTime(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(mins) || mins <= 0 || mins > 100000) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function tempColor(c: number, critical?: number | null): string {
  if (critical != null && Number.isFinite(critical) && c >= critical - 5) return "var(--bad)";
  if (c >= 85) return "var(--bad)";
  if (c >= 70) return "var(--warn)";
  return "var(--good)";
}

function tempGlow(c: number, critical?: number | null): string {
  if (critical != null && Number.isFinite(critical) && c >= critical - 5) return "0 0 10px color-mix(in srgb, var(--bad) 50%, transparent)";
  if (c >= 85) return "0 0 10px color-mix(in srgb, var(--bad) 50%, transparent)";
  if (c >= 70) return "0 0 7px color-mix(in srgb, var(--warn) 38%, transparent)";
  return "none";
}

function batteryBarColor(pct: number, charging: boolean): string {
  if (charging) return "var(--good)";
  if (pct < 20) return "var(--bad)";
  if (pct < 40) return "var(--warn)";
  return "var(--good)";
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
  const disks = storage.slice(0, compact ? 1 : 3);
  return (
    <div className={cn(compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink3">Armazenamento</div>
      <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
        {disks.map((d) => (
          <div key={d.mount} className="min-w-0">
            <div className="flex items-baseline justify-between gap-1 text-[11px] leading-none">
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-ink2" title={`${d.name} · ${d.mount}`}>
                {fmtDiskLabel(d)}
              </span>
              <span className={cn(num, "shrink-0 text-[10px] font-bold text-ink")}>{fmtGb(d.free_gb)} livre</span>
            </div>
            <div className={cn(barTrack, compact ? "mt-1 h-[3px]" : "mt-1 h-[4px]")}>
              <div className={barFill} style={{ width: `${d.use_percent}%`, background: barColorVar(d.use_percent) } as React.CSSProperties} />
            </div>
            {!compact ? (
              <div className={cn(num, "mt-0.5 flex justify-between text-[10px] leading-none text-ink3")}>
                <span>{fmtGb(d.used_gb)} usados</span>
                <span>{d.use_percent}% · {fmtGb(d.total_gb)}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StorageInline({ storage }: { storage: DiskInfo[] }) {
  if (!storage || storage.length === 0) return null;
  const disks = storage.slice(0, 2);
  return (
    <div className="grid grid-cols-2 gap-2">
      {disks.map((d) => (
        <div key={d.mount} className="min-w-0 rounded-lg border border-edge bg-chip/40 px-2 py-1.5">
          <div className="truncate text-[10px] font-semibold leading-none text-ink2" title={`${d.name} · ${d.mount}`}>{fmtDiskLabel(d)}</div>
          <div className={cn(barTrack, "mt-1 h-[3px]")}>
            <div className={barFill} style={{ width: `${d.use_percent}%`, background: barColorVar(d.use_percent) } as React.CSSProperties} />
          </div>
          <div className={cn(num, "mt-1 flex justify-between text-[10px] leading-none text-ink3")}>
            <span>{fmtGb(d.free_gb)} livre</span>
            <span>{d.use_percent}%</span>
          </div>
        </div>
      ))}
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

function NetworkSection({ network, t, compact }: { network: NetworkInfo[]; t: T; compact?: boolean }) {
  if (!network || network.length === 0) return null;
  const list = network.slice(0, compact ? 1 : 3);
  return (
    <div className={cn(compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink3">{t.systemNetwork}</div>
      <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
        {list.map((n) => {
          const isWifi = n.type === "wifi";
          const label = isWifi ? t.systemNetworkWifi : n.type === "wired" ? t.systemNetworkWired : n.name;
          const speed = n.speed_mbps != null ? fmtSpeed(n.speed_mbps) : null;
          const rate = n.rx_rate_bps != null || n.tx_rate_bps != null ? `${n.rx_rate_bps != null ? t.systemNetworkRx + " " + fmtBps(n.rx_rate_bps) : ""}${n.rx_rate_bps != null && n.tx_rate_bps != null ? " · " : ""}${n.tx_rate_bps != null ? t.systemNetworkTx + " " + fmtBps(n.tx_rate_bps) : ""}`.trim() : null;
          return (
            <div key={n.name} className="flex items-center gap-1.5 rounded-lg border border-edge bg-chip/30 px-2 py-1">
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md text-[10px]", isWifi ? "bg-sky-500/15 text-sky-400" : "bg-emerald-500/15 text-emerald-400")}>
                {isWifi ? (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12a10 10 0 0 1 14 0" /><path d="M8.5 15a5 5 0 0 1 7 0" /><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" /></svg>
                ) : (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" /><path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" /><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-[11px] font-semibold leading-none text-ink2" title={`${n.name} · ${n.ip || ""}`}>{n.name}</span>
                  <span className="shrink-0 text-[10px] leading-none text-ink3">{label}</span>
                  {speed ? <span className={cn(num, "shrink-0 text-[10px] font-bold leading-none text-ink")}>{speed}</span> : null}
                  {!n.is_up ? <span className="shrink-0 rounded bg-bad/15 px-1 py-0.5 text-[9px] font-bold leading-none text-bad">offline</span> : null}
                </div>
                {!compact && (n.ip || rate) ? (
                  <div className={cn(num, "mt-0.5 flex gap-2 text-[10px] leading-none text-ink3")}>
                    {n.ip ? <span className="truncate">{n.ip}</span> : null}
                    {rate ? <span className="shrink-0">{rate}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThermalSection({ thermal, t, compact }: { thermal: ThermalSensor[]; t: T; compact?: boolean }) {
  if (!thermal || thermal.length === 0) return null;
  const list = thermal.slice(0, compact ? 2 : 4);
  return (
    <div className={cn(compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink3">{t.systemThermal}</div>
      <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
        {list.map((s) => {
          const pct = s.critical_c != null && s.critical_c > 0 ? Math.max(0, Math.min(100, (s.value_c / s.critical_c) * 100)) : Math.max(0, Math.min(100, (s.value_c / 100) * 100));
          const color = tempColor(s.value_c, s.critical_c);
          const glow = tempGlow(s.value_c, s.critical_c);
          const isGpu = s.type === "gpu";
          return (
            <div key={s.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-1 text-[11px] leading-none">
                <span className="flex items-center gap-1 min-w-0">
                  <span className={cn("size-1.5 shrink-0 rounded-full", isGpu ? "bg-violet-400" : "bg-orange-400")} />
                  <span className="truncate font-medium text-ink2" title={s.label}>{s.label.length > 22 ? s.label.slice(0, 22) + "…" : s.label}</span>
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-ink3">{isGpu ? "GPU" : s.type === "cpu" ? "CPU" : ""}</span>
                </span>
                <span className={cn(num, "shrink-0 text-[11px] font-bold")} style={{ color }}>{fmtTemp(s.value_c)}</span>
              </div>
              <div className={cn(barTrack, compact ? "mt-1 h-[3px]" : "mt-1 h-[4px]")}>
                <div className={barFill} style={{ width: `${pct}%`, background: color, boxShadow: glow } as React.CSSProperties} />
              </div>
              {!compact && s.critical_c ? <div className={cn(num, "mt-0.5 text-[10px] leading-none text-ink3")}>crítico {fmtTemp(s.critical_c)}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FansSection({ fans, t, compact }: { fans: FanInfo[]; t: T; compact?: boolean }) {
  if (!fans || fans.length === 0) return null;
  const list = fans.slice(0, compact ? 1 : 3);
  return (
    <div className={cn(compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink3">{t.systemFans}</div>
      <div className={cn(compact ? "space-y-1" : "space-y-1")}>
        {list.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-chip/30 px-2 py-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0 text-ink3"><circle cx="12" cy="12" r="3" /><path d="M12 2a10 10 0 0 1 0 20M2 12a10 10 0 0 1 20 0" opacity={0.35} /><path d="M12 2c2 2 2 6 0 8M12 22c-2-2-2-6 0-8M2 12c2-2 6-2 8 0M22 12c-2 2-6 2-8 0" /></svg>
              <span className="truncate text-[11px] font-medium text-ink2" title={f.label}>{f.label.length > 20 ? f.label.slice(0, 20) + "…" : f.label}</span>
            </span>
            <span className={cn(num, "shrink-0 text-[11px] font-bold text-ink")}>{fmtRpm(f.rpm)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatterySection({ battery, t, compact }: { battery: BatteryInfo | null | undefined; t: T; compact?: boolean }) {
  if (!battery || !battery.is_present) return null;
  const pct = Math.max(0, Math.min(100, battery.percent));
  const charging = battery.is_charging;
  const statusLabel = charging ? t.systemBatteryCharging : battery.status?.toLowerCase() === "full" ? t.systemBatteryFull : t.systemBatteryDischarging;
  const timeLabel = fmtBatteryTime(battery.time_remaining_min);
  const color = batteryBarColor(pct, charging);
  const glow = pct < 20 && !charging ? "0 0 10px color-mix(in srgb, var(--bad) 50%, transparent)" : charging ? "0 0 8px color-mix(in srgb, var(--good) 40%, transparent)" : "none";
  return (
    <div className={cn(compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5")}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink3">{t.systemBattery}</span>
        <span className={cn("text-[10px] font-semibold leading-none", charging ? "text-good" : pct < 20 ? "text-bad" : "text-ink3")}>{statusLabel}{timeLabel ? ` · ${timeLabel} ${t.systemBatteryRemaining}` : ""}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex h-[14px] flex-1 items-center rounded-[4px] border border-edge bg-surface p-[2px]">
          <div className={cn(barFill, "h-full rounded-[2px] transition-[width] duration-700")} style={{ width: `${pct}%`, background: color, boxShadow: glow } as React.CSSProperties} />
          <span className={cn(num, "pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-[800] leading-none", pct > 55 ? "text-white drop-shadow" : "text-ink")}>{pct}%</span>
        </div>
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border", charging ? "border-good/30 bg-good/15 text-good" : pct < 20 ? "border-bad/30 bg-bad/15 text-bad" : "border-edge bg-chip text-ink3")}>
          {charging ? (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" className="fill-current/20" /></svg>
          ) : (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="7" width="16" height="10" rx="2" /><path d="M20 10v4" strokeWidth="2" /><rect x="4" y="9" width={Math.max(1, Math.round((pct / 100) * 12))} height="6" rx="1" className="fill-current" stroke="none" /></svg>
          )}
        </span>
      </div>
      {!compact && battery.health_percent != null ? <div className={cn(num, "text-[10px] leading-none text-ink3")}>{t.systemBatteryHealth} {battery.health_percent}%</div> : null}
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

  // ── md: 2×2 compacto — sem scroll, storage só se couber (1 disco ultra-compacto)
  if (ns === "md") {
    const hasNet = !!state.network?.length;
    const hasBat = !!state.battery?.is_present;
    const hasTherm = !!state.thermal?.length;
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} compact />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
          <BarRow label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} pct={mp} sub={`heap ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)}`} />
          <BarRow label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} pct={cp} sub={`${state.cpu.cores} ${t.systemCores} · 5m ${fmtLoad(state.cpu.load5)}`} />
          {hasBat ? <BatterySection battery={state.battery} t={t} compact /> : hasNet ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-chip/30 px-2 py-1">
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded text-[9px]", state.network![0].type === "wifi" ? "bg-sky-500/15 text-sky-400" : "bg-emerald-500/15 text-emerald-400")}>{state.network![0].type === "wifi" ? "Wi" : "Eth"}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-none text-ink2">{state.network![0].name}</span>
              <span className={cn(num, "shrink-0 text-[10px] font-bold leading-none text-ink")}>{state.network![0].speed_mbps != null ? fmtSpeed(state.network![0].speed_mbps) : state.network![0].ip || ""}</span>
            </div>
          ) : hasTherm ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-chip/30 px-2 py-1">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: tempColor(state.thermal![0].value_c, state.thermal![0].critical_c) }} />
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-none text-ink2" title={state.thermal![0].label}>{state.thermal![0].label.slice(0, 18)}</span>
              <span className={cn(num, "shrink-0 text-[10px] font-bold leading-none")} style={{ color: tempColor(state.thermal![0].value_c, state.thermal![0].critical_c) }}>{fmtTemp(state.thermal![0].value_c)}</span>
            </div>
          ) : state.storage?.length ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-chip/30 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-none text-ink2" title={`${state.storage[0].name} · ${state.storage[0].mount}`}>{fmtDiskLabel(state.storage[0])}</span>
              <span className={cn(num, "shrink-0 text-[10px] font-bold leading-none text-ink")}>{fmtGb(state.storage[0].free_gb)} livre</span>
              <span className={cn(barTrack, "h-[3px] w-10 shrink-0")}><span className={barFill} style={{ width: `${state.storage[0].use_percent}%`, background: barColorVar(state.storage[0].use_percent) } as React.CSSProperties} /></span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── lg: 4×2 largo — 2 colunas, sem scroll, storage inline em linha única
  if (ns === "lg") {
    const net0 = state.network?.[0];
    const therm0 = state.thermal?.[0];
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Row label={t.systemUptime} value={fmtUptime(state.uptime_s)} />
            <Row label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} sub={`${Math.round(mp)}%`} />
            <Row label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} sub={`×${state.cpu.cores}`} />
            <Row label={t.systemLastCycle} value={fmtLastCycleShort(state.last_cycle, t)} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {state.battery?.is_present ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-chip px-2 py-0.5 text-[10px] font-medium">
                <span className={cn("size-1.5 rounded-full", state.battery.is_charging ? "bg-good" : state.battery.percent < 20 ? "bg-bad" : "bg-good")} />
                <span className={cn(num, "font-bold")}>{state.battery.percent}%</span>
                <span className="text-ink3">{state.battery.is_charging ? t.systemBatteryCharging : ""}</span>
              </span>
            ) : null}
            {net0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-chip px-2 py-0.5 text-[10px] font-medium text-ink3">
                <span className={cn("size-1.5 rounded-full", net0.type === "wifi" ? "bg-sky-400" : "bg-emerald-400")} />
                {net0.name} · {net0.speed_mbps != null ? fmtSpeed(net0.speed_mbps) : net0.ip || (net0.type === "wifi" ? "Wi-Fi" : "Cabo")}
              </span>
            ) : null}
            {therm0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-chip px-2 py-0.5 text-[10px] font-medium">
                <span className="size-1.5 rounded-full" style={{ background: tempColor(therm0.value_c, therm0.critical_c) }} />
                <span className={cn(num, "font-bold")} style={{ color: tempColor(therm0.value_c, therm0.critical_c) }}>{fmtTemp(therm0.value_c)}</span>
                <span className="text-ink3">{therm0.type === "gpu" ? "GPU" : "CPU"}</span>
              </span>
            ) : null}
            {state.fans?.[0] ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-chip px-2 py-0.5 text-[10px] font-medium text-ink3">
                {fmtRpm(state.fans[0].rpm)}
              </span>
            ) : null}
          </div>
          {state.storage?.length ? (
            <div className="flex items-center gap-2 rounded-lg border border-edge bg-chip/30 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-none text-ink2" title={`${state.storage[0].name} · ${state.storage[0].mount}`}>{fmtDiskLabel(state.storage[0])}</span>
              <span className={cn(num, "shrink-0 text-[10px] font-bold leading-none text-ink")}>{fmtGb(state.storage[0].free_gb)} livre · {state.storage[0].use_percent}%</span>
              <span className={cn(barTrack, "h-[3px] w-12 shrink-0")}><span className={barFill} style={{ width: `${state.storage[0].use_percent}%`, background: barColorVar(state.storage[0].use_percent) } as React.CSSProperties} /></span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-medium text-ink3">heap {fmtMb(state.memory.heap_used_mb)}/{fmtMb(state.memory.heap_total_mb)}</span>
            <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-medium text-ink3">{state.node_version}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── xl: 4×4 — gauges à esquerda, métricas à direita, storage compacto
  if (ns === "xl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Header state={state} subtitle={`${t.systemUptime} ${fmtUptime(state.uptime_s)} · ${state.node_version}`} />
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div className="flex w-[148px] shrink-0 flex-col items-center justify-center gap-2 overflow-y-auto rounded-xl border border-edge bg-chip px-3 py-2.5 [scrollbar-width:thin]">
            <div className="flex items-center justify-center gap-2.5">
              <Gauge pct={mp} label="HEAP" value={`${Math.round(mp)}%`} />
              <Gauge pct={cp} label="CPU" value={fmtLoad(state.cpu.load1)} />
            </div>
            {state.battery?.is_present ? (
              <div className="w-full border-t border-edge pt-2">
                <div className="flex items-center justify-between text-[10px] leading-none">
                  <span className="font-semibold text-ink3">{t.systemBattery}</span>
                  <span className={cn(num, "font-bold", state.battery.is_charging ? "text-good" : state.battery.percent < 20 ? "text-bad" : "text-ink")}>{state.battery.percent}%</span>
                </div>
                <div className={cn(barTrack, "mt-1 h-[4px]")}>
                  <div className={barFill} style={{ width: `${state.battery.percent}%`, background: batteryBarColor(state.battery.percent, state.battery.is_charging) } as React.CSSProperties} />
                </div>
                <div className={cn(num, "mt-0.5 text-[10px] leading-none", state.battery.is_charging ? "text-good" : "text-ink3")}>{state.battery.is_charging ? t.systemBatteryCharging : t.systemBatteryDischarging}</div>
              </div>
            ) : null}
            {state.thermal?.length ? (
              <div className="w-full border-t border-edge pt-2 space-y-1">
                {state.thermal.slice(0, 2).map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-1 text-[10px] leading-none">
                    <span className="flex items-center gap-1 truncate font-medium text-ink2"><span className="size-1.5 shrink-0 rounded-full" style={{ background: tempColor(s.value_c, s.critical_c) }} />{s.label.slice(0, 14)}</span>
                    <span className={cn(num, "shrink-0 font-bold")} style={{ color: tempColor(s.value_c, s.critical_c) }}>{fmtTemp(s.value_c)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {state.storage?.length ? (
              <div className="w-full border-t border-edge pt-2">
                <div className="truncate text-[10px] font-semibold leading-none text-ink2" title={`${state.storage[0].name} · ${state.storage[0].mount}`}>{fmtDiskLabel(state.storage[0])}</div>
                <div className={cn(barTrack, "mt-1 h-[3px]")}>
                  <div className={barFill} style={{ width: `${state.storage[0].use_percent}%`, background: barColorVar(state.storage[0].use_percent) } as React.CSSProperties} />
                </div>
                <div className={cn(num, "mt-0.5 text-[10px] leading-none text-ink3")}>{fmtGb(state.storage[0].free_gb)} livre · {state.storage[0].use_percent}%</div>
              </div>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-y-auto [scrollbar-width:thin]">
            <Row label={t.systemMemory} value={fmtMb(state.memory.rss_mb)} sub={`heap ${fmtMb(state.memory.heap_used_mb)}/${fmtMb(state.memory.heap_total_mb)}`} />
            <div className={cn(barTrack, "h-[4px]")}>
              <div className={barFill} style={{ width: `${mp}%`, background: barColorVar(mp), boxShadow: barGlowVar(mp) } as React.CSSProperties} />
            </div>
            <Row label={t.systemCpuLoad} value={fmtLoad(state.cpu.load1)} sub={`${state.cpu.cores} ${t.systemCores} · 5m ${fmtLoad(state.cpu.load5)}`} />
            <div className={cn(barTrack, "h-[4px]")}>
              <div className={barFill} style={{ width: `${cp}%`, background: barColorVar(cp), boxShadow: barGlowVar(cp) } as React.CSSProperties} />
            </div>
            <Row label={t.systemLastCycle} value={fmtLastCycleShort(state.last_cycle, t)} sub={state.last_cycle?.ok === false ? "erro" : `a cada ${state.last_cycle?.interval_s ?? "--"}s`} />
            {state.network?.length ? (
              <div className="flex flex-wrap gap-1">
                {state.network.slice(0, 2).map((n) => (
                  <span key={n.name} className="inline-flex items-center gap-1 rounded-full border border-edge bg-chip px-2 py-0.5 text-[10px] font-medium text-ink3">
                    <span className={cn("size-1.5 rounded-full", n.type === "wifi" ? "bg-sky-400" : "bg-emerald-400")} />
                    {n.name} {n.speed_mbps != null ? `· ${fmtSpeed(n.speed_mbps)}` : n.ip ? `· ${n.ip}` : ""}
                  </span>
                ))}
              </div>
            ) : null}
            {state.fans?.length ? (
              <div className="flex flex-wrap gap-1">
                {state.fans.slice(0, 2).map((f) => (
                  <span key={f.label} className="inline-flex items-center gap-1 rounded-full border border-edge bg-chip px-2 py-0.5 text-[10px] font-medium text-ink3">{f.label.slice(0, 12)} · {fmtRpm(f.rpm)}</span>
                ))}
              </div>
            ) : null}
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
          {state.battery?.is_present ? <BatterySection battery={state.battery} t={t} compact /> : null}
          {state.network?.length ? <NetworkSection network={state.network} t={t} compact /> : null}
          {state.thermal?.length ? <ThermalSection thermal={state.thermal} t={t} compact /> : null}
          {state.fans?.length ? <FansSection fans={state.fans} t={t} compact /> : null}
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
        {state.battery?.is_present ? <BatterySection battery={state.battery} t={t} /> : null}
        {state.network?.length ? <NetworkSection network={state.network} t={t} /> : null}
        {state.thermal?.length ? <ThermalSection thermal={state.thermal} t={t} /> : null}
        {state.fans?.length ? <FansSection fans={state.fans} t={t} /> : null}
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
