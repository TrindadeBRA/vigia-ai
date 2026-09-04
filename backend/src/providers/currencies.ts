/**
 * Cotação de moedas: lista livre do usuário, fiat (câmbio) + cripto (CoinGecko).
 * Port of backend-python-legacy/app/providers/currencies.py
 */
import { httpJson } from "../httpClient.js";
import { utcNow } from "../formatting.js";
import { fetchSimplePrice } from "./coingecko.js";

const FIAT_RE = /^[A-Za-z]{3}$/;
const CRYPTO_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const COINGECKO_SEARCH_URL = "https://api.coingecko.com/api/v3/search";
export const FOREX_URL = "https://open.er-api.com/v6/latest/";

export const FOREX_TTL_S = 3600;

const forexCache = new Map<string, { at: number; payload: Record<string, unknown> }>();

export function resetForexCache(): void {
  forexCache.clear();
}

export function cleanFiatCode(raw: string): string | null {
  const text = raw.trim().toUpperCase();
  return FIAT_RE.test(text) ? text : null;
}

export function cleanCryptoCode(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  return CRYPTO_RE.test(text) ? text : null;
}

export async function searchCrypto(query: string, count = 8): Promise<Array<Record<string, unknown>>> {
  query = query.trim();
  if (query.length < 2) return [];
  count = Math.max(1, Math.min(15, count));
  const qs = new URLSearchParams({ query }).toString();
  let data: unknown;
  try {
    data = await httpJson(`${COINGECKO_SEARCH_URL}?${qs}`, { timeout: 10.0, provider: "CURRENCIES" });
  } catch {
    return [];
  }
  const coins = data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>).coins : null;
  if (!Array.isArray(coins)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const c of coins.slice(0, count)) {
    if (c === null || typeof c !== "object" || Array.isArray(c) || !(c as Record<string, unknown>).id) continue;
    const dict = c as Record<string, unknown>;
    out.push({ id: String(dict.id), symbol: String(dict.symbol ?? "").toUpperCase(), name: String(dict.name ?? "") });
  }
  return out;
}

async function fetchForexRates(base: string): Promise<Record<string, unknown>> {
  const key = base.toUpperCase();
  const now = Date.now();
  const hit = forexCache.get(key);
  if (hit && (now - hit.at) / 1000 < FOREX_TTL_S) return hit.payload;
  const stale = hit ? hit.payload : null;
  try {
    const data = await httpJson(`${FOREX_URL}${encodeURIComponent(key)}`, { timeout: 15.0, provider: "CURRENCIES" });
    if (
      data === null ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      (data as Record<string, unknown>).result !== "success" ||
      typeof (data as Record<string, unknown>).rates !== "object" ||
      Array.isArray((data as Record<string, unknown>).rates)
    ) {
      throw new Error("resposta inesperada da API de câmbio");
    }
    const rates = (data as Record<string, unknown>).rates as Record<string, unknown>;
    forexCache.set(key, { at: Date.now(), payload: rates });
    return rates;
  } catch (e) {
    if (stale !== null) return stale;
    throw e;
  }
}

function quoteItem(
  item: Record<string, unknown>,
  cryptoPrices: Record<string, unknown>,
  fiatRates: Record<string, unknown> | null,
  fiatError: string | null,
  cryptoError: string | null,
  base: string,
): Record<string, unknown> {
  const kind = item.kind;
  const code = String(item.code ?? "");
  const out: Record<string, unknown> = {
    id: String(item.id ?? ""),
    kind,
    code,
    label: String(item.label ?? ""),
    price: null,
    ok: false,
    error: null,
  };
  if (kind === "crypto") {
    if (cryptoError) {
      out.error = cryptoError;
      return out;
    }
    const entry = cryptoPrices[code];
    const price = entry !== null && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>)[base.toLowerCase()] : null;
    if (price === null || price === undefined) {
      out.error = "cotação não encontrada";
      return out;
    }
    out.price = Number(price);
    out.ok = true;
    return out;
  }
  // fiat: invert rate (1/rate)
  if (code.toUpperCase() === base.toUpperCase()) {
    out.price = 1.0;
    out.ok = true;
    return out;
  }
  if (fiatError) {
    out.error = fiatError;
    return out;
  }
  const rate = (fiatRates ?? {})[code.toUpperCase()];
  if (!rate) {
    out.error = "cotação não encontrada";
    return out;
  }
  try {
    out.price = 1.0 / Number(rate);
    out.ok = true;
  } catch {
    out.error = "cotação inválida";
  }
  // also handle ZeroDivision if rate is 0 -> Infinity
  if (typeof out.price === "number" && !Number.isFinite(out.price)) {
    out.error = "cotação inválida";
    out.price = null;
    out.ok = false;
  }
  return out;
}

export async function fetchCurrencyQuotes(cfgCurrencies: Record<string, unknown>): Promise<Record<string, unknown>> {
  const base = String(cfgCurrencies.base ?? "BRL").trim().toUpperCase() || "BRL";
  const items = Array.isArray(cfgCurrencies.items) ? [...(cfgCurrencies.items as unknown[])] : [];
  if (items.length === 0) return { ok: true, error: null, updated_at: utcNow(), base, items: [] };

  const cryptoCodes = [...new Set(
    (items as Record<string, unknown>[]).filter((i) => i.kind === "crypto" && i.code).map((i) => String(i.code)),
  )].sort();
  const needFiat = (items as Record<string, unknown>[]).some(
    (i) => i.kind === "fiat" && String(i.code ?? "").toUpperCase() !== base,
  );

  let cryptoPrices: Record<string, unknown> = {};
  let cryptoError: string | null = null;
  if (cryptoCodes.length > 0) {
    try {
      cryptoPrices = await fetchSimplePrice(cryptoCodes, [base.toLowerCase()], "CURRENCIES");
    } catch (e) {
      cryptoError = String(e);
    }
  }

  let fiatRates: Record<string, unknown> | null = null;
  let fiatError: string | null = null;
  if (needFiat) {
    try {
      fiatRates = await fetchForexRates(base);
    } catch (e) {
      fiatError = String(e);
    }
  }

  const quoted = (items as Record<string, unknown>[]).map((i) =>
    quoteItem(i, cryptoPrices, fiatRates, fiatError, cryptoError, base),
  );
  return { ok: true, error: null, updated_at: utcNow(), base, items: quoted };
}

export function mockCurrenciesPayload(): Record<string, unknown> {
  const now = utcNow();
  return {
    ok: true,
    error: null,
    updated_at: now,
    base: "BRL",
    items: [
      { id: "usd", kind: "fiat", code: "USD", label: "Dólar", price: 5.42, ok: true, error: null },
      { id: "eur", kind: "fiat", code: "EUR", label: "Euro", price: 5.9, ok: true, error: null },
      { id: "eth", kind: "crypto", code: "ethereum", label: "Ethereum", price: 18500.3, ok: true, error: null },
    ],
  };
}

export const reset_forex_cache = resetForexCache;
export const clean_fiat_code = cleanFiatCode;
export const clean_crypto_code = cleanCryptoCode;
export const search_crypto = searchCrypto;
export const fetch_currency_quotes = fetchCurrencyQuotes;
export const mock_currencies_payload = mockCurrenciesPayload;
