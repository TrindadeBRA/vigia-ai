/**
 * Provedor Google AdSense: ganhos de hoje (estimativa) + saldo não pago.
 * Port of backend-python-legacy/app/providers/adsense.py
 */
import { httpForm, httpJson } from "../httpClient.js";
import { provider as providerCfg } from "../store.js";

export const ADSENSE_SCOPE = "https://www.googleapis.com/auth/adsense.readonly";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const ADSENSE_ACCOUNTS_URL = "https://adsense.googleapis.com/v2/accounts";

const CURRENCY_TAIL = /\s+([A-Z]{3})\s*$/;
const DIGITS = /[^\d]/g;

export function adsenseFail(msg: string): Record<string, unknown> {
  return { ok: false, error: msg, currency: null, today_cents: null, unpaid_cents: null, account_name: null };
}

export function redirectUri(port: number): string {
  return `http://127.0.0.1:${Number(port)}/api/oauth/adsense/callback`;
}

export function authUrl(clientId: string, port: number, state: string): string {
  const params = {
    client_id: clientId,
    redirect_uri: redirectUri(port),
    response_type: "code",
    scope: ADSENSE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  };
  return GOOGLE_AUTH_URL + "?" + new URLSearchParams(params).toString();
}

export async function exchangeCode(clientId: string, clientSecret: string, port: number, code: string): Promise<Record<string, unknown>> {
  const data = await httpForm(
    GOOGLE_TOKEN_URL,
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(port),
      grant_type: "authorization_code",
    },
    { provider: "ADSENSE" },
  );
  if (data === null || typeof data !== "object" || Array.isArray(data) || !(data as Record<string, unknown>).refresh_token) {
    throw new Error("Google não devolveu refresh_token — revogue o acesso em myaccount.google.com/permissions e entre de novo");
  }
  return data as Record<string, unknown>;
}

export async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const data = await httpForm(
    GOOGLE_TOKEN_URL,
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
    { provider: "ADSENSE" },
  );
  if (data === null || typeof data !== "object" || Array.isArray(data) || !(data as Record<string, unknown>).access_token) {
    throw new Error("falha ao renovar o login Google — entre de novo no painel");
  }
  return String((data as Record<string, unknown>).access_token);
}

/**
 * Converte o texto da API ('R$1.234,57', '$1,234.57', '¥1,235 JPY') em centavos + ISO.
 * Preserves exact decimal separator logic via comma/dot position.
 */
export function parsePaymentAmount(raw: string | null | undefined): [number | null, string | null] {
  if (!raw || typeof raw !== "string") return [null, null];
  let text = raw.trim();
  if (!text) return [null, null];
  let currency: string | null = null;
  const tail = CURRENCY_TAIL.exec(text);
  if (tail) {
    currency = tail[1];
    text = text.slice(0, tail.index).trim();
  }
  if (text.startsWith("R$") || text.startsWith("r$")) {
    currency = currency ?? "BRL";
    text = text.slice(2).trim();
  } else if (text.startsWith("$")) {
    currency = currency ?? "USD";
    text = text.slice(1).trim();
  } else if (text.startsWith("£")) {
    currency = currency ?? "GBP";
    text = text.slice(1).trim();
  } else if (text.startsWith("€")) {
    currency = currency ?? "EUR";
    text = text.slice(1).trim();
  } else if (text.startsWith("¥")) {
    currency = currency ?? "JPY";
    text = text.slice(1).trim();
  }

  const negative = text.startsWith("-") || text.startsWith("(");
  // Python: text.strip("()- ").replace("\xa0","")
  text = text.replace(/^[\(\)\- ]+|[\(\)\- ]+$/g, "").replace(/\xa0/g, "").trim();
  let work = text;

  if (work.includes(",") && work.includes(".")) {
    if (work.lastIndexOf(",") > work.lastIndexOf(".")) {
      work = work.split(".").join("").split(",").join(".");
    } else {
      work = work.split(",").join("");
    }
  } else if (work.includes(",")) {
    const parts = work.split(",");
    if (parts[parts.length - 1].length === 2) {
      work = work.split(".").join("").split(",").join(".");
    } else {
      work = work.split(",").join("");
    }
  }

  let value: number;
  try {
    value = parseFloat(work);
    if (Number.isNaN(value)) throw new Error("NaN");
  } catch {
    const digits = raw.replace(DIGITS, "");
    if (!digits) return [null, currency];
    return [currency === "JPY" ? parseInt(digits, 10) : parseInt(digits, 10), currency];
  }
  // If parseFloat produced NaN (e.g. empty string)
  if (Number.isNaN(value)) {
    const digits = raw.replace(DIGITS, "");
    if (!digits) return [null, currency];
    return [parseInt(digits, 10), currency];
  }
  if (negative) value = -Math.abs(value);
  if (currency === "JPY") return [Math.round(value), currency];
  return [Math.round(value * 100), currency];
}

export function parseUnpaidPayments(payload: Record<string, unknown>): [number | null, string | null] {
  const payments = payload.payments ?? [];
  if (!Array.isArray(payments)) return [null, null];
  for (const item of payments) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const it = item as Record<string, unknown>;
    const name = String(it.name ?? "");
    if (name.endsWith("/payments/unpaid")) {
      return parsePaymentAmount(String(it.amount ?? "") || null);
    }
  }
  return [0, null];
}

export function parseEstimatedEarnings(payload: Record<string, unknown>): [number | null, string | null] {
  const headers = payload.headers ?? [];
  let currency: string | null = null;
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h !== null && typeof h === "object" && !Array.isArray(h) && (h as Record<string, unknown>).name === "ESTIMATED_EARNINGS") {
        currency = String((h as Record<string, unknown>).currencyCode ?? "") || null;
        break;
      }
    }
  }
  let cells: unknown = null;
  const totals = payload.totals;
  if (totals !== null && typeof totals === "object" && !Array.isArray(totals)) {
    cells = (totals as Record<string, unknown>).cells;
  }
  if (cells === null || cells === undefined) {
    const rows = payload.rows ?? [];
    if (Array.isArray(rows) && rows.length > 0 && rows[0] !== null && typeof rows[0] === "object") {
      cells = (rows[0] as Record<string, unknown>).cells;
    }
  }
  if (!Array.isArray(cells) || cells.length === 0) return [0, currency];
  const raw = (cells[0] !== null && typeof cells[0] === "object" ? (cells[0] as Record<string, unknown>).value : null) as unknown;
  if (raw === null || raw === undefined || raw === "") return [0, currency];
  try {
    return [Math.round(Number(raw) * 100), currency];
  } catch {
    return [null, currency];
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export async function fetchAdsenseOne(accessToken: string): Promise<Record<string, unknown>> {
  let accounts: unknown;
  try {
    accounts = await httpJson(ADSENSE_ACCOUNTS_URL, { headers: bearer(accessToken), provider: "ADSENSE" });
  } catch (e) {
    return adsenseFail(String(e));
  }
  const items = accounts !== null && typeof accounts === "object" && !Array.isArray(accounts)
    ? (accounts as Record<string, unknown>).accounts
    : null;
  if (!Array.isArray(items) || items.length === 0) return adsenseFail("nenhuma conta AdSense nesta conta Google");
  const acc = items[0] !== null && typeof items[0] === "object" ? (items[0] as Record<string, unknown>) : {};
  const accountName = String(acc.name ?? "").trim();
  const display = String(acc.displayName ?? accountName ?? "").trim();
  if (!accountName.startsWith("accounts/")) return adsenseFail("conta AdSense sem nome de recurso");

  let unpaidCents: number | null = null;
  let currency: string | null = null;
  try {
    const payments = await httpJson(`https://adsense.googleapis.com/v2/${accountName}/payments`, {
      headers: bearer(accessToken),
      provider: "ADSENSE",
    });
    if (payments !== null && typeof payments === "object" && !Array.isArray(payments)) {
      [unpaidCents, currency] = parseUnpaidPayments(payments as Record<string, unknown>);
    }
  } catch (e) {
    return adsenseFail(String(e));
  }

  let todayCents: number | null = null;
  try {
    const reportUrl = `https://adsense.googleapis.com/v2/${accountName}/reports:generate?dateRange=TODAY&metrics=ESTIMATED_EARNINGS`;
    const report = await httpJson(reportUrl, { headers: bearer(accessToken), provider: "ADSENSE" });
    if (report !== null && typeof report === "object" && !Array.isArray(report)) {
      const [tc, rc] = parseEstimatedEarnings(report as Record<string, unknown>);
      todayCents = tc;
      currency = currency ?? rc;
    }
  } catch (e) {
    return adsenseFail(String(e));
  }

  return {
    ok: true,
    error: null,
    currency: currency ?? "USD",
    today_cents: todayCents !== null && todayCents !== undefined ? todayCents : 0,
    unpaid_cents: unpaidCents !== null && unpaidCents !== undefined ? unpaidCents : 0,
    account_name: display,
  };
}

export async function fetchAdsenseAccounts(cfg: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const p = providerCfg(cfg, "adsense") as Record<string, unknown>;
  if (p.hidden) return [];
  const refresh = String(p.refresh_token ?? "").trim();
  const clientId = String(p.client_id ?? "").trim();
  const clientSecret = String(p.client_secret ?? "").trim();
  if (!refresh || !clientId || !clientSecret) return [];
  const label = String(p.local_label ?? "").trim();
  let access: string;
  try {
    access = await refreshAccessToken(clientId, clientSecret, refresh);
  } catch (e) {
    return [{ id: "legacy", label, ...adsenseFail(String(e)) }];
  }
  const result = await fetchAdsenseOne(access);
  return [{ id: "legacy", label, ...result }];
}

export const adsense_fail = adsenseFail;
export const parse_payment_amount = parsePaymentAmount;
export const parse_unpaid_payments = parseUnpaidPayments;
export const parse_estimated_earnings = parseEstimatedEarnings;
export const refresh_access_token = refreshAccessToken;
export const fetch_adsense_one = fetchAdsenseOne;
export const fetch_adsense_accounts = fetchAdsenseAccounts;
