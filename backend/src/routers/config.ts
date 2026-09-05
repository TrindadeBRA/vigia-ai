import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { inDocker } from "../config.js";
import { credentialsPath, missingLoginHint } from "../local/claudeOauth.js";
import { cursorMissingHint, cursorTokenCandidates, jwtExpired } from "../local/cursorState.js";
import { authPath as gptAuthPath, gptMissingHint, gptTokenCandidates, gptTokenExpired } from "../local/gptOauth.js";
import { lanIPv4 } from "../netutil.js";
import { cleanBitcoinAddress } from "../providers/bitcoin.js";
import { cleanDeepseekKey } from "../providers/deepseek.js";
import { cleanFalKey } from "../providers/fal.js";
import { cleanOpencodeKey } from "../providers/opencode.js";
import { cleanOpenrouterKey } from "../providers/openrouter.js";
import { cleanRaApiKey, cleanRaUsername, parseRaSecret } from "../providers/retroachievements.js";
import { load, provider as providerCfg, updateSync as update } from "../store.js";

function suffix(token: string): string | null {
  token = token.trim();
  if (token.length < 8) return null;
  return token.slice(-4);
}

function accountsPublic(p: Record<string, unknown>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const acc of (p.accounts ?? []) as Array<Record<string, unknown>>) {
    const secret = String(acc.secret ?? "");
    out.push({ id: String(acc.id ?? ""), label: String(acc.label ?? ""), suffix: suffix(secret) });
  }
  return out;
}

import { claudeTokenCandidates } from "../local/claudeOauth.js";

function _claudeCard(cfg: Record<string, unknown>): Record<string, unknown> {
  const p = providerCfg(cfg, "claude") as Record<string, unknown>;
  const cands = claudeTokenCandidates(cfg);
  const paste = String(p.paste_secret ?? "").trim();
  const nowMs = Date.now();
  let live: [string, string] | null = null;
  let expiredOnly = false;
  for (const [source, token, expMs] of cands) {
    if (expMs !== null && expMs !== undefined && expMs < nowMs) {
      expiredOnly = true;
      continue;
    }
    live = [source, token];
    break;
  }
  const extras = accountsPublic(p);
  if (live) {
    const [source] = live;
    let label = source === "keychain" ? "Lido do Keychain do Claude Code" : `Lido de ${credentialsPath(cfg)}`;
    if (paste) label += " · token colado ignorado na conta local (o app tem prioridade)";
    return { source, label, configured: true, suffix: null, mode: "local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (expiredOnly) {
    return { source: "expired", label: "OAuth expirado — abra o Claude Code neste computador para renovar", configured: false, suffix: null, mode: "need_local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (paste) {
    return { source: "env", label: "Token colado neste coletor", configured: true, suffix: suffix(paste), mode: "paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (inDocker()) {
    return { source: "missing", label: "Docker não lê o Keychain — monte ~/.claude ou cole o token abaixo", configured: false, suffix: null, mode: "need_paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  const hint = missingLoginHint(cfg);
  return { source: "missing", label: hint, configured: false, suffix: null, mode: "need_local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
}

function _gptCard(cfg: Record<string, unknown>): Record<string, unknown> {
  const p = providerCfg(cfg, "gpt") as Record<string, unknown>;
  const cands = gptTokenCandidates(cfg);
  const paste = String(p.paste_secret ?? "").trim();
  const extras = accountsPublic(p);
  let live: [string, string] | null = null;
  let expiredOnly = false;
  for (const [source, token] of cands) {
    if (gptTokenExpired(token)) { expiredOnly = true; continue; }
    live = [source, token];
    break;
  }
  if (live) {
    const [source] = live;
    let label = `Lido de ${gptAuthPath(cfg)}`;
    if (paste) label += " · token colado ignorado na conta local (o Codex tem prioridade)";
    return { source, label, configured: true, suffix: null, mode: "local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (expiredOnly) {
    return { source: "expired", label: "OAuth expirado — rode `codex login` neste computador para renovar", configured: false, suffix: null, mode: "need_local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (paste) {
    return { source: "env", label: "Token colado neste coletor", configured: true, suffix: suffix(paste), mode: "paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (inDocker()) {
    return { source: "missing", label: "Docker não lê ~/.codex — monte o auth.json ou cole o token abaixo", configured: false, suffix: null, mode: "need_paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  return { source: "missing", label: gptMissingHint(cfg), configured: false, suffix: null, mode: "need_local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
}

function _cursorCard(cfg: Record<string, unknown>): Record<string, unknown> {
  const p = providerCfg(cfg, "cursor") as Record<string, unknown>;
  const cands = cursorTokenCandidates(cfg);
  const paste = String(p.paste_secret ?? "").trim();
  const extras = accountsPublic(p);
  let live: [string, string] | null = null;
  let expiredOnly = false;
  for (const [source, token] of cands) {
    if (jwtExpired(token)) { expiredOnly = true; continue; }
    live = [source, token];
    break;
  }
  if (live) {
    let label = "Lido do login do Cursor neste computador";
    if (paste) label += " · token colado ignorado na conta local";
    return { source: live[0], label, configured: true, suffix: null, mode: "local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (expiredOnly) {
    return { source: "expired", label: "JWT expirado — abra o Cursor neste computador para renovar", configured: false, suffix: null, mode: "need_local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (paste) {
    return { source: "env", label: "Token colado neste coletor", configured: true, suffix: suffix(paste), mode: "paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (inDocker()) {
    return { source: "missing", label: "Docker: monte o state.vscdb ou cole o token abaixo", configured: false, suffix: null, mode: "need_paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
  }
  return { source: "missing", label: cursorMissingHint(cfg) + " — ou cole o token abaixo", configured: false, suffix: null, mode: "need_local", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), accounts: extras };
}

function _adsenseCard(cfg: Record<string, unknown>): Record<string, unknown> {
  const p = providerCfg(cfg, "adsense") as Record<string, unknown>;
  const clientId = String(p.client_id ?? "").trim();
  const clientSecret = String(p.client_secret ?? "").trim();
  const refresh = String(p.refresh_token ?? "").trim();
  const extras = accountsPublic(p);
  if (refresh) {
    return { source: "google", label: "Login Google gravado neste coletor", configured: true, suffix: clientId ? suffix(clientId) : null, mode: "oauth", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), primary_label: String(p.local_label ?? ""), accounts: extras };
  }
  if (clientId && clientSecret) {
    return { source: "google_client", label: "Credenciais Google Cloud salvas — entre com o Google", configured: false, suffix: suffix(clientId), mode: "need_oauth", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), primary_label: String(p.local_label ?? ""), accounts: extras };
  }
  return { source: "missing", label: "Cole o Client ID e o Client Secret (tipo Web) do Google Cloud", configured: false, suffix: null, mode: "need_paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), primary_label: String(p.local_label ?? ""), accounts: extras };
}

function _keyCard(cfg: Record<string, unknown>, name: string): Record<string, unknown> {
  const p = providerCfg(cfg, name) as Record<string, unknown>;
  const paste = String(p.paste_secret ?? "").trim();
  const extras = accountsPublic(p);
  if (paste) {
    return { source: "env", label: "Key salva neste coletor", configured: true, suffix: suffix(paste), mode: "paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), primary_label: String(p.local_label ?? ""), accounts: extras };
  }
  return { source: "missing", label: "Nenhuma key configurada", configured: Boolean(extras.length > 0), suffix: null, mode: "need_paste", hidden: Boolean(p.hidden), local_label: String(p.local_label ?? ""), primary_label: String(p.local_label ?? ""), accounts: extras };
}

function secretsHFile(usageLan: string): string {
  return `#pragma once\n\n#define WIFI_SSID "SUA_REDE"\n#define WIFI_PASSWORD "SUA_SENHA"\n#define USAGE_URL "${usageLan}"\n`;
}

function devicePublic(hub: unknown): Record<string, unknown> {
  const h = hub as Record<string, unknown> | null;
  if (!h) return { ip: null, last_seen_s: null, width: null, height: null };
  const ip = h.deviceIp as string | null ?? (h.device_ip as string | null) ?? null;
  const seenAt = (h.deviceSeenAt as number | null) ?? (h.device_seen_at as number | null) ?? null;
  if (!ip || seenAt === null) return { ip: null, last_seen_s: null, width: null, height: null };
  const nowMonotonic = performance.now() / 1000;
  const elapsed = Math.max(0, Math.trunc(nowMonotonic - seenAt));
  return { ip, last_seen_s: elapsed, width: (h.deviceWidth as number | null) ?? (h.device_width as number | null) ?? null, height: (h.deviceHeight as number | null) ?? (h.device_height as number | null) ?? null };
}

function configPublic(listenHost: string, listenPort: number, hub: unknown = null): Record<string, unknown> {
  const cfg = load() as Record<string, unknown>;
  const ips = lanIPv4();
  const usagePaths = [`http://127.0.0.1:${listenPort}/usage`];
  const panelPaths = [`http://127.0.0.1:${listenPort}/`];
  for (const ip of ips) {
    usagePaths.push(`http://${ip}:${listenPort}/usage`);
    panelPaths.push(`http://${ip}:${listenPort}/`);
  }
  const usageLocal = `http://127.0.0.1:${listenPort}/usage`;
  const usageLan = ips.length ? `http://${ips[0]}:${listenPort}/usage` : usageLocal;
  const storedPort = Number(((cfg.listen as Record<string, unknown>) ?? {}).port ?? 8787);
  const weatherRaw = (cfg.weather ?? {}) as Record<string, unknown>;
  const currenciesRaw = (cfg.currencies ?? {}) as Record<string, unknown>;
  const gitRaw = (cfg.git ?? {}) as Record<string, unknown>;
  const calendarRaw = (cfg.calendar ?? { enabled: false, hidden: false, calendars: [] }) as Record<string, unknown>;
  const rssRaw = (cfg.rss ?? { enabled: false, hidden: false, feeds: [] }) as Record<string, unknown>;
  return {
    in_docker: inDocker(),
    mock: Boolean(cfg.mock),
    listen: { host: listenHost, port: listenPort },
    urls: {
      panel: panelPaths,
      usage: usagePaths,
      usage_lan: usageLan,
      usage_local: usageLocal,
      secrets_h: `#define USAGE_URL "${usageLan}"`,
      secrets_h_file: secretsHFile(usageLan),
      board_ok: Boolean(ips.length),
    },
    lan_ips: ips,
    restart_needed_for_port: storedPort !== listenPort,
    providers: {
      claude: _claudeCard(cfg),
      gpt: _gptCard(cfg),
      cursor: _cursorCard(cfg),
      openrouter: _keyCard(cfg, "openrouter"),
      deepseek: _keyCard(cfg, "deepseek"),
      opencode: _keyCard(cfg, "opencode"),
      fal: _keyCard(cfg, "fal"),
      bitcoin: _keyCard(cfg, "bitcoin"),
      adsense: _adsenseCard(cfg),
      retroachievements: _keyCard(cfg, "retroachievements"),
    },
    weather: weatherRaw,
    currencies: currenciesRaw,
    git: gitRaw,
    calendar: calendarRaw,
    rss: rssRaw,
    device: devicePublic(hub),
  };
}

export async function createConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/config", async (request) => {
    const host = (app as unknown as { listenHost?: string }).listenHost ?? "0.0.0.0";
    const port = (app as unknown as { listenPort?: number }).listenPort ?? 8787;
    const hub = (app as unknown as { hub?: unknown }).hub ?? null;
    return configPublic(host, port, hub);
  });

  app.post("/api/config", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
    const hostVal = (app as unknown as { listenHost?: string }).listenHost ?? "0.0.0.0";
    const portVal = (app as unknown as { listenPort?: number }).listenPort ?? 8787;
    let restart = false;
    try {
      update((cfg: Record<string, unknown>) => {
        if (body.host !== undefined && body.host !== null) {
          (cfg.listen as Record<string, unknown>).host = String(body.host).trim() || "0.0.0.0";
        }
        if (body.port !== undefined && body.port !== null) {
          const p = Number(body.port);
          (cfg.listen as Record<string, unknown>).port = p;
          restart = p !== portVal;
        }
        if (body.mock !== undefined && body.mock !== null) cfg.mock = Boolean(body.mock);
        const mapping: Record<string, [unknown, unknown, unknown, string | null]> = {
          claude: [body.claude_hidden, body.claude_local_label, body.claude_paste, null],
          gpt: [body.gpt_hidden, body.gpt_local_label, body.gpt_paste, null],
          cursor: [body.cursor_hidden, body.cursor_local_label, body.cursor_paste, null],
          openrouter: [body.openrouter_hidden, body.openrouter_primary_label, body.openrouter_paste, "openrouter"],
          deepseek: [body.deepseek_hidden, body.deepseek_primary_label, body.deepseek_paste, "deepseek"],
          opencode: [body.opencode_hidden, body.opencode_primary_label, body.opencode_paste, "opencode"],
          fal: [body.fal_hidden, body.fal_primary_label, body.fal_paste, "fal"],
          bitcoin: [body.bitcoin_hidden, body.bitcoin_primary_label, body.bitcoin_paste, "bitcoin"],
          adsense: [body.adsense_hidden, body.adsense_primary_label, null, null],
          retroachievements: [body.retroachievements_hidden, body.retroachievements_primary_label, body.retroachievements_paste, "retroachievements"],
        };
        for (const [name, [hidden, label, paste, kind]] of Object.entries(mapping)) {
          const providers = (cfg.providers ?? {}) as Record<string, Record<string, unknown>>;
          const p = providers[name] ?? {};
          if (hidden !== undefined && hidden !== null) p.hidden = Boolean(hidden);
          if (label !== undefined && label !== null) p.local_label = String(label);
          if (paste !== undefined && paste !== null && paste !== "" && paste !== "********") {
            let secret = String(paste).trim();
            if (kind === "openrouter") {
              const cleaned = cleanOpenrouterKey(secret);
              if (!cleaned) throw Object.assign(new Error("API key OpenRouter inválida; cole só a chave sk-or-..."), { statusCode: 400 });
              secret = cleaned;
            } else if (kind === "deepseek") {
              const cleaned = cleanDeepseekKey(secret);
              if (!cleaned) throw Object.assign(new Error("API key DeepSeek inválida; cole só a chave sk-..."), { statusCode: 400 });
              secret = cleaned;
            } else if (kind === "opencode") {
              const cleaned = cleanOpencodeKey(secret);
              if (!cleaned) throw Object.assign(new Error("API key OpenCode inválida; cole só a chave sk-..."), { statusCode: 400 });
              secret = cleaned;
            } else if (kind === "fal") {
              const cleaned = cleanFalKey(secret);
              if (!cleaned) throw Object.assign(new Error("API key fal.ai inválida; cole a chave admin (id:secret)"), { statusCode: 400 });
              secret = cleaned;
            } else if (kind === "bitcoin") {
              const cleaned = cleanBitcoinAddress(secret);
              if (!cleaned) throw Object.assign(new Error("Endereço Bitcoin inválido; cole o endereço público da carteira"), { statusCode: 400 });
              secret = cleaned;
            } else if (kind === "retroachievements") {
              // aceita "usuario:apikey" ou só apikey (com label como usuario)
              const parsed = parseRaSecret(secret, String(label ?? ""));
              if (!parsed) throw Object.assign(new Error("RetroAchievements: cole no formato usuario:apikey (ex.: MeuUser:abc123...) ou preencha o nome e cole só a API key"), { statusCode: 400 });
              // valida partes
              if (!cleanRaUsername(parsed.username) || !cleanRaApiKey(parsed.apiKey)) {
                throw Object.assign(new Error("RetroAchievements: usuário ou API key inválidos"), { statusCode: 400 });
              }
              secret = `${parsed.username}:${parsed.apiKey}`;
            }
            p.paste_secret = secret;
          }
          providers[name] = p;
        }
        const adsense = ((cfg.providers as Record<string, unknown>).adsense ?? {}) as Record<string, unknown>;
        if (body.adsense_client_id !== undefined && body.adsense_client_id !== null && body.adsense_client_id !== "" && body.adsense_client_id !== "********") {
          adsense.client_id = String(body.adsense_client_id).trim();
        }
        if (body.adsense_client_secret !== undefined && body.adsense_client_secret !== null && body.adsense_client_secret !== "" && body.adsense_client_secret !== "********") {
          adsense.client_secret = String(body.adsense_client_secret).trim();
        }
        (cfg.providers as Record<string, unknown>).adsense = adsense;
      });
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 400) return reply.code(400).send({ ok: false, error: err.message });
      throw e;
    }
    return { ok: true, restart_needed_for_port: restart };
  });

  app.post("/api/config/account", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.provider !== "string") return reply.code(400).send({ ok: false, error: "provider obrigatório" });
    const provider = String(body.provider);
    const label = String(body.label ?? "").trim();
    let secret = String(body.token ?? body.key ?? "").trim();
    if (provider === "openrouter") {
      const c = cleanOpenrouterKey(secret);
      if (!c) return reply.code(400).send({ ok: false, error: "API key OpenRouter inválida; cole só a chave sk-or-..." });
      secret = c;
    } else if (provider === "deepseek") {
      const c = cleanDeepseekKey(secret);
      if (!c) return reply.code(400).send({ ok: false, error: "API key DeepSeek inválida; cole só a chave sk-..." });
      secret = c;
    } else if (provider === "opencode") {
      const c = cleanOpencodeKey(secret);
      if (!c) return reply.code(400).send({ ok: false, error: "API key OpenCode inválida; cole só a chave sk-..." });
      secret = c;
    } else if (provider === "fal") {
      const c = cleanFalKey(secret);
      if (!c) return reply.code(400).send({ ok: false, error: "API key fal.ai inválida; cole a chave admin (id:secret)" });
      secret = c;
    } else if (provider === "bitcoin") {
      const c = cleanBitcoinAddress(secret);
      if (!c) return reply.code(400).send({ ok: false, error: "Endereço Bitcoin inválido; cole o endereço público da carteira" });
      secret = c;
    } else if (provider === "retroachievements") {
      const parsed = parseRaSecret(secret, label);
      if (!parsed) return reply.code(400).send({ ok: false, error: "RetroAchievements: cole no formato usuario:apikey (ex.: MeuUser:abc123...)" });
      if (!cleanRaUsername(parsed.username) || !cleanRaApiKey(parsed.apiKey)) {
        return reply.code(400).send({ ok: false, error: "RetroAchievements: usuário ou API key inválidos" });
      }
      secret = `${parsed.username}:${parsed.apiKey}`;
    } else if (!secret) {
      return reply.code(400).send({ ok: false, error: "token vazio" });
    }
    const accountId = randomBytes(4).toString("hex");
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, Record<string, unknown>>;
      const p = providers[provider] ?? { accounts: [] };
      const accounts = Array.isArray(p.accounts) ? [...(p.accounts as unknown[])] : [];
      accounts.push({ id: accountId, label, secret });
      p.accounts = accounts;
      providers[provider] = p;
      cfg.providers = providers;
    });
    return { ok: true, id: accountId };
  });

  app.delete("/api/config/account/:provider/:account_id", async (request) => {
    const { provider, account_id } = request.params as { provider: string; account_id: string };
    const valid = ["claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal", "bitcoin", "adsense", "retroachievements"];
    if (!valid.includes(provider)) return { ok: false, error: "provider inválido" };
    if (!account_id) return { ok: false, error: "id vazio" };
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, Record<string, unknown>>;
      const p = providers[provider] ?? {};
      const accounts = Array.isArray(p.accounts) ? (p.accounts as Array<Record<string, unknown>>) : [];
      p.accounts = accounts.filter((a) => String(a.id) !== account_id);
      providers[provider] = p;
      cfg.providers = providers;
    });
    return { ok: true };
  });

  app.delete("/api/config/secret/:name", async (request) => {
    const { name } = request.params as { name: string };
    const mapping: Record<string, string> = {
      claude: "claude", claude_paste: "claude", CLAUDE_OAUTH_TOKEN: "claude",
      gpt: "gpt", gpt_paste: "gpt", GPT_OAUTH_TOKEN: "gpt", CODEX_ACCESS_TOKEN: "gpt",
      cursor: "cursor", cursor_paste: "cursor", CURSOR_ACCESS_TOKEN: "cursor",
      openrouter: "openrouter", openrouter_paste: "openrouter", OPENROUTER_API_KEY: "openrouter",
      deepseek: "deepseek", deepseek_paste: "deepseek", DEEPSEEK_API_KEY: "deepseek",
      opencode: "opencode", opencode_paste: "opencode", OPENCODE_API_KEY: "opencode",
      fal: "fal", fal_paste: "fal", FAL_API_KEY: "fal",
      bitcoin: "bitcoin", bitcoin_paste: "bitcoin", BITCOIN_ADDRESS: "bitcoin",
      retroachievements: "retroachievements", retroachievements_paste: "retroachievements",
      adsense_client_secret: "adsense", adsense_client_id: "adsense",
    };
    const provider = mapping[name];
    if (!provider) return { ok: false, error: "chave não é segredo gerenciável" };
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, Record<string, unknown>>;
      if (provider === "adsense") {
        const ads = providers.adsense ?? {};
        ads.client_id = "";
        ads.client_secret = "";
        ads.refresh_token = "";
        ads.account_name = "";
        providers.adsense = ads;
      } else {
        const p = providers[provider] ?? {};
        p.paste_secret = "";
        providers[provider] = p;
      }
      cfg.providers = providers;
    });
    return { ok: true, cleared: name };
  });

  app.get("/secrets.h", async (request, reply) => {
    const host = (app as unknown as { listenHost?: string }).listenHost ?? "0.0.0.0";
    const port = (app as unknown as { listenPort?: number }).listenPort ?? 8787;
    const pub = configPublic(host, port) as Record<string, unknown>;
    const urls = (pub.urls ?? {}) as Record<string, unknown>;
    const file = String(urls.secrets_h_file ?? "");
    return reply.type("text/plain; charset=utf-8").send(file);
  });
}
