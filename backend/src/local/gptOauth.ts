/**
 * OAuth da assinatura ChatGPT / Codex CLI. Token em ~/.codex/auth.json
 * Port of backend-python-legacy/app/local/gpt_oauth.py
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { jwtExpUnix, jwtExpired } from "./cursorState.js";

function expandUser(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

export function authPath(cfg?: Record<string, unknown> | null): string {
  const envFile = (process.env.CODEX_AUTH_PATH ?? "").trim();
  if (envFile) return expandUser(envFile);
  const envHome = (process.env.CODEX_HOME ?? "").trim();
  if (envHome) return join(expandUser(envHome), "auth.json");
  let stored = "";
  if (cfg) {
    const paths = cfg.paths as Record<string, unknown> | undefined;
    stored = String(paths?.codex_auth ?? "").trim();
  }
  if (stored) return expandUser(stored);
  return join(homedir(), ".codex", "auth.json");
}

export function parseAuthBlob(data: unknown): [string | null, string | null] {
  if (typeof data === "string") {
    const text = data.trim();
    if (!text) return [null, null];
    try {
      data = JSON.parse(text);
    } catch {
      return [text, null];
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return [null, null];
  const dict = data as Record<string, unknown>;
  const tokensRaw = dict.tokens;
  const tokens = tokensRaw !== null && typeof tokensRaw === "object" && !Array.isArray(tokensRaw)
    ? (tokensRaw as Record<string, unknown>)
    : (dict as Record<string, unknown>);
  const token = String(tokens.access_token ?? dict.access_token ?? "").trim();
  const accountIdRaw = tokens.account_id ?? dict.account_id;
  const accountId = String(accountIdRaw ?? "").trim() || null;
  if (!token) return [null, null];
  return [token, accountId];
}

export function fromAuthFile(path: string): [string | null, string | null, string | null] {
  if (!existsSync(path)) return [null, null, null];
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return [null, null, `auth.json: ${e}`];
  }
  const [token, accountId] = parseAuthBlob(data);
  if (!token) return [null, null, "auth.json sem access_token — rode `codex login`"];
  return [token, accountId, null];
}

export function gptTokenCandidates(
  cfg?: Record<string, unknown> | null,
): Array<[string, string, string | null, number | null]> {
  const found: Array<[string, string, string | null, number | null]> = [];
  const seen = new Set<string>();

  function add(source: string, token: string | null, accountId: string | null): void {
    if (!token || seen.has(token)) return;
    seen.add(token);
    found.push([source, token, accountId, jwtExpUnix(token)]);
  }

  const [token, accountId] = fromAuthFile(authPath(cfg));
  add("auth", token, accountId);
  return found;
}

export function gptMissingHint(cfg?: Record<string, unknown> | null): string {
  const p = authPath(cfg);
  if (existsSync(p)) return "auth.json sem access_token — rode `codex login` neste computador";
  return `Nenhum login Codex encontrado — rode \`codex login\` neste computador (sem ${p})`;
}

export function gptTokenExpired(token: string): boolean {
  return jwtExpired(token);
}
