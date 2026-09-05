/**
 * Provedor DeepSeek: API key + saldo da conta.
 * Port of backend-python-legacy/app/providers/deepseek.py
 */
import { httpJson } from "../httpClient.js";
import { provider as providerCfg } from "../store.js";

const DS_KEY_RE = /sk-[A-Za-z0-9]+/;
const INVISIBLE = ["\ufeff", "\u200b", "\u200c", "\u200d", "\xa0"];
export const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";

export function cleanDeepseekKey(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = [...text].filter((ch) => ch.charCodeAt(0) < 128).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text) return null;
  const match = DS_KEY_RE.exec(text);
  if (match) return match[0];
  if (text.includes(" ")) return null;
  return text || null;
}

function usdCents(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function deepseekFail(msg: string): Record<string, unknown> {
  return { ok: false, error: msg, percent: null, limit_cents: null, used_cents: null, remaining_cents: null };
}

export function parseDeepseekPayload(data: Record<string, unknown>): Record<string, unknown> {
  const infos = data.balance_infos;
  if (!Array.isArray(infos) || infos.length === 0) return deepseekFail("resposta DeepSeek sem balance_infos");
  let info: unknown = infos.find(
    (i) => typeof i === "object" && i !== null && (i as Record<string, unknown>).currency === "USD",
  );
  if (info === undefined) info = infos[0];
  if (info === null || typeof info !== "object" || Array.isArray(info)) return deepseekFail("resposta DeepSeek sem balance_infos");
  const infoDict = info as Record<string, unknown>;
  const remainingCents = usdCents(infoDict.total_balance);
  return { ok: true, error: null, percent: null, limit_cents: null, used_cents: null, remaining_cents: remainingCents };
}

export async function fetchDeepseekOne(rawKey: string): Promise<Record<string, unknown>> {
  const key = cleanDeepseekKey(rawKey ?? "");
  if (!key) return deepseekFail("API key inválida; cole só a chave sk-... no painel");
  let data: unknown;
  try {
    data = await httpJson(DEEPSEEK_BALANCE_URL, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      provider: "DEEPSEEK",
    });
  } catch (e) {
    return deepseekFail(String(e));
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return deepseekFail("resposta DeepSeek inesperada");
  return parseDeepseekPayload(data as Record<string, unknown>);
}

export async function fetchDeepseekAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "deepseek") as Record<string, unknown>;
  let accounts = Array.isArray(p.accounts) ? [...(p.accounts as unknown[])] : [];
  if (accounts.length === 0 && !p.hidden) {
    const legacy = String(p.paste_secret ?? "").trim();
    if (legacy) accounts = [{ id: "legacy", label: String(p.local_label ?? ""), secret: legacy }];
  }
  const out: Array<Record<string, unknown>> = [];
  for (const accRaw of accounts) {
    const acc = accRaw as Record<string, unknown>;
    const key = String(acc.secret ?? "").trim();
    const label = String(acc.label ?? "").trim();
    const aid = String(acc.id ?? "extra");
    const result = await fetchDeepseekOne(key);
    out.push({ id: aid, label, ...result });
  }
  return out;
}

export const clean_deepseek_key = cleanDeepseekKey;
export const deepseek_fail = deepseekFail;
export const parse_deepseek_payload = parseDeepseekPayload;
export const fetch_deepseek_one = fetchDeepseekOne;
export const fetch_deepseek_accounts = fetchDeepseekAccounts;
