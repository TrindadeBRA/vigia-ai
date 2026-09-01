import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { fetchHealth, fetchUsage, openUsageEvents } from "../api/client";
import type { ClaudeAccount, CreditsAccount, CursorAccount, GptAccount, OpenCodeAccount, UsagePayload } from "../api/types";
import { Logo } from "../components/Logo";
import { CheckIcon, ClockIcon, CloseIcon, GitHubIcon, GridIcon, MenuIcon, SettingsIcon, SlidersIcon } from "../components/icons";
import "../display.css";
import { FETCH_OK_FLASH_MS, FRESH_PAYLOAD_MS, POLL_MS, barColor, barGlow, clamp, countdownSecs, fmtClock, fmtCountdown, fmtPct, fmtRemain, fmtUsd, fmtWhen, nextFetchAtMs, payloadAgeMs } from "../format";
import { STR, WEEKDAYS, type Lang, type T } from "../i18n";
import { ACCENTS, PALETTES, PROVIDER_ICON, applyThemeVars, inverseOn, type ThemeName } from "../theme";
import type { ConfigOutlet } from "./config/ConfigPage";

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

function Badge({ secs, total, showCheck, pal, onClick }: { secs: number; total: number; showCheck: boolean; pal: Pal; onClick?: () => void }) {
  const pct = showCheck ? 100 : clamp(((total - secs) / total) * 100, 0, 100);
  const ringColor = showCheck ? pal.good : "var(--accent)";
  const inner = <div className="badge-inner">{showCheck ? <CheckIcon size={12} /> : <span className="num">{Math.min(99, secs)}</span>}</div>;
  const style = { background: `conic-gradient(${ringColor} ${pct}%, var(--track) 0)` };
  if (onClick) {
    return (
      <button className="badge-ring" style={style} onClick={onClick} title="Atualizar agora" aria-label="Atualizar agora">
        {inner}
      </button>
    );
  }
  return (
    <div className="badge-ring" style={style}>
      {inner}
    </div>
  );
}

function barFillStyle(pct: number, pal: Pal) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
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
        <div className="bar-fill" style={barFillStyle(pct, pal)} />
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

function gptSessionMetric(g: GptAccount, t: T, nowMs: number): Metric {
  if (g.session_percent != null) {
    return {
      label: t.session5h,
      pct: g.session_percent,
      sub: t.remainingPrefix + fmtRemain(g.session_percent) + (g.session_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(g.session_resets_at)}` : ""),
    };
  }
  const until = g.session_resets_at || g.weekly_resets_at;
  return { label: t.resetIn, pct: null, sub: fmtCountdown(until, nowMs) };
}

function buildProviders(data: UsagePayload, t: T, nowMs = Date.now()): ProviderMeta[] {
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
  for (const g of data.gpt || []) {
    list.push({
      id: `gpt:${g.id}`,
      provider: "gpt",
      ok: g.ok,
      error: g.error,
      title: g.plan ? `GPT ${g.plan}` : "GPT",
      label: g.label || "",
      metrics: [
        gptSessionMetric(g, t, nowMs),
        {
          label: t.weekLimit,
          pct: g.weekly_percent,
          sub: g.weekly_percent != null ? t.remainingPrefix + fmtRemain(g.weekly_percent) + (g.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(g.weekly_resets_at)}` : "") : null,
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
  for (const o of data.opencode || []) {
    const metrics: Metric[] = [];
    if (o.rolling_percent != null) {
      metrics.push({
        label: t.rolling,
        pct: o.rolling_percent,
        sub: t.remainingPrefix + fmtRemain(o.rolling_percent) + (o.rolling_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(o.rolling_resets_at)}` : ""),
      });
    }
    if (o.weekly_percent != null) {
      metrics.push({
        label: t.weekLimit,
        pct: o.weekly_percent,
        sub: t.remainingPrefix + fmtRemain(o.weekly_percent) + (o.weekly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(o.weekly_resets_at)}` : ""),
      });
    }
    if (o.monthly_percent != null) {
      metrics.push({
        label: t.monthLimit,
        pct: o.monthly_percent,
        sub: t.remainingPrefix + fmtRemain(o.monthly_percent) + (o.monthly_resets_at ? `  ·  ${t.resetPrefix}${fmtWhen(o.monthly_resets_at)}` : ""),
      });
    }
    if (o.remaining_cents != null) {
      metrics.push({
        label: t.accountCredits,
        pct: null,
        sub: t.remainMoney + fmtUsd(o.remaining_cents),
      });
    }
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
    const sub = f.remaining_cents != null ? t.remainMoney + fmtUsd(f.remaining_cents) : t.noCredits;
    list.push({
      id: `fal:${f.id}`,
      provider: "fal",
      ok: f.ok,
      error: f.error,
      title: "fal.ai",
      label: f.label || "",
      metrics: [{ label: t.accountCredits, pct: null, sub }],
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

function StatusStrip({ providers, updatedAt, now, t }: { providers: ProviderMeta[]; updatedAt: string; now: number; t: T }) {
  const failing = providers.filter((p) => !p.ok).length;
  const age = payloadAgeMs(updatedAt, now);
  const agoS = age == null ? null : Math.max(0, Math.round(age / 1000));
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
  configActive: boolean;
  t: T;
}) {
  const { providers, section, selectedId, open, onOverview, onSelect, onClose, onNow, nowActive, configActive, t } = props;
  return (
    <nav className={`sidebar${open ? " open" : ""}`}>
      <button className={`side-item${section === "overview" && !nowActive && !configActive ? " active" : ""}`} onClick={() => { onOverview(); onClose(); }}>
        <GridIcon size={16} /> {t.overview}
      </button>
      <button className={`side-item${nowActive ? " active" : ""}`} onClick={() => { onNow(); onClose(); }}>
        <ClockIcon size={16} /> {t.now}
      </button>
      <div className="side-section-title">{t.accounts}</div>
      {providers.length === 0 ? (
        <div className="side-empty">
          {t.noProviders}{" "}
          <NavLink to="/display/config" className="side-inline-link" onClick={onClose}>
            {t.configCta}
          </NavLink>
        </div>
      ) : (
        providers.map((p) => (
          <button key={p.id} className={`side-item${section === "account" && selectedId === p.id && !configActive ? " active" : ""}`} onClick={() => { onSelect(p.id); onClose(); }}>
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
      <div className="side-section-title">{t.setup}</div>
      <NavLink to="/display/config" className={({ isActive }) => `side-item${isActive ? " active" : ""}`} onClick={onClose}>
        <SlidersIcon size={16} /> {t.config}
      </NavLink>
      <a className="side-item side-footer" href="https://github.com/TrindadeBRA/vigia-ai" target="_blank" rel="noopener noreferrer">
        <GitHubIcon size={16} /> GitHub
      </a>
    </nav>
  );
}

function Overview({ providers, updatedAt, now, t, pal, onOpen }: { providers: ProviderMeta[]; updatedAt: string; now: number; t: T; pal: Pal; onOpen: (id: string) => void }) {
  const failing = providers.filter((p) => !p.ok).length;
  const age = payloadAgeMs(updatedAt, now);
  const agoS = age == null ? null : Math.max(0, Math.round(age / 1000));
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
        <div className="empty-note">
          {t.noProviders}{" "}
          <Link to="/display/config" className="empty-link">
            {t.configCta}
          </Link>
        </div>
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
                  <div className="bar-fill" style={barFillStyle(m.pct, pal)} />
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

function NowView({ data, prefs, t, pal, nowMs, driftMs, secs, pollS, showCheck, onClose }: { data: UsagePayload; prefs: Prefs; t: T; pal: Pal; nowMs: number; driftMs: number; secs: number; pollS: number; showCheck: boolean; onClose: () => void }) {
  const clockNow = new Date(nowMs + driftMs);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad2(clockNow.getHours())}:${pad2(clockNow.getMinutes())}:${pad2(clockNow.getSeconds())}`;
  const weekday = WEEKDAYS[prefs.lang][clockNow.getDay()];
  const dateStr = `${weekday}  ${pad2(clockNow.getDate())}/${pad2(clockNow.getMonth() + 1)}/${clockNow.getFullYear()}`;
  const providers = buildProviders(data, t, nowMs);
  return (
    <div className="now-view" onClick={onClose}>
      <div className="now-badge">
        <Badge secs={secs} total={pollS} showCheck={showCheck} pal={pal} />
      </div>
      <div className="now-clock">{timeStr}</div>
      <div className="now-date">{dateStr}</div>
      <div className="now-rows">
        <StatusStrip providers={providers} updatedAt={data.updated_at} now={nowMs} t={t} />
        {providers.length === 0 ? <div className="empty-note">{t.noProviders}</div> : providers.map((p) => <NowRow key={p.id} p={p} pal={pal} />)}
      </div>
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
    <div className="account-meta">
      {shown.map((i) => (
        <div className="meta-chip" key={i.k}>
          <span className="k">{i.k}</span>
          <span className="v num">{i.v}</span>
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
    <div className="metric-card">
      <div className="detail-bar-top">
        <span className="label">{label}</span>
        {display ? <span className="val num">{display}</span> : null}
      </div>
      {pct != null ? (
        <div className="bar-track">
          <div className="bar-fill" style={barFillStyle(pct, pal)} />
        </div>
      ) : !display && sub ? (
        <div className="detail-plain-val num">{sub}</div>
      ) : null}
      {sub && (pct != null || display) ? <div className="metric-sub">{sub}</div> : null}
      {children}
    </div>
  );
}

function MetricsGrid({ children }: { children: ReactNode }) {
  return <div className="account-metrics">{children}</div>;
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
      <MetaChips items={[{ k: t.updated, v: fmtWhen(data.updated_at) }]} />
      <MetricsGrid>
        <MetricCard label={t.window5h} pct={c.session_percent} pal={pal} sub={remainLine(t, c.session_percent, c.session_resets_at)} />
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

function CursorBody({ data, account, t, pal }: { data: UsagePayload; account: CursorAccount; t: T; pal: Pal }) {
  const c = account;
  const ondemandPct = c.used_cents != null && c.limit_cents != null && c.limit_cents > 0 ? clamp((c.used_cents / c.limit_cents) * 100, 0, 100) : null;
  const hasLegacy = c.requests_used != null && (c.requests_limit || 0) > 0;
  return (
    <>
      <MetaChips items={[{ k: t.plan, v: c.plan }, { k: t.cycle, v: fmtWhen(c.cycle_end) }, { k: t.updated, v: fmtWhen(data.updated_at) }]} />
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
        <div className="account-extra metric-card">
          <div className="note">{t.requestsLegacy}</div>
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
      <div className="account-note">{t.allKeysNote}</div>
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

function AccountPage({ meta, account, data, t, pal, nowMs }: { meta: ProviderMeta; account: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | null; data: UsagePayload; t: T; pal: Pal; nowMs: number }) {
  let body: ReactNode = null;
  if (meta.ok && account) {
    if (meta.provider === "claude") body = <ClaudeBody data={data} account={account as ClaudeAccount} t={t} pal={pal} />;
    else if (meta.provider === "gpt") body = <GptBody data={data} account={account as GptAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "cursor") body = <CursorBody data={data} account={account as CursorAccount} t={t} pal={pal} />;
    else if (meta.provider === "openrouter") body = <OpenRouterBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "deepseek") body = <DeepSeekBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
    else if (meta.provider === "opencode") body = <OpenCodeBody data={data} account={account as OpenCodeAccount} t={t} pal={pal} />;
    else if (meta.provider === "fal") body = <FalBody data={data} account={account as CreditsAccount} t={t} pal={pal} />;
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
      <div className="account-content">{!meta.ok ? <div className="metric-card"><div className="error-text">{meta.error || t.noData}</div></div> : body}</div>
    </div>
  );
}

function SettingsDrawer({ prefs, setPrefs, t, onRefresh, data, refreshing, fetchFailed, onClose }: { prefs: Prefs; setPrefs: (fn: (p: Prefs) => Prefs) => void; t: T; onRefresh: () => void; data: UsagePayload | null; refreshing: boolean; fetchFailed: boolean; onClose: () => void }) {
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
        <Kv k={t.updated} v={data ? fmtWhen(data.updated_at) : "—"} />
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
  const navigate = useNavigate();
  const isConfig = Boolean(useMatch("/display/config"));
  const [prefs, setPrefs] = usePrefs();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [section, setSection] = useState<"overview" | "account">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nowOpen, setNowOpen] = useState(false);
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
  const shellClass = `shell${flat ? " flat" : ""}`;
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
    setNowOpen(false);
  }

  if (nowOpen && data) {
    return (
      <div className={shellClass}>
        <NowView data={data} prefs={prefs} t={t} pal={pal} nowMs={now} driftMs={driftMs} secs={secsLeft} pollS={pollS} showCheck={showCheck} onClose={() => setNowOpen(false)} />
      </div>
    );
  }

  const providers = data ? buildProviders(data, t, now) : [];
  let meta: ProviderMeta | null = null;
  let rawAccount: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | null = null;
  if (data && section === "account") {
    meta = providers.find((p) => p.id === selectedId) || null;
    if (meta) {
      const idx = meta.id.indexOf(":");
      const accountId = meta.id.slice(idx + 1);
      const key = meta.provider as "claude" | "gpt" | "cursor" | "openrouter" | "deepseek" | "opencode" | "fal";
      rawAccount = (data[key] || []).find((a) => a.id === accountId) ?? null;
    }
  }

  return (
    <div className={shellClass}>
      <div className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)}><MenuIcon size={19} /></button>
        <button className="brand-btn" onClick={goOverview}>
          <Logo size={28} />
        </button>
        <div className="spacer" />
        <button className="clock-btn num" onClick={() => { if (data) setNowOpen(true); }} title={t.now}>
          <span className="clock-dot" />
          {fmtClock(now + driftMs)}
        </button>
        <button className={`icon-btn${settingsOpen ? " on" : ""}`} onClick={() => setSettingsOpen((v) => !v)} title={t.settings}>
          <SettingsIcon size={19} />
        </button>
        <Badge secs={secsLeft} total={pollS} showCheck={showCheck} pal={pal} onClick={() => void loadUsage()} />
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
          configActive={isConfig}
          onOverview={goOverview}
          onSelect={(id) => { navigate("/display"); setSection("account"); setSelectedId(id); setNowOpen(false); }}
          onNow={() => { if (data) setNowOpen(true); }}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="content-area">
          {isConfig ? (
            <Outlet context={outlet} />
          ) : !data ? (
            fetchFailed ? (
              <div className="empty-note">{t.fetchFail}</div>
            ) : (
              <div className="cfg-skel-page view-fade" aria-hidden>
                <div className="cfg-skel cfg-skel-lead" />
                <div className="cfg-grid">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="cfg-skel cfg-skel-card" />
                  ))}
                </div>
              </div>
            )
          ) : (
            <>
              {section === "overview" ? <Overview providers={providers} updatedAt={data.updated_at} now={now} t={t} pal={pal} onOpen={(id) => { setSection("account"); setSelectedId(id); }} /> : null}
              {section === "account" && meta ? <AccountPage key={meta.id} meta={meta} account={rawAccount} data={data} t={t} pal={pal} nowMs={now} /> : null}
            </>
          )}
        </main>
      </div>
      {settingsOpen ? <SettingsDrawer prefs={prefs} setPrefs={setPrefs} t={t} onRefresh={() => void loadUsage()} data={data} refreshing={refreshing} fetchFailed={fetchFailed} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
