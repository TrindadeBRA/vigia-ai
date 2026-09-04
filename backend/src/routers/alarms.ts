import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { catalogPublic, metricKind } from "../alarms.js";
import { load, updateSync as update } from "../store.js";

export async function createAlarmsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/alarms", async () => {
    const cfg = load() as Record<string, unknown>;
    const rules = (cfg.alarms ?? []) as Array<Record<string, unknown>>;
    // rules already in normalized form but ensure shape
    return { rules, metrics: catalogPublic() };
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
