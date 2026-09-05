import type { FastifyInstance } from "fastify";
import { fetchRetroOne, mockRetroPayload } from "../providers/retroachievements.js";
import { load } from "../store.js";

export async function createRetroachievementsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/retroachievements", async () => {
    const cfg = load() as Record<string, unknown>;
    const rcfg = (cfg.retroachievements ?? {}) as Record<string, unknown>;
    // hidden check is handled in usage hub; here just return live data if possible
    if (cfg.mock) return mockRetroPayload();
    // if no accounts configured, return empty hint
    const p = (cfg.providers as Record<string, unknown> | undefined)?.retroachievements as Record<string, unknown> | undefined;
    const hasAccounts = p && Array.isArray(p.accounts) && (p.accounts as unknown[]).length > 0;
    const hasLegacy = p && String(p.paste_secret ?? "").trim();
    if (!hasAccounts && !hasLegacy) {
      return { ok: false, error: "Nenhuma conta RetroAchievements configurada", updated_at: null, username: null };
    }
    // fetch first account as preview
    const secret = hasAccounts
      ? String(((p.accounts as Array<Record<string, unknown>>)[0].secret ?? ""))
      : String(p?.paste_secret ?? "");
    const label = hasAccounts ? String(((p.accounts as Array<Record<string, unknown>>)[0].label ?? "")) : String(p?.local_label ?? "");
    const data = await fetchRetroOne(secret, label);
    return data;
  });

  app.post("/api/retroachievements/preview", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.secret !== "string" || !String(body.secret).trim()) {
      return reply.code(400).send({ ok: false, error: "secret é obrigatório (formato usuario:apikey)" });
    }
    const secret = String(body.secret).trim();
    const label = String(body.label ?? "").trim();
    const result = await fetchRetroOne(secret, label);
    return result;
  });
}
