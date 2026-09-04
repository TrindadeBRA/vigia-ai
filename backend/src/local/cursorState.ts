/**
 * Leitura do state.vscdb do Cursor (SQLite local).
 * Port of backend-python-legacy/app/local/cursor_state.py
 */
import { existsSync, copyFileSync, unlinkSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const CURSOR_STATE_CACHE_TTL_S = 30.0;

let _cursorStateCache: { at: number; db: string; result: Array<[string, string, string | null]> } | null = null;

function expandUser(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

export function stateDbCandidates(): string[] {
  const home = homedir();
  const rel = join("Cursor", "User", "globalStorage", "state.vscdb");
  const macos = join(home, "Library", "Application Support", rel);
  const linux = join(home, ".config", rel);
  const appdata = (process.env.APPDATA ?? "").trim();
  const windows = appdata ? join(appdata, rel) : join(home, "AppData", "Roaming", rel);
  if (platform() === "darwin") return [macos, linux, windows];
  if (platform().startsWith("win")) return [windows, linux, macos];
  return [linux, macos, windows];
}

export function stateDbPath(cfg?: Record<string, unknown> | null): string {
  const override = (process.env.CURSOR_STATE_DB ?? "").trim();
  if (override) return expandUser(override);
  let stored = "";
  if (cfg) {
    const paths = cfg.paths as Record<string, unknown> | undefined;
    stored = String(paths?.cursor_state_db ?? "").trim();
  }
  if (stored) return expandUser(stored);
  for (const p of stateDbCandidates()) {
    if (existsSync(p)) return p;
  }
  return stateDbCandidates()[0];
}

function cleanValuePy(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (Buffer.isBuffer(val)) val = val.toString("utf-8");
  let s = String(val).trim();
  // strip('"') removes both leading and trailing " characters
  s = s.replace(/^"+|"+$/g, "");
  s = s.trim();
  return s || null;
}

export function readItems(dbPath: string, keys: string[]): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const k of keys) values[k] = null;
  if (!existsSync(dbPath)) return values;

  const tmp = join(tmpdir(), `vigia-${randomUUID()}.vscdb`);
  try {
    copyFileSync(dbPath, tmp);
  } catch {
    return values;
  }

  let rows: Array<[string, unknown]> = [];
  let usedSqlite = false;

  // Try node:sqlite (Node 22.5+)
  try {
    // Dynamic import via createRequire-style: use Function to avoid static analysis
    const sqliteMod: unknown = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("node:sqlite");
      } catch {
        return null;
      }
    })();
    if (sqliteMod && typeof (sqliteMod as Record<string, unknown>).DatabaseSync === "function") {
      const DatabaseSync = (sqliteMod as Record<string, unknown>).DatabaseSync as new (path: string) => {
        prepare: (sql: string) => { all: (...args: unknown[]) => Array<Record<string, unknown>> };
        close: () => void;
      };
      const db = new DatabaseSync(tmp);
      try {
        const placeholders = keys.map(() => "?").join(",");
        const stmt = db.prepare(`SELECT key, value FROM ItemTable WHERE key IN (${placeholders})`);
        const result = stmt.all(...keys) as Array<Record<string, unknown>>;
        rows = result.map((r) => [String(r.key), r.value] as [string, unknown]);
        usedSqlite = true;
      } finally {
        try { db.close(); } catch {}
      }
    }
  } catch {
    // fall through
  }

  if (!usedSqlite) {
    // Fallback: attempt better-sqlite3 if installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BetterSqlite = require("better-sqlite3");
      const db = new BetterSqlite(tmp, { readonly: true });
      try {
        const placeholders = keys.map(() => "?").join(",");
        const stmt = db.prepare(`SELECT key, value FROM ItemTable WHERE key IN (${placeholders})`);
        const result = stmt.all(...keys) as Array<Record<string, unknown>>;
        rows = result.map((r) => [String(r.key), r.value] as [string, unknown]);
        usedSqlite = true;
      } finally {
        try { db.close(); } catch {}
      }
    } catch {
      // No sqlite available -> return nulls (cannot read)
      try { unlinkSync(tmp); } catch {}
      return values;
    }
  }

  try { unlinkSync(tmp); } catch {}

  for (const [key, value] of rows) {
    values[key] = cleanValuePy(value);
  }
  return values;
}

export function readItem(dbPath: string, key: string): string | null {
  return readItems(dbPath, [key])[key] ?? null;
}

export function cursorTokenCandidates(
  cfg?: Record<string, unknown> | null,
): Array<[string, string, string | null]> {
  const db = stateDbPath(cfg);
  if (_cursorStateCache !== null) {
    const { at, db: cachedDb, result } = _cursorStateCache;
    if (cachedDb === db && Date.now() / 1000 - at < CURSOR_STATE_CACHE_TTL_S) {
      return result;
    }
  }

  const found: Array<[string, string, string | null]> = [];
  const seen = new Set<string>();
  const values = readItems(db, ["cursorAuth/stripeMembershipType", "cursorAuth/accessToken"]);
  const plan = values["cursorAuth/stripeMembershipType"] ?? null;

  function add(source: string, token: string | null): void {
    if (!token || seen.has(token)) return;
    seen.add(token);
    found.push([source, token, plan]);
  }

  add("vscdb", values["cursorAuth/accessToken"] ?? null);
  _cursorStateCache = { at: Date.now() / 1000, db, result: found };
  return found;
}

export function cursorMissingHint(cfg?: Record<string, unknown> | null): string {
  const db = stateDbPath(cfg);
  if (existsSync(db)) return "cursorAuth/accessToken ausente — saia e entre de novo na conta no Cursor";
  return `Cursor não encontrado neste computador (sem ${db})`;
}

export function jwtExpUnix(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  try {
    // Buffer supports base64url
    const raw = Buffer.from(payload, "base64url").toString("utf-8");
    const data = JSON.parse(raw) as unknown;
    if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
    const exp = (data as Record<string, unknown>).exp;
    if (exp === null || exp === undefined) return null;
    const n = Number(exp);
    if (Number.isNaN(n) || !Number.isFinite(n)) return null;
    return Math.trunc(n);
  } catch {
    return null;
  }
}

export function jwtExpired(token: string): boolean {
  const exp = jwtExpUnix(token);
  if (exp === null) return false;
  return exp < Date.now() / 1000;
}

export function _resetCursorStateCache(): void {
  _cursorStateCache = null;
}
