import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import {
  cleanCryptoCode,
  cleanFiatCode,
  fetchCurrencyQuotes,
  mockCurrenciesPayload,
  searchCrypto,
} from "../providers/currencies.js";
import { load, updateSync as update } from "../store.js";

export async function createCurrenciesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/currencies/config", async () => {
    const cfg = load() as Record<string, unknown>;
    return (cfg.currencies ?? {}) as Record<string, unknown>;
  });

  app.patch("/api/currencies/config", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
    let baseClean: string | null = null;
    if (body.base !== undefined && body.base !== null) {
      baseClean = cleanFiatCode(String(body.base));
      if (!baseClean) return reply.code(400).send({ ok: false, error: "Moeda base inválida; use um código de 3 letras (ex.: BRL)" });
    }
    update((cfg: Record<string, unknown>) => {
      const cur = (cfg.currencies ?? {}) as Record<string, unknown>;
      if (!cfg.currencies) cfg.currencies = cur;
      if (body.enabled !== undefined && body.enabled !== null) { cur.enabled = Boolean(body.enabled); cur.hidden = !Boolean(body.enabled); }
      else if (body.hidden !== undefined && body.hidden !== null) { cur.hidden = Boolean(body.hidden); cur.enabled = !Boolean(body.hidden); }
      if (baseClean !== null) cur.base = baseClean;
    });
    const cfg = load() as Record<string, unknown>;
    return (cfg.currencies ?? {}) as Record<string, unknown>;
  });

  app.post("/api/currencies/items", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.kind !== "string" || typeof body.code !== "string") return reply.code(400).send({ ok: false, error: "kind e code obrigatórios" });
    const kind = String(body.kind);
    let code: string | null;
    if (kind === "fiat") {
      code = cleanFiatCode(String(body.code));
      if (!code) return reply.code(400).send({ ok: false, error: "Código de moeda inválido; use 3 letras (ex.: USD)" });
    } else if (kind === "crypto") {
      code = cleanCryptoCode(String(body.code));
      if (!code) return reply.code(400).send({ ok: false, error: "Identificador de criptomoeda inválido; escolha um resultado da busca" });
    } else {
      return reply.code(400).send({ ok: false, error: "kind deve ser fiat ou crypto" });
    }
    const itemId = randomBytes(4).toString("hex");
    update((cfg: Record<string, unknown>) => {
      const cur = (cfg.currencies ?? {}) as Record<string, unknown>;
      if (!cfg.currencies) cfg.currencies = cur;
      const items = Array.isArray(cur.items) ? [...(cur.items as unknown[])] : [];
      items.push({ id: itemId, kind, code, label: String(body.label ?? "").trim() });
      cur.items = items;
      cur.enabled = true;
      cur.hidden = false;
    });
    const cfg = load() as Record<string, unknown>;
    return (cfg.currencies ?? {}) as Record<string, unknown>;
  });

  app.delete("/api/currencies/items/:item_id", async (request) => {
    const { item_id } = request.params as { item_id: string };
    update((cfg: Record<string, unknown>) => {
      const cur = (cfg.currencies ?? {}) as Record<string, unknown>;
      if (!cfg.currencies) cfg.currencies = cur;
      const items = Array.isArray(cur.items) ? (cur.items as Array<Record<string, unknown>>) : [];
      cur.items = items.filter((i) => String(i.id) !== item_id);
    });
    return { ok: true };
  });

  app.get("/api/currencies/search", async (request) => {
    const query = (request.query ?? {}) as Record<string, string>;
    const q = String(query.q ?? "");
    const count = Number(query.count ?? 8);
    const results = await searchCrypto(q, count);
    return { results };
  });

  app.get("/api/currencies", async () => {
    const cfg = load() as Record<string, unknown>;
    const ccfg = (cfg.currencies ?? {}) as Record<string, unknown>;
    if (cfg.mock && ccfg.enabled) return mockCurrenciesPayload();
    const data = await fetchCurrencyQuotes(ccfg);
    return data;
  });
}
