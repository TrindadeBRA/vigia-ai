import { fmtResetWhen } from "../formatting.js";
import { displayLanUrl } from "../netutil.js";
import { load } from "../store.js";

export const METRICS: Record<string, Array<[string, string, string]>> = {
  claude: [
    ["session_percent", "Sessão 5h", "percent"],
    ["weekly_percent", "Semana", "percent"],
    ["sonnet_percent", "Sonnet (semana)", "percent"],
    ["opus_percent", "Opus (semana)", "percent"],
  ],
  gpt: [
    ["session_percent", "Sessão", "percent"],
    ["weekly_percent", "Semana", "percent"],
  ],
  cursor: [
    ["percent", "Uso do plano", "percent"],
    ["other_percent", "Outros modelos", "percent"],
    ["remaining_cents", "Saldo restante", "cents"],
  ],
  openrouter: [
    ["percent", "Uso", "percent"],
    ["remaining_cents", "Saldo restante", "cents"],
  ],
  deepseek: [
    ["percent", "Uso", "percent"],
    ["remaining_cents", "Saldo restante", "cents"],
  ],
  opencode: [
    ["rolling_percent", "Rolling", "percent"],
    ["weekly_percent", "Semana", "percent"],
    ["monthly_percent", "Mês", "percent"],
    ["percent", "Uso", "percent"],
    ["remaining_cents", "Saldo Zen", "cents"],
  ],
  fal: [
    ["remaining_cents", "Saldo restante", "cents"],
  ],
  bitcoin: [
    ["value_usd_cents", "Valor em USD", "cents"],
  ],
  adsense: [
    ["unpaid_cents", "Carteira", "cents"],
  ],
};

export const PROVIDER_NAMES: Record<string, string> = {
  claude: "Claude",
  gpt: "GPT",
  cursor: "Cursor",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  opencode: "OpenCode",
  fal: "fal.ai",
  bitcoin: "Bitcoin",
  adsense: "AdSense",
  calendar: "Calendário",
};

export const CALENDAR_METRICS: Array<[string, string, string]> = [
  ["event", "Eventos", "calendar"],
  ["task", "Tarefas", "calendar"],
  ["all", "Eventos e tarefas", "calendar"],
];

export const CALENDAR_THRESHOLD_UNITS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export function calendarThresholdMs(threshold: number, unit: string): number {
  const ms = CALENDAR_THRESHOLD_UNITS[unit] ?? CALENDAR_THRESHOLD_UNITS.minutes;
  return Math.max(60_000, Math.trunc(threshold * ms));
}

export function calendarThresholdLabel(threshold: number, unit: string): string {
  if (unit === "days") return threshold === 1 ? "1 dia antes" : `${threshold} dias antes`;
  if (unit === "hours") return threshold === 1 ? "1 hora antes" : `${threshold} horas antes`;
  return threshold === 1 ? "1 minuto antes" : `${threshold} minutos antes`;
}

export function catalogPublic(): Record<string, Array<{ key: string; label: string; kind: string }>> {
  const out: Record<string, Array<{ key: string; label: string; kind: string }>> = {};
  for (const [provider, fields] of Object.entries(METRICS)) {
    out[provider] = fields.map(([key, label, kind]) => ({ key, label, kind }));
  }
  out.calendar = CALENDAR_METRICS.map(([key, label, kind]) => ({ key, label, kind }));
  return out;
}

export function metricKind(provider: string, metric: string): string | null {
  if (provider === "calendar") {
    for (const [key, , kind] of CALENDAR_METRICS) if (key === metric) return kind;
    return null;
  }
  for (const [key, , kind] of METRICS[provider] ?? []) {
    if (key === metric) return kind;
  }
  return null;
}

export function metricLabel(provider: string, metric: string): string | null {
  if (provider === "calendar") {
    for (const [key, label] of CALENDAR_METRICS) if (key === metric) return label;
    return null;
  }
  for (const [key, label] of METRICS[provider] ?? []) {
    if (key === metric) return label;
  }
  return null;
}

export function metricResetField(provider: string, metric: string): string | null {
  if (provider === "cursor" && ["percent", "other_percent", "remaining_cents"].includes(metric)) {
    return "cycle_end";
  }
  if (metric.endsWith("_percent")) {
    return metric.replace("_percent", "_resets_at");
  }
  return null;
}

function fired(kind: string, value: number, threshold: number): boolean {
  return kind === "percent" ? value >= threshold : value <= threshold;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function calendarEventTime(ev: Record<string, unknown>): number | null {
  const raw = (ev.dtstart as string | null) ?? (ev.due as string | null) ?? null;
  if (!raw) return null;
  const t = new Date(String(raw)).getTime();
  return Number.isNaN(t) ? null : t;
}

function evaluateCalendarRule(
  rule: Record<string, unknown>,
  payload: Record<string, unknown>,
  armed: Record<string, boolean>,
  events: Array<Record<string, unknown>>,
): void {
  const metric = String(rule.metric);
  const thresholdMs = calendarThresholdMs(Number(rule.threshold), String((rule as Record<string, unknown>).threshold_unit ?? "minutes"));
  const wantedCalendar = String((rule as Record<string, unknown>).calendar_id ?? "*");
  const calPayload = payload.calendar as Record<string, unknown> | null | undefined;
  if (!calPayload || typeof calPayload !== "object" || Array.isArray(calPayload)) return;
  const calendars = (calPayload.calendars ?? null) as Array<Record<string, unknown>> | null | undefined;
  if (!Array.isArray(calendars) || calendars.length === 0) return;
  const now = Date.now();
  for (const cal of calendars) {
    if (!cal || typeof cal !== "object" || Array.isArray(cal)) continue;
    const calId = String((cal as Record<string, unknown>).id ?? "");
    if (wantedCalendar !== "*" && wantedCalendar !== calId) continue;
    const calEvents = (cal as Record<string, unknown>).events as Array<Record<string, unknown>> | null | undefined;
    if (!Array.isArray(calEvents)) continue;
    for (const ev of calEvents) {
      if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
      const kind = String((ev as Record<string, unknown>).kind ?? "events");
      if (metric !== "all" && metric !== kind && !(metric === "event" && kind === "events") && !(metric === "task" && kind === "tasks")) continue;
      const t = calendarEventTime(ev as Record<string, unknown>);
      if (t == null) continue;
      const diff = t - now;
      // dispara quando faltar <= threshold e ainda não passou (diff >= 0)
      // e não dispara para eventos já passados
      if (diff < 0 || diff > thresholdMs) continue;
      const uid = String((ev as Record<string, unknown>).uid ?? (ev as Record<string, unknown>).summary ?? t);
      const stateKey = `${String(rule.id)}:calendar:${calId}:${uid}`;
      const wasArmed = armed[stateKey] ?? false;
      if (!wasArmed) {
        events.push({
          rule,
          provider: "calendar",
          calendar_id: calId,
          calendar_label: String((cal as Record<string, unknown>).label ?? ""),
          event: ev,
          event_time: new Date(t).toISOString(),
          value: diff,
        });
      }
      armed[stateKey] = true;
      // rearma quando sair da janela (evento passou ou foi reagendado para longe)
      // para não repetir, mantemos armed=true até o evento passar; limpeza é feita abaixo
    }
  }
  // limpa armed de eventos que já passaram ou saíram da janela (evita vazamento)
  for (const key of Object.keys(armed)) {
    if (!key.startsWith(`${String(rule.id)}:calendar:`)) continue;
    // se não está mais na janela, desarma para permitir novo disparo se reagendado
    // verificamos se ainda existe um evento correspondente na janela
    let stillInWindow = false;
    for (const cal of calendars) {
      if (!cal || typeof cal !== "object") continue;
      const calId = String((cal as Record<string, unknown>).id ?? "");
      if (wantedCalendar !== "*" && wantedCalendar !== calId) continue;
      const calEvents = (cal as Record<string, unknown>).events as Array<Record<string, unknown>> | null | undefined;
      if (!Array.isArray(calEvents)) continue;
      for (const ev of calEvents) {
        const kind = String((ev as Record<string, unknown>).kind ?? "events");
        if (metric !== "all" && metric !== kind && !(metric === "event" && kind === "events") && !(metric === "task" && kind === "tasks")) continue;
        const t = calendarEventTime(ev as Record<string, unknown>);
        if (t == null) continue;
        const diff = t - now;
        if (diff < 0 || diff > thresholdMs) continue;
        const uid = String((ev as Record<string, unknown>).uid ?? (ev as Record<string, unknown>).summary ?? t);
        if (key === `${String(rule.id)}:calendar:${calId}:${uid}`) { stillInWindow = true; break; }
      }
      if (stillInWindow) break;
    }
    if (!stillInWindow) delete armed[key];
  }
}

export function evaluate(
  payload: Record<string, unknown>,
  rules: Array<Record<string, unknown>>,
  armed: Record<string, boolean>,
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const rule of rules) {
    if (!rule.enabled && rule.enabled !== undefined ? !rule.enabled : false) {
      if (rule.enabled === false) continue;
    }
    if (rule.enabled === false) continue;
    if (rule.enabled === false) continue;
    const enabled = (rule as Record<string, unknown>).enabled;
    if (enabled === false) continue;
    const provider = String(rule.provider);
    if (provider === "calendar") {
      evaluateCalendarRule(rule, payload, armed, events);
      continue;
    }
    const kind = metricKind(provider, String(rule.metric));
    if (kind === null) continue;
    const accounts = (payload[provider] as unknown) as Array<Record<string, unknown>> | null | undefined;
    if (!accounts || !Array.isArray(accounts)) continue;
    for (const account of accounts) {
      if (account === null || typeof account !== "object" || Array.isArray(account)) continue;
      const acc = account as Record<string, unknown>;
      if (acc.ok === false) continue;
      const accountId = String(acc.id ?? "");
      const wanted = String((rule as Record<string, unknown>).account_id ?? "*");
      if (wanted !== "*" && wanted !== accountId) continue;
      const value = acc[String(rule.metric)];
      if (value === null || value === undefined) continue;
      const stateKey = `${rule.id}:${accountId}`;
      const firedNow = fired(kind, Number(value), Number(rule.threshold));
      const wasArmed = armed[stateKey] ?? false;
      if (firedNow && !wasArmed) {
        const resetField = metricResetField(provider, String(rule.metric));
        const resetsAt = resetField ? acc[resetField] : null;
        events.push({
          rule,
          provider,
          account_id: accountId,
          account_label: (acc.label as string) ?? "",
          value,
          resets_at: resetsAt,
        });
      }
      armed[stateKey] = firedNow;
    }
  }
  return events;
}

export function formatAlarmNotification(event: Record<string, unknown>): string {
  const rule = event.rule as Record<string, unknown>;
  const provider = String(event.provider);
  if (provider === "calendar") {
    const ev = (event.event ?? {}) as Record<string, unknown>;
    const summary = escapeHtml(String(ev.summary ?? "Evento"));
    const whenRaw = String((event.event_time as string) ?? (ev.dtstart as string) ?? (ev.due as string) ?? "");
    let whenLabel = "";
    if (whenRaw) {
      try {
        const d = new Date(whenRaw);
        if (!Number.isNaN(d.getTime())) {
          whenLabel = d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        }
      } catch { }
    }
    const threshold = Number(rule.threshold);
    const unit = String((rule as Record<string, unknown>).threshold_unit ?? "minutes");
    const lead = calendarThresholdLabel(threshold, unit);
    const calLabel = event.calendar_label ? ` · ${escapeHtml(String(event.calendar_label))}` : "";
    const lines = [`⏰ <b>Calendário${calLabel}</b>`, "", `📅 <b>${summary}</b>`, `⏳ Em <b>${escapeHtml(lead)}</b>`];
    if (whenLabel) lines.push(`🕐 <b>${escapeHtml(whenLabel)}</b>`);
    if (ev.location) lines.push(`📍 ${escapeHtml(String(ev.location))}`);
    return lines.join("\n");
  }
  const kind = metricKind(provider, String(rule.metric)) ?? "percent";
  const providerName = escapeHtml(PROVIDER_NAMES[provider] ?? provider);
  const metricName = escapeHtml(metricLabel(provider, String(rule.metric)) ?? String(rule.metric));
  const threshold = Number(rule.threshold);

  let detail: string;
  let lines: string[];
  if (kind === "percent") {
    detail = `${threshold.toFixed(0)}% da cota ${metricName}`;
    lines = [`⚠️ <b>${providerName}</b>`, "", `📊 Uso de <b>${detail}</b>`];
  } else {
    const amount = `$${(threshold / 100).toFixed(2)}`;
    detail = `${amount} da cota ${metricName}`;
    lines = [`⚠️ <b>${providerName}</b>`, "", `💰 Saldo de <b>${detail}</b>`];
  }

  const when = fmtResetWhen(event.resets_at);
  if (when) {
    lines.push(`🕐 Reset em <b>${escapeHtml(when)}</b>`);
  }
  return lines.join("\n");
}

export class AlarmEngine {
  private _armed: Record<string, boolean> = {};

  handlePayload(payload: Record<string, unknown>): void {
    const cfg = load() as Record<string, unknown>;
    const rules = (cfg.alarms ?? []) as Array<Record<string, unknown>>;
    if (!rules || rules.length === 0) return;
    const events = evaluate(payload, rules, this._armed);
    if (events.length === 0) return;
    void (async () => {
      const { broadcast } = await import("../telegram/bot.js");
      const port = Number(((cfg.listen as Record<string, unknown>) ?? {}).port ?? 8787);
      const displayUrl = displayLanUrl(port) || null;
      for (const event of events) {
        const text = formatAlarmNotification(event);
        try {
          await broadcast(text, displayUrl);
        } catch (exc) {
          console.log(`[alarms] falha ao enviar telegram: ${exc}`);
        }
      }
    })();
  }
}

// snake_case aliases
export const catalog_public = catalogPublic;
export const metric_kind = metricKind;
export const metric_label = metricLabel;
export const metric_reset_field = metricResetField;
export const format_alarm_notification = formatAlarmNotification;
