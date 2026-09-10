import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { HttpError } from "../httpClient.js";
import {
  authUrl,
  exchangeCode,
  getAccessToken,
  getPlaybackState,
  playbackNext,
  playbackPause,
  playbackPlay,
  playbackPrevious,
  spotifyCreds,
  summarizePlayback,
} from "../providers/spotify.js";
import { load, updateSync as update } from "../store.js";

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

function appendQuery(url: string, key: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    const hashIdx = url.indexOf("#");
    if (hashIdx === -1) return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    return `${url.slice(0, hashIdx)}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}${url.slice(hashIdx)}`;
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

function friendlyError(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.status === 404) return "Nenhum dispositivo Spotify ativo — abra o Spotify em algum aparelho (celular, PC, alto-falante), toque algo e tente de novo.";
    if (e.status === 401 || e.status === 403) return "Sessão do Spotify expirada ou sem permissão — entre de novo em Configurações.";
    if (e.status === 429) return "Spotify limitou as requisições, aguarde um pouco e tente de novo.";
  }
  return e instanceof Error ? e.message : String(e);
}

const NOT_CONFIGURED = "Conecte sua conta Spotify em Configurações primeiro.";

export async function createSpotifyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/oauth/spotify/start", { schema: { tags: ["Spotify"] } }, async (request, reply) => {
    const cfg = load() as Record<string, unknown>;
    const providers = (cfg.providers ?? {}) as Record<string, unknown>;
    const p = (providers.spotify ?? {}) as Record<string, unknown>;
    const clientId = String(p.client_id ?? "").trim();
    const clientSecret = String(p.client_secret ?? "").trim();
    if (!clientId || !clientSecret) {
      return reply.code(400).send({ ok: false, error: "Cole o Client ID e o Client Secret do Spotify antes de entrar" });
    }
    const port = listenPort(app);
    const state = randomBytes(18).toString("base64url");
    const query = (request.query ?? {}) as Record<string, string>;
    const returnTo = safeReturnTo(query.return_to ?? null, port);
    purge();
    pending.set(state, { at: performance.now() / 1000, returnTo });
    return { url: authUrl(clientId, port, state) };
  });

  app.get("/api/oauth/spotify/callback", { schema: { tags: ["Spotify"] } }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string | undefined>;
    const code = query.code ?? null;
    const state = query.state ?? null;
    const error = query.error ?? null;
    const errorDescription = (query.error_description as string | undefined) ?? null;
    const port = listenPort(app);
    purge();
    const pend = pending.get(state ?? "");
    if (pend) pending.delete(state ?? "");
    const returnTo = String(pend?.returnTo ?? safeReturnTo(null, port));
    // Spotify manda error=access_denied quando o usuário cancela
    if (error) {
      const url = appendQuery(returnTo, "spotify", "denied");
      const html = htmlRedirect(url, errorDescription ? `Login Spotify cancelado: ${errorDescription}` : "Login Spotify cancelado.");
      return reply.type("text/html").send(html);
    }
    if (!code || !state || !pend) {
      const url = appendQuery(returnTo, "spotify", "error");
      const detail = !pend ? "Sessão expirada — o coletor reiniciou ou o link expirou (10 min). Tente Entrar com Spotify de novo." : "Callback OAuth inválido ou expirado.";
      const html = htmlRedirect(url, detail);
      return reply.type("text/html").send(html);
    }
    const cfg = load() as Record<string, unknown>;
    const providers = (cfg.providers ?? {}) as Record<string, unknown>;
    const p = (providers.spotify ?? {}) as Record<string, unknown>;
    const clientId = String(p.client_id ?? "").trim();
    const clientSecret = String(p.client_secret ?? "").trim();
    let tokens: Record<string, unknown>;
    try {
      tokens = await exchangeCode(clientId, clientSecret, port, code);
    } catch (exc) {
      const raw = String(exc);
      // Erro mais comum: redirect_uri_mismatch quando o dev esqueceu de cadastrar
      // a URI exata no dashboard. Dá um hint acionável em vez de JSON cru.
      let hint = raw;
      if (/redirect_uri/i.test(raw) || /redirect_uri_mismatch/i.test(raw)) {
        const want = `http://127.0.0.1:${port}/api/oauth/spotify/callback`;
        const alt = `http://localhost:${port}/api/oauth/spotify/callback`;
        hint = `Redirect URI não confere no Spotify Dashboard. Cadastre exatamente "${want}" e "${alt}" em https://developer.spotify.com/dashboard > seu app > Settings > Redirect URIs > Save. Detalhe: ${raw}`;
      } else if (/refresh_token/i.test(raw)) {
        hint = `${raw} — revogue o acesso em https://www.spotify.com/account/apps/ e entre de novo (o Spotify só manda refresh_token no primeiro consent).`;
      }
      const url = appendQuery(returnTo, "spotify", "error");
      const urlWithReason = appendQuery(url, "reason", hint.slice(0, 600));
      const html = htmlRedirect(urlWithReason, hint);
      return reply.type("text/html").send(html);
    }
    update((cfgNow: Record<string, unknown>) => {
      const providersNow = (cfgNow.providers ?? {}) as Record<string, unknown>;
      const sp = (providersNow.spotify ?? {}) as Record<string, unknown>;
      sp.refresh_token = String(tokens.refresh_token ?? "");
      providersNow.spotify = sp;
      cfgNow.providers = providersNow;
    });
    const url = appendQuery(returnTo, "spotify", "ok");
    const html = htmlRedirect(url, "Spotify conectado. Pode fechar esta aba.");
    return reply.type("text/html").send(html);
  });

  app.post("/api/oauth/spotify/disconnect", { schema: { tags: ["Spotify"] } }, async () => {
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, unknown>;
      const sp = (providers.spotify ?? {}) as Record<string, unknown>;
      sp.refresh_token = "";
      providers.spotify = sp;
      cfg.providers = providers;
    });
    return { ok: true, cleared: "spotify_oauth" };
  });

  app.get("/api/spotify", { schema: { tags: ["Spotify"] } }, async () => {
    const cfg = load() as Record<string, unknown>;
    const creds = spotifyCreds(cfg);
    if (!creds) {
      return { ok: true, configured: false, error: null, is_playing: false, progress_ms: null, device: null, shuffle: false, repeat: "off", track: null };
    }
    try {
      const access = await getAccessToken(creds.clientId, creds.clientSecret, creds.refreshToken);
      const raw = await getPlaybackState(access);
      return { ok: true, configured: true, error: null, ...summarizePlayback(raw) };
    } catch (e) {
      return { ok: false, configured: true, error: friendlyError(e), is_playing: false, progress_ms: null, device: null, shuffle: false, repeat: "off", track: null };
    }
  });

  async function runAction(fn: (accessToken: string) => Promise<void>): Promise<{ ok: boolean; error?: string }> {
    const cfg = load() as Record<string, unknown>;
    const creds = spotifyCreds(cfg);
    if (!creds) return { ok: false, error: NOT_CONFIGURED };
    try {
      const access = await getAccessToken(creds.clientId, creds.clientSecret, creds.refreshToken);
      await fn(access);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
  }

  app.post("/api/spotify/play", { schema: { tags: ["Spotify"] } }, async () => runAction(playbackPlay));
  app.post("/api/spotify/pause", { schema: { tags: ["Spotify"] } }, async () => runAction(playbackPause));
  app.post("/api/spotify/next", { schema: { tags: ["Spotify"] } }, async () => runAction(playbackNext));
  app.post("/api/spotify/previous", { schema: { tags: ["Spotify"] } }, async () => runAction(playbackPrevious));
}
