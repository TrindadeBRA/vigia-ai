import type { AlarmMetric, AlarmsPublic } from "../../../api/types";
import { saveTextFile } from "../../../desktop";
import type { ALARMS_STR } from "../alarmsCopy";

export const PROVIDER_LABEL: Record<string, string> = {
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

export function calendarUnitLabel(c: typeof ALARMS_STR.pt, unit: string): string {
  if (unit === "days") return c.calendarUnitDays;
  if (unit === "hours") return c.calendarUnitHours;
  return c.calendarUnitMinutes;
}

export function ruleHint(c: typeof ALARMS_STR.pt, metric: AlarmMetric | undefined, threshold: number, unit?: string): string {
  if (!metric) return "";
  if (metric.kind === "calendar") return c.triggerHintCalendar(threshold, unit ?? "minutes");
  return metric.kind === "percent" ? c.triggerHintPercent(threshold) : c.triggerHintCents(threshold);
}

export function formatThreshold(metric: AlarmMetric | undefined, threshold: number, unit?: string): string {
  if (metric?.kind === "calendar") {
    const u = unit === "days" ? (threshold === 1 ? "1 dia" : `${threshold}d`) : unit === "hours" ? (threshold === 1 ? "1h" : `${threshold}h`) : threshold === 1 ? "1min" : `${threshold}min`;
    return `${u} antes`;
  }
  if (metric?.kind === "cents") return `$${(threshold / 100).toFixed(2)}`;
  return `${threshold}%`;
}

export function ruleSearchText(
  c: typeof ALARMS_STR.pt,
  rule: AlarmsPublic["rules"][number],
  metric: AlarmMetric | undefined,
): string {
  const providerName = PROVIDER_LABEL[rule.provider] || rule.provider;
  const metricName = metric?.label || rule.metric;
  const title = rule.label || suggestLabel(c, rule.provider, metric, rule.threshold, (rule as unknown as { threshold_unit?: string }).threshold_unit);
  return `${providerName} ${metricName} ${title} ${formatThreshold(metric, rule.threshold, (rule as unknown as { threshold_unit?: string }).threshold_unit)}`.toLowerCase();
}

export function suggestLabel(c: typeof ALARMS_STR.pt, provider: string, metric: AlarmMetric | undefined, threshold: number, unit?: string): string {
  if (!metric) return "";
  if (metric.kind === "calendar") return c.suggestCalendar(threshold, unit ?? "minutes", metric.label);
  const providerName = PROVIDER_LABEL[provider] || provider;
  return metric.kind === "percent"
    ? c.suggestUsage(providerName, threshold, metric.label)
    : c.suggestBalance(providerName, `$${(threshold / 100).toFixed(2)}`, metric.label);
}

// ── Exportar/importar regras de alarme como JSON ──────────────────────

export type ExportedAlarmRule = { provider: string; metric: string; threshold: number; threshold_unit?: string; calendar_id?: string; enabled: boolean; label: string };

export function downloadAlarmsJson(rules: AlarmsPublic["rules"]) {
  const alarms: ExportedAlarmRule[] = rules.map((r) => ({
    provider: r.provider,
    metric: r.metric,
    threshold: r.threshold,
    threshold_unit: (r as unknown as { threshold_unit?: string }).threshold_unit,
    calendar_id: (r as unknown as { calendar_id?: string }).calendar_id,
    enabled: r.enabled,
    label: r.label,
  }));
  const payload = { version: 1, exported_at: new Date().toISOString(), alarms };
  void saveTextFile(
    `vigia-alarmes-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}

export function parseAlarmsJson(text: string): ExportedAlarmRule[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const candidate = data && typeof data === "object" && "alarms" in (data as Record<string, unknown>) ? (data as Record<string, unknown>).alarms : data;
  if (!Array.isArray(candidate)) return null;
  const rules: ExportedAlarmRule[] = [];
  for (const item of candidate) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.provider !== "string" || typeof r.metric !== "string" || typeof r.threshold !== "number") continue;
    rules.push({
      provider: r.provider,
      metric: r.metric,
      threshold: r.threshold,
      threshold_unit: typeof r.threshold_unit === "string" ? r.threshold_unit : typeof (r as Record<string, unknown>).unit === "string" ? String((r as Record<string, unknown>).unit) : undefined,
      calendar_id: typeof r.calendar_id === "string" ? r.calendar_id : typeof (r as Record<string, unknown>).calendarId === "string" ? String((r as Record<string, unknown>).calendarId) : undefined,
      enabled: typeof r.enabled === "boolean" ? r.enabled : true,
      label: typeof r.label === "string" ? r.label : "",
    });
  }
  return rules;
}
