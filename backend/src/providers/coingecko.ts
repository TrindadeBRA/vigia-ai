/**
 * Cliente compartilhado do CoinGecko /simple/price.
 * Port of backend-python-legacy/app/providers/coingecko.py
 */
import { httpJson, HttpError, isRateLimit } from "../httpClient.js";

export const SIMPLE_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
export const TTL_S = 300;
const MIN_BACKOFF_S = 120.0;

type CacheEntry = { at: number; payload: Record<string, unknown> };

const cache = new Map<string, CacheEntry>();
let backoffUntil = 0; // epoch ms via Date.now()
let inflightPromise: Promise<Record<string, unknown>> | null = null;
let inflightKey: string | null = null;

export function reset(): void {
  cache.clear();
  inflightPromise = null;
  inflightKey = null;
  backoffUntil = 0;
}

function query(ids: string[], vs: string[]): string | null {
  const cleanIds = [...new Set(ids.map((i) => String(i).trim().toLowerCase()).filter(Boolean))].sort();
  const cleanVs = [...new Set(vs.map((v) => String(v).trim().toLowerCase()).filter(Boolean))].sort();
  if (cleanIds.length === 0 || cleanVs.length === 0) return null;
  return new URLSearchParams({ ids: cleanIds.join(","), vs_currencies: cleanVs.join(",") }).toString();
}

export async function fetchSimplePrice(
  ids: string[],
  vsCurrencies: string[],
  provider = "CRYPTO",
): Promise<Record<string, unknown>> {
  const qs = query(ids, vsCurrencies);
  if (!qs) return {};

  const now = Date.now();
  const entry = cache.get(qs);
  if (entry && (now - entry.at) / 1000 < TTL_S) return entry.payload;
  if (now < backoffUntil && entry) return entry.payload;

  // coalescence: if already inflight for same qs, await it
  if (inflightPromise && inflightKey === qs) {
    try {
      const data = await inflightPromise;
      return data;
    } catch {
      // fall through to retry (if last-good available will be returned below via 429 handling)
      // but for coalescence we need to attempt new fetch if inflight failed without stale
      // For simplicity, continue to start new fetch after catch
    }
  }
  // if any inflight for different key, we still serialize per key? Python uses global _inflight lock.
  // To mimic, if any inflight exists, wait for it then re-check cache.
  if (inflightPromise) {
    try {
      await inflightPromise;
    } catch {}
    const after = cache.get(qs);
    const now2 = Date.now();
    if (after && (now2 - after.at) / 1000 < TTL_S) return after.payload;
    if (now2 < backoffUntil && after) return after.payload;
  }

  const stale = entry ? entry.payload : null;

  const url = `${SIMPLE_PRICE_URL}?${qs}`;

  const promise = (async () => {
    const data = await httpJson(url, { timeout: 15.0, provider });
    if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("resposta inesperada da cotação");
    cache.set(qs, { at: Date.now(), payload: data as Record<string, unknown> });
    backoffUntil = 0;
    return data as Record<string, unknown>;
  })();

  inflightPromise = promise as Promise<Record<string, unknown>>;
  inflightKey = qs;

  try {
    const result = await promise;
    return result;
  } catch (exc) {
    if (isRateLimit(exc) && stale !== null) {
      let wait = MIN_BACKOFF_S;
      if (exc instanceof HttpError && exc.retryAfterS !== null) {
        wait = Math.max(wait, exc.retryAfterS);
      }
      backoffUntil = Date.now() + wait * 1000;
      return stale;
    }
    throw exc;
  } finally {
    if (inflightPromise === promise) {
      inflightPromise = null;
      inflightKey = null;
    }
  }
}

export const fetch_simple_price = fetchSimplePrice;
