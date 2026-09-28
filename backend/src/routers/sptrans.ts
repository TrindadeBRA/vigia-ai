import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { fetchPrevisaoParada, findNearby, geolocateByIp, loadStopCache, mockPrevisao, refreshStopCache, searchLines, searchStops, searchStopsCombined, stopCacheAgeDays } from "../providers/sptrans.js";
import {
  SpTransStopBodySchema,
  SpTransStopPatchSchema,
  SpTransTokenBodySchema,
  type SpTransStop,
} from "../schemas/sptrans.js";
import { load, updateSync as update } from "../store.js";

type Cfg = Record<string, unknown>;
type SpTransCfg = { token?: string; stops?: SpTransStop[]; enabled?: boolean; hidden?: boolean };

function sptransCfg(): SpTransCfg {
  const cfg = load() as Cfg;
  const s = (cfg.sptrans ?? {}) as SpTransCfg;
  return { token: "", stops: [], enabled: false, hidden: false, ...s };
}

function tokenSuffix(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  return t.length <= 4 ? "••••" : `••••${t.slice(-4)}`;
}

// Cache curto por parada: vários cards/abas pollando a mesma parada não
// multiplicam chamadas no Olho Vivo (30 s, igual ao poll do card).
const PREVISAO_TTL_MS = 30_000;
const previsaoCache = new Map<number, { at: number; payload: unknown }>();

function dropPrevisaoCache(cp: number): void {
  previsaoCache.delete(cp);
  previsaoCache.delete(-cp);
}

function stopById(stops: SpTransStop[], id: string): SpTransStop | undefined {
  return stops.find((s) => s.id === id);
}

export async function createSpTransRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sptrans/status", { schema: { tags: ["SPTrans"] } }, async () => {
    const s = sptransCfg();
    const token = String(s.token ?? "");
    return {
      ok: true,
      configured: Boolean(token.trim()),
      suffix: tokenSuffix(token),
      stops: (s.stops ?? []).length,
      enabled: Boolean(s.enabled),
      hidden: Boolean(s.hidden),
    };
  });

  app.put("/api/sptrans/token", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const parsed = SpTransTokenBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: "token é obrigatório" });
    const token = parsed.data.token.trim();
    // Valida na hora: autentica e faz uma busca boba pra provar o acesso.
    try {
      await searchStops("paulista", token);
    } catch (e) {
      return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    update((cfg: Cfg) => {
      const s = ((cfg.sptrans ?? {}) as SpTransCfg);
      if (!cfg.sptrans) cfg.sptrans = s;
      s.token = token;
      s.enabled = true;
      s.hidden = false;
    });
    return { ok: true, suffix: tokenSuffix(token) };
  });

  app.delete("/api/sptrans/token", { schema: { tags: ["SPTrans"] } }, async () => {
    update((cfg: Cfg) => {
      const s = ((cfg.sptrans ?? {}) as SpTransCfg);
      if (!cfg.sptrans) cfg.sptrans = s;
      s.token = "";
    });
    previsaoCache.clear();
    return { ok: true };
  });

  app.get("/api/sptrans/stops", { schema: { tags: ["SPTrans"] } }, async () => {
    const s = sptransCfg();
    return { ok: true, stops: s.stops ?? [] };
  });

  app.post("/api/sptrans/stops", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const parsed = SpTransStopBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: "cp (código da parada) é obrigatório" });
    const s = sptransCfg();
    const token = String(s.token ?? "");
    if (!token.trim()) return reply.code(400).send({ ok: false, error: "Configure o token do Olho Vivo primeiro" });
    const cp = parsed.data.cp;
    if ((s.stops ?? []).some((x) => x.cp === cp)) {
      return reply.code(400).send({ ok: false, error: "Essa parada já está monitorada" });
    }
    // Resolve nome/endereço + linhas que atendem o ponto via Previsao/Parada.
    let name = "";
    let lines: SpTransStop["lines"] = [];
    try {
      const prev = await fetchPrevisaoParada(cp, token);
      name = prev.np ?? "";
      // A Previsao/Parada só traz linhas com veículo na rua agora; completa
      // com a busca de linhas depois na UI se precisar. Aqui guarda o que veio.
      lines = prev.lines.map((l) => ({ cl: l.cl, c: l.c, lt: "", tl: 10, sl: l.sl, lt0: l.lt0, lt1: l.lt1 }));
    } catch (e) {
      return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    const stop: SpTransStop = {
      id: randomBytes(4).toString("hex"),
      cp,
      name,
      address: "",
      nickname: parsed.data.nickname.trim(),
      lines,
    };
    update((cfg: Cfg) => {
      const ss = ((cfg.sptrans ?? {}) as SpTransCfg);
      if (!cfg.sptrans) cfg.sptrans = ss;
      const list = Array.isArray(ss.stops) ? [...ss.stops] : [];
      list.push(stop);
      ss.stops = list;
      ss.enabled = true;
      ss.hidden = false;
    });
    dropPrevisaoCache(cp);
    return { ok: true, stop };
  });

  app.patch("/api/sptrans/stops/:id", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = SpTransStopPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ ok: false, error: "corpo inválido" });
    const s = sptransCfg();
    const cur = stopById(s.stops ?? [], id);
    if (!cur) return reply.code(404).send({ ok: false, error: "parada não encontrada" });
    update((cfg: Cfg) => {
      const ss = ((cfg.sptrans ?? {}) as SpTransCfg);
      const list = Array.isArray(ss.stops) ? [...ss.stops] : [];
      const i = list.findIndex((x) => x.id === id);
      if (i === -1) return;
      const next = { ...list[i] };
      if (parsed.data.nickname !== null && parsed.data.nickname !== undefined) next.nickname = parsed.data.nickname.trim();
      if (parsed.data.lines !== null && parsed.data.lines !== undefined) next.lines = parsed.data.lines;
      list[i] = next;
      ss.stops = list;
    });
    dropPrevisaoCache(cur.cp);
    const updated = load() as Cfg;
    const stops = (((updated.sptrans ?? {}) as SpTransCfg).stops ?? []) as SpTransStop[];
    return { ok: true, stop: stopById(stops, id) ?? null };
  });

  app.delete("/api/sptrans/stops/:id", { schema: { tags: ["SPTrans"] } }, async (request) => {
    const { id } = request.params as { id: string };
    const s = sptransCfg();
    const cur = stopById(s.stops ?? [], id);
    update((cfg: Cfg) => {
      const ss = ((cfg.sptrans ?? {}) as SpTransCfg);
      const list = Array.isArray(ss.stops) ? ss.stops : [];
      ss.stops = list.filter((x) => x.id !== id);
    });
    if (cur) dropPrevisaoCache(cur.cp);
    return { ok: true };
  });

  app.get("/api/sptrans/search/stops", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const q = String((request.query as Record<string, unknown>).q ?? "");
    const s = sptransCfg();
    const token = String(s.token ?? "");
    if (!token.trim()) return reply.code(400).send({ ok: false, error: "Configure o token do Olho Vivo primeiro", results: [] });
    try {
      const { hits, geo } = await searchStopsCombined(q, token);
      return { ok: true, results: hits, geo };
    } catch (e) {
      return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e), results: [] });
    }
  });

  // Pontos próximos de uma coordenada (botão "usar minha localização").
  app.get("/api/sptrans/nearby", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const lat = Number(query.lat);
    const lng = Number(query.lng ?? query.lon);
    const limit = Number(query.limit ?? 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply.code(400).send({ ok: false, error: "lat/lng inválidos", results: [] });
    }
    const cache = loadStopCache();
    if (!cache?.stops.length) {
      return reply.code(400).send({ ok: false, error: "Banco de paradas ainda não montado — toque em atualizar", results: [], cache: false });
    }
    return { ok: true, results: findNearby(lat, lng, limit, cache.stops), cache: true, cache_age_days: stopCacheAgeDays(cache) };
  });

  app.get("/api/sptrans/cache", { schema: { tags: ["SPTrans"] } }, async () => {
    const cache = loadStopCache();
    return {
      ok: true,
      ready: Boolean(cache?.stops.length),
      count: cache?.count ?? 0,
      updated_at: cache?.updated_at ?? null,
      age_days: stopCacheAgeDays(cache),
    };
  });

  app.get("/api/sptrans/geolocate", { schema: { tags: ["SPTrans"] } }, async (_request, reply) => {
    try {
      const geo = await geolocateByIp();
      return { ok: true, ...geo, approx: true };
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/sptrans/cache/refresh", { schema: { tags: ["SPTrans"] } }, async (_request, reply) => {
    const s = sptransCfg();
    const token = String(s.token ?? "");
    if (!token.trim()) return reply.code(400).send({ ok: false, error: "Configure o token do Olho Vivo primeiro" });
    try {
      const cache = await refreshStopCache(token);
      return { ok: true, count: cache.count, updated_at: cache.updated_at };
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/sptrans/search/lines", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const q = String((request.query as Record<string, unknown>).q ?? "");
    const s = sptransCfg();
    const token = String(s.token ?? "");
    if (!token.trim()) return reply.code(400).send({ ok: false, error: "Configure o token do Olho Vivo primeiro", results: [] });
    try {
      const results = await searchLines(q, token);
      return { ok: true, results };
    } catch (e) {
      return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e), results: [] });
    }
  });

  // Previsão de uma parada, filtrada pras linhas monitoradas (se a parada
  // tiver linhas escolhidas). É o que o card polla a cada 30 s.
  app.get("/api/sptrans/previsao/:cp", { schema: { tags: ["SPTrans"] } }, async (request, reply) => {
    const cp = Number((request.params as { cp: string }).cp);
    if (!Number.isFinite(cp)) return reply.code(400).send({ ok: false, error: "código da parada inválido", cp: null, lines: [] });
    const cfg = load() as Cfg;
    const s = sptransCfg();
    const token = String(s.token ?? "");
    const stop = (s.stops ?? []).find((x) => x.cp === cp) ?? null;
    const wantAll = ["1", "true", "all"].includes(String((request.query as Record<string, unknown>).all ?? "").toLowerCase());
    const monitored = !wantAll && stop && stop.lines.length ? stop.lines.map((l) => l.cl) : null;
    if (cfg.mock) return mockPrevisao(cp, monitored);
    if (!token.trim()) return reply.code(400).send({ ok: false, error: "Configure o token do Olho Vivo primeiro", cp, lines: [] });
    const hit = previsaoCache.get(wantAll ? -cp : cp);
    if (hit && Date.now() - hit.at < PREVISAO_TTL_MS) return hit.payload;
    try {
      const payload = await fetchPrevisaoParada(cp, token, monitored);
      previsaoCache.set(wantAll ? -cp : cp, { at: Date.now(), payload });
      return payload;
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e), cp, lines: [] });
    }
  });
}
