/**
 * Provedor SPTrans — API Olho Vivo v2.1 (tempo real dos ônibus de São Paulo).
 *
 * Base: https://api.olhovivo.sptrans.com.br/v2.1
 * Auth: POST /Login/Autenticar?token={token} devolve `true` e seta cookie de
 * sessão — todos os GETs seguintes precisam reenviar esse cookie. O jar abaixo
 * é em memória (um por processo); em 401 reloga uma vez e repete a chamada.
 *
 * Um card = uma parada (ponto). Cada parada guarda as linhas monitoradas
 * (código `cl` por sentido). A previsão vem de GET /Previsao/Parada, que traz
 * por linha os veículos com `t` (HH:MM previsto) — daí sai o `mins`.
 *
 * Doc oficial:
 * https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/
 */

export const SPTRANS_BASE = (process.env.SPTRANS_BASE || "https://api.olhovivo.sptrans.com.br/v2.1").replace(/\/+$/, "");

// ---------- tipos ----------

export type SpTransStopSearch = {
  cp: number;
  np: string;
  ed: string;
  py: number;
  px: number;
};

export type SpTransLineSearch = {
  cl: number;
  lc: boolean;
  lt: string;
  sl: number;
  tl: number;
  tp: string;
  ts: string;
};

export type SpTransVehicleRaw = {
  p: string | number;
  t?: string | null;
  a?: boolean | null;
  ta?: string | null;
  py?: number | null;
  px?: number | null;
};

export type SpTransLineRaw = {
  c: string;
  cl: number;
  sl: number;
  lt0: string;
  lt1: string;
  qv: number;
  vs?: SpTransVehicleRaw[] | null;
};

export type SpTransPrevisaoRaw = {
  hr: string;
  p?: {
    cp: number;
    np: string;
    py?: number | null;
    px?: number | null;
    l?: SpTransLineRaw[] | null;
  } | null;
};

export type SpTransVehicle = {
  p: string;
  t: string | null;
  mins: number | null;
  a: boolean;
};

export type SpTransLineForecast = {
  c: string;
  cl: number;
  sl: number;
  lt0: string;
  lt1: string;
  qv: number;
  next: SpTransVehicle | null;
  vehicles: SpTransVehicle[];
};

export type SpTransPrevisao = {
  ok: boolean;
  error: string | null;
  updated_at: string | null;
  hr: string | null;
  cp: number;
  np: string | null;
  lines: SpTransLineForecast[];
};

// ---------- sessão (cookie jar em memória) ----------

let sessionCookie: string | null = null;
let sessionToken: string | null = null;

export function _resetSession(): void {
  sessionCookie = null;
  sessionToken = null;
}

function pickCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  // "apiCredentials=...; path=/; ..." -> "apiCredentials=..."
  const first = setCookie.split(",").map((s) => s.trim());
  const pairs: string[] = [];
  for (const part of first) {
    const kv = part.split(";")[0].trim();
    if (kv.includes("=") && !/^(path|expires|domain|max-age|secure|httponly|samesite)$/i.test(kv.split("=")[0].trim())) {
      pairs.push(kv);
    }
  }
  return pairs.length ? pairs.join("; ") : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutS: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1, timeoutS) * 1000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function authenticate(token: string): Promise<string> {
  const url = `${SPTRANS_BASE}/Login/Autenticar?token=${encodeURIComponent(token)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { method: "POST" }, 15);
  } catch (e) {
    throw new Error(`Falha ao autenticar no Olho Vivo: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new Error(`Autenticação no Olho Vivo falhou (HTTP ${res.status}) — confira o token`);
  const body = (await res.json().catch(() => null)) as unknown;
  if (body !== true) throw new Error("Token do Olho Vivo rejeitado (retornou false) — gere um novo em sptrans.com.br/desenvolvedores");
  const raw = res.headers.get("set-cookie");
  const cookie = pickCookie(raw);
  if (!cookie) throw new Error("Olho Vivo autenticou mas não devolveu cookie de sessão");
  sessionCookie = cookie;
  sessionToken = token;
  return cookie;
}

async function olhoGet(path: string, token: string): Promise<unknown> {
  if (!token.trim()) throw new Error("Token do Olho Vivo não configurado");
  const doGet = async (cookie: string): Promise<Response> => {
    const url = `${SPTRANS_BASE}${path}`;
    return fetchWithTimeout(url, { method: "GET", headers: { Cookie: cookie } }, 15);
  };
  try {
    const cookie = sessionToken === token && sessionCookie ? sessionCookie : await authenticate(token);
    let res = await doGet(cookie);
    if (res.status === 401 || res.status === 403) {
      const fresh = await authenticate(token);
      res = await doGet(fresh);
    }
    if (!res.ok) throw new Error(`Olho Vivo HTTP ${res.status} em ${path}`);
    return (await res.json().catch(() => null)) as unknown;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

// ---------- buscas ----------

export async function searchStops(query: string, token: string): Promise<SpTransStopSearch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const raw = await olhoGet(`/Parada/Buscar?termosBusca=${encodeURIComponent(q)}`, token);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
    .map((it) => ({
      cp: Number(it.cp),
      np: String(it.np ?? ""),
      ed: String(it.ed ?? ""),
      py: Number(it.py),
      px: Number(it.px),
    }))
    .filter((s) => Number.isFinite(s.cp) && s.np);
}

export async function searchLines(query: string, token: string): Promise<SpTransLineSearch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const raw = await olhoGet(`/Linha/Buscar?termosBusca=${encodeURIComponent(q)}`, token);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
    .map((it) => ({
      cl: Number(it.cl),
      lc: Boolean(it.lc),
      lt: String(it.lt ?? ""),
      sl: Number(it.sl),
      tl: Number(it.tl),
      tp: String(it.tp ?? ""),
      ts: String(it.ts ?? ""),
    }))
    .filter((l) => Number.isFinite(l.cl));
}

// ---------- previsão ----------

/** Minutos de agora (horário de SP) até `t` (HH:MM do Olho Vivo). Rola +24h. */
export function minutesUntil(t: string | null | undefined, now: Date = new Date()): number | null {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const nowSp = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [nh, nm] = nowSp.split(":").map(Number);
  if (!Number.isFinite(nh) || !Number.isFinite(nm)) return null;
  const target = hh * 60 + mm;
  const cur = nh * 60 + nm;
  return (target - cur + 1440) % 1440;
}

export function parsePrevisaoParada(raw: unknown, cp: number, monitored?: Set<number> | number[] | null): SpTransPrevisao {
  const now = new Date().toISOString();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Resposta inesperada do Olho Vivo", updated_at: now, hr: null, cp, np: null, lines: [] };
  }
  const dict = raw as Record<string, unknown>;
  const p = (dict.p ?? null) as Record<string, unknown> | null;
  const hr = typeof dict.hr === "string" ? dict.hr : null;
  if (!p || typeof p !== "object") {
    return { ok: true, error: null, updated_at: now, hr, cp, np: null, lines: [] };
  }
  const watch = monitored instanceof Set ? monitored : monitored ? new Set(monitored) : null;
  const rawLines = Array.isArray(p.l) ? (p.l as SpTransLineRaw[]) : [];
  const lines: SpTransLineForecast[] = [];
  for (const l of rawLines) {
    if (!l || typeof l !== "object") continue;
    const cl = Number((l as Record<string, unknown>).cl);
    if (!Number.isFinite(cl)) continue;
    if (watch && !watch.has(cl)) continue;
    const vs = Array.isArray(l.vs) ? l.vs : [];
    const vehicles: SpTransVehicle[] = vs.map((v) => {
      const t = typeof v.t === "string" ? v.t : null;
      return {
        p: String(v.p ?? ""),
        t,
        mins: minutesUntil(t),
        a: Boolean(v.a),
      };
    });
    vehicles.sort((a, b) => (a.mins ?? 1e9) - (b.mins ?? 1e9));
    lines.push({
      c: String(l.c ?? ""),
      cl,
      sl: Number(l.sl ?? 0),
      lt0: String(l.lt0 ?? ""),
      lt1: String(l.lt1 ?? ""),
      qv: Number(l.qv ?? vehicles.length),
      next: vehicles[0] ?? null,
      vehicles,
    });
  }
  lines.sort((a, b) => (a.next?.mins ?? 1e9) - (b.next?.mins ?? 1e9));
  return {
    ok: true,
    error: null,
    updated_at: now,
    hr,
    cp,
    np: typeof p.np === "string" ? p.np : null,
    lines,
  };
}

export async function fetchPrevisaoParada(cp: number, token: string, monitored?: number[] | null): Promise<SpTransPrevisao> {
  if (!Number.isFinite(cp)) throw new Error("código da parada inválido");
  const raw = await olhoGet(`/Previsao/Parada?codigoParada=${encodeURIComponent(String(cp))}`, token);
  return parsePrevisaoParada(raw, cp, monitored);
}

export function mockPrevisao(cp: number, monitored?: number[] | null): SpTransPrevisao {
  const now = new Date().toISOString();
  const cls = monitored?.length ? monitored : [34041];
  return {
    ok: true,
    error: null,
    updated_at: now,
    hr: "12:00",
    cp,
    np: "PARADA EXEMPLO (mock)",
    lines: cls.map((cl, i) => ({
      c: `8000-1${i}`,
      cl,
      sl: 1,
      lt0: "PCA.RAMOS DE AZEVEDO",
      lt1: "TERMINAL LAPA",
      qv: 1,
      next: { p: "12345", t: "12:15", mins: 15, a: true },
      vehicles: [{ p: "12345", t: "12:15", mins: 15, a: true }],
    })),
  };
}

// aliases snake_case (padrão do port)
export const minutes_until = minutesUntil;
export const parse_previsao_parada = parsePrevisaoParada;
export const fetch_previsao_parada = fetchPrevisaoParada;
export const search_stops = searchStops;
export const search_lines = searchLines;

// ---------- banco local de paradas (proximidade + endereço) ----------
// A API não tem "paradas próximas": então montamos o banco varrendo todos
// os corredores (BuscarParadasPorCorredor traz py/px de cada parada) e
// salvamos em backend/data/sptrans-stops.json. Daí sai o "arredores" por
// haversine e a busca por endereço (geocode -> nearby).

import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dataDir } from "../config.js";
import { httpJson } from "../httpClient.js";

export type SpTransCorridor = { cc: number; nc: string };

export type SpTransCachedStop = {
  cp: number;
  np: string;
  ed: string;
  py: number;
  px: number;
  cc: number;
};

export type SpTransStopCache = {
  updated_at: string;
  count: number;
  stops: SpTransCachedStop[];
};

export type SpTransNearbyStop = SpTransCachedStop & { distance_m: number };

export const STOP_CACHE_TTL_DAYS = 7;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// caixa de SP (capital + entorno) pra aceitar geocode
const SP_BBOX = { minLat: -24.2, maxLat: -22.5, minLng: -47.2, maxLng: -45.9 };

export function stopCachePath(): string {
  return join(dataDir(), "sptrans-stops.json");
}

export async function listCorridors(token: string): Promise<SpTransCorridor[]> {
  const raw = await olhoGet("/Corredor", token);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
    .map((it) => ({ cc: Number(it.cc), nc: String(it.nc ?? "") }))
    .filter((c) => Number.isFinite(c.cc));
}

export async function stopsByCorridor(cc: number, token: string): Promise<SpTransCachedStop[]> {
  const raw = await olhoGet(`/Parada/BuscarParadasPorCorredor?codigoCorredor=${encodeURIComponent(String(cc))}`, token);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
    .map((it) => ({
      cp: Number(it.cp),
      np: String(it.np ?? ""),
      ed: String(it.ed ?? ""),
      py: Number(it.py),
      px: Number(it.px),
      cc,
    }))
    .filter((s) => Number.isFinite(s.cp) && s.np && Number.isFinite(s.py) && Number.isFinite(s.px));
}

export function loadStopCache(): SpTransStopCache | null {
  try {
    const p = stopCachePath();
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf-8")) as SpTransStopCache;
    if (!raw || !Array.isArray(raw.stops)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function stopCacheAgeDays(cache: SpTransStopCache | null): number | null {
  if (!cache?.updated_at) return null;
  const ms = Date.now() - new Date(cache.updated_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 86400000;
}

export async function refreshStopCache(token: string): Promise<SpTransStopCache> {
  const corridors = await listCorridors(token);
  const byCp = new Map<number, SpTransCachedStop>();
  for (const c of corridors) {
    const stops = await stopsByCorridor(c.cc, token).catch(() => [] as SpTransCachedStop[]);
    for (const s of stops) {
      if (!byCp.has(s.cp)) byCp.set(s.cp, s);
    }
  }
  const cache: SpTransStopCache = {
    updated_at: new Date().toISOString(),
    count: byCp.size,
    stops: [...byCp.values()],
  };
  mkdirSync(dataDir(), { recursive: true });
  const p = stopCachePath();
  writeFileSync(p + ".tmp", JSON.stringify(cache), "utf-8");
  renameSync(p + ".tmp", p);
  return cache;
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function findNearby(
  lat: number,
  lng: number,
  limit = 10,
  stops?: SpTransCachedStop[] | null,
): SpTransNearbyStop[] {
  const list = stops ?? loadStopCache()?.stops ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !list.length) return [];
  const safeLimit = Math.max(1, Math.min(30, Math.trunc(limit) || 10));
  return list
    .map((s) => ({ ...s, distance_m: Math.round(haversineM(lat, lng, s.py, s.px)) }))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, safeLimit);
}

let lastGeocodeAt = 0;

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  // política de uso do Nominatim: máx 1 req/s + User-Agent identificando o app
  const wait = 1100 - (Date.now() - lastGeocodeAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
  const params = new URLSearchParams({
    format: "jsonv2",
    q: `${q}, São Paulo, Brasil`,
    countrycodes: "br",
    limit: "1",
    viewboxl: "-46.85",
    viewboxt: "-23.35",
    viewboxr: "-46.35",
    viewboxb: "-23.75",
  });
  let data: unknown;
  try {
    data = await httpJson(`${NOMINATIM_URL}?${params.toString()}`, {
      timeout: 12,
      provider: "SPTRANS",
      headers: { "User-Agent": "VigiaAI/2 (painel local; contato via repo)" },
    });
  } catch {
    return null;
  }
  if (!Array.isArray(data) || !data.length) return null;
  const first = data[0] as Record<string, unknown>;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < SP_BBOX.minLat || lat > SP_BBOX.maxLat || lng < SP_BBOX.minLng || lng > SP_BBOX.maxLng) return null;
  return { lat, lng, label: String(first.display_name ?? q).split(",").slice(0, 2).join(",") };
}

export type StopSearchHit = SpTransStopSearch & { source: "near" | "api"; distance_m: number | null };

/** Busca combinada: endereço (geocode -> arredores) primeiro, depois a busca
 * fonética da API, sem duplicar `cp`. Se o banco local ainda não existe,
 * cai pra busca da API pura. */
export async function searchStopsCombined(query: string, token: string): Promise<{ hits: StopSearchHit[]; geo: { lat: number; lng: number; label: string } | null }> {
  const [apiHits, geo] = await Promise.all([
    searchStops(query, token).catch(() => [] as SpTransStopSearch[]),
    geocodeAddress(query).catch(() => null),
  ]);
  const hits: StopSearchHit[] = [];
  const seen = new Set<number>();
  if (geo) {
    for (const n of findNearby(geo.lat, geo.lng, 8)) {
      if (seen.has(n.cp)) continue;
      seen.add(n.cp);
      hits.push({ cp: n.cp, np: n.np, ed: n.ed, py: n.py, px: n.px, source: "near", distance_m: n.distance_m });
    }
  }
  for (const s of apiHits) {
    if (seen.has(s.cp)) continue;
    seen.add(s.cp);
    hits.push({ ...s, source: "api", distance_m: null });
  }
  return { hits, geo };
}

export type IpGeo = { lat: number; lng: number; city: string | null };

/** Localização aproximada pelo IP (fallback quando o GPS do aparelho não
 * responde — caso do Electron, cujo Chromium não tem provider de
 * geolocalização). Grátis, sem chave (ip-api.com, volume baixíssimo). */
export async function geolocateByIp(): Promise<IpGeo> {
  const data = (await httpJson("http://ip-api.com/json/?fields=status,message,lat,lon,city", {
    timeout: 10,
    provider: "SPTRANS",
  })) as Record<string, unknown>;
  if (data?.status !== "success") {
    throw new Error(typeof data?.message === "string" && data.message ? `Geolocalização por IP falhou: ${data.message}` : "Geolocalização por IP falhou");
  }
  const lat = Number(data.lat);
  const lng = Number(data.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Geolocalização por IP devolveu coordenada inválida");
  return { lat, lng, city: typeof data.city === "string" ? data.city : null };
}
