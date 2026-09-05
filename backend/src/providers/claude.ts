/**
 * Provedor Claude: OAuth local + contas extras coladas no painel.
 * Port of backend-python-legacy/app/providers/claude.py
 */
import { asPercentPoints, claudeUtilizationPercent, isoOrNone, pick } from "../formatting.js";
import { httpJson } from "../httpClient.js";
import { claudeTokenCandidates } from "../local/claudeOauth.js";
import { provider as providerCfg } from "../store.js";

export const CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
export const CLAUDE_BETA = "oauth-2025-04-20";
export const CLAUDE_USER_AGENT = "claude-code/2.1";

export const SCOPE_HINT =
  "token sem escopo user:profile (típico de claude setup-token / oat). " +
  "Apague o token colado no painel e use o Claude Code logado neste computador (`claude` / /login).";

export function claudeFail(msg: string): Record<string, unknown> {
  return {
    ok: false,
    error: msg,
    session_percent: null,
    session_resets_at: null,
    weekly_percent: null,
    weekly_resets_at: null,
    sonnet_percent: null,
    sonnet_resets_at: null,
    opus_percent: null,
    opus_resets_at: null,
  };
}

export function parseClaudePayload(data: Record<string, unknown>): Record<string, unknown> {
  function win(obj: unknown): [number | null, string | null] {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj) || Object.keys(obj as object).length === 0) return [null, null];
    const d = obj as Record<string, unknown>;
    const pct = pick(asPercentPoints(d.percent), claudeUtilizationPercent(d.utilization)) as number | null;
    return [pct, isoOrNone(pick(d.resets_at, d.resetsAt))];
  }

  let [sessionPct, sessionReset] = win((data.five_hour ?? data.fiveHour) as unknown);
  let [weeklyPct, weeklyReset] = win((data.seven_day ?? data.sevenDay) as unknown);
  let [sonnetPct, sonnetReset] = win((data.seven_day_sonnet ?? data.sevenDaySonnet) as unknown);
  let [opusPct, opusReset] = win((data.seven_day_opus ?? data.sevenDayOpus) as unknown);

  const limits = data.limits;
  if (Array.isArray(limits)) {
    for (const item of limits) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
      const it = item as Record<string, unknown>;
      const kind = String(it.kind ?? "").toLowerCase();
      const pct = pick(asPercentPoints(it.percent), claudeUtilizationPercent(it.utilization)) as number | null;
      const reset = isoOrNone(pick(it.resets_at, it.resetsAt));
      if ((kind === "session" || kind === "five_hour" || kind === "5h") && sessionPct === null) {
        sessionPct = pct;
        sessionReset = reset;
      }
      if ((kind === "weekly_all" || kind === "seven_day" || kind === "weekly" || kind === "7d") && weeklyPct === null) {
        weeklyPct = pct;
        weeklyReset = reset;
      }
      if (kind.includes("sonnet") && sonnetPct === null) {
        sonnetPct = pct;
        sonnetReset = reset;
      }
      if (kind.includes("opus") && opusPct === null) {
        opusPct = pct;
        opusReset = reset;
      }
    }
  }

  const ok = [sessionPct, weeklyPct, sonnetPct, opusPct].some((v) => v !== null && v !== undefined);
  return {
    ok,
    error: ok ? null : "resposta Claude sem janelas de cota",
    session_percent: sessionPct,
    session_resets_at: sessionReset,
    weekly_percent: weeklyPct,
    weekly_resets_at: weeklyReset,
    sonnet_percent: sonnetPct,
    sonnet_resets_at: sonnetReset,
    opus_percent: opusPct,
    opus_resets_at: opusReset,
  };
}

function isScopeError(msg: string): boolean {
  const low = msg.toLowerCase();
  return low.includes("user:profile") || low.includes("oauth_scope_insufficient");
}

export async function fetchClaudeOne(token: string): Promise<Record<string, unknown>> {
  token = (token ?? "").trim();
  if (!token) return claudeFail("sem token Claude");
  let data: unknown;
  try {
    data = await httpJson(CLAUDE_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": CLAUDE_BETA,
        Accept: "application/json",
        "User-Agent": CLAUDE_USER_AGENT,
      },
      provider: "CLAUDE",
    });
  } catch (e) {
    const msg = String(e);
    return claudeFail(isScopeError(msg) ? SCOPE_HINT : msg);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return claudeFail("resposta Claude inesperada");
  const parsed = parseClaudePayload(data as Record<string, unknown>);
  if (parsed.ok) return parsed;
  return claudeFail(String(parsed.error ?? "resposta Claude sem janelas de cota"));
}

async function fetchClaudeLocal(cands: Array<[string, string, number | null]>): Promise<Record<string, unknown>> {
  let lastErr = "sem token Claude";
  const nowMs = Date.now();
  for (const [, token, expMs] of cands) {
    if (expMs !== null && expMs !== undefined && expMs < nowMs) {
      lastErr = "OAuth expirado; abra o Claude Code neste computador";
      continue;
    }
    const result = await fetchClaudeOne(token);
    if (result.ok) return result;
    lastErr = String(result.error ?? lastErr);
  }
  return claudeFail(lastErr);
}

export async function fetchClaudeAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const accounts: Array<Record<string, unknown>> = [];
  const p = providerCfg(cfg, "claude") as Record<string, unknown>;

  if (!p.hidden) {
    const localCands = claudeTokenCandidates(cfg);
    if (localCands.length > 0) {
      const result = await fetchClaudeLocal(localCands);
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
    const result = await fetchClaudeOne(token);
    accounts.push({ id: aid, label, ...result });
  }
  return accounts;
}

export const claude_fail = claudeFail;
export const parse_claude_payload = parseClaudePayload;
export const fetch_claude_one = fetchClaudeOne;
export const fetch_claude_accounts = fetchClaudeAccounts;
