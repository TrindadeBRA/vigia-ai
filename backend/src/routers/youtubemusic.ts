import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { HttpError } from "../httpClient.js";
import {
  authUrl,
  getAccessToken,
  getPlaybackState,
  playbackNext,
  playbackPause,
  playbackPlay,
  playbackPrevious,
  summarizePlayback,
  ytmusicCreds,
} from "../providers/youtubemusic.js";
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
    if (e.status === 404) return "Nenhum conteúdo do YouTube Music encontrado — abra o YouTube Music em algum aparelho.";
    if (e.status === 401 || e.status === 403) return "Sessão do YouTube Music expirada ou sem permissão — entre de novo em Configurações.";
    if (e.status === 429) return "YouTube limitou as requisições, aguarde um pouco e tente de novo.";
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/Controle remoto/.test(msg)) return msg;
  return msg;
}

const NOT_CONFIGURED = "Conecte sua conta do YouTube Music em Configurações primeiro.";

export async function createYoutubeMusicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/oauth/youtubemusic/start", async (request, reply) => {
    const cfg = load() as Record<string, unknown>;
    const providers = (cfg.providers ?? {}) as Record<string, unknown>;
    const p = (providers.youtubemusic ?? {}) as Record<string, unknown>;
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

  app.get("/api/oauth/youtubemusic/callback", async (request, reply) => {
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
    if (error) {
      const url = appendQuery(returnTo, "youtubemusic", "denied");
      const html = htmlRedirect(url, errorDescription ? `Login YouTube Music cancelado: ${errorDescription}` : "Login YouTube Music cancelado.");
      return reply.type("text/html").send(html);
    }
    if (!code || !state || !pend) {
      const url = appendQuery(returnTo, "youtubemusic", "error");
      const detail = !pend ? "Sessão expirada — o coletor reiniciou ou o link expirou (10 min). Tente Entrar com YouTube Music de novo." : "Callback OAuth inválido ou expirado.";
      const html = htmlRedirect(url, detail);
      return reply.type("text/html").send(html);
    }
    const cfg = load() as Record<string, unknown>;
    const providers = (cfg.providers ?? {}) as Record<string, unknown>;
    const p = (providers.youtubemusic ?? {}) as Record<string, unknown>;
    const clientId = String(p.client_id ?? "").trim();
    const clientSecret = String(p.client_secret ?? "").trim();
    // Import dinâmico para evitar ciclo
    const { exchangeCode } = await import("../providers/youtubemusic.js");
    let tokens: Record<string, unknown>;
    try {
      tokens = await exchangeCode(clientId, clientSecret, port, code);
    } catch (exc) {
      const raw = String(exc);
      let hint = raw;
      if (/redirect_uri/i.test(raw) || /redirect_uri_mismatch/i.test(raw)) {
        const want = `http://127.0.0.1:${port}/api/oauth/youtubemusic/callback`;
        const alt = `http://localhost:${port}/api/oauth/youtubemusic/callback`;
        hint = `Redirect URI não confere no Google Cloud. Cadastre exatamente "${want}" e "${alt}" em https://console.cloud.google.com/apis/credentials > seu OAuth Client > Authorized redirect URIs > Save. Detalhe: ${raw}`;
      } else if (/refresh_token/i.test(raw)) {
        hint = `${raw} — revogue o acesso em https://myaccount.google.com/permissions e entre de novo (o Google só manda refresh_token no primeiro consent com prompt=consent).`;
      }
      const url = appendQuery(returnTo, "youtubemusic", "error");
      const urlWithReason = appendQuery(url, "reason", hint.slice(0, 600));
      const html = htmlRedirect(urlWithReason, hint);
      return reply.type("text/html").send(html);
    }
    update((cfgNow: Record<string, unknown>) => {
      const providersNow = (cfgNow.providers ?? {}) as Record<string, unknown>;
      const sp = (providersNow.youtubemusic ?? {}) as Record<string, unknown>;
      sp.refresh_token = String(tokens.refresh_token ?? "");
      providersNow.youtubemusic = sp;
      cfgNow.providers = providersNow;
    });
    const url = appendQuery(returnTo, "youtubemusic", "ok");
    const html = htmlRedirect(url, "YouTube Music conectado. Pode fechar esta aba.");
    return reply.type("text/html").send(html);
  });

  app.post("/api/oauth/youtubemusic/disconnect", async () => {
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, unknown>;
      const sp = (providers.youtubemusic ?? {}) as Record<string, unknown>;
      sp.refresh_token = "";
      providers.youtubemusic = sp;
      cfg.providers = providers;
    });
    return { ok: true, cleared: "youtubemusic_oauth" };
  });

  app.get("/api/youtubemusic", async () => {
    const cfg = load() as Record<string, unknown>;
    const creds = ytmusicCreds(cfg);
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
    const creds = ytmusicCreds(cfg);
    if (!creds) return { ok: false, error: NOT_CONFIGURED };
    try {
      const access = await getAccessToken(creds.clientId, creds.clientSecret, creds.refreshToken);
      await fn(access);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
  }

  app.post("/api/youtubemusic/play", async () => runAction(playbackPlay));
  app.post("/api/youtubemusic/pause", async () => runAction(playbackPause));
  app.post("/api/youtubemusic/next", async () => runAction(playbackNext));
  app.post("/api/youtubemusic/previous", async () => runAction(playbackPrevious));
}
