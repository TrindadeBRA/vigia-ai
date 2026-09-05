/**
 * Provedor GPT: OAuth do Codex CLI (ChatGPT) + contas extras coladas no painel.
 * Port of backend-python-legacy/app/providers/gpt.py
 */
import { isoOrNone, pick } from "../formatting.js";
import { httpJson } from "../httpClient.js";
import { gptTokenCandidates, gptTokenExpired } from "../local/gptOauth.js";
import { provider as providerCfg } from "../store.js";

export const GPT_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export const GPT_USER_AGENT = "codex-cli";
export const SESSION_MAX_S = 8 * 3600;

export function gptFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    session_percent: null,
    session_resets_at: null,
    weekly_percent: null,
    weekly_resets_at: null,
    plan: null,
  };
}

function usedPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  try {
    n = Number(value);
    if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  } catch {
    return null;
  }
  if (n < 0) n = 0.0;
  if (n > 100) n = 100.0;
  return Math.round(n * 10) / 10;
}

function extractWindow(obj: unknown): [number | null, string | null, number | null] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj) || Object.keys(obj as object).length === 0) return [null, null, null];
  const d = obj as Record<string, unknown>;
  const pct = usedPercent(pick(d.used_percent, d.utilization, d.percent));
  const reset = isoOrNone(pick(d.reset_at, d.resets_at, d.resetsAt));
  const secsRaw = pick(d.limit_window_seconds, d.window_seconds);
  let secs: number | null = null;
  if (secsRaw !== null && secsRaw !== undefined) {
    try {
      secs = Math.trunc(Number(secsRaw));
      if (Number.isNaN(secs)) secs = null;
    } catch {
      secs = null;
    }
    // Python: int(secs_raw) — if it fails sets None
    if (secs !== null && Number.isNaN(secs)) secs = null;
  }
  return [pct, reset, secs];
}

function isSession(secs: number | null): boolean {
  return secs !== null && secs !== undefined && 0 < secs && secs <= SESSION_MAX_S;
}

export function parseGptPayload(data: Record<string, unknown>): Record<string, unknown> {
  const rl = data.rate_limit !== null && typeof data.rate_limit === "object" && !Array.isArray(data.rate_limit)
    ? (data.rate_limit as Record<string, unknown>)
    : (data as Record<string, unknown>);
  const primary = pick(
    rl !== data ? (rl as Record<string, unknown>).primary_window : null,
    data.five_hour,
    data.fiveHour,
    data.five_hour_limit,
  );
  const secondary = pick(
    rl !== data ? (rl as Record<string, unknown>).secondary_window : null,
    data.weekly,
    data.weekly_limit,
    data.seven_day,
  );

  const windows: Array<[number | null, string | null, number | null]> = [];
  for (const raw of [primary, secondary]) {
    const [pct, reset, secs] = extractWindow(raw);
    if (pct === null && reset === null && secs === null) continue;
    windows.push([pct, reset, secs]);
  }

  let sessionPct: number | null = null;
  let sessionReset: string | null = null;
  let weeklyPct: number | null = null;
  let weeklyReset: string | null = null;

  // Preserve exact assignment order from Python:
  for (const [pct, reset, secs] of windows) {
    if (sessionPct === null && (secs === null || isSession(secs))) {
      sessionPct = pct;
      sessionReset = reset;
      continue;
    }
    if (weeklyPct === null) {
      weeklyPct = pct;
      weeklyReset = reset;
    } else if (sessionPct === null) {
      sessionPct = pct;
      sessionReset = reset;
    }
  }

  const planRaw = data.plan_type;
  let planS: string | null = planRaw ? String(planRaw).trim() : null;
  if (planS === "") planS = null;
  if (!planS) planS = null;

  const ok = sessionPct !== null || weeklyPct !== null;
  return {
    ok,
    error: ok ? null : "resposta GPT sem janelas de cota",
    session_percent: sessionPct,
    session_resets_at: sessionReset,
    weekly_percent: weeklyPct,
    weekly_resets_at: weeklyReset,
    plan: planS,
  };
}

export async function fetchGptOne(token: string, accountId?: string | null): Promise<Record<string, unknown>> {
  token = (token ?? "").trim();
  if (!token) return gptFail("sem token GPT");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": GPT_USER_AGENT,
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId.trim();
  let data: unknown;
  try {
    data = await httpJson(GPT_USAGE_URL, { headers, provider: "GPT" });
  } catch (e) {
    return gptFail(String(e));
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return gptFail("resposta GPT inesperada");
  const parsed = parseGptPayload(data as Record<string, unknown>);
  if (parsed.ok) return parsed;
  return gptFail(String(parsed.error ?? "resposta GPT sem janelas de cota"));
}

async function fetchGptLocal(
  cands: Array<[string, string, string | null, number | null]>,
): Promise<Record<string, unknown>> {
  let lastErr = "sem token GPT";
  for (const [, token, accountId] of cands) {
    if (gptTokenExpired(token)) {
      lastErr = "OAuth expirado; abra o Codex neste computador (`codex login`)";
      continue;
    }
    const result = await fetchGptOne(token, accountId);
    if (result.ok) return result;
    lastErr = String(result.error ?? lastErr);
  }
  return gptFail(lastErr);
}

export async function fetchGptAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const accounts: Array<Record<string, unknown>> = [];
  const p = providerCfg(cfg, "gpt") as Record<string, unknown>;

  if (!p.hidden) {
    const localCands = gptTokenCandidates(cfg);
    if (localCands.length > 0) {
      const result = await fetchGptLocal(localCands);
      accounts.push({ id: "local", label: String(p.local_label ?? ""), ...result });
    }
  }

  let extra = Array.isArray(p.accounts) ? [...(p.accounts as unknown[])] : [];
  if (extra.length === 0) {
    const legacy = String(p.paste_secret ?? "").trim();
    if (legacy) extra = [{ id: "legacy", label: "", secret: legacy }];
  }
  for (const accRaw of extra) {
    const acc = accRaw as Record<string, unknown>;
    const token = String(acc.secret ?? "").trim();
    const label = String(acc.label ?? "").trim();
    const aid = String(acc.id ?? "extra");
    const result = await fetchGptOne(token);
    accounts.push({ id: aid, label, ...result });
  }
  return accounts;
}

export const gpt_fail = gptFail;
export const parse_gpt_payload = parseGptPayload;
export const fetch_gpt_one = fetchGptOne;
export const fetch_gpt_accounts = fetchGptAccounts;
