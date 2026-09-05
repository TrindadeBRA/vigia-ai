import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { authUrl, exchangeCode } from "../providers/adsense.js";
import { load, updateSync as update, provider as providerCfg } from "../store.js";

const pending = new Map<string, { at: number; returnTo: string }>();
const TTL_S = 600;

function purge(): void {
  const now = performance.now() / 1000;
  for (const [k, v] of pending) {
    if (now - v.at > TTL_S) pending.delete(k);
  }
}

function listenPort(app: FastifyInstance): number {
  return Number((app as unknown as { listenPort?: number }).listenPort ?? 8787);
}

function safeReturnTo(raw: string | null | undefined, port: number): string {
  const fallback = `http://127.0.0.1:${port}/display/config`;
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:") return fallback;
    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return fallback;
    const path = parsed.pathname || "/display/config";
    if (!path.startsWith("/display")) return fallback;
    const host = parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname;
    const netloc = parsed.port ? `${host}:${parsed.port}` : host;
    return `http://${netloc}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function jsStringLiteral(value: string): string {
  const encoded = JSON.stringify(value);
  return encoded.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function htmlRedirect(url: string, message: string): string {
  const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return (
    `<!doctype html><meta charset=utf-8>` +
    `<meta http-equiv="refresh" content="0;url=${safe}">` +
    `<script>location.replace(${jsStringLiteral(url)})</script>` +
    `<p>${message}</p>`
  );
}

export async function createAdsenseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/oauth/adsense/start", async (request, reply) => {
    const cfg = load() as Record<string, unknown>;
    const p = providerCfg(cfg, "adsense") as Record<string, unknown>;
    const clientId = String(p.client_id ?? "").trim();
    const clientSecret = String(p.client_secret ?? "").trim();
    if (!clientId || !clientSecret) {
      return reply.code(400).send({ ok: false, error: "Cole o Client ID e o Client Secret do Google Cloud antes de entrar" });
    }
    const port = listenPort(app);
    const state = randomBytes(18).toString("base64url");
    const query = (request.query ?? {}) as Record<string, string>;
    const returnTo = safeReturnTo(query.return_to ?? null, port);
    purge();
    pending.set(state, { at: performance.now() / 1000, returnTo });
    return { url: authUrl(clientId, port, state) };
  });

  app.get("/api/oauth/adsense/callback", async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string | undefined>;
    const code = query.code ?? null;
    const state = query.state ?? null;
    const error = query.error ?? null;
    const port = listenPort(app);
    purge();
    const pend = pending.get(state ?? "");
    if (pend) pending.delete(state ?? "");
    const returnTo = String(pend?.returnTo ?? safeReturnTo(null, port));
    const sep = returnTo.includes("?") ? "&" : "?";
    if (error) {
      const html = htmlRedirect(`${returnTo}${sep}adsense=denied`, "Login Google cancelado.");
      return reply.type("text/html").send(html);
    }
    if (!code || !state || !pend) {
      const html = htmlRedirect(`${returnTo}${sep}adsense=error`, "Callback OAuth inválido ou expirado.");
      return reply.type("text/html").send(html);
    }
    const cfg = load() as Record<string, unknown>;
    const p = providerCfg(cfg, "adsense") as Record<string, unknown>;
    const clientId = String(p.client_id ?? "").trim();
    const clientSecret = String(p.client_secret ?? "").trim();
    let tokens: Record<string, unknown>;
    try {
      tokens = await exchangeCode(clientId, clientSecret, port, code) as Record<string, unknown>;
    } catch (exc) {
      const html = htmlRedirect(`${returnTo}${sep}adsense=error`, String(exc));
      return reply.type("text/html").send(html);
    }
    update((cfgNow: Record<string, unknown>) => {
      const providers = (cfgNow.providers ?? {}) as Record<string, unknown>;
      const ads = (providers.adsense ?? {}) as Record<string, unknown>;
      ads.refresh_token = String(tokens.refresh_token ?? "");
      providers.adsense = ads;
      cfgNow.providers = providers;
    });
    const html = htmlRedirect(`${returnTo}${sep}adsense=ok`, "AdSense conectado. Pode fechar esta aba.");
    return reply.type("text/html").send(html);
  });

  app.post("/api/oauth/adsense/disconnect", async () => {
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, unknown>;
      const ads = (providers.adsense ?? {}) as Record<string, unknown>;
      ads.refresh_token = "";
      ads.account_name = "";
      providers.adsense = ads;
      cfg.providers = providers;
    });
    return { ok: true, cleared: "adsense_oauth" };
  });
}
