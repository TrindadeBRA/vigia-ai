/**
 * Provedor YouTube Music: estado de reprodução (now playing) + comandos de player.
 * Espelho do Spotify — mesmo padrão OAuth (client_id/client_secret/refresh_token)
 * mas usando Google OAuth (conta Google = YouTube Music). O coletor renova o
 * access token e tenta buscar "o que está tocando" via YouTube Data API; controles
 * de player ainda não são expostos pela API oficial, então retornam erro amigável
 * até integração completa com InnerTube/continuar.
 */
import { httpForm, httpJson } from "../httpClient.js";
import { provider as providerCfg, updateSync as update } from "../store.js";

export const YTMUSIC_SCOPES =
  "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

export function redirectUri(port: number): string {
  return `http://127.0.0.1:${Number(port)}/api/oauth/youtubemusic/callback`;
}

export function redirectUris(port: number): string[] {
  const p = Number(port) || 8787;
  return [
    `http://127.0.0.1:${p}/api/oauth/youtubemusic/callback`,
    `http://localhost:${p}/api/oauth/youtubemusic/callback`,
  ];
}

export function authUrl(clientId: string, port: number, state: string): string {
  const params = {
    client_id: clientId,
    redirect_uri: redirectUri(port),
    response_type: "code",
    scope: YTMUSIC_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  };
  return GOOGLE_AUTH_URL + "?" + new URLSearchParams(params).toString();
}

export async function exchangeCode(clientId: string, clientSecret: string, port: number, code: string): Promise<Record<string, unknown>> {
  const data = await httpForm(
    GOOGLE_TOKEN_URL,
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(port),
      grant_type: "authorization_code",
    },
    { provider: "YTMUSIC" },
  );
  if (data === null || typeof data !== "object" || Array.isArray(data) || !(data as Record<string, unknown>).refresh_token) {
    throw new Error("Google não devolveu refresh_token — revogue o acesso em myaccount.google.com/permissions e entre de novo");
  }
  return data as Record<string, unknown>;
}

type RefreshResult = { accessToken: string; expiresInS: number };

async function refreshAccessTokenRaw(clientId: string, clientSecret: string, refreshToken: string): Promise<RefreshResult> {
  const data = await httpForm(
    GOOGLE_TOKEN_URL,
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
    { provider: "YTMUSIC" },
  );
  if (data === null || typeof data !== "object" || Array.isArray(data) || !(data as Record<string, unknown>).access_token) {
    throw new Error("falha ao renovar o login do YouTube Music — entre de novo no painel");
  }
  return {
    accessToken: String((data as Record<string, unknown>).access_token),
    expiresInS: Number((data as Record<string, unknown>).expires_in ?? 3600),
  };
}

// Cache simples em memória — evita renovar o access token a cada poll (5-10s).
let _cache: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

/** Devolve um access token válido, renovando só quando necessário. */
export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const now = Date.now();
  if (_cache && _cache.refreshToken === refreshToken && _cache.expiresAt - 15_000 > now) {
    return _cache.accessToken;
  }
  const result = await refreshAccessTokenRaw(clientId, clientSecret, refreshToken);
  _cache = { accessToken: result.accessToken, expiresAt: now + result.expiresInS * 1000, refreshToken };
  return result.accessToken;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/** Tenta inferir "tocando agora" — YouTube Data API não expõe player em tempo real, então usamos atividades recentes como fallback. */
export async function getPlaybackState(accessToken: string): Promise<Record<string, unknown> | null> {
  // Tenta buscar a última atividade do canal (pode ser um like/watch de música)
  try {
    const data = await httpJson(`${YT_API_BASE}/activities?mine=true&maxResults=1&part=snippet,contentDetails`, {
      headers: bearer(accessToken),
      provider: "YTMUSIC",
    });
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const items = (data as Record<string, unknown>).items as unknown[] | undefined;
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0] as Record<string, unknown>;
        // Se a atividade for relacionada a vídeo, expõe como "track" provisória
        const snippet = first.snippet as Record<string, unknown> | undefined;
        const title = snippet ? String(snippet.title ?? "") : "";
        const thumbnails = (snippet?.thumbnails ?? {}) as Record<string, unknown>;
        const img = (thumbnails.high as Record<string, unknown> | undefined)?.url ?? (thumbnails.default as Record<string, unknown> | undefined)?.url ?? null;
        if (title) {
          return {
            is_playing: false,
            progress_ms: null,
            device: null,
            // Emula estrutura do Spotify para o card reaproveitar
            item: {
              id: String((first as Record<string, unknown>).id ?? ""),
              name: title,
              artists: String(snippet?.channelTitle ?? ""),
              album: { name: "YouTube", images: img ? [{ url: String(img) }] : [] },
              duration_ms: null,
              external_urls: { spotify: null },
            },
            shuffle_state: false,
            repeat_state: "off",
          };
        }
      }
    }
  } catch {
    // ignora e retorna null (sem nada tocando)
  }
  return null;
}

// Comandos de player — API oficial não expõe controle remoto para YouTube Music, então retornamos erro amigável.
export async function playbackPlay(_accessToken: string): Promise<void> {
  throw new Error("Controle remoto do YouTube Music ainda não disponível pela API oficial — use o app do YouTube Music no celular/PC para tocar/pausar");
}
export async function playbackPause(_accessToken: string): Promise<void> {
  throw new Error("Controle remoto do YouTube Music ainda não disponível pela API oficial — use o app do YouTube Music no celular/PC para pausar");
}
export async function playbackNext(_accessToken: string): Promise<void> {
  throw new Error("Controle remoto do YouTube Music ainda não disponível pela API oficial — use o app do YouTube Music para avançar");
}
export async function playbackPrevious(_accessToken: string): Promise<void> {
  throw new Error("Controle remoto do YouTube Music ainda não disponível pela API oficial — use o app do YouTube Music para voltar");
}

export type YoutubeMusicNowPlaying = {
  is_playing: boolean;
  progress_ms: number | null;
  device: { name: string; volume_percent: number | null; type: string } | null;
  shuffle: boolean;
  repeat: string;
  track: {
    id: string;
    name: string;
    artists: string;
    album: string;
    duration_ms: number | null;
    image_url: string | null;
    external_url: string | null;
  } | null;
};

export function summarizePlayback(raw: Record<string, unknown> | null): YoutubeMusicNowPlaying {
  if (!raw) {
    return { is_playing: false, progress_ms: null, device: null, shuffle: false, repeat: "off", track: null };
  }
  const item = (raw.item ?? null) as Record<string, unknown> | null;
  const album = item ? ((item.album ?? null) as Record<string, unknown> | null) : null;
  const images = (album?.images ?? []) as Array<Record<string, unknown>>;
  const artists = item ? String(item.artists ?? (item as Record<string, unknown>).channelTitle ?? "") : "";
  // fallback: se veio direto do YouTube activities, mapeia
  const trackId = item ? String(item.id ?? "") : "";
  const trackName = item ? String(item.name ?? (raw as Record<string, unknown>).title ?? "") : "";
  const external = item ? ((item.external_urls ?? null) as Record<string, unknown> | null) : null;
  if (item) {
    return {
      is_playing: Boolean(raw.is_playing),
      progress_ms: raw.progress_ms != null ? Number(raw.progress_ms) : null,
      device: null,
      shuffle: Boolean(raw.shuffle_state),
      repeat: String(raw.repeat_state ?? "off"),
      track: {
        id: trackId,
        name: trackName || "YouTube Music",
        artists,
        album: String(album?.name ?? "YouTube Music"),
        duration_ms: item.duration_ms != null ? Number(item.duration_ms) : null,
        image_url: images[0] ? String(images[0].url ?? "") || null : null,
        external_url: external?.spotify ? String(external.spotify) : null,
      },
    };
  }
  return { is_playing: false, progress_ms: null, device: null, shuffle: false, repeat: "off", track: null };
}

/** Lê client_id/client_secret/refresh_token salvos; null se falta algo. */
export function ytmusicCreds(cfg: Record<string, unknown>): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const p = providerCfg(cfg, "youtubemusic") as Record<string, unknown>;
  const clientId = String(p.client_id ?? "").trim();
  const clientSecret = String(p.client_secret ?? "").trim();
  const refreshToken = String(p.refresh_token ?? "").trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}
