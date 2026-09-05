import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { UsagePayload } from "../api/types";
import { cn } from "../cn";
import { ArrowLeftIcon, ChevronRightIcon } from "../components/icons";
import { FETCH_OK_FLASH_MS, barColor, barGlow, clamp, fmtPct } from "../format";
import { WEEKDAYS, type Lang, type T } from "../i18n";
import { PALETTES, PROVIDER_ICON, type ThemeName } from "../theme";
import { accentLink, barFill, barTrack, emptyNote, errorText, num } from "../tw";

type Prefs = { theme: ThemeName; accent: number; lang: Lang };
type Pal = (typeof PALETTES)[ThemeName];
type Metric = { label: string; pct: number | null; sub: string | null; value?: string | null };
type ProviderMeta = {
  id: string;
  provider: string;
  ok: boolean;
  error: string | null;
  title: string;
  label: string;
  metrics: Metric[];
  kind?: "provider" | "weather" | "currencies" | "git" | "retroachievements" | "calendar" | "rss";
};

function Icon({ id }: { id: string }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-chip/80 backdrop-blur-sm shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-6 object-contain" src={PROVIDER_ICON[id]} alt={id} draggable={false} />
    </div>
  );
}

function barFillStyle(pct: number, pal: Pal) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
}

function ProviderCard({ p, pal, t, onNavigate }: { p: ProviderMeta; pal: Pal; t: T; onNavigate: () => void }) {
  if (p.provider === "weather" || p.kind === "weather" || p.provider === "currencies" || p.kind === "currencies" || p.provider === "git" || p.kind === "git" || p.provider === "retroachievements" || p.kind === "retroachievements") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onNavigate}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-edge bg-panel p-4 text-left shadow-card transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover",
        "[.flat_&]:shadow-none [.flat_&]:hover:translate-y-0"
      )}
    >
      <div className="mb-3.5 flex items-center gap-3">
        <Icon id={p.provider} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-[650] leading-none">{p.title}</h3>
            <span className={cn("size-2 shrink-0 rounded-full", p.ok ? "bg-good" : "bg-bad")} />
          </div>
          {p.label ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink3">{p.label}</div> : null}
        </div>
        <ChevronRightIcon size={18} className="shrink-0 text-ink3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>

      {!p.ok ? (
        <div className={cn(errorText, "text-xs")}>{p.error || t.noData}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {p.metrics.slice(0, 3).map((m, i) => (
            <div key={i} className="min-w-0">
              {m.pct != null ? (
                <>
                  <div className="mb-1.5 flex items-baseline justify-between text-xs">
                    <span className="text-ink2">{m.label}</span>
                    <span className={cn(num, "font-bold text-ink")}>{fmtPct(m.pct)}</span>
                  </div>
                  <div className={cn(barTrack, "h-[6px]")}>
                    <div className={barFill} style={barFillStyle(m.pct, pal)} />
                  </div>
                  {m.sub ? <div className="mt-1 text-[10.5px] text-ink3">{m.sub}</div> : null}
                </>
              ) : (
                <>
                  <div className="mb-1 text-xs text-ink2">{m.label}</div>
                  <div className={cn(num, "text-sm font-bold")}>{m.value || m.sub || "—"}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default function NowPage({
  data,
  prefs,
  providers,
  t,
  nowMs,
  driftMs,
}: {
  data: UsagePayload;
  prefs: Prefs;
  providers: ProviderMeta[];
  t: T;
  nowMs: number;
  driftMs: number;
}) {
  const navigate = useNavigate();
  const [flash, setFlash] = useState(false);
  const pal = PALETTES[prefs.theme];

  useEffect(() => {
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), FETCH_OK_FLASH_MS);
    return () => clearTimeout(timer);
  }, [data.updated_at]);

  const clockNow = new Date(nowMs + driftMs);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad2(clockNow.getHours())}:${pad2(clockNow.getMinutes())}:${pad2(clockNow.getSeconds())}`;
  const weekday = WEEKDAYS[prefs.lang][clockNow.getDay()];
  const dateStr = `${weekday}, ${pad2(clockNow.getDate())}/${pad2(clockNow.getMonth() + 1)}/${clockNow.getFullYear()}`;

  const accountProviders = providers.filter(
    (p) => p.provider !== "weather" && p.kind !== "weather" && p.provider !== "currencies" && p.kind !== "currencies" && p.provider !== "git" && p.kind !== "git",
  );
  const failing = accountProviders.filter((p) => !p.ok).length;
  const working = accountProviders.length - failing;

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="mb-6 flex items-center justify-between gap-4 max-[860px]:mb-4">
        <button
          onClick={() => navigate("/display")}
          className="flex items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-ink2 transition-colors hover:bg-chip hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
          {t.overview}
        </button>
      </div>

      <div className="mb-8 flex flex-col items-center justify-center rounded-3xl border border-edge bg-[radial-gradient(900px_420px_at_50%_30%,var(--glow),transparent_65%),var(--panel)] px-6 py-12 shadow-card [.flat_&]:shadow-none max-[860px]:py-8">
        <div className={cn(num, "mb-2 text-[clamp(56px,14vw,96px)] font-[650] tracking-[-2px] leading-none [text-shadow:0_0_50px_var(--glow)] transition-opacity duration-300", flash && "opacity-60", "[.flat_&]:[text-shadow:none]")}>
          {timeStr}
        </div>
        <div className="mb-6 text-base capitalize tracking-[.3px] text-ink2 max-[860px]:text-sm">{dateStr}</div>

        <div className="flex flex-wrap items-center justify-center gap-4 max-[860px]:gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-chip/50 px-4 py-2.5 backdrop-blur-sm max-[860px]:px-3 max-[860px]:py-2">
            <span className={cn("size-2 shrink-0 rounded-full", failing === 0 ? "bg-good shadow-[0_0_8px_var(--good)]" : "bg-bad shadow-[0_0_8px_var(--bad)]", "[.flat_&]:shadow-none")} />
            <span className="text-sm font-medium text-ink2 max-[860px]:text-xs">
              {failing === 0 ? t.allOk : t.errorsCount(failing)}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-chip/50 px-4 py-2.5 backdrop-blur-sm max-[860px]:px-3 max-[860px]:py-2">
            <span className="text-sm font-medium text-ink3 max-[860px]:text-xs">{t.accountsCount(working)}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-baseline justify-between gap-4 max-[860px]:mb-4">
        <h2 className="text-xl font-[750] tracking-[-0.3px] max-[860px]:text-lg">{t.accounts}</h2>
        <span className="text-sm text-ink3 max-[860px]:text-xs">{t.providersCount(accountProviders.length)}</span>
      </div>

      {accountProviders.length === 0 ? (
        <div className={emptyNote}>
          {t.noProviders}{" "}
          <Link to="/display/config" className={accentLink}>
            {t.configCta}
          </Link>
        </div>
      ) : (
        <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))] max-[860px]:gap-3">
          {accountProviders.map((p) => (
            <ProviderCard
              key={p.id}
              p={p}
              pal={pal}
              t={t}
              onNavigate={() => {
                navigate("/display");
                setTimeout(() => {
                  const btn = document.querySelector(`[data-provider-id="${p.id}"]`) as HTMLButtonElement;
                  btn?.click();
                }, 100);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
