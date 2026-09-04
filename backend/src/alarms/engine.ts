import { fmtResetWhen } from "../formatting.js";
import { load } from "../store.js";
import { displayLanUrl } from "../netutil.js";

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
};

export function catalogPublic(): Record<string, Array<{ key: string; label: string; kind: string }>> {
  const out: Record<string, Array<{ key: string; label: string; kind: string }>> = {};
  for (const [provider, fields] of Object.entries(METRICS)) {
    out[provider] = fields.map(([key, label, kind]) => ({ key, label, kind }));
  }
  return out;
}

export function metricKind(provider: string, metric: string): string | null {
  for (const [key, , kind] of METRICS[provider] ?? []) {
    if (key === metric) return kind;
  }
  return null;
}

export function metricLabel(provider: string, metric: string): string | null {
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

export function evaluate(
  payload: Record<string, unknown>,
  rules: Array<Record<string, unknown>>,
  armed: Record<string, boolean>,
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const rule of rules) {
    if (!rule.enabled && rule.enabled !== undefined ? !rule.enabled : false) {
      // rule.get("enabled", true) -> if enabled is false, skip
      if (rule.enabled === false) continue;
    }
    if (rule.enabled === false) continue;
    // python: if not rule.get("enabled", True): continue
    if (rule.enabled === false) continue;
    // need to handle rule.enabled missing defaults to true
    const enabled = (rule as Record<string, unknown>).enabled;
    if (enabled === false) continue;
    const provider = String(rule.provider);
    const kind = metricKind(provider, String(rule.metric));
    if (kind === null) continue;
    const accounts = (payload[provider] as unknown) as Array<Record<string, unknown>> | null | undefined;
    if (!accounts || !Array.isArray(accounts)) continue;
    for (const account of accounts) {
      if (account === null || typeof account !== "object" || Array.isArray(account)) continue;
      const acc = account as Record<string, unknown>;
      if (!acc.ok && acc.ok !== undefined ? !acc.ok : acc.ok === false) {
        // python: if not isinstance(account, dict) or not account.get("ok", True): continue
        // get("ok", True) defaults True, so undefined ok counts as True
        // we check only if ok explicitly false
      }
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
