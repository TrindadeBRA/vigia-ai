import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../config.js";
import {
  MiningConfigPatchSchema,
  MiningConfigSchema,
  MiningReportSchema,
  type MiningConfig,
  type MiningReport,
} from "../schemas/mining.js";

// Report fica velho depois disso sem chegar um novo (device saiu da
// VIEW_MINER, perdeu Wi-Fi, ou está desligado) — ver .agents/PLANO_MINERACAO.md.
const STALE_AFTER_MS = 90_000;

function miningPath(): string {
  return join(dataDir(), "mining.json");
}

type MiningStore = {
  config: MiningConfig;
  report: MiningReport | null;
  reportedAt: string | null;
};

function defaultConfig(): MiningConfig {
  return MiningConfigSchema.parse({});
}

function load(): MiningStore {
  const p = miningPath();
  if (!existsSync(p)) {
    return { config: defaultConfig(), report: null, reportedAt: null };
  }
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
    const config = MiningConfigSchema.parse(raw.config ?? {});
    const report = raw.report ? MiningReportSchema.parse(raw.report) : null;
    const reportedAt = typeof raw.reportedAt === "string" ? raw.reportedAt : null;
    return { config, report, reportedAt };
  } catch {
    return { config: defaultConfig(), report: null, reportedAt: null };
  }
}

function save(store: MiningStore): void {
  mkdirSync(dataDir(), { recursive: true });
  const p = miningPath();
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n", "utf-8");
  renameSync(tmp, p);
}

export async function createMiningRoutes(app: FastifyInstance): Promise<void> {
  // GET pela placa (busca pool/wallet/worker/enabled) e pelo painel de config.
  app.get("/api/mining/config", async () => {
    return load().config;
  });

  // PUT pelo painel de config (/display/config) — merge parcial.
  app.put("/api/mining/config", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const parsed = MiningConfigPatchSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const store = load();
    const nextConfig = MiningConfigSchema.parse({ ...store.config, ...parsed.data });
    save({ ...store, config: nextConfig });
    return { ok: true, config: nextConfig };
  });

  // POST pela placa, só enquanto estiver de fato na VIEW_MINER minerando.
  app.post("/api/mining/report", async (request, reply) => {
    const parsed = MiningReportSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const store = load();
    save({ ...store, report: parsed.data, reportedAt: new Date().toISOString() });
    return { ok: true };
  });

  // GET pelo painel (/display) — snapshot em memória/disco, com `stale`
  // calculado agora (não fica gravado, é sempre relativo ao momento da leitura).
  app.get("/api/mining/status", async () => {
    const { report, reportedAt } = load();
    const ageMs = reportedAt ? Date.now() - Date.parse(reportedAt) : Infinity;
    const stale = !reportedAt || !Number.isFinite(ageMs) || ageMs > STALE_AFTER_MS;
    const base = report ?? MiningReportSchema.parse({ status: "idle" });
    return { ...base, reportedAt, stale };
  });
}
