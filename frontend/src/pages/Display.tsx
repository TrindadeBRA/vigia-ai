import { DndContext, DragOverlay, PointerSensor, closestCorners, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { fetchHealth, fetchUsage, openUsageEvents } from "../api/client";
import type { AdsenseAccount, BitcoinAccount, ClaudeAccount, CreditsAccount, CurrenciesPayload, CursorAccount, GptAccount, OpenCodeAccount, UsagePayload, WeatherConfig, WeatherPayload } from "../api/types";
import { CELL_GAP, colsForWidth, displayBoard, dropTarget, emptyBoard, emptyCells, normalizeSize, packBoard, padRowsForHeight, placeCard, rectFor, rowPxFor, sameBoard, setCardSize, slotKey, syncBoard, type BoardLayout, type CardSize } from "../board";
import { cn } from "../cn";
import { Logo } from "../components/Logo";
import { Skeleton } from "../components/Skeleton";
import { CurrenciesBoardCard, CurrenciesDetail } from "../components/CurrenciesWidget";
import { WeatherBoardCard, WeatherDetail } from "../components/WeatherWidget";
import { BellIcon, CheckIcon, ChipIcon, ClockIcon, CloseIcon, GitHubIcon, GridIcon, GripIcon, MenuIcon, PaletteIcon, SettingsIcon, SlidersIcon } from "../components/icons";
import { FETCH_OK_FLASH_MS, FRESH_PAYLOAD_MS, POLL_MS, barColor, barGlow, clamp, countdownSecs, fmtBrl, fmtBtc, fmtClock, fmtCountdown, fmtCurrencyAmount, fmtMoney, fmtPct, fmtRemain, fmtUsd, fmtWhen, nextFetchAtMs, payloadAgeMs } from "../format";
import { STR, type Lang, type T } from "../i18n";
import { ACCENTS, PALETTES, PROVIDER_ICON, applyThemeVars, inverseOn, type ThemeName } from "../theme";
import { accentLink, barFill, barTrack, cardLabel, emptyNote, errorText, iconBtn, iconChip, iconImg, metricCard, metricsGrid, num, overviewBoard, shell, sideItem, sideItemActive, viewFade } from "../tw";
import type { ConfigOutlet } from "./config/ConfigPage";
import NowPage from "./NowPage";

const boardCollision: CollisionDetection = (args: Parameters<CollisionDetection>[0]) => {
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
  kind?: "provider" | "weather" | "currencies";
  weather?: WeatherPayload | null;
  weatherConfig?: WeatherConfig | null;
  currencies?: CurrenciesPayload | null;
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
  const pctText = pct != null ? fmtPct(pct) : null;
  const remainText = pct != null ? fmtRemain(pct) : null;

  if (pct == null) {
    const money = compact ? (value || compactMoney(sub, t)) : (value || sub);
    const display = clock || money || sub || "--";
    const clockLine = clock ? `${t.resetIn} ${clock}` : null;
    // GPT free (e similares): o rótulo já é "Reset em" e o valor grande já é o
    // cronômetro — não repetir "Reset em 28d …" na mesma linha, senão os dois
    // textos se sobrepõem no card em tamanho real.
    const labelIsReset = name === t.resetIn || name === t.reset;
    const showHeaderClock = Boolean(clock && display !== clock && !labelIsReset);
    const showClockBelow = Boolean(clock && display !== clock && !showHeaderClock);
    const showSub = Boolean(sub && sub !== display && sub !== clock && sub !== clockLine && !showClockBelow);
    if (compact) {
      return (
        <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{name}</span>
          <span className={cn(num, "min-w-0 text-[15px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere]")}>{display}</span>
          {showClockBelow ? <span className={cn(num, "overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{clockLine}</span> : null}
          {showSub ? <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{sub}</span> : null}
        </div>
      );
    }
    return (
      <div className="mt-3 first:mt-0">
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{name}</span>
          {showHeaderClock ? <span className={cn(num, "shrink-0 text-[12px] font-[550] text-ink2")}>{clockLine}</span> : null}
        </div>
        <div className={cn(num, "text-[15px] font-bold")}>{display}</div>
        {showSub ? <div className="mt-1 text-[11.5px] leading-snug text-ink3">{sub}</div> : null}
        {showClockBelow ? <div className={cn(num, "mt-1 text-[11.5px] font-[550] text-ink2")}>{clockLine}</div> : null}
      </div>
    );
  }

  const headerValue = value ? `${pctText} · ${value}` : pctText;
  const footerRemain = remainText ? `${t.left} ${remainText}` : null;
  const footerClock = clock ? `${t.resetIn} ${clock}` : null;
  const footerSub = sub && sub !== footerRemain ? sub : null;
  const footerParts = [footerRemain, footerClock, footerSub].filter(Boolean) as string[];

  if (compact) {
    const compactExtra = clock ? `${t.resetIn} ${clock}` : value ? value : footerRemain || sub;
    const compactSecondLine = value && clock ? value : null;
    return (
      <div className="mt-1.5 min-w-0 first:mt-0">
        <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{name}</span>
          <span className={`${num} shrink-0 text-[12px] font-bold text-ink`}>{pctText}</span>
        </div>
        <div className={cn(barTrack, "h-[5px]")}>
          <div className={barFill} style={barFillStyle(pct, pal)} />
        </div>
        {compactExtra ? <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{compactExtra}</div> : null}
        {compactSecondLine ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none text-ink3">{compactSecondLine}</div> : null}
        {footerSub && !clock && !value ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none text-ink3">{footerSub}</div> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{name}</span>
        <span className={`${num} shrink-0 text-sm font-bold`}>{headerValue}</span>
      </div>
      <div className={barTrack}>
        <div className={barFill} style={barFillStyle(pct, pal)} />
      </div>
      {footerParts.length ? (
        <div className="mt-[5px] flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11.5px] leading-tight text-ink3">
          {footerParts.map((part, i) => (
            <span key={i} className={cn(i === 1 && footerClock ? "font-[550] text-ink2" : "", i === 1 && footerClock ? num : "")}>{part}{i < footerParts.length - 1 ? " ·" : ""}</span>
          ))}
        </div>
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
  const hasLimits = bits.length > 0;
  // Evita duplicar "restam $X" quando value já é "$X" e não há limites
  const sub = hasLimits ? bits.join(" · ") : acc.percent == null && acc.remaining_cents != null ? null : acc.remaining_cents != null ? t.remainMoney + fmtUsd(acc.remaining_cents) : t.noCredits;
  return {
    label: t.credits,
    pct: acc.percent,
    value: acc.remaining_cents != null ? fmtUsd(acc.remaining_cents) : null,
    sub,
  };
}

function bitcoinMetrics(b: BitcoinAccount, t: T): Metric[] {
  const value =
    b.value_usd_cents != null && b.value_brl_cents != null
      ? `${fmtUsd(b.value_usd_cents)} · ${fmtBrl(b.value_brl_cents)}`
      : b.value_usd_cents != null
        ? fmtUsd(b.value_usd_cents)
        : null;
  return [
    { label: t.bitcoinBalance, pct: null, value: b.balance_btc != null ? fmtBtc(b.balance_btc) : null, sub: null },
    { label: t.bitcoinValue, pct: null, value, sub: null },
  ];
}

function adsenseMetrics(a: AdsenseAccount, t: T): Metric[] {
  return [
    { label: t.adsenseToday, pct: null, value: a.today_cents != null ? fmtMoney(a.today_cents, a.currency) : null, sub: null },
    { label: t.adsenseWallet, pct: null, value: a.unpaid_cents != null ? fmtMoney(a.unpaid_cents, a.currency) : null, sub: null },
  ];
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
      sub: t.remainingPrefix + fmtRemain(g.session_percent),
      countdownAt: g.session_resets_at,
    };
  }
  const until = g.session_resets_at || g.weekly_resets_at;
  return { label: t.resetIn, pct: null, sub: fmtCountdown(until, nowMs), countdownAt: until };
}

function buildProviders(data: UsagePayload, t: T, nowMs = Date.now()): ProviderMeta[] {
  const list: ProviderMeta[] = [];
  for (const c of data.claude || []) {
    const metrics: Metric[] = [];
    if (c.session_percent != null || c.session_resets_at) {
      metrics.push({
        label: t.session5h,
        pct: c.session_percent,
        sub: c.session_percent != null ? t.remainingPrefix + fmtRemain(c.session_percent) : null,
        countdownAt: c.session_resets_at,
      });
    }
    if (c.weekly_percent != null || c.weekly_resets_at) {
      metrics.push({
        label: t.weekLimit,
        pct: c.weekly_percent,
        sub: c.weekly_percent != null ? t.remainingPrefix + fmtRemain(c.weekly_percent) : null,
        countdownAt: c.weekly_resets_at,
      });
    }
    if (c.sonnet_percent != null) {
      metrics.push({
        label: t.sonnetWeek,
        pct: c.sonnet_percent,
        sub: t.remainingPrefix + fmtRemain(c.sonnet_percent),
        countdownAt: c.sonnet_resets_at,
      });
    }
    if (c.opus_percent != null) {
      metrics.push({
        label: t.opusWeek,
        pct: c.opus_percent,
        sub: t.remainingPrefix + fmtRemain(c.opus_percent),
        countdownAt: c.opus_resets_at,
      });
    }
    if (!metrics.length) {
      metrics.push({ label: t.session5h, pct: null, sub: t.noData });
    }
    list.push({
      id: `claude:${c.id}`,
      provider: "claude",
      ok: c.ok,
      error: c.error,
      title: "Claude",
      label: c.label || "",
      metrics,
    });
  }
  for (const g of data.gpt || []) {
    const metrics: Metric[] = [gptSessionMetric(g, t, nowMs)];
    if (g.weekly_percent != null || g.weekly_resets_at) {
      metrics.push({
        label: t.weekLimit,
        pct: g.weekly_percent,
        sub: g.weekly_percent != null ? t.remainingPrefix + fmtRemain(g.weekly_percent) : null,
        countdownAt: g.weekly_resets_at,
      });
    }
    list.push({
      id: `gpt:${g.id}`,
      provider: "gpt",
      ok: g.ok,
      error: g.error,
      title: g.plan ? `GPT ${g.plan}` : "GPT",
      label: g.label || "",
      metrics,
    });
  }
  for (const c of data.cursor || []) {
    const ondemandBits: string[] = [];
    if (c.used_cents != null && c.limit_cents != null) ondemandBits.push(`${fmtUsd(c.used_cents)} / ${fmtUsd(c.limit_cents)}`);
    else if (c.used_cents != null) ondemandBits.push(`${t.used} ${fmtUsd(c.used_cents)}`);
    else if (c.limit_cents != null) ondemandBits.push(`${t.cap} ${fmtUsd(c.limit_cents)}`);
    if (c.remaining_cents != null) ondemandBits.push(`${t.left} ${fmtUsd(c.remaining_cents)}`);
    if ((c.bonus_cents || 0) > 0) ondemandBits.push(`${t.bonusPrefix}${fmtUsd(c.bonus_cents)}`);
    const ondemand = ondemandBits.join(" · ") || null;
    const cursorMetrics: Metric[] = [];
    if (c.percent != null || c.cycle_end) {
      cursorMetrics.push({ label: t.cursorModels, pct: c.percent, sub: t.remainingPrefix + (c.percent != null ? fmtRemain(c.percent) : ""), countdownAt: c.cycle_end });
    }
    if (c.other_percent != null) {
      cursorMetrics.push({ label: t.otherModels, pct: c.other_percent, sub: t.remainingPrefix + fmtRemain(c.other_percent) });
    }
    if (ondemand) {
      cursorMetrics.push({ label: t.ondemand, pct: null, sub: ondemand });
    }
    if (!cursorMetrics.length) cursorMetrics.push({ label: t.cursorModels, pct: null, sub: t.noData });
    list.push({
      id: `cursor:${c.id}`,
      provider: "cursor",
      ok: c.ok,
      error: c.error,
      title: c.plan ? `Cursor ${c.plan}` : "Cursor",
      label: c.label || "",
      metrics: cursorMetrics,
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
        sub: t.remainingPrefix + fmtRemain(o.rolling_percent),
        countdownAt: o.rolling_resets_at,
      });
    }
    if (o.weekly_percent != null) {
      metrics.push({
        label: t.weekLimit,
        pct: o.weekly_percent,
        sub: t.remainingPrefix + fmtRemain(o.weekly_percent),
        countdownAt: o.weekly_resets_at,
      });
    }
    if (o.monthly_percent != null) {
      metrics.push({
        label: t.monthLimit,
        pct: o.monthly_percent,
        sub: t.remainingPrefix + fmtRemain(o.monthly_percent),
        countdownAt: o.monthly_resets_at,
      });
    }
    if (o.remaining_cents != null) {
      metrics.push({
        label: t.accountCredits,
        pct: o.percent,
        value: fmtUsd(o.remaining_cents),
        sub: o.limit_cents != null ? `${t.cap} ${fmtUsd(o.limit_cents)}` : t.remainMoney + fmtUsd(o.remaining_cents),
      });
    }
    if (!metrics.length) metrics.push({ label: t.rolling, pct: null, sub: t.noData });
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
  for (const b of data.bitcoin || []) {
    list.push({
      id: `bitcoin:${b.id}`,
      provider: "bitcoin",
      ok: b.ok,
      error: b.error,
      title: "Bitcoin",
      label: b.label || "",
      metrics: bitcoinMetrics(b, t),
    });
  }
  for (const a of data.adsense || []) {
    list.push({
      id: `adsense:${a.id}`,
      provider: "adsense",
      ok: a.ok,
      error: a.error,
      title: "AdSense",
      label: a.label || a.account_name || "",
      metrics: adsenseMetrics(a, t),
    });
  }
  // Weather widget — só aparece se habilitado e não oculto
  const w = data.weather;
  if (w) {
    const locName = w.location?.name || "";
    const hasData = w.ok && w.current;
    const hasError = !w.ok && w.error;
    // Se weather existe no payload, mostra o card (mesmo com erro, para feedback)
    // O backend já filtra hidden/enabled; se chegou aqui, deve mostrar
    const weatherOk = w.ok;
    const weatherError = w.error || null;
    // Só adiciona se tem localização configurada ou se tem erro para mostrar
    if (locName || hasData || hasError) {
      list.push({
        id: "weather:main",
        provider: "weather",
        ok: weatherOk,
        error: weatherError,
        title: locName ? `${t.weather} · ${locName}` : t.weather,
        label: w.timezone || "",
        metrics: hasData
          ? [
            {
              label: t.weatherTemp,
              pct: null,
              value: w.current?.temperature_2m != null ? `${Math.round(w.current.temperature_2m)}${w.current_units?.["temperature_2m"] || "°C"}` : "--",
              sub: w.current?.weather_code != null ? wmoLabel(w.current.weather_code) : null,
            },
          ]
          : [],
        kind: "weather",
        weather: w,
        weatherConfig: null,
      });
    }
  }
  // Moedas — card único com N cotações, igual ao clima (o backend já filtra
  // hidden/enabled; se chegou aqui é pra mostrar).
  const cu = data.currencies;
  if (cu && (cu.items.length || (!cu.ok && cu.error))) {
    list.push({
      id: "currencies:main",
      provider: "currencies",
      ok: cu.ok,
      error: cu.error,
      title: t.currencies,
      label: cu.base,
      metrics: cu.items.slice(0, 6).map((it) => ({
        label: it.label || it.code,
        pct: null,
        value: it.ok ? fmtCurrencyAmount(it.price, cu.base) : null,
        sub: it.ok ? null : it.error,
      })),
      kind: "currencies",
      currencies: cu,
    });
  }
  return list;
}

function wmoLabel(code: number | null | undefined): string {
  if (code == null) return "--";
  const map: Record<number, string> = {
    0: "Céu limpo", 1: "Predom. limpo", 2: "Parcial. nublado", 3: "Encoberto",
    45: "Nevoeiro", 48: "Nevoeiro c/ geada",
    51: "Chuvisco fraco", 53: "Chuvisco", 55: "Chuvisco forte",
    61: "Chuva fraca", 63: "Chuva", 65: "Chuva forte",
    71: "Neve fraca", 73: "Neve", 75: "Neve forte",
    80: "Pancadas fracas", 81: "Pancadas", 82: "Pancadas fortes",
    95: "Trovoada", 96: "Trovoada c/ granizo", 99: "Trovoada c/ granizo forte",
  };
  return map[code] || `Código ${code}`;
}

const CARD_ORDER: CardSize[] = ["sm", "md", "lg", "xl", "wl", "wxl"];

function sizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.cardSmall;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

function SizeIcon({ size, className }: { size: CardSize; className?: string }) {
  const s = normalizeSize(size);
  if (s === "sm") return <span className={cn("block size-[7px] rounded-[2px] border-[1.5px] border-current", className)} />;
  if (s === "md") return <span className={cn("block size-[11px] rounded-[2px] border-[1.5px] border-current", className)} />;
  if (s === "lg") return <span className={cn("flex size-[11px] gap-px", className)}><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /></span>;
  if (s === "wl") return <span className={cn("flex size-[11px] flex-col gap-px", className)}><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /></span>;
  if (s === "wxl") return <span className={cn("grid size-[11px] grid-cols-2 gap-px", className)}><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /></span>;
  return <span className={cn("grid size-[11px] grid-cols-2 gap-px", className)}><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /></span>;
}

function SizeMenu({ size, t, onChange }: { size: CardSize; t: T; onChange: (next: CardSize) => void }) {
  const cur = normalizeSize(size);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 200;
      const menuH = CARD_ORDER.length * 36 + 8;
      let top = r.bottom + 6;
      let left = r.right - menuW;
      if (left < 8) left = 8;
      if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 6;
      if (top < 8) top = 8;
      setPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink3 transition-colors duration-150 hover:bg-chip hover:text-ink"
        title={sizeLabel(cur, t)}
        aria-label={sizeLabel(cur, t)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <SizeIcon size={cur} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[100] min-w-[190px] rounded-xl border border-edge bg-panel p-1 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {CARD_ORDER.map((s) => {
            const active = s === cur;
            return (
              <button
                key={s}
                role="menuitem"
                type="button"
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors", active ? "bg-accent text-accent-ink" : "text-ink hover:bg-chip")}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
              >
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-[5px] border", active ? "border-accent-ink/30 bg-accent-ink/15" : "border-edge bg-chip")}><SizeIcon size={s} className={active ? "text-accent-ink" : "text-ink3"} /></span>
                <span className="flex-1 font-medium leading-none">{sizeLabel(s, t)}</span>
                {active ? <CheckIcon size={14} /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

function WeatherTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void }) {
  const sm = normalizeSize(size) === "sm";
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
        <div className={cn("absolute right-1 top-1 z-[3] flex items-center rounded-lg border border-edge bg-chip", "opacity-0 pointer-events-none transition-opacity duration-150 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100", "max-[860px]:pointer-events-auto max-[860px]:opacity-100")}>
          <button type="button" className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink3 touch-none hover:bg-chip hover:text-ink active:cursor-grabbing" aria-label={t.dragCard} title={t.dragCard} {...grip}><GripIcon size={14} /></button>
          <SizeMenu size={size} t={t} onChange={onSetSize} />
        </div>
      ) : null}
      <WeatherBoardCard weather={p.weather} config={null} t={t} compact={sm} onOpen={onOpen} />
    </div>
  );
}

function CurrenciesTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void }) {
  const sm = normalizeSize(size) === "sm";
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
        <div className={cn("absolute right-1 top-1 z-[3] flex items-center rounded-lg border border-edge bg-chip", "opacity-0 pointer-events-none transition-opacity duration-150 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100", "max-[860px]:pointer-events-auto max-[860px]:opacity-100")}>
          <button type="button" className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink3 touch-none hover:bg-chip hover:text-ink active:cursor-grabbing" aria-label={t.dragCard} title={t.dragCard} {...grip}><GripIcon size={14} /></button>
          <SizeMenu size={size} t={t} onChange={onSetSize} />
        </div>
      ) : null}
      <CurrenciesBoardCard currencies={p.currencies} t={t} compact={sm} onOpen={onOpen} />
    </div>
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
  // Weather e Moedas têm seu próprio card (sem ícone de provedor genérico)
  if (p.provider === "weather" || p.kind === "weather") {
    return <WeatherTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} onOpen={onOpen} onSetSize={onSetSize} />;
  }
  if (p.provider === "currencies" || p.kind === "currencies") {
    return <CurrenciesTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} onOpen={onOpen} onSetSize={onSetSize} />;
  }
  const sm = normalizeSize(size) === "sm";
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
          <SizeMenu size={size} t={t} onChange={onSetSize} />
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
          sm ? "justify-center gap-0" : normalizeSize(size) === "wxl" ? "justify-evenly gap-1" : normalizeSize(size) === "wl" ? "justify-evenly gap-1" : normalizeSize(size) === "xl" ? "justify-evenly gap-1" : normalizeSize(size) === "lg" ? "justify-center gap-1" : p.metrics.length > 1 ? "justify-evenly" : "justify-center",
        )}
        onClick={onOpen}
      >
        {!p.ok ? (
          <div className={cn(errorText, sm && "text-[11px] leading-snug")}>{p.error || ""}</div>
        ) : (
          (() => {
            const ns = normalizeSize(size);
            const slice = sm ? 2 : ns === "lg" ? 2 : ns === "xl" ? 4 : ns === "wl" ? 4 : ns === "wxl" ? 8 : p.metrics.length;
            return p.metrics.slice(0, slice).map((m, i) => (
              <MetricRow key={i} {...m} pal={pal} compact={sm} nowMs={nowMs} t={t} />
            ));
          })()
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
  rect,
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
  rect: { w: number; h: number };
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
      style={{ gridColumn: `${col + 1} / span ${rect.w}`, gridRow: `${row + 1} / span ${rect.h}`, zIndex: isDragging ? 2 : 1 }}
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
  nowActive: boolean;
  configActive: boolean;
  setupActive: boolean;
  temaActive: boolean;
  alarmsActive: boolean;
  t: T;
}) {
  const { providers, section, selectedId, open, onOverview, onSelect, onClose, nowActive, configActive, setupActive, temaActive, alarmsActive, t } = props;
  const onPage = configActive || setupActive || temaActive || alarmsActive;
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
        <NavLink to="/display/agora" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <ClockIcon size={16} /> {t.now}
        </NavLink>
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
              <button key={p.id} data-provider-id={p.id} className={cn(sideItem, "shrink-0", section === "account" && selectedId === p.id && !onPage && sideItemActive)} onClick={() => { onSelect(p.id); onClose(); }}>
                <img className="size-[22px] shrink-0 object-contain" src={PROVIDER_ICON[p.provider]} alt={p.provider} draggable={false} />
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
        <NavLink to="/display/alarmes" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <BellIcon size={16} /> {t.alarms}
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
  const activeSize: CardSize = activeId ? normalizeSize(layout.size[activeId]) : "md";

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
              const size = normalizeSize(layout.size[id]);
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
                  rect={rectFor(size, cols)}
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
                style={(() => { const r = rectFor(activeSize, cols); return { width: liftSize?.w || (r.w * cellPx + (r.w - 1) * CELL_GAP), height: liftSize?.h || (r.h * rowPx + (r.h - 1) * CELL_GAP) }; })()}
              >
                <ProviderCard p={active} pal={pal} size={activeSize} t={t} nowMs={now} lifted onOpen={() => { }} onSetSize={() => { }} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
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

function BitcoinBody({ data, account, t, pal }: { data: UsagePayload; account: BitcoinAccount; t: T; pal: Pal }) {
  const b = account;
  const value =
    b.value_usd_cents != null && b.value_brl_cents != null
      ? `${fmtUsd(b.value_usd_cents)} · ${fmtBrl(b.value_brl_cents)}`
      : b.value_usd_cents != null
        ? fmtUsd(b.value_usd_cents)
        : t.noData;
  return (
    <>
      {b.address ? <div className="px-0.5 text-[12.5px] tracking-[.1px] text-ink3">{b.address}</div> : null}
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.bitcoinBalance} pct={null} pal={pal} value={b.balance_btc != null ? fmtBtc(b.balance_btc) : null} />
        <MetricCard label={t.bitcoinValue} pct={null} pal={pal} value={value} />
      </MetricsGrid>
    </>
  );
}

function AdsenseBody({ data, account, t, pal }: { data: UsagePayload; account: AdsenseAccount; t: T; pal: Pal }) {
  const a = account;
  return (
    <>
      {a.account_name ? <div className="px-0.5 text-[12.5px] tracking-[.1px] text-ink3">{a.account_name}</div> : null}
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.adsenseToday} pct={null} pal={pal} value={a.today_cents != null ? fmtMoney(a.today_cents, a.currency) : t.noData} />
        <MetricCard label={t.adsenseWallet} pct={null} pal={pal} value={a.unpaid_cents != null ? fmtMoney(a.unpaid_cents, a.currency) : t.noData} />
      </MetricsGrid>
    </>
  );
}

function WeatherAccountPage({ data, t }: { data: UsagePayload; t: T }) {
  const w = data.weather;
  // Busca config do weather via payload (location/units) — se não tiver, usa defaults
  const cfg: WeatherConfig | null = w?.location ? { enabled: true, hidden: false, location: w.location as WeatherConfig["location"], units: (w.units as WeatherConfig["units"]) || { temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" }, forecast_days: 7, past_days: 0, timezone: w.timezone || "auto", current: [], hourly: [], daily: [], display: { show_current: true, show_hourly: true, show_daily: true, hourly_count: 12, daily_count: 7, fields: { temperature: true, feels_like: true, humidity: true, precipitation: true, wind: true, pressure: true, cloud_cover: true, uv_index: true, sunrise_sunset: true } } } : null;
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id="weather" large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{t.weather}</div>
          {w?.location?.name ? <div className={cardLabel}>{w.location.name}{w.location.country ? `, ${w.location.country}` : ""}</div> : null}
        </div>
      </div>
      <WeatherDetail weather={w} config={cfg} t={t} />
    </div>
  );
}

function CurrenciesAccountPage({ data, t }: { data: UsagePayload; t: T }) {
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[28px] leading-none">💱</span>
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{t.currencies}</div>
        </div>
      </div>
      <CurrenciesDetail currencies={data.currencies} t={t} />
    </div>
  );
}

function AccountPage({ meta, account, data, t, pal, nowMs }: { meta: ProviderMeta; account: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | BitcoinAccount | AdsenseAccount | null; data: UsagePayload; t: T; pal: Pal; nowMs: number }) {
  // Weather e Moedas têm página própria (sem "conta" única)
  if (meta.provider === "weather" || meta.kind === "weather") {
    return <WeatherAccountPage data={data} t={t} />;
  }
  if (meta.provider === "currencies" || meta.kind === "currencies") {
    return <CurrenciesAccountPage data={data} t={t} />;
  }
  let body: ReactNode = null;
  if (meta.ok && account) {
    if (meta.provider === "claude") body = <ClaudeBody data={data} account={account as ClaudeAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "gpt") body = <GptBody data={data} account={account as GptAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "cursor") body = <CursorBody data={data} account={account as CursorAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "openrouter") body = <OpenRouterBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "deepseek") body = <DeepSeekBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "opencode") body = <OpenCodeBody data={data} account={account as OpenCodeAccount} t={t} pal={pal} />;
    else if (meta.provider === "fal") body = <FalBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "bitcoin") body = <BitcoinBody data={data} account={account as BitcoinAccount} t={t} pal={pal} />;
    else if (meta.provider === "adsense") body = <AdsenseBody data={data} account={account as AdsenseAccount} t={t} pal={pal} />;
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
  const isAlarms = Boolean(useMatch("/display/alarmes"));
  const isNow = Boolean(useMatch("/display/agora"));
  const isNested = isConfig || isSetup || isTema || isAlarms || isNow;
  const [prefs, setPrefs] = usePrefs();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [section, setSection] = useState<"overview" | "account">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  }

  const providers = data ? buildProviders(data, t, now) : [];
  let meta: ProviderMeta | null = null;
  let rawAccount: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | BitcoinAccount | AdsenseAccount | null = null;
  if (data && section === "account") {
    meta = providers.find((p) => p.id === selectedId) || null;
    if (meta && meta.provider !== "weather" && meta.kind !== "weather" && meta.provider !== "currencies" && meta.kind !== "currencies") {
      const idx = meta.id.indexOf(":");
      const accountId = meta.id.slice(idx + 1);
      const key = meta.provider as "claude" | "gpt" | "cursor" | "openrouter" | "deepseek" | "opencode" | "fal" | "bitcoin" | "adsense";
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
        <NavLink to="/display/agora" className={`${num} flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[9px] border-0 bg-transparent px-2.5 py-[7px] text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:bg-chip`} title={t.now}>
          <span className="size-1.5 shrink-0 rounded-full bg-good shadow-[0_0_5px_var(--good)] [.flat_&]:shadow-none" />
          {fmtClock(now + driftMs)}
        </NavLink>
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
          nowActive={isNow}
          configActive={isConfig}
          setupActive={isSetup}
          temaActive={isTema}
          alarmsActive={isAlarms}
          onOverview={goOverview}
          onSelect={(id) => { navigate("/display"); setSection("account"); setSelectedId(id); }}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-5 pb-12 pt-5 max-[860px]:px-4 max-[860px]:pb-16 max-[860px]:pt-[18px]">
          {isNested && !isNow ? (
            <Outlet context={outlet} />
          ) : isNow && data ? (
            <NowPage data={data} prefs={prefs} providers={providers} t={t} nowMs={now} driftMs={driftMs} />
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
