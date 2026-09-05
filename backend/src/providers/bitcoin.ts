/**
 * Provedor Bitcoin: endereço de carteira + saldo on-chain + cotação.
 * Port of backend-python-legacy/app/providers/bitcoin.py
 */
import { httpJson } from "../httpClient.js";
import { fetchSimplePrice } from "./coingecko.js";
import { provider as providerCfg } from "../store.js";

const ADDRESS_RE = /^(1[1-9A-HJ-NP-Za-km-z]{25,34}|3[1-9A-HJ-NP-Za-km-z]{25,34}|bc1[ac-hj-np-z02-9]{6,87})$/;
const INVISIBLE = ["\ufeff", "\u200b", "\u200c", "\u200d", "\xa0"];
export const BLOCKSTREAM_ADDRESS_URL = "https://blockstream.info/api/address/";
export const SATS_PER_BTC = 100_000_000;

export function cleanBitcoinAddress(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = [...text].filter((ch) => ch.charCodeAt(0) < 128).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text || text.includes(" ")) return null;
  if (!ADDRESS_RE.test(text)) return null;
  return text;
}

function cents(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function bitcoinFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    address: null,
    balance_btc: null,
    price_usd_cents: null,
    price_brl_cents: null,
    value_usd_cents: null,
    value_brl_cents: null,
  };
}

async function fetchBalanceSat(address: string): Promise<number> {
  const url = BLOCKSTREAM_ADDRESS_URL + encodeURIComponent(address);
  const data = await httpJson(url, { timeout: 15.0, provider: "BTC" });
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("resposta inesperada do explorador de blocos");
  const d = data as Record<string, unknown>;
  const chain = (d.chain_stats !== null && typeof d.chain_stats === "object" ? d.chain_stats : {}) as Record<string, unknown>;
  const mempool = (d.mempool_stats !== null && typeof d.mempool_stats === "object" ? d.mempool_stats : {}) as Record<string, unknown>;
  const funded = Number(chain.funded_txo_sum ?? 0) + Number(mempool.funded_txo_sum ?? 0);
  const spent = Number(chain.spent_txo_sum ?? 0) + Number(mempool.spent_txo_sum ?? 0);
  return Math.trunc(funded) - Math.trunc(spent);
}

async function fetchBtcPrice(): Promise<[number | null, number | null]> {
  const data = await fetchSimplePrice(["bitcoin"], ["usd", "brl"], "BTC");
  const btc = (data.bitcoin !== null && typeof data.bitcoin === "object" ? data.bitcoin : {}) as Record<string, unknown>;
  return [cents(btc.usd), cents(btc.brl)];
}

function accountFromBalance(
  address: string,
  balanceSat: number,
  priceUsdCents: number | null,
  priceBrlCents: number | null,
): Record<string, unknown> {
  const balanceBtc = balanceSat / SATS_PER_BTC;
  const valueUsdCents = priceUsdCents !== null ? Math.round(balanceBtc * priceUsdCents) : null;
  const valueBrlCents = priceBrlCents !== null ? Math.round(balanceBtc * priceBrlCents) : null;
  return {
    ok: true,
    error: null,
    address,
    balance_btc: balanceBtc,
    price_usd_cents: priceUsdCents,
    price_brl_cents: priceBrlCents,
    value_usd_cents: valueUsdCents,
    value_brl_cents: valueBrlCents,
  };
}

export async function fetchBitcoinOne(rawAddress: string): Promise<Record<string, unknown>> {
  const address = cleanBitcoinAddress(rawAddress ?? "");
  if (!address) return bitcoinFail("Endereço Bitcoin inválido; cole o endereço público da carteira");
  let balanceSat: number;
  try {
    balanceSat = await fetchBalanceSat(address);
  } catch (e) {
    return bitcoinFail(String(e));
  }
  let priceUsdCents: number | null, priceBrlCents: number | null;
  try {
    [priceUsdCents, priceBrlCents] = await fetchBtcPrice();
  } catch (e) {
    return bitcoinFail(String(e));
  }
  return accountFromBalance(address, balanceSat, priceUsdCents, priceBrlCents);
}

export async function fetchBitcoinAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "bitcoin") as Record<string, unknown>;
  const accounts = Array.isArray(p.accounts) ? [...(p.accounts as unknown[])] : [];
  let rawAccounts = [...accounts];
  if (rawAccounts.length === 0 && !p.hidden) {
    const legacy = String(p.paste_secret ?? "").trim();
    if (legacy) rawAccounts = [{ id: "legacy", label: String(p.local_label ?? ""), secret: legacy }];
  }

  const cleanedAccounts: Array<[string, string, string | null]> = [];
  let needPrice = false;
  for (const accRaw of rawAccounts) {
    const acc = accRaw as Record<string, unknown>;
    const address = String(acc.secret ?? "").trim();
    const label = String(acc.label ?? "").trim();
    const aid = String(acc.id ?? "extra");
    const cleaned = cleanBitcoinAddress(address);
    if (cleaned) needPrice = true;
    cleanedAccounts.push([aid, label, cleaned]);
  }

  let priceUsdCents: number | null = null;
  let priceBrlCents: number | null = null;
  let priceError: string | null = null;
  if (needPrice) {
    try {
      [priceUsdCents, priceBrlCents] = await fetchBtcPrice();
    } catch (e) {
      priceError = String(e);
    }
  }

  const out: Array<Record<string, unknown>> = [];
  for (const [aid, label, address] of cleanedAccounts) {
    if (!address) {
      out.push({ id: aid, label, ...bitcoinFail("Endereço Bitcoin inválido; cole o endereço público da carteira") });
      continue;
    }
    if (priceError) {
      out.push({ id: aid, label, ...bitcoinFail(priceError) });
      continue;
    }
    let balanceSat: number;
    try {
      balanceSat = await fetchBalanceSat(address);
    } catch (e) {
      out.push({ id: aid, label, ...bitcoinFail(String(e)) });
      continue;
    }
    out.push({ id: aid, label, ...accountFromBalance(address, balanceSat, priceUsdCents, priceBrlCents) });
  }
  return out;
}

export const clean_bitcoin_address = cleanBitcoinAddress;
export const bitcoin_fail = bitcoinFail;
export const fetch_bitcoin_one = fetchBitcoinOne;
export const fetch_bitcoin_accounts = fetchBitcoinAccounts;
