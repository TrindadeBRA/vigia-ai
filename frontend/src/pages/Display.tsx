import { useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import { fetchUsage, openUsageEvents } from "../api/client";
import type { CreditsAccount, CursorAccount, ClaudeAccount, UsagePayload } from "../api/types";
import { FETCH_OK_FLASH_MS, POLL_MS, barColor, barGlow, clamp, fmtClock, fmtPct, fmtRemain, fmtUsd, fmtWhen, prefersReducedMotion } from "../format";
import { STR, WEEKDAYS, type Lang, type T } from "../i18n";
import { ACCENTS, PALETTES, PROVIDER_ICON, applyThemeVars, inverseOn, type ThemeName } from "../theme";
import "../display.css";

type Prefs = { theme: ThemeName; accent: number; lang: Lang };
type Pal = (typeof PALETTES)[ThemeName];
type Metric = { label: string; pct: number | null; sub: string | null };
type ProviderMeta = {
  id: string;
  provider: string;
  ok: boolean;
  error: string | null;
  title: string;
  label: string;
  metrics: Metric[];
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

function Svg({ d, size, viewBox, stroke, fill, className, children, ...rest }: SVGProps<SVGSVGElement> & { d?: string; size?: number }) {
  return (
    <svg width={size || 16} height={size || 16} viewBox={viewBox || "0 0 24 24"} className={className} fill={fill || "none"} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...rest}>
      {children || (d ? <path d={d} stroke={stroke || "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null)}
    </svg>
  );
}
function CheckIcon(props: { size?: number; stroke?: string }) {
  return <Svg {...props} d="M5 13l4 4L19 7" />;
}
function CloseIcon(props: { size?: number }) {
  return <Svg {...props} d="M6 6l12 12M18 6L6 18" />;
}
function MenuIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <line x1={4} y1={7} x2={20} y2={7} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1={4} y1={12} x2={20} y2={12} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1={4} y1={17} x2={20} y2={17} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function SettingsIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <line x1={4} y1={6} x2={20} y2={6} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={9} cy={6} r={2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
      <line x1={4} y1={12} x2={20} y2={12} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={15} cy={12} r={2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
      <line x1={4} y1={18} x2={20} y2={18} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={11} cy={18} r={2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
    </Svg>
  );
}
function GridIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <rect x={4} y={4} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <rect x={13} y={4} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <rect x={4} y={13} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <rect x={13} y={13} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
    </Svg>
  );
}
function ClockIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={2} />
      <path d="M12 7.5V12l3.2 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Eye({ size }: { size: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf: number | null = null;
    let target = { x: 0, y: 0 };
    let gaze = { x: 0, y: 0 };
    let nextMoveAt = 0;
    const maxGaze = Math.max(1, (size * 0.6) / 2 - 2);
    function tick(now: number) {
      if (now >= nextMoveAt) {
        target.x = (Math.random() * 2 - 1) * maxGaze;
        target.y = (Math.random() * 2 - 1) * maxGaze;
        nextMoveAt = now + 900 + Math.random() * 1700;
      }
      gaze.x += (target.x - gaze.x) * 0.08;
      gaze.y += (target.y - gaze.y) * 0.08;
      if (ref.current) {
        ref.current.style.transform = `translate(calc(-50% + ${gaze.x}px), calc(-50% + ${gaze.y}px))`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [size]);
  return (
    <div className="eye" style={{ width: size, height: size }}>
      <div className="pupil" ref={ref} />
    </div>
  );
}

function Badge({ secs, total, showCheck, pal }: { secs: number | null; total: number; showCheck: boolean; pal: Pal }) {
  if (secs == null && !showCheck) return null;
  const pct = showCheck ? 100 : clamp(((total - (secs || 0)) / total) * 100, 0, 100);
  const ringColor = showCheck ? pal.good : "var(--accent)";
  return (
    <div className="badge-ring" style={{ background: `conic-gradient(${ringColor} ${pct}%, var(--track) 0)` }}>
      <div className="badge-inner">{showCheck ? <CheckIcon size={12} /> : <span className="num">{Math.min(99, secs || 0)}</span>}</div>
    </div>
  );
}

function MetricRow({ label, pct, sub, pal }: Metric & { pal: Pal }) {
  if (pct == null) {
    return (
      <div className="metric">
        <div className="metric-top">
          <span className="label">{label}</span>
        </div>
        <div className="metric-plain num">{sub || "--"}</div>
      </div>
    );
  }
  return (
    <div className="metric">
      <div className="metric-top">
        <span className="label">{label}</span>
        <span className="val num">{fmtPct(pct)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${clamp(pct, 0, 100)}%`, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) }} />
      </div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}

function Icon({ id }: { id: string }) {
  return (
    <div className="icon-chip">
      <img className="icon-img" src={PROVIDER_ICON[id]} alt={id} draggable={false} />
    </div>
  );
}

function buildProviders(data: UsagePayload, t: T): ProviderMeta[] {
  const list: ProviderMeta[] = [];
  for (const c of data.claude || []) {
    list.push({
      id: `claude:${c.id}`,
      provider: "claude",
      ok: c.ok,
      error: c.error,
      title: "Claude",
      label: c.label || "",
      metrics: [
        {
          label: t.session5h,
          pct: c.session_percent,
          sub: c.session_percent != null ? t.remainingPrefix + fmtRemain(c.session_percent) + (c.session_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.session_resets_at)}` : "") : null,
        },
        {
          label: t.weekLimit,
          pct: c.weekly_percent,
          sub: c.weekly_percent != null ? t.remainingPrefix + fmtRemain(c.weekly_percent) + (c.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.weekly_resets_at)}` : "") : null,
        },
      ],
    });
  }
  for (const c of data.cursor || []) {
    let ondemand = "";
    if (c.used_cents != null && c.limit_cents != null) ondemand = `${fmtUsd(c.used_cents)} / ${fmtUsd(c.limit_cents)}`;
    if ((c.bonus_cents || 0) > 0) ondemand += (ondemand ? "  " : "") + t.bonusPrefix + fmtUsd(c.bonus_cents);
    list.push({
      id: `cursor:${c.id}`,
      provider: "cursor",
      ok: c.ok,
      error: c.error,
      title: c.plan ? `Cursor ${c.plan}` : "Cursor",
      label: c.label || "",
      metrics: [
        { label: t.cursorModels, pct: c.percent, sub: c.cycle_end ? t.resetPrefix + fmtWhen(c.cycle_end) : null },
        { label: t.otherModels, pct: c.other_percent, sub: ondemand || null },
      ],
    });
  }
  for (const o of data.openrouter || []) {
    const sub = o.remaining_cents != null ? t.remainMoney + fmtUsd(o.remaining_cents) : t.noCredits;
    list.push({
      id: `openrouter:${o.id}`,
      provider: "openrouter",
      ok: o.ok,
      error: o.error,
      title: "OpenRouter",
      label: o.label || "",
      metrics: [{ label: t.accountCredits, pct: null, sub }],
    });
  }
  for (const d of data.deepseek || []) {
    const sub = d.remaining_cents != null ? t.remainMoney + fmtUsd(d.remaining_cents) : t.noCredits;
    list.push({
      id: `deepseek:${d.id}`,
      provider: "deepseek",
      ok: d.ok,
      error: d.error,
      title: "DeepSeek",
      label: d.label || "",
      metrics: [{ label: t.accountCredits, pct: d.percent, sub }],
    });
  }
  return list;
}

function ProviderCard({ p, pal, onOpen }: { p: ProviderMeta; pal: Pal; onOpen: () => void }) {
  return (
    <div className="card view-fade" onClick={onOpen}>
      <div className="card-head">
        <Icon id={p.provider} />
        <div className="card-title-wrap">
          <div className="card-title">
            <span className="txt">{p.title}</span>
            <span className={`status-dot ${p.ok ? "ok" : "bad"}`} />
          </div>
          {p.label ? <div className="card-label">{p.label}</div> : null}
        </div>
      </div>
      <div className="card-metrics">
        {!p.ok ? <div className="error-text">{p.error || ""}</div> : p.metrics.map((m, i) => <MetricRow key={i} {...m} pal={pal} />)}
      </div>
    </div>
  );
}

function StatusStrip({ providers, okFlashAt, now, t }: { providers: ProviderMeta[]; okFlashAt: number; now: number; t: T }) {
  const failing = providers.filter((p) => !p.ok).length;
  const agoS = okFlashAt ? Math.max(0, Math.round((now - okFlashAt) / 1000)) : null;
  const agoText = agoS == null ? "" : agoS < 3 ? t.agoNow : t.agoSecs(agoS);
  return (
    <div className="status-strip">
      <div className="who">
        <span className={`who-dot ${failing ? "bad" : "ok"}`} />
        <span>{failing ? t.errorsCount(failing) : t.allOk}</span>
      </div>
      <div className="num">{agoText}</div>
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
  onNow: () => void;
  nowActive: boolean;
  t: T;
}) {
  const { providers, section, selectedId, open, onOverview, onSelect, onClose, onNow, nowActive, t } = props;
  return (
    <nav className={`sidebar${open ? " open" : ""}`}>
      <button className={`side-item${section === "overview" && !nowActive ? " active" : ""}`} onClick={() => { onOverview(); onClose(); }}>
        <GridIcon size={16} /> {t.overview}
      </button>
      <button className={`side-item${nowActive ? " active" : ""}`} onClick={() => { onNow(); onClose(); }}>
        <ClockIcon size={16} /> {t.now}
      </button>
      <div className="side-section-title">{t.accounts}</div>
      {providers.length === 0 ? (
        <div className="side-empty">{t.noProviders}</div>
      ) : (
        providers.map((p) => (
          <button key={p.id} className={`side-item${section === "account" && selectedId === p.id ? " active" : ""}`} onClick={() => { onSelect(p.id); onClose(); }}>
            <div className="icon-chip side-account-icon">
              <img src={PROVIDER_ICON[p.provider]} alt={p.provider} draggable={false} />
            </div>
            <div className="side-account-text">
              <div className="side-account-name">{p.title}</div>
              {p.label ? <div className="side-account-label">{p.label}</div> : null}
            </div>
            <span className={`side-dot ${p.ok ? "ok" : "bad"}`} />
          </button>
        ))
      )}
    </nav>
  );
}

function Overview({ providers, okFlashAt, now, t, pal, onOpen }: { providers: ProviderMeta[]; okFlashAt: number; now: number; t: T; pal: Pal; onOpen: (id: string) => void }) {
  const failing = providers.filter((p) => !p.ok).length;
  const agoS = okFlashAt ? Math.max(0, Math.round((now - okFlashAt) / 1000)) : null;
  return (
    <>
      <div className="overview-head">
        <h1>{t.overview}</h1>
        <div className="overview-stat">
          <span className={`who-dot ${failing ? "bad" : "ok"}`} />
          <span>{failing ? t.errorsCount(failing) : t.allOk}</span>
          <span className="num">{agoS != null ? `· ${agoS < 3 ? t.agoNow : t.agoSecs(agoS)}` : ""}</span>
        </div>
      </div>
      {providers.length === 0 ? (
        <div className="empty-note">{t.noProviders}</div>
      ) : (
        <div className="overview-grid">
          {providers.map((p) => (
            <ProviderCard key={p.id} p={p} pal={pal} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function NowRow({ p, pal }: { p: ProviderMeta; pal: Pal }) {
  const half = p.metrics.length === 1;
  return (
    <div className={`now-row${half ? " half" : ""}`}>
      <div className="now-row-head">
        <Icon id={p.provider} />
        <div className="now-row-title-wrap">
          <div className="now-row-title">{p.title}</div>
          {p.label ? <div className="card-label">{p.label}</div> : null}
        </div>
      </div>
      {!p.ok ? (
        <div className="error-text">{p.error || ""}</div>
      ) : (
        <div className="now-row-metrics">
          {p.metrics.map((m, i) => (
            <div key={i} className="now-metric">
              <div className="now-metric-top">
                <span className="label">{m.label}</span>
                {m.pct != null ? <span className="val num">{fmtPct(m.pct)}</span> : null}
              </div>
              {m.pct != null ? (
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${clamp(m.pct, 0, 100)}%`, background: barColor(m.pct, pal), boxShadow: barGlow(m.pct, pal) }} />
                </div>
              ) : (
                <div className="now-metric-plain num">{m.sub || "--"}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NowView({ data, prefs, t, pal, nowMs, okFlashAt, onClose }: { data: UsagePayload; prefs: Prefs; t: T; pal: Pal; nowMs: number; okFlashAt: number; onClose: () => void }) {
  const [clockNow, setClockNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad2(clockNow.getHours())}:${pad2(clockNow.getMinutes())}:${pad2(clockNow.getSeconds())}`;
  const weekday = WEEKDAYS[prefs.lang][clockNow.getDay()];
  const dateStr = `${weekday}  ${pad2(clockNow.getDate())}/${pad2(clockNow.getMonth() + 1)}/${clockNow.getFullYear()}`;
  const providers = buildProviders(data, t);
  return (
    <div className="now-view" onClick={onClose}>
      <div className="now-clock">{timeStr}</div>
      <div className="now-date">{dateStr}</div>
      <div className="now-rows">
        <StatusStrip providers={providers} okFlashAt={okFlashAt} now={nowMs} t={t} />
        {providers.length === 0 ? <div className="empty-note">{t.noProviders}</div> : providers.map((p) => <NowRow key={p.id} p={p} pal={pal} />)}
      </div>
    </div>
  );
}

function DetailBar({ label, pct, sub, pal }: { label: string; pct: number | null | undefined; sub?: string | null; pal: Pal }) {
  if (pct == null) {
    return (
      <div className="detail-bar">
        <div className="detail-bar-top">
          <span className="label">{label}</span>
        </div>
        <div className="detail-plain-val num">{sub || "--"}</div>
      </div>
    );
  }
  return (
    <div className="detail-bar">
      <div className="detail-bar-top">
        <span className="label">{label}</span>
        <span className="val num">{fmtPct(pct)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${clamp(pct, 0, 100)}%`, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) }} />
      </div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v num">{v}</span>
    </div>
  );
}

function ClaudeBody({ data, account, t, pal }: { data: UsagePayload; account: ClaudeAccount; t: T; pal: Pal }) {
  const c = account;
  return (
    <>
      <Kv k={t.updated} v={fmtWhen(data.updated_at)} />
      <DetailBar label={t.window5h} pct={c.session_percent} pal={pal} sub={t.remainingPrefix + fmtRemain(c.session_percent) + (c.session_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.session_resets_at)}` : "")} />
      <Kv k={t.used} v={fmtPct(c.session_percent)} />
      <Kv k={t.left} v={fmtRemain(c.session_percent)} />
      <Kv k={t.reset} v={fmtWhen(c.session_resets_at)} />
      <DetailBar label={t.weekLimit} pct={c.weekly_percent} pal={pal} sub={t.remainingPrefix + fmtRemain(c.weekly_percent) + (c.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.weekly_resets_at)}` : "")} />
      <Kv k={t.used} v={fmtPct(c.weekly_percent)} />
      <Kv k={t.left} v={fmtRemain(c.weekly_percent)} />
      <Kv k={t.reset} v={fmtWhen(c.weekly_resets_at)} />
      {c.sonnet_percent != null ? <DetailBar label={t.sonnetWeek} pct={c.sonnet_percent} pal={pal} sub={t.remainingPrefix + fmtRemain(c.sonnet_percent) + (c.sonnet_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.sonnet_resets_at)}` : "")} /> : null}
      {c.sonnet_percent != null ? <Kv k={t.reset} v={fmtWhen(c.sonnet_resets_at)} /> : null}
      {c.opus_percent != null ? <DetailBar label={t.opusWeek} pct={c.opus_percent} pal={pal} sub={t.remainingPrefix + fmtRemain(c.opus_percent) + (c.opus_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(c.opus_resets_at)}` : "")} /> : null}
      {c.opus_percent != null ? <Kv k={t.reset} v={fmtWhen(c.opus_resets_at)} /> : null}
    </>
  );
}

function CursorBody({ data, account, t, pal }: { data: UsagePayload; account: CursorAccount; t: T; pal: Pal }) {
  const c = account;
  return (
    <>
      <Kv k={t.plan} v={c.plan} />
      <Kv k={t.cycle} v={fmtWhen(c.cycle_end)} />
      <Kv k={t.updated} v={fmtWhen(data.updated_at)} />
      <DetailBar label={t.cursorModels} pct={c.percent} pal={pal} sub={t.remainingPrefix + fmtRemain(c.percent)} />
      <Kv k={t.used} v={fmtPct(c.percent)} />
      <Kv k={t.left} v={fmtRemain(c.percent)} />
      <DetailBar label={t.otherModels} pct={c.other_percent} pal={pal} sub={t.remainingPrefix + fmtRemain(c.other_percent)} />
      <Kv k={t.used} v={fmtPct(c.other_percent)} />
      <Kv k={t.left} v={fmtRemain(c.other_percent)} />
      <div className="note">{t.ondemand}</div>
      <Kv k={t.used} v={c.used_cents != null ? fmtUsd(c.used_cents) : ""} />
      <Kv k={t.cap} v={c.limit_cents != null ? fmtUsd(c.limit_cents) : ""} />
      <Kv k={t.left} v={c.remaining_cents != null ? fmtUsd(c.remaining_cents) : ""} />
      <Kv k={t.bonus} v={(c.bonus_cents || 0) > 0 ? fmtUsd(c.bonus_cents) : ""} />
      {c.requests_used != null && (c.requests_limit || 0) > 0 ? <div className="note">{t.requestsLegacy}</div> : null}
      {c.requests_used != null && (c.requests_limit || 0) > 0 ? <Kv k={t.usedCount} v={String(c.requests_used)} /> : null}
      {c.requests_used != null && (c.requests_limit || 0) > 0 ? <Kv k={t.limit} v={String(c.requests_limit)} /> : null}
    </>
  );
}

function OpenRouterBody({ data, account, t, pal }: { data: UsagePayload; account: CreditsAccount; t: T; pal: Pal }) {
  const o = account;
  const remain = o.remaining_cents != null ? t.remainMoney + fmtUsd(o.remaining_cents) : t.noCredits;
  return (
    <>
      <div className="note">{t.allKeysNote}</div>
      <Kv k={t.updated} v={fmtWhen(data.updated_at)} />
      <DetailBar label={t.credits} pct={null} pal={pal} sub={remain} />
      <Kv k={t.used} v={o.used_cents != null ? fmtUsd(o.used_cents) : ""} />
      <Kv k={t.left} v={o.remaining_cents != null ? fmtUsd(o.remaining_cents) : ""} />
      <Kv k={t.cap} v={o.limit_cents != null ? fmtUsd(o.limit_cents) : ""} />
      <Kv k={t.percent} v={fmtPct(o.percent)} />
    </>
  );
}

function DeepSeekBody({ data, account, t, pal }: { data: UsagePayload; account: CreditsAccount; t: T; pal: Pal }) {
  const d = account;
  const remain = d.remaining_cents != null ? t.remainMoney + fmtUsd(d.remaining_cents) : t.noCredits;
  return (
    <>
      <Kv k={t.updated} v={fmtWhen(data.updated_at)} />
      <DetailBar label={t.credits} pct={d.percent} pal={pal} sub={remain} />
    </>
  );
}

function AccountPage({ meta, account, data, t, pal }: { meta: ProviderMeta; account: ClaudeAccount | CursorAccount | CreditsAccount | null; data: UsagePayload; t: T; pal: Pal }) {
  let body: ReactNode = null;
  if (meta.ok && account) {
    if (meta.provider === "claude") body = <ClaudeBody data={data} account={account as ClaudeAccount} t={t} pal={pal} />;
    else if (meta.provider === "cursor") body = <CursorBody data={data} account={account as CursorAccount} t={t} pal={pal} />;
    else if (meta.provider === "openrouter") body = <OpenRouterBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else body = <DeepSeekBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
  }
  return (
    <div className="account-page view-fade">
      <div className="account-header">
        <Icon id={meta.provider} />
        <div>
          <div className="account-title">{meta.title}</div>
          {meta.label ? <div className="card-label">{meta.label}</div> : null}
        </div>
      </div>
      <div className="account-card">{!meta.ok ? <div className="error-text">{meta.error || t.noData}</div> : body}</div>
    </div>
  );
}

function SettingsDrawer({ prefs, setPrefs, t, onRefresh, data, refreshing, fetchFailed, onClose }: { prefs: Prefs; setPrefs: (fn: (p: Prefs) => Prefs) => void; t: T; onRefresh: () => void; data: UsagePayload; refreshing: boolean; fetchFailed: boolean; onClose: () => void }) {
  const accents = ACCENTS[prefs.theme];
  return (
    <>
      <div className="settings-scrim" onClick={onClose} />
      <div className="settings-drawer">
        <div className="settings-head">
          <h2>{t.settings}</h2>
          <button className="icon-btn" onClick={onClose} title={t.closeSettings}>
            <CloseIcon size={18} />
          </button>
        </div>
        <Kv k={t.updated} v={fmtWhen(data.updated_at)} />
        <div className="section-title">{t.themeSection}</div>
        <div className="segmented">
          {(["dark", "light", "contrast"] as ThemeName[]).map((k) => (
            <button key={k} className={prefs.theme === k ? "active" : ""} onClick={() => setPrefs((p) => ({ ...p, theme: k }))}>
              {t[k]}
            </button>
          ))}
        </div>
        <div className="section-title">{t.accentSection}</div>
        <div className="swatch-row">
          {accents.map((c, i) => (
            <button key={i} className={`swatch${prefs.accent === i ? " active" : ""}`} aria-label={`${t.accentSection} ${i + 1}`} style={{ background: c }} onClick={() => setPrefs((p) => ({ ...p, accent: i }))}>
              {prefs.accent === i ? <CheckIcon size={14} stroke={inverseOn(c)} /> : null}
            </button>
          ))}
        </div>
        <div className="section-title">{t.langSection}</div>
        <div className="segmented">
          {([["pt", "PT"], ["en", "EN"], ["es", "ES"]] as const).map(([k, label]) => (
            <button key={k} className={prefs.lang === k ? "active" : ""} onClick={() => setPrefs((p) => ({ ...p, lang: k }))}>
              {label}
            </button>
          ))}
        </div>
        <div className="section-title">{t.refreshSection}</div>
        <button className="btn-primary" onClick={onRefresh}>{refreshing ? "…" : t.refreshNow}</button>
        <div className="status-note">{t.autoNote()}</div>
        {fetchFailed ? <div className="fetch-fail-note">{t.fetchFail}</div> : null}
      </div>
    </>
  );
}

export default function Display() {
  const [prefs, setPrefs] = usePrefs();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [section, setSection] = useState<"overview" | "account">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nowOpen, setNowOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nextFetchAt, setNextFetchAt] = useState(Date.now() + POLL_MS);
  const [okFlashAt, setOkFlashAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [driftMs, setDriftMs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const pal = PALETTES[prefs.theme];
  const flat = prefs.theme === "contrast";
  const accent = ACCENTS[prefs.theme][prefs.accent] || ACCENTS[prefs.theme][0];
  const t = STR[prefs.lang];
  const shellClass = `shell${flat ? " flat" : ""}`;

  useEffect(() => {
    applyThemeVars(pal, accent, flat);
  }, [pal, accent, flat]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
    setData(json);
    setFetchFailed(false);
    setOkFlashAt(Date.now());
    const serverMs = Date.parse(json.updated_at);
    if (!Number.isNaN(serverMs)) setDriftMs(serverMs - Date.now());
    setNextFetchAt(Date.now() + POLL_MS);
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

  if (!data) {
    return (
      <div className={shellClass}>
        <div className="topbar">
          <div className="eye" style={{ width: 28, height: 28 }}>
            <div className="pupil" />
          </div>
          <div className="brand">VIGIA<span className="ai"> AI</span></div>
        </div>
        <div className="content-area">
          <div className="empty-note">{fetchFailed ? t.fetchFail : "…"}</div>
        </div>
      </div>
    );
  }

  if (nowOpen) {
    return (
      <div className={shellClass}>
        <NowView data={data} prefs={prefs} t={t} pal={pal} nowMs={now} okFlashAt={okFlashAt} onClose={() => setNowOpen(false)} />
      </div>
    );
  }

  const providers = buildProviders(data, t);
  const showCheck = Boolean(okFlashAt && now - okFlashAt < FETCH_OK_FLASH_MS);
  const secsLeft = showCheck ? null : Math.max(0, Math.ceil((nextFetchAt - now) / 1000));
  let meta: ProviderMeta | null = null;
  let rawAccount: ClaudeAccount | CursorAccount | CreditsAccount | null = null;
  if (section === "account") {
    meta = providers.find((p) => p.id === selectedId) || null;
    if (meta) {
      const idx = meta.id.indexOf(":");
      const accountId = meta.id.slice(idx + 1);
      const key = meta.provider as "claude" | "cursor" | "openrouter" | "deepseek";
      rawAccount = (data[key] || []).find((a) => a.id === accountId) ?? null;
    }
  }

  return (
    <div className={shellClass}>
      <div className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)}><MenuIcon size={19} /></button>
        <button className="brand-btn" onClick={() => setSection("overview")}>
          <Eye size={28} />
          <div className="brand">VIGIA<span className="ai"> AI</span></div>
        </button>
        <div className="spacer" />
        <button className="clock-btn num" onClick={() => setNowOpen(true)} title={t.now}>
          <span className="clock-dot" />
          {fmtClock(now + driftMs)}
        </button>
        <button className={`icon-btn${settingsOpen ? " on" : ""}`} onClick={() => setSettingsOpen((v) => !v)} title={t.settings}>
          <SettingsIcon size={19} />
        </button>
        <Badge secs={secsLeft} total={POLL_MS / 1000} showCheck={showCheck} pal={pal} />
      </div>
      <div className="shell-body">
        {sidebarOpen ? <div className="scrim" onClick={() => setSidebarOpen(false)} /> : null}
        <Sidebar
          providers={providers}
          section={section}
          selectedId={selectedId}
          open={sidebarOpen}
          t={t}
          nowActive={nowOpen}
          onOverview={() => setSection("overview")}
          onSelect={(id) => { setSection("account"); setSelectedId(id); }}
          onNow={() => setNowOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="content-area">
          {section === "overview" ? <Overview providers={providers} okFlashAt={okFlashAt} now={now} t={t} pal={pal} onOpen={(id) => { setSection("account"); setSelectedId(id); }} /> : null}
          {section === "account" && meta ? <AccountPage key={meta.id} meta={meta} account={rawAccount} data={data} t={t} pal={pal} /> : null}
        </main>
      </div>
      {settingsOpen ? <SettingsDrawer prefs={prefs} setPrefs={setPrefs} t={t} onRefresh={() => void loadUsage()} data={data} refreshing={refreshing} fetchFailed={fetchFailed} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
