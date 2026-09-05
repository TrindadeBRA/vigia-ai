import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function inDocker(): boolean {
  const env = (process.env.COLLECTOR_IN_DOCKER || "").trim().toLowerCase();
  if (env === "1" || env === "true" || env === "yes") return true;
  try {
    return existsSync("/.dockerenv") && statSync("/.dockerenv").isFile();
  } catch {
    return false;
  }
}

function expandUser(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    const home = process.env.HOME || homedir() || "";
    if (p === "~") return home;
    return join(home, p.slice(2));
  }
  // also handle ~user not needed
  return p;
}

export function dataDir(): string {
  const override = process.env.COLLECTOR_DATA || process.env.VIGIA_DATA || "";
  if (override.trim()) {
    return resolve(expandUser(override.trim()));
  }
  // backend/src/config.ts -> backend/data
  const filePath = fileURLToPath(import.meta.url);
  // filePath is .../backend/src/config.ts -> parent parent = backend
  const backendRoot = resolve(join(filePath, "..", ".."));
  return join(backendRoot, "data");
}

export function configPath(): string {
  return join(dataDir(), "config.json");
}

export function frontendDist(): string | null {
  const override = (process.env.VIGIA_FRONTEND_DIST || "").trim();
  if (override) {
    const p = resolve(expandUser(override));
    try {
      if (existsSync(p) && statSync(p).isDirectory()) return p;
    } catch {}
    return null;
  }
  const filePath = fileURLToPath(import.meta.url);
  const repoRoot = resolve(join(filePath, "..", "..", ".."));
  const dist = join(repoRoot, "frontend", "dist");
  try {
    if (existsSync(dist) && statSync(dist).isDirectory()) return dist;
  } catch {}
  return null;
}
