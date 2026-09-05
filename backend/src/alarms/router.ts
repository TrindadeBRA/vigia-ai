import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { load, updateSync as update } from "../store.js";
import { calendarThresholdLabel, catalogPublic, metricKind } from "./engine.js";

function normalizeCalendarUnit(raw: unknown): string | null {
  const s = String(raw ?? "minutes").trim().toLowerCase();
  if (["minutes", "minutos", "minute", "min", "m"].includes(s)) return "minutes";
  if (["hours", "horas", "hour", "h", "hr"].includes(s)) return "hours";
  if (["days", "dias", "day", "d"].includes(s)) return "days";
  return null;
}

export async function createAlarmsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/alarms", async () => {
    const cfg = load() as Record<string, unknown>;
    const rules = (cfg.alarms ?? []) as Array<Record<string, unknown>>;
    const calendars = ((cfg.calendar ?? {}) as Record<string, unknown>).calendars as Array<Record<string, unknown>> | undefined;
    return { rules, metrics: catalogPublic(), calendars: Array.isArray(calendars) ? calendars.map((c) => ({ id: String(c.id), label: String(c.label ?? ""), url: String(c.url ?? ""), kind: String(c.kind ?? "events") })) : [] };
  });

  app.post("/api/alarms", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.provider !== "string" || typeof body.metric !== "string" || body.threshold === undefined) {
      return reply.code(400).send({ ok: false, error: "provider, metric, threshold obrigatórios" });
    }
    const provider = String(body.provider);
    const metric = String(body.metric);
    const threshold = Number(body.threshold);
    if (Number.isNaN(threshold)) return reply.code(400).send({ ok: false, error: "threshold inválido" });
    if (metricKind(provider, metric) === null) {
      return reply.code(400).send({ ok: false, error: `métrica '${metric}' inválida para o provedor '${provider}'` });
    }
    if (provider === "calendar") {
      if (!Number.isFinite(threshold) || threshold <= 0) return reply.code(400).send({ ok: false, error: "limiar deve ser > 0" });
      const unit = normalizeCalendarUnit((body as Record<string, unknown>).threshold_unit ?? (body as Record<string, unknown>).unit ?? "minutes");
      if (!unit) return reply.code(400).send({ ok: false, error: "unidade inválida (use minutes, hours ou days)" });
      const calendar_id = String((body as Record<string, unknown>).calendar_id ?? (body as Record<string, unknown>).calendarId ?? "*").trim() || "*";
      const id = randomBytes(4).toString("hex");
      const rule: Record<string, unknown> = {
        id,
        provider: "calendar",
        metric: metric === "events" ? "event" : metric === "tasks" ? "task" : metric,
        threshold,
        threshold_unit: unit,
        calendar_id,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
        label: String(body.label ?? "").trim() || `Calendário · ${calendarThresholdLabel(threshold, unit)}`,
        account_id: "*",
      };
      update((cfg: Record<string, unknown>) => {
        const alarms = (cfg.alarms ?? []) as Array<Record<string, unknown>>;
        alarms.push(rule);
        cfg.alarms = alarms;
      });
      return rule;
    }
    const id = randomBytes(4).toString("hex");
    const rule: Record<string, unknown> = {
      id,
      provider,
      metric,
      threshold,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      label: String(body.label ?? ""),
      account_id: String((body as Record<string, unknown>).account_id ?? "*"),
    };
    // normalize account_id if missing
    if (!rule.account_id) rule.account_id = "*";
    update((cfg: Record<string, unknown>) => {
      const alarms = (cfg.alarms ?? []) as Array<Record<string, unknown>>;
      alarms.push(rule);
      cfg.alarms = alarms;
    });
    return rule;
  });

  app.patch("/api/alarms/:rule_id", async (request, reply) => {
    const { rule_id } = request.params as { rule_id: string };
    const body = request.body as Record<string, unknown> | null;
    const cfg = load() as Record<string, unknown>;
    const exists = ((cfg.alarms ?? []) as Array<Record<string, unknown>>).some((r) => String(r.id) === rule_id);
    if (!exists) return reply.code(404).send({ ok: false, error: "regra não encontrada" });
    update((c: Record<string, unknown>) => {
      const alarms = (c.alarms ?? []) as Array<Record<string, unknown>>;
      for (const rule of alarms) {
        if (String(rule.id) !== rule_id) continue;
        if (body && body.threshold !== undefined && body.threshold !== null) rule.threshold = Number(body.threshold);
        if (body && body.threshold_unit !== undefined && body.threshold_unit !== null) {
          const u = normalizeCalendarUnit(body.threshold_unit);
          if (u) (rule as Record<string, unknown>).threshold_unit = u;
        }
        if (body && (body as Record<string, unknown>).unit !== undefined && (body as Record<string, unknown>).unit !== null) {
          const u = normalizeCalendarUnit((body as Record<string, unknown>).unit);
          if (u) (rule as Record<string, unknown>).threshold_unit = u;
        }
        if (body && (body as Record<string, unknown>).calendar_id !== undefined) (rule as Record<string, unknown>).calendar_id = String((body as Record<string, unknown>).calendar_id ?? "*").trim() || "*";
        if (body && (body as Record<string, unknown>).calendarId !== undefined) (rule as Record<string, unknown>).calendar_id = String((body as Record<string, unknown>).calendarId ?? "*").trim() || "*";
        if (body && body.enabled !== undefined && body.enabled !== null) rule.enabled = Boolean(body.enabled);
        if (body && body.label !== undefined && body.label !== null) rule.label = String(body.label);
      }
      c.alarms = alarms;
    });
    return { ok: true };
  });

  app.delete("/api/alarms/:rule_id", async (request) => {
    const { rule_id } = request.params as { rule_id: string };
    update((c: Record<string, unknown>) => {
      const alarms = (c.alarms ?? []) as Array<Record<string, unknown>>;
      c.alarms = alarms.filter((r) => String(r.id) !== rule_id);
    });
    return { ok: true };
  });
}
