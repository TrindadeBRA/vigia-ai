/**
 * Provedor Cursor: JWT local + contas extras via Dashboard Connect RPC.
 * Port of backend-python-legacy/app/providers/cursor.py
 */
import { asPercentPoints, isoOrNone, moneyCents, pick, ratioPercent } from "../formatting.js";
import { httpJson } from "../httpClient.js";
import { cursorTokenCandidates, jwtExpired } from "../local/cursorState.js";
import { provider as providerCfg } from "../store.js";

export const CURSOR_USAGE_URL = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";
export const CURSOR_AUTH_USAGE_URL = "https://api2.cursor.sh/auth/usage";

export function cursorFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    percent: null,
    other_percent: null,
    used_cents: null,
    limit_cents: null,
    remaining_cents: null,
    bonus_cents: null,
    cycle_end: null,
    plan: null,
    requests_used: null,
    requests_limit: null,
  };
}

export function parseCursorDashboard(data: Record<string, unknown>, plan: string | null): Record<string, unknown> | null {
  const usageRaw = (data.planUsage ?? data.plan_usage ?? {}) as unknown;
  const usage = usageRaw !== null && typeof usageRaw === "object" && !Array.isArray(usageRaw) ? (usageRaw as Record<string, unknown>) : {};

  // use asPercentPoints — 0 is valid, so use pick not ||
  let percent = asPercentPoints(pick(usage.autoPercentUsed, usage.auto_percent_used));
  let otherPercent = asPercentPoints(pick(usage.apiPercentUsed, usage.api_percent_used));

  const spendRaw = (data.spendLimitUsage ?? data.spend_limit_usage ?? {}) as unknown;
  const spend = spendRaw !== null && typeof spendRaw === "object" && !Array.isArray(spendRaw) ? (spendRaw as Record<string, unknown>) : {};

  const ondemandLimit = moneyCents(pick(spend.individualLimit, spend.limit));
  const ondemandRemain = moneyCents(pick(spend.individualRemaining, spend.remaining));
  let ondemandUsed: number | null = null;
  if (ondemandLimit !== null && ondemandRemain !== null) {
    ondemandUsed = Math.max(0, ondemandLimit - ondemandRemain);
  } else if (ondemandLimit !== null) {
    ondemandUsed = 0;
  }

  const bonus = moneyCents(pick(usage.bonusSpend, usage.bonus_spend));

  const cycleEnd = isoOrNone(
    pick(data.billingCycleEnd, data.billing_cycle_end, usage.endDate, usage.end_date),
  );

  // proto3 omits scalar 0: ciclo novo chega sem autoPercentUsed/apiPercentUsed.
  if (percent === null && otherPercent === null && ondemandLimit === null && !cycleEnd) {
    return null;
  }
  if (percent === null) percent = 0.0;
  if (otherPercent === null) otherPercent = 0.0;

  return {
    ok: true,
    error: null,
    percent,
    other_percent: otherPercent,
    used_cents: ondemandUsed,
    limit_cents: ondemandLimit,
    remaining_cents: ondemandRemain,
    bonus_cents: bonus !== null ? bonus : 0,
    cycle_end: cycleEnd,
    plan: (plan ?? String(data.membershipType ?? "").trim()) || null,
    requests_used: null,
    requests_limit: null,
  };
}

export function parseCursorAuthUsage(data: Record<string, unknown>, plan: string | null): Record<string, unknown> {
  let bestPct: number | null = null;
  let used: number | null = null;
  let limit: number | null = null;

  for (const bucket of Object.values(data)) {
    if (bucket === null || typeof bucket !== "object" || Array.isArray(bucket)) continue;
    const b = bucket as Record<string, unknown>;
    const n = b.numRequests;
    const m = b.maxRequestUsage ?? b.maxRequests;
    let nI: number, mI: number;
    try {
      nI = Math.trunc(Number(n));
      mI = m !== null && m !== undefined ? Math.trunc(Number(m)) : 0;
      if (Number.isNaN(nI) || Number.isNaN(mI)) continue;
    } catch {
      continue;
    }
    if (mI <= 0) continue;
    const pct = ratioPercent(nI, mI);
    if (bestPct === null || (pct !== null && pct > bestPct)) {
      bestPct = pct;
      used = nI;
      limit = mI;
    }
  }

  const ok = bestPct !== null;
  return {
    ok,
    error: ok ? null : "auth/usage sem buckets",
    percent: bestPct,
    other_percent: null,
    used_cents: null,
    limit_cents: null,
    remaining_cents: null,
    bonus_cents: null,
    cycle_end: null,
    plan,
    requests_used: used,
    requests_limit: limit,
  };
}

function isAuthError(msg: string): boolean {
  return msg.includes("HTTP 401") || msg.includes("HTTP 403");
}

async function fetchCursorWithToken(token: string, plan: string | null): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Connect-Protocol-Version": "1",
    Accept: "application/json",
  };
  let dashErr = "GetCurrentPeriodUsage vazio";
  try {
    const data = await httpJson(CURSOR_USAGE_URL, {
      method: "POST",
      headers,
      body: Buffer.from("{}"),
      provider: "CURSOR",
    });
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      const parsed = parseCursorDashboard(data as Record<string, unknown>, plan);
      if (parsed && parsed.ok) return parsed;
      if (parsed && parsed.error) dashErr = String(parsed.error);
    }
  } catch (e) {
    dashErr = String(e);
  }

  try {
    const data = await httpJson(CURSOR_AUTH_USAGE_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      provider: "CURSOR",
    });
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      const parsed = parseCursorAuthUsage(data as Record<string, unknown>, plan);
      if (parsed.ok) return parsed;
      return cursorFail(`${dashErr}; ${parsed.error}`);
    }
  } catch (e) {
    return cursorFail(`${dashErr}; fallback: ${e}`);
  }
  return cursorFail(dashErr);
}

export async function fetchCursorOne(token: string, plan: string | null): Promise<Record<string, unknown>> {
  token = (token ?? "").trim();
  if (!token) return cursorFail("sem token Cursor");
  return fetchCursorWithToken(token, plan);
}

async function fetchCursorLocal(cands: Array<[string, string, string | null]>): Promise<Record<string, unknown>> {
  let lastErr = "sem JWT Cursor";
  for (const [, token, plan] of cands) {
    if (jwtExpired(token)) {
      lastErr = "JWT expirado; abra o Cursor neste computador";
      continue;
    }
    const parsed = await fetchCursorOne(token, plan);
    if (parsed.ok) return parsed;
    const err = String(parsed.error ?? "");
    lastErr = err;
    if (isAuthError(err)) continue;
    return parsed;
  }
  return cursorFail(lastErr);
}

export async function fetchCursorAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const accounts: Array<Record<string, unknown>> = [];
  const p = providerCfg(cfg, "cursor") as Record<string, unknown>;

  if (!p.hidden) {
    const localCands = cursorTokenCandidates(cfg);
    if (localCands.length > 0) {
      const result = await fetchCursorLocal(localCands);
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
    const result = await fetchCursorOne(token, null);
    accounts.push({ id: aid, label, ...result });
  }
  return accounts;
}

export const cursor_fail = cursorFail;
export const parse_cursor_dashboard = parseCursorDashboard;
export const parse_cursor_auth_usage = parseCursorAuthUsage;
export const fetch_cursor_one = fetchCursorOne;
export const fetch_cursor_accounts = fetchCursorAccounts;
