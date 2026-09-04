/**
 * Escolha de porta. A ESP32 tem a URL do coletor gravada no secrets.h, então a
 * porta não pode ser sorteada em silêncio — ver .agents/PLANO_ELECTRON.md §5.1.
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

import { dataDir } from "./paths";

export const DEFAULT_PORT = 8787;

export type HealthInfo = {
  version: string;
  listen?: { host?: string; port?: number };
  panel_lan?: string;
  interval_s?: number;
};

/** Porta salva pelo painel em config.json (`listen.port`). */
export function configuredPort(): number {
  const file = join(dataDir(), "config.json");
  if (!existsSync(file)) return DEFAULT_PORT;
  try {
    const cfg = JSON.parse(readFileSync(file, "utf8")) as { listen?: { port?: unknown } };
    const port = Number(cfg?.listen?.port);
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

export function configuredHost(): string {
  const file = join(dataDir(), "config.json");
  if (!existsSync(file)) return "0.0.0.0";
  try {
    const cfg = JSON.parse(readFileSync(file, "utf8")) as { listen?: { host?: unknown } };
    const host = String(cfg?.listen?.host ?? "").trim();
    return host || "0.0.0.0";
  } catch {
    return "0.0.0.0";
  }
}

export function isPortFree(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise((done) => {
    const srv = createServer();
    srv.once("error", () => done(false));
    srv.once("listening", () => srv.close(() => done(true)));
    srv.listen(port, host);
  });
}

/** Já tem um Vigia nessa porta? Então o app se conecta a ele em vez de subir outro. */
export async function probeVigia(port: number, timeoutMs = 1500): Promise<HealthInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as HealthInfo & { usage?: string };
    return typeof body?.version === "string" && typeof body?.usage === "string" ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Primeira porta livre a partir da preferida, para sugerir na tela de conflito. */
export async function suggestFreePort(from: number): Promise<number | null> {
  for (let port = from + 1; port <= from + 20 && port < 65536; port += 1) {
    if (await isPortFree(port)) return port;
  }
  return null;
}
