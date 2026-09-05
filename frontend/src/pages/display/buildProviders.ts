import type { BitcoinAccount, GptAccount, UsagePayload } from "../../api/types";
import type { WidgetKind } from "../../components/AddWidgetModal";
import { getAdsenseMetrics } from "../../components/cards/AdsenseCard";
import { getCreditsMetrics, getOpenCodeMetrics } from "../../components/cards/CreditsCard";
import { getRetroMetrics } from "../../components/cards/RetroAchievementsCard";
import { fmtBrl, fmtBtc, fmtCountdown, fmtCurrencyAmount, fmtRemain, fmtUsd } from "../../format";
import type { T } from "../../i18n";
import type { Metric, ProviderMeta } from "./types";

function bitcoinMetrics(b: BitcoinAccount, t: T): Metric[] {
  return [
    { label: t.bitcoinBalance, pct: null, value: b.balance_btc != null ? fmtBtc(b.balance_btc) : null, sub: null },
    { label: "USD", pct: null, value: b.value_usd_cents != null ? fmtUsd(b.value_usd_cents) : null, sub: null },
    { label: "BRL", pct: null, value: b.value_brl_cents != null ? fmtBrl(b.value_brl_cents) : null, sub: b.address || null },
  ];
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

export function buildProviders(data: UsagePayload, t: T, nowMs = Date.now()): ProviderMeta[] {
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
      metrics: getCreditsMetrics(o, t),
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
      metrics: getCreditsMetrics(d, t),
    });
  }
  for (const o of data.opencode || []) {
    list.push({
      id: `opencode:${o.id}`,
      provider: "opencode",
      ok: o.ok,
      error: o.error,
      title: "OpenCode",
      label: o.label || "",
      metrics: getOpenCodeMetrics(o, t),
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
      metrics: getCreditsMetrics(f, t),
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
      metrics: getAdsenseMetrics(a, t),
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
  if (cu && (((cu.items?.length) ?? 0) > 0 || (!cu.ok && cu.error))) {
    list.push({
      id: "currencies:main",
      provider: "currencies",
      ok: cu.ok,
      error: cu.error,
      title: t.currencies,
      label: cu.base,
      metrics: (cu.items ?? []).slice(0, 6).map((it) => ({
        label: it.label || it.code,
        pct: null,
        value: it.ok && it.price != null ? fmtCurrencyAmount(it.price, cu.base) : null,
        sub: it.ok ? null : it.error,
      })),
      kind: "currencies",
      currencies: cu,
    });
  }
  // RetroAchievements — um card por conta
  for (const ra of data.retroachievements || []) {
    list.push({
      id: `retroachievements:${ra.id}`,
      provider: "retroachievements",
      ok: ra.ok,
      error: ra.error,
      title: ra.username ? `RetroAchievements · ${ra.username}` : "RetroAchievements",
      label: ra.motto || ra.status || ra.label || "",
      metrics: getRetroMetrics(ra, t),
      retroachievements: ra,
    });
  }
  // Calendário — um card por payload, lista próximos eventos/tarefas
  const cal = data.calendar;
  if (cal && (((cal.calendars?.length) ?? 0) > 0 || (!cal.ok && cal.error))) {
    const totalEvents = (cal.calendars ?? []).reduce((acc, c) => acc + (c.events?.length ?? 0), 0);
    const first = cal.calendars[0];
    const kindLabel = first?.kind === "tasks" ? t.calendarTasks : t.calendarEvents;
    list.push({
      id: "calendar:main",
      provider: "calendar",
      ok: cal.ok,
      error: cal.error,
      title: cal.calendars.length === 1 ? (first.label || kindLabel) : `${t.calendar} · ${cal.calendars.length}`,
      label: `${totalEvents} ${totalEvents === 1 ? "item" : "itens"}`,
      metrics: (cal.calendars ?? []).slice(0, 2).flatMap((c) =>
        (c.events ?? []).slice(0, 2).map((ev) => ({
          label: ev.summary.slice(0, 32),
          pct: null,
          value: ev.dtstart ? new Date(ev.dtstart).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ev.due ? new Date(ev.due).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null,
          sub: ev.location || (ev.allDay ? "dia todo" : null),
        })),
      ),
      kind: "calendar",
      calendar: cal,
    });
  }
  // Git — um card por repositório (igual às contas de IA)
  const git = data.git;
  if (git && git.repos) {
    for (const repo of git.repos) {
      const repoName = repo.label || repo.source.split("/").pop()?.replace(/\.git$/, "") || repo.source.slice(0, 24);
      const metrics: Metric[] = repo.ok
        ? repo.commits.slice(0, 6).map((c) => ({
          label: c.short_hash,
          pct: null,
          value: c.subject.slice(0, 40),
          sub: `${c.author_name} · ${new Date(c.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
        }))
        : [];
      if (metrics.length === 0 && !repo.ok) {
        metrics.push({ label: repoName, pct: null, value: null, sub: repo.error ?? t.gitNoCommits });
      } else if (metrics.length === 0) {
        metrics.push({ label: repoName, pct: null, value: null, sub: t.gitNoCommits });
      }
      list.push({
        id: `git:${repo.id}`,
        provider: "git",
        ok: repo.ok,
        error: repo.error,
        title: repoName,
        label: repo.branch ? `${repo.branch} · ${repo.commits.length} ${repo.commits.length === 1 ? t.gitCommit : t.gitCommits}` : `${repo.commits.length} ${repo.commits.length === 1 ? t.gitCommit : t.gitCommits}`,
        metrics,
        kind: "git",
        git,
        gitRepo: repo,
      });
    }
    // Se não há repos mas há erro no payload, mostra um card de erro
    if (git.repos.length === 0 && !git.ok && git.error) {
      list.push({
        id: "git:main",
        provider: "git",
        ok: false,
        error: git.error,
        title: t.git,
        label: "",
        metrics: [{ label: t.git, pct: null, value: null, sub: git.error }],
        kind: "git",
        git,
      });
    }
  }
  // RSS — um card com todos os feeds (o backend já filtra hidden/enabled)
  const rss = data.rss;
  if (rss && (((rss.feeds?.length) ?? 0) > 0 || (!rss.ok && rss.error))) {
    const feedCount = rss.feeds?.length ?? 0;
    list.push({
      id: "rss:main",
      provider: "rss",
      ok: rss.ok,
      error: rss.error,
      title: t.rss,
      label: feedCount === 1 ? "1 feed" : `${feedCount} feeds`,
      metrics: (rss.feeds ?? []).slice(0, 2).flatMap((f) =>
        f.items.slice(0, 2).map((it) => ({
          label: it.title.slice(0, 32),
          pct: null,
          value: it.title.slice(0, 40),
          sub: it.pubDate ? new Date(it.pubDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null,
        })),
      ),
      kind: "rss",
      rss,
    });
  }
  return list;
}

/** Widgets extras (relógio, olho/logo) — não vêm do backend, só do que o usuário habilitou. */
export function buildWidgetProviders(enabled: WidgetKind[] | undefined, t: T): ProviderMeta[] {
  const list: ProviderMeta[] = [];
  if (enabled?.includes("clock")) {
    list.push({ id: "widget:clock", provider: "clock", ok: true, error: null, title: t.widgetClock, label: "", metrics: [] });
  }
  if (enabled?.includes("eye")) {
    list.push({ id: "widget:eye", provider: "eye", ok: true, error: null, title: t.widgetEye, label: "", metrics: [] });
  }
  return list;
}

export function buildImageProviders(items: Array<{ id: string; src: string; fit: "cover" | "contain"; label?: string }>, t: T): ProviderMeta[] {
  return items.map((it) => ({
    id: it.id,
    provider: "image",
    kind: "image" as const,
    ok: true,
    error: null,
    title: it.label || t.widgetImage || "Imagem",
    label: "",
    metrics: [],
    imageSrc: it.src,
    imageFit: it.fit,
    imageTransform: (it as unknown as { transform?: { x: number; y: number; scale: number } }).transform ?? null,
  }));
}

export function buildNoteProviders(notes: Array<{ id: string; text: string; color: string }> | undefined, t: T): ProviderMeta[] {
  if (!notes?.length) return [];
  return notes.map((n) => ({
    id: `note:${n.id}`,
    provider: "note",
    kind: "note" as const,
    ok: true,
    error: null,
    title: t.widgetNote || "Nota",
    label: n.text ? n.text.slice(0, 24) : "",
    metrics: [],
    note: n,
  }));
}
