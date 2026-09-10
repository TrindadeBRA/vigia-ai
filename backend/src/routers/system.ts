import type { FastifyInstance } from "fastify";
import os from "node:os";
import type { UsageHub } from "../hub.js";
import { getStorageInfo, getSystemDetails } from "../systemInfo.js";
import { VERSION } from "../version.js";

const STARTED_AT = new Date();

/** Saúde do próprio coletor (uptime/memória/CPU/último ciclo) — sem API externa, card "Sistema" no /display. */
export async function createSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/system", { schema: { tags: ["Sistema"] } }, async () => {
    const hub = (app as unknown as { hub?: UsageHub }).hub;
    const mem = process.memoryUsage();
    const load = os.loadavg();
    const storage = getStorageInfo();
    const details = getSystemDetails();
    return {
      ok: true,
      version: VERSION,
      node_version: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      started_at: STARTED_AT.toISOString(),
      uptime_s: Math.round(process.uptime()),
      memory: {
        rss_mb: mem.rss / 1024 / 1024,
        heap_used_mb: mem.heapUsed / 1024 / 1024,
        heap_total_mb: mem.heapTotal / 1024 / 1024,
      },
      cpu: {
        cores: os.cpus().length,
        load1: load[0],
        load5: load[1],
        load15: load[2],
      },
      system: details,
      storage,
      last_cycle: hub
        ? {
          at: hub.lastCycleAt,
          duration_ms: hub.lastCycleMs,
          ok: hub.lastCycleOk,
          error: hub.lastCycleError,
          interval_s: hub.seconds,
        }
        : null,
    };
  });
}
