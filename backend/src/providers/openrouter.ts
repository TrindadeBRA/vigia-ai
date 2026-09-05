/**
 * Provedor OpenRouter: API key + saldo de créditos da conta.
 * Port of backend-python-legacy/app/providers/openrouter.py
 */
import { httpJson } from "../httpClient.js";
import { ratioPercent } from "../formatting.js";
import { provider as providerCfg } from "../store.js";

const OR_KEY_RE = /sk-or-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/;
// preserve exact invisible chars: \ufeff, \u200b, \u200c, \u200d, \xa0
const INVISIBLE = ["\ufeff", "\u200b", "\u200c", "\u200d", "\xa0"];
export const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

export function cleanOpenrouterKey(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = [...text].filter((ch) => ch.charCodeAt(0) < 128).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text) return null;
  const match = OR_KEY_RE.exec(text);
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

export function openrouterFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    percent: null,
    limit_cents: null,
    used_cents: null,
    remaining_cents: null,
  };
}

export function parseOpenrouterPayload(data: Record<string, unknown>): Record<string, unknown> {
  const info = data.data;
  if (info === null || typeof info !== "object" || Array.isArray(info)) {
    return openrouterFail("resposta OpenRouter sem campo data");
  }
  const infoDict = info as Record<string, unknown>;
  const limitCents = usdCents(infoDict.total_credits);
  const usedCents = usdCents(infoDict.total_usage) ?? 0;
  let remainingCents: number | null = null;
  let percent: number | null = null;
  if (limitCents !== null) {
    remainingCents = Math.max(0, limitCents - usedCents);
    if (limitCents > 0) percent = ratioPercent(usedCents, limitCents);
  }
  return {
    ok: true,
    error: null,
    percent,
    limit_cents: limitCents,
    used_cents: usedCents,
    remaining_cents: remainingCents,
  };
}

export async function fetchOpenrouterOne(rawKey: string): Promise<Record<string, unknown>> {
  const key = cleanOpenrouterKey(rawKey ?? "");
  if (!key) return openrouterFail("API key inválida; cole só a chave sk-or- no painel");
  let data: unknown;
  try {
    data = await httpJson(OPENROUTER_CREDITS_URL, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      provider: "OPENROUTER",
    });
  } catch (e) {
    return openrouterFail(String(e));
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return openrouterFail("resposta OpenRouter inesperada");
  }
  return parseOpenrouterPayload(data as Record<string, unknown>);
}

export async function fetchOpenrouterAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "openrouter") as Record<string, unknown>;
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
    const result = await fetchOpenrouterOne(key);
    out.push({ id: aid, label, ...result });
  }
  return out;
}

export const clean_openrouter_key = cleanOpenrouterKey;
export const openrouter_fail = openrouterFail;
export const parse_openrouter_payload = parseOpenrouterPayload;
export const fetch_openrouter_one = fetchOpenrouterOne;
export const fetch_openrouter_accounts = fetchOpenrouterAccounts;
