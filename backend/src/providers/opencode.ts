/**
 * Provedor OpenCode: API key única + assinatura (Go) e saldo (Zen).
 * Port of backend-python-legacy/app/providers/opencode.py
 */
import { asPercentPoints, isoOrNone } from "../formatting.js";
import { httpJson } from "../httpClient.js";
import { opencodeTokenCandidates } from "../local/opencodeAuth.js";
import { provider as providerCfg } from "../store.js";

const OC_KEY_RE = /sk-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/;
const INVISIBLE = ["\ufeff", "\u200b", "\u200c", "\u200d", "\xa0"];
export const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
export const OPENCODE_ZEN_BALANCE_URL = "https://opencode.ai/zen/v1/usage";
export const OPENCODE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function cleanOpencodeKey(raw: string): string | null {
  let text = raw.trim();
  for (const ch of INVISIBLE) text = text.split(ch).join("");
  text = [...text].filter((ch) => ch.charCodeAt(0) < 128).join("");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  if (!text) return null;
  const match = OC_KEY_RE.exec(text);
  if (match) return match[0];
  return null;
}

function usdCents(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function opencodeFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    rolling_percent: null,
    rolling_resets_at: null,
    weekly_percent: null,
    weekly_resets_at: null,
    monthly_percent: null,
    monthly_resets_at: null,
    percent: null,
    limit_cents: null,
    used_cents: null,
    remaining_cents: null,
  };
}

function parseGo(data: Record<string, unknown>): Record<string, unknown> {
  const usage = data.usage;
  if (usage === null || typeof usage !== "object" || Array.isArray(usage)) return {};
  const usageDict = usage as Record<string, unknown>;

  function win(name: string): [number | null, string | null] {
    const obj = usageDict[name];
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [null, null];
    const d = obj as Record<string, unknown>;
    return [asPercentPoints(d.percent), isoOrNone(d.resetsAt)];
  }

  const [rollingPct, rollingReset] = win("rolling");
  const [weeklyPct, weeklyReset] = win("weekly");
  const [monthlyPct, monthlyReset] = win("monthly");
  return {
    rolling_percent: rollingPct,
    rolling_resets_at: rollingReset,
    weekly_percent: weeklyPct,
    weekly_resets_at: weeklyReset,
    monthly_percent: monthlyPct,
    monthly_resets_at: monthlyReset,
  };
}

function parseZen(data: Record<string, unknown>): Record<string, unknown> {
  const infoRaw = data.data !== null && typeof data.data === "object" && !Array.isArray(data.data) ? data.data : data;
  const info = infoRaw as Record<string, unknown>;
  let remainingCents = usdCents(info.remaining_cents);
  if (remainingCents === null) remainingCents = usdCents(info.balance);
  return { remaining_cents: remainingCents };
}

export function parseOpencodePayload(data: Record<string, unknown>): Record<string, unknown> {
  const go = parseGo(data);
  const zen = parseZen(data);
  const hasGo = Object.values(go).some((v) => v !== null && v !== undefined);
  const hasZen = zen.remaining_cents !== null && zen.remaining_cents !== undefined;
  if (!hasGo && !hasZen) return opencodeFail("resposta OpenCode sem janelas de cota nem saldo");
  return {
    ok: true,
    error: null,
    ...go,
    percent: null,
    limit_cents: null,
    used_cents: null,
    remaining_cents: zen.remaining_cents,
  };
}

export async function fetchOpencodeOne(rawKey: string): Promise<Record<string, unknown>> {
  const key = cleanOpencodeKey(rawKey ?? "");
  if (!key) return opencodeFail("API key inválida; cole só a chave sk-... no painel");
  const combined: Record<string, unknown> = {};
  for (const url of [OPENCODE_GO_USAGE_URL, OPENCODE_ZEN_BALANCE_URL]) {
    try {
      const data = await httpJson(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "User-Agent": OPENCODE_USER_AGENT },
        provider: "OPENCODE",
      });
      if (data !== null && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        Object.assign(combined, parseGo(d));
        Object.assign(combined, parseZen(d));
      }
    } catch (e) {
      combined.error = String(e);
      continue;
    }
  }
  if (!Object.values(combined).some((v) => v !== null && v !== undefined)) {
    return opencodeFail(String(combined.error ?? "resposta OpenCode inesperada"));
  }
  return {
    ok: true,
    error: null,
    rolling_percent: combined.rolling_percent ?? null,
    rolling_resets_at: combined.rolling_resets_at ?? null,
    weekly_percent: combined.weekly_percent ?? null,
    weekly_resets_at: combined.weekly_resets_at ?? null,
    monthly_percent: combined.monthly_percent ?? null,
    monthly_resets_at: combined.monthly_resets_at ?? null,
    percent: null,
    limit_cents: null,
    used_cents: null,
    remaining_cents: combined.remaining_cents ?? null,
  };
}

async function fetchOpencodeLocal(cands: Array<[string, string]>): Promise<Record<string, unknown>> {
  let lastErr = "sem key OpenCode";
  for (const [, key] of cands) {
    const result = await fetchOpencodeOne(key);
    if (result.ok) return result;
    lastErr = String(result.error ?? lastErr);
  }
  return opencodeFail(lastErr);
}

export async function fetchOpencodeAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "opencode") as Record<string, unknown>;
  if (p.hidden) return [];

  const accounts: Array<Record<string, unknown>> = [];
  const seenKeys = new Set<string>();

  const localCands = opencodeTokenCandidates(cfg);
  if (localCands.length > 0) {
    const result = await fetchOpencodeLocal(localCands);
    accounts.push({ id: "local", label: String(p.local_label ?? ""), ...result });
    for (const [, key] of localCands) {
      const cleaned = cleanOpencodeKey(key);
      if (cleaned) seenKeys.add(cleaned);
    }
  }

  let extra = Array.isArray(p.accounts) ? [...(p.accounts as unknown[])] : [];
  if (extra.length === 0 && accounts.length === 0) {
    const legacy = String(p.paste_secret ?? "").trim();
    if (legacy) extra = [{ id: "legacy", label: String(p.local_label ?? ""), secret: legacy }];
  }
  for (const accRaw of extra) {
    const acc = accRaw as Record<string, unknown>;
    const key = String(acc.secret ?? "").trim();
    const cleaned = cleanOpencodeKey(key);
    if (cleaned && seenKeys.has(cleaned)) continue;
    if (cleaned) seenKeys.add(cleaned);
    const label = String(acc.label ?? "").trim();
    const aid = String(acc.id ?? "extra");
    const result = await fetchOpencodeOne(key);
    accounts.push({ id: aid, label, ...result });
  }
  return accounts;
}

export const clean_opencode_key = cleanOpencodeKey;
export const opencode_fail = opencodeFail;
export const parse_opencode_payload = parseOpencodePayload;
export const fetch_opencode_one = fetchOpencodeOne;
export const fetch_opencode_accounts = fetchOpencodeAccounts;
