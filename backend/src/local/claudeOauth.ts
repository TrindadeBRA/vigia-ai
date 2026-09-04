/**
 * OAuth da assinatura Claude Code. No macOS o token vive no Keychain.
 * Port of backend-python-legacy/app/local/claude_oauth.py
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const KEYCHAIN_SERVICES: readonly string[] = ["Claude Code-credentials"] as const;
const KEYCHAIN_CACHE_TTL_S = 30.0;

let _lastKeychainErr: string | null = null;
let _keychainCache: { at: number; result: [string | null, number | null, string | null] } | null = null;

export function parseOauthBlob(data: unknown): [string | null, number | null] {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      const token = (data as string).trim();
      return token ? [token, null] : [null, null];
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [null, null];
  }
  const dict = data as Record<string, unknown>;
  const oauthRaw = (dict.claudeAiOauth ?? dict.oauth ?? dict) as unknown;
  if (oauthRaw === null || typeof oauthRaw !== "object" || Array.isArray(oauthRaw)) {
    return [null, null];
  }
  const oauth = oauthRaw as Record<string, unknown>;
  const token = String(oauth.accessToken ?? dict.accessToken ?? "").trim();
  const expRaw = oauth.expiresAt ?? dict.expiresAt;
  // Python: int(exp) if isinstance(exp, (int, float)) else None
  const expI: number | null = typeof expRaw === "number" && Number.isFinite(expRaw) ? Math.trunc(expRaw) : null;

  if (!token) return [null, null];
  return [token, expI];
}

export function fromCredentialsFile(path: string): [string | null, number | null, string | null] {
  if (!existsSync(path)) return [null, null, null];
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return [null, null, `credentials.json: ${e}`];
  }
  const [token, exp] = parseOauthBlob(data);
  if (!token) return [null, null, "credentials.json sem accessToken"];
  return [token, exp, null];
}

function keychainServices(): string[] {
  const names = [...KEYCHAIN_SERVICES];
  const extra = (process.env.CLAUDE_KEYCHAIN_SERVICE ?? "").trim();
  if (extra && !names.includes(extra)) names.unshift(extra);
  return names;
}

function keychainError(svc: string, proc: ReturnType<typeof spawnSync>): string {
  const raw = String(proc.stderr ?? proc.stdout ?? "").trim();
  const low = raw.toLowerCase();
  if (low.includes("could not be found") || proc.status === 44) {
    return (
      `Keychain sem o item «${svc}». Abra o Claude Code (\`claude\`) neste Mac, ` +
      "faça login, e se o sistema pedir, permita o acesso do coletor."
    );
  }
  if (low.includes("user interaction is not allowed")) {
    return (
      "Keychain recusou (sem janela para confirmar). Rode o coletor no Terminal " +
      "deste Mac — não no Docker — e permita o acesso quando o macOS pedir."
    );
  }
  if (low.includes("errsecauthfailed") || low.includes("authorization")) {
    return "Keychain recusou a senha. Rode `claude` e tente o coletor de novo no Terminal.";
  }
  return (raw || "keychain recusou").slice(0, 240);
}

export function lastKeychainError(): string | null {
  return _lastKeychainErr;
}

export function fromMacosKeychain(): [string | null, number | null, string | null] {
  if (_keychainCache !== null) {
    const { at, result } = _keychainCache;
    if (Date.now() / 1000 - at < KEYCHAIN_CACHE_TTL_S) {
      _lastKeychainErr = result[2];
      return result;
    }
  }
  _lastKeychainErr = null;
  if (platform() !== "darwin") return [null, null, null];

  let best: [string, number | null] | null = null;
  let lastErr: string | null = null;

  for (const svc of keychainServices()) {
    let proc: ReturnType<typeof spawnSync>;
    try {
      proc = spawnSync("security", ["find-generic-password", "-s", svc, "-w"], {
        encoding: "utf-8",
        timeout: 20_000,
      });
    } catch (e) {
      lastErr = String(e);
      continue;
    }
    if (proc.error) {
      lastErr = String(proc.error);
      continue;
    }
    if (proc.status !== 0) {
      lastErr = keychainError(svc, proc);
      continue;
    }
    const out = String(proc.stdout ?? "").trim();
    const [token, exp] = parseOauthBlob(out);
    if (!token) {
      lastErr = `item ${svc} sem accessToken`;
      continue;
    }
    if (best === null || (exp ?? 0) >= (best[1] ?? 0)) {
      best = [token, exp];
    }
  }

  let result: [string | null, number | null, string | null];
  if (best) {
    _lastKeychainErr = null;
    result = [best[0], best[1], null];
  } else {
    _lastKeychainErr = lastErr;
    result = [null, null, lastErr];
  }
  _keychainCache = { at: Date.now() / 1000, result };
  return result;
}

function expandUser(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

export function credentialsPath(cfg?: Record<string, unknown> | null): string {
  const env = (process.env.CLAUDE_CREDENTIALS_PATH ?? "").trim();
  if (env) return expandUser(env);
  let stored = "";
  if (cfg) {
    const paths = cfg.paths as Record<string, unknown> | undefined;
    stored = String(paths?.claude_credentials ?? "").trim();
  }
  if (stored) return expandUser(stored);
  return join(homedir(), ".claude", ".credentials.json");
}

export function missingLoginHint(cfg?: Record<string, unknown> | null): string {
  if (platform() === "darwin") {
    return lastKeychainError() ?? "Nenhum login encontrado — rode `claude` neste Mac";
  }
  return (
    "Nenhum login encontrado — rode `claude` neste computador " + `(o token fica em ${credentialsPath(cfg)})`
  );
}

export function claudeTokenCandidates(
  cfg?: Record<string, unknown> | null,
): Array<[string, string, number | null]> {
  const found: Array<[string, string, number | null]> = [];
  const seen = new Set<string>();

  function add(source: string, token: string | null, exp: number | null): void {
    if (!token || seen.has(token)) return;
    seen.add(token);
    found.push([source, token, exp]);
  }

  const [kcToken, kcExp] = fromMacosKeychain();
  add("keychain", kcToken, kcExp);
  const [fileTok, fileExp] = fromCredentialsFile(credentialsPath(cfg));
  add("credentials", fileTok, fileExp);
  return found;
}

// For testing: reset cache
export function _resetClaudeOauthCache(): void {
  _keychainCache = null;
  _lastKeychainErr = null;
}
