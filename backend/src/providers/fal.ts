/**
 * Provedor fal.ai: API key + saldo de créditos da conta.
 * Port of backend-python-legacy/app/providers/fal.py
 */
import { httpJson } from "../httpClient.js";
import { provider as providerCfg } from "../store.js";

const FAL_KEY_RE = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*:[A-Za-z0-9]+/;
const INVISIBLE = ["\ufeff", "\u200b", "\u200c", "\u200d", "\xa0"];
export const FAL_BILLING_URL = "https://api.fal.ai/v1/account/billing?expand=credits";

export function cleanFalKey(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = [...text].filter((ch) => ch.charCodeAt(0) < 128).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text) return null;
  const match = FAL_KEY_RE.exec(text);
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

export function falFail(msg: string): Record<string, unknown> {
  return { ok: false, error: msg, percent: null, limit_cents: null, used_cents: null, remaining_cents: null };
}

export function parseFalPayload(data: Record<string, unknown>): Record<string, unknown> {
  const credits = data.credits;
  if (credits === null || typeof credits !== "object" || Array.isArray(credits)) return falFail("resposta fal.ai sem credits");
  const c = credits as Record<string, unknown>;
  const remainingCents = usdCents(c.current_balance);
  if (remainingCents === null) return falFail("resposta fal.ai sem current_balance");
  return { ok: true, error: null, percent: null, limit_cents: null, used_cents: null, remaining_cents: remainingCents };
}

export async function fetchFalOne(rawKey: string): Promise<Record<string, unknown>> {
  const key = cleanFalKey(rawKey ?? "");
  if (!key) return falFail("API key inválida; cole a chave admin (id:secret) no painel");
  let data: unknown;
  try {
    data = await httpJson(FAL_BILLING_URL, {
      headers: { Authorization: `Key ${key}`, Accept: "application/json" },
      provider: "FAL",
    });
  } catch (e) {
    return falFail(String(e));
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return falFail("resposta fal.ai inesperada");
  return parseFalPayload(data as Record<string, unknown>);
}

export async function fetchFalAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "fal") as Record<string, unknown>;
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
    const result = await fetchFalOne(key);
    out.push({ id: aid, label, ...result });
  }
  return out;
}

export const clean_fal_key = cleanFalKey;
export const fal_fail = falFail;
export const parse_fal_payload = parseFalPayload;
export const fetch_fal_one = fetchFalOne;
export const fetch_fal_accounts = fetchFalAccounts;
