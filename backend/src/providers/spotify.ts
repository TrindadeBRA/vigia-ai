/**
 * Provedor Spotify: estado de reprodução (now playing) + comandos de player.
 * Login OAuth (client_id/client_secret/refresh_token) igual ao AdSense, mas
 * aqui o coletor também manda comandos (play/pause/next/previous) em vez de
 * só ler dados — não é uma "cota", é controle remoto do player.
 */
import { httpJson } from "../httpClient.js";
import { provider as providerCfg, updateSync as update } from "../store.js";

export const SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing";
export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export function redirectUri(port: number): string {
  return `http://127.0.0.1:${Number(port)}/api/oauth/spotify/callback`;
}

export function redirectUris(port: number): string[] {
  const p = Number(port) || 8787;
  return [
    `http://127.0.0.1:${p}/api/oauth/spotify/callback`,
    `http://localhost:${p}/api/oauth/spotify/callback`,
  ];
}

export function authUrl(clientId: string, port: number, state: string): string {
  const params = {
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(port),
    scope: SPOTIFY_SCOPES,
    state,
    // Sem isso, o Spotify pula a tela de login/consentimento quando esse
    // client_id já tem autorização prévia na conta — o navegador volta
    // direto pro callback e parece "só um refresh" em vez de abrir o Spotify.
    show_dialog: "true",
  };
  return SPOTIFY_AUTH_URL + "?" + new URLSearchParams(params).toString();
}

function basicAuth(clientId: string, clientSecret: string): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function tokenRequest(clientId: string, clientSecret: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(fields).toString();
  const data = await httpJson(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    provider: "SPOTIFY",
  });
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("resposta inválida do Spotify");
  }
  return data as Record<string, unknown>;
}

export async function exchangeCode(clientId: string, clientSecret: string, port: number, code: string): Promise<Record<string, unknown>> {
  const data = await tokenRequest(clientId, clientSecret, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(port),
  });
  if (!data.refresh_token) {
    throw new Error("Spotify não devolveu refresh_token — revogue o acesso em spotify.com/account/apps e entre de novo");
  }
  return data;
}

type RefreshResult = { accessToken: string; expiresInS: number; refreshToken: string | null };

async function refreshAccessTokenRaw(clientId: string, clientSecret: string, refreshToken: string): Promise<RefreshResult> {
  const data = await tokenRequest(clientId, clientSecret, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (!data.access_token) {
    throw new Error("falha ao renovar o login Spotify — entre de novo no painel");
  }
  return {
    accessToken: String(data.access_token),
    expiresInS: Number(data.expires_in ?? 3600),
    refreshToken: data.refresh_token ? String(data.refresh_token) : null,
  };
}

// Cache simples em memória — evita renovar o access token a cada poll de "now playing" (5-10s).
let _cache: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

/** Devolve um access token válido, renovando (e persistindo rotação) só quando necessário. */
export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const now = Date.now();
  if (_cache && _cache.refreshToken === refreshToken && _cache.expiresAt - 15_000 > now) {
    return _cache.accessToken;
  }
  const result = await refreshAccessTokenRaw(clientId, clientSecret, refreshToken);
  const nextRefreshToken = result.refreshToken || refreshToken;
  _cache = { accessToken: result.accessToken, expiresAt: now + result.expiresInS * 1000, refreshToken: nextRefreshToken };
  if (result.refreshToken && result.refreshToken !== refreshToken) {
    update((cfg: Record<string, unknown>) => {
      const providers = (cfg.providers ?? {}) as Record<string, unknown>;
      const sp = (providers.spotify ?? {}) as Record<string, unknown>;
      sp.refresh_token = result.refreshToken;
      providers.spotify = sp;
      cfg.providers = providers;
    });
  }
  return result.accessToken;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/** GET /me/player — null quando nada está tocando (204 sem corpo). */
export async function getPlaybackState(accessToken: string): Promise<Record<string, unknown> | null> {
  const data = await httpJson(`${SPOTIFY_API_BASE}/me/player`, { headers: bearer(accessToken), provider: "SPOTIFY" });
  if (data === null || typeof data !== "object" || Array.isArray(data) || Object.keys(data as object).length === 0) return null;
  return data as Record<string, unknown>;
}

export async function playbackPlay(accessToken: string): Promise<void> {
  await httpJson(`${SPOTIFY_API_BASE}/me/player/play`, { method: "PUT", headers: bearer(accessToken), provider: "SPOTIFY" });
}
export async function playbackPause(accessToken: string): Promise<void> {
  await httpJson(`${SPOTIFY_API_BASE}/me/player/pause`, { method: "PUT", headers: bearer(accessToken), provider: "SPOTIFY" });
}
export async function playbackNext(accessToken: string): Promise<void> {
  await httpJson(`${SPOTIFY_API_BASE}/me/player/next`, { method: "POST", headers: bearer(accessToken), provider: "SPOTIFY" });
}
export async function playbackPrevious(accessToken: string): Promise<void> {
  await httpJson(`${SPOTIFY_API_BASE}/me/player/previous`, { method: "POST", headers: bearer(accessToken), provider: "SPOTIFY" });
}

export type SpotifyNowPlaying = {
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

/** Escolhe a menor capa do Spotify que ainda cubra `minSize` px (a placa pede ~48). */
export function pickCoverUrl(images: unknown, minSize: number): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const parsed = images
    .map((img) => {
      const rec = img && typeof img === "object" ? (img as Record<string, unknown>) : {};
      const url = String(rec.url ?? "").trim();
      const w = Number(rec.width ?? 0);
      const h = Number(rec.height ?? 0);
      const known = Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0;
      const edge = known ? Math.min(w, h) : 9999;
      return { url, edge };
    })
    .filter((img) => img.url.startsWith("http://") || img.url.startsWith("https://"));
  if (!parsed.length) return null;
  const want = Number.isFinite(minSize) && minSize > 0 ? minSize : 48;
  const bigEnough = parsed.filter((img) => img.edge >= want);
  const pool = bigEnough.length ? bigEnough : parsed;
  pool.sort((a, b) => a.edge - b.edge);
  return pool[0]?.url ?? null;
}

export function albumImages(raw: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  const item = (raw.item ?? null) as Record<string, unknown> | null;
  const album = item ? ((item.album ?? null) as Record<string, unknown> | null) : null;
  const images = album?.images;
  return Array.isArray(images) ? (images as Array<Record<string, unknown>>) : [];
}

export function summarizePlayback(raw: Record<string, unknown> | null): SpotifyNowPlaying {
  if (!raw) {
    return { is_playing: false, progress_ms: null, device: null, shuffle: false, repeat: "off", track: null };
  }
  const item = (raw.item ?? null) as Record<string, unknown> | null;
  const album = item ? ((item.album ?? null) as Record<string, unknown> | null) : null;
  const images = albumImages(raw);
  const artists = (item?.artists ?? []) as Array<Record<string, unknown>>;
  const device = (raw.device ?? null) as Record<string, unknown> | null;
  const externalUrls = (item?.external_urls ?? null) as Record<string, unknown> | null;
  return {
    is_playing: Boolean(raw.is_playing),
    progress_ms: raw.progress_ms != null ? Number(raw.progress_ms) : null,
    device: device
      ? { name: String(device.name ?? ""), volume_percent: device.volume_percent != null ? Number(device.volume_percent) : null, type: String(device.type ?? "") }
      : null,
    shuffle: Boolean(raw.shuffle_state),
    repeat: String(raw.repeat_state ?? "off"),
    track: item
      ? {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        artists: artists.map((a) => String(a.name ?? "")).filter(Boolean).join(", "),
        album: String(album?.name ?? ""),
        duration_ms: item.duration_ms != null ? Number(item.duration_ms) : null,
        image_url: pickCoverUrl(images, 300) ?? (images[0] ? String(images[0].url ?? "") || null : null),
        external_url: externalUrls?.spotify ? String(externalUrls.spotify) : null,
      }
      : null,
  };
}

/** Lê client_id/client_secret/refresh_token salvos; null se falta algo. */
export function spotifyCreds(cfg: Record<string, unknown>): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const p = providerCfg(cfg, "spotify") as Record<string, unknown>;
  const clientId = String(p.client_id ?? "").trim();
  const clientSecret = String(p.client_secret ?? "").trim();
  const refreshToken = String(p.refresh_token ?? "").trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}
