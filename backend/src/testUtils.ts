import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { createApp } from "./main.js";
import { cache } from "./refreshCache.js";
import { reset as resetCoingecko } from "./providers/coingecko.js";
import { resetForexCache } from "./providers/currencies.js";
import { defaultConfig, saveSync } from "./store.js";

/**
 * Equivalente ao fixture `client` de backend-python-legacy/tests/conftest.py:
 * app isolada por diretório temporário, config mock e caches zerados.
 */
export async function createTestApp(
  configure?: (cfg: Record<string, unknown>) => void,
): Promise<FastifyInstance> {
  const dir = mkdtempSync(join(tmpdir(), "vigia-test-"));
  process.env.COLLECTOR_DATA = dir;
  process.env.HOST = "127.0.0.1";
  process.env.PORT = "8787";
  process.env.USAGE_INTERVAL_S = "60";

  cache.reset();
  resetCoingecko();
  resetForexCache();

  const cfg = defaultConfig();
  cfg.mock = true;
  configure?.(cfg);
  saveSync(cfg);

  const app = await createApp();
  await app.ready();
  return app;
}
