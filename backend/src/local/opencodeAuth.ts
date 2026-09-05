/**
 * Auth local do OpenCode CLI. Token em ~/.local/share/opencode/auth.json
 * Port of pattern from gptOauth.ts / claudeOauth.ts
 * Formato do auth.json (opencode):
 *   { "opencode": { "type": "api", "key": "sk-..." } }
 *   ou { "opencode": { "type": "oauth", "access": "...", "refresh": "...", "expires": 123 } }
 * Também suporta OPENCODE_AUTH_CONTENT (JSON inline) e XDG_DATA_HOME.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function expandUser(p: string): string {
    if (p === "~") return homedir();
    if (p.startsWith("~/")) return join(homedir(), p.slice(2));
    return p;
}

export function authPath(cfg?: Record<string, unknown> | null): string {
    const envFile = (process.env.OPENCODE_AUTH_PATH ?? "").trim();
    if (envFile) return expandUser(envFile);
    let stored = "";
    if (cfg) {
        const paths = cfg.paths as Record<string, unknown> | undefined;
        stored = String(paths?.opencode_auth ?? "").trim();
    }
    if (stored) return expandUser(stored);
    const xdg = (process.env.XDG_DATA_HOME ?? "").trim();
    if (xdg) return join(expandUser(xdg), "opencode", "auth.json");
    return join(homedir(), ".local", "share", "opencode", "auth.json");
}

export function parseAuthBlob(data: unknown): string | null {
    if (typeof data === "string") {
        const text = data.trim();
        if (!text) return null;
        try {
            data = JSON.parse(text);
        } catch {
            // string solta pode ser a própria key
            return text.startsWith("sk-") ? text : null;
        }
    }
    if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
    const dict = data as Record<string, unknown>;

    // OPENCODE_AUTH_CONTENT pode ser o objeto inteiro do auth.json
    // Tenta chaves candidatas: "opencode", "opencode-zen", "opencode_go", "opencode_zen"
    const candidates = ["opencode", "opencode-zen", "opencode_zen", "opencode-go", "opencode_go"];
    for (const key of candidates) {
        const entry = dict[key];
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
        const e = entry as Record<string, unknown>;
        // type: "api" -> key
        const k = String(e.key ?? e.apiKey ?? e.api_key ?? "").trim();
        if (k) return k;
        // type: "oauth" -> access token (fallback)
        const access = String(e.access ?? e.accessToken ?? e.access_token ?? "").trim();
        if (access) return access;
    }

    // Fallback: se o próprio objeto for { type: "api", key: "sk-..." }
    if (typeof dict.type === "string" && typeof dict.key === "string") {
        const k = String(dict.key).trim();
        if (k) return k;
    }

    return null;
}

export function fromAuthFile(path: string): [string | null, string | null] {
    if (!existsSync(path)) return [null, null];
    let data: unknown;
    try {
        data = JSON.parse(readFileSync(path, "utf-8"));
    } catch (e) {
        return [null, `auth.json: ${e}`];
    }
    const key = parseAuthBlob(data);
    if (!key) return [null, null];
    return [key, null];
}

export function fromEnvContent(): [string | null, string | null] {
    const raw = (process.env.OPENCODE_AUTH_CONTENT ?? "").trim();
    if (!raw) return [null, null];
    try {
        const data = JSON.parse(raw);
        const key = parseAuthBlob(data);
        if (key) return [key, null];
        return [null, null];
    } catch {
        // pode ser a key direta
        if (raw.startsWith("sk-")) return [raw, null];
        return [null, null];
    }
}

export function opencodeTokenCandidates(
    cfg?: Record<string, unknown> | null,
): Array<[string, string]> {
    const found: Array<[string, string]> = [];
    const seen = new Set<string>();

    function add(source: string, token: string | null): void {
        if (!token || seen.has(token)) return;
        seen.add(token);
        found.push([source, token]);
    }

    const [envKey] = fromEnvContent();
    add("env", envKey);

    const [fileKey] = fromAuthFile(authPath(cfg));
    add("auth", fileKey);

    return found;
}

export function opencodeMissingHint(cfg?: Record<string, unknown> | null): string {
    const p = authPath(cfg);
    if (existsSync(p)) return "auth.json sem credencial opencode — rode `opencode auth login` ou `opencode` > /connect";
    return `Nenhum login OpenCode encontrado — rode \`opencode auth login\` neste computador (sem ${p})`;
}
