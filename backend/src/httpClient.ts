import { STATUS_CODES } from "node:http";
import { VERSION } from "./version.js";

const RETRY_AFTER_RE = /retry-after=(\d+(?:\.\d+)?)/i;

export const DEFAULT_USER_AGENT = `VigiaAI/${VERSION} (local collector)`;

const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const USE_COLOR = Boolean(process.stdout.isTTY);
const PREFIX_WIDTH = 21;
const NOTIFICATION_PREFIX_WIDTH = 25;

function levelPrefix(label: string): string {
  const prefix = `UPDATE - ${label}:`.padEnd(PREFIX_WIDTH, " ");
  return USE_COLOR ? `${MAGENTA}${prefix}${RESET}` : prefix;
}

function notificationPrefix(label: string): string {
  const prefix = `NOTIFICATION - ${label}:`.padEnd(NOTIFICATION_PREFIX_WIDTH, " ");
  return USE_COLOR ? `${RED}${prefix}${RESET}` : prefix;
}

function labelFromHost(netloc: string): string {
  const host = netloc.split(":")[0];
  const parts = host.split(".");
  const core = parts.length >= 2 ? parts[parts.length - 2] : host;
  return core.toUpperCase();
}

function logRequest(
  prefix: string,
  method: string,
  url: string,
  opts: { status: number | null; elapsedMs: number; error?: string | null },
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // fallback: treat as path
    const requestLine = `"${method} ${url} HTTP/1.1"`;
    if (opts.error) {
      console.log(`${prefix} - ${requestLine} falhou (${opts.elapsedMs.toFixed(0)}ms): ${opts.error}`);
    } else {
      const reason = STATUS_CODES[opts.status ?? 0] ?? "";
      console.log(`${prefix} - ${requestLine} ${opts.status} ${reason} (${opts.elapsedMs.toFixed(0)}ms)`);
    }
    return;
  }
  let path = parsed.pathname || "/";
  if (parsed.search) path += parsed.search;
  const requestLine = `"${method} ${path} HTTP/1.1"`;
  if (opts.error != null) {
    console.log(`${prefix}${parsed.host} - ${requestLine} falhou (${opts.elapsedMs.toFixed(0)}ms): ${opts.error}`);
    return;
  }
  const reason = STATUS_CODES[opts.status ?? 0] ?? "";
  console.log(`${prefix}${parsed.host} - ${requestLine} ${opts.status} ${reason} (${opts.elapsedMs.toFixed(0)}ms)`);
}

function logOutboundInternal(
  method: string,
  url: string,
  opts: { label: string; status: number | null; elapsedMs: number; error?: string | null },
): void {
  logRequest(levelPrefix(opts.label), method, url, { status: opts.status, elapsedMs: opts.elapsedMs, error: opts.error ?? null });
}

export function logOutbound(
  method: string,
  url: string,
  opts: { label: string; status: number | null; elapsedMs: number; error?: string | null },
): void {
  logOutboundInternal(method, url, opts);
}

export function logNotification(
  method: string,
  url: string,
  opts: { label: string; status: number | null; elapsedMs: number; error?: string | null },
): void {
  logRequest(notificationPrefix(opts.label.toUpperCase()), method, url, { status: opts.status, elapsedMs: opts.elapsedMs, error: opts.error ?? null });
}

export class HttpError extends Error {
  status: number;
  retryAfterS: number | null;
  constructor(message: string, opts: { status: number; retryAfterS?: number | null }) {
    super(message);
    this.name = "HttpError";
    this.status = opts.status;
    this.retryAfterS = opts.retryAfterS ?? null;
  }
  get isRateLimit(): boolean {
    return this.status === 429;
  }
  get retry_after_s(): number | null {
    return this.retryAfterS;
  }
  get is_rate_limit(): boolean {
    return this.isRateLimit;
  }
}

function parseRetryAfter(raw: string | null | undefined): number | null {
  if (!raw) return null;
  try {
    return Math.max(1.0, parseFloat(raw.trim()));
  } catch {
    return null;
  }
}

function rateLimitExtra(headers: Headers): string {
  const bits: string[] = [];
  const retry = headers.get("Retry-After");
  if (retry) bits.push(`retry-after=${retry}`);
  for (const [key, val] of headers.entries()) {
    const low = key.toLowerCase().replace(/-/g, "");
    if (low.includes("ratelimit") && val) bits.push(`${key}=${val}`);
  }
  return bits.length ? " " + bits.join(" ") : "";
}

export function retryAfterS(exc: unknown): number | null {
  if (exc instanceof HttpError) return exc.retryAfterS;
  const text = String(exc);
  const m = RETRY_AFTER_RE.exec(text);
  if (!m) return null;
  return parseRetryAfter(m[1]);
}
export const retry_after_s = retryAfterS;

export function isRateLimit(exc: unknown): boolean {
  if (exc === null || exc === undefined) return false;
  if (exc instanceof HttpError) return exc.isRateLimit;
  return String(exc).includes("HTTP 429 ");
}
export const is_rate_limit = isRateLimit;

export function resultIsRateLimited(value: unknown): boolean {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const dict = value as Record<string, unknown>;
    if (isRateLimit(dict.error)) return true;
    const items = dict.items;
    if (Array.isArray(items) && items.some((item) => resultIsRateLimited(item))) return true;
    return false;
  }
  if (Array.isArray(value)) return value.some((item) => resultIsRateLimited(item));
  return false;
}
export const result_is_rate_limited = resultIsRateLimited;

function isLatin1(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) return false;
  }
  return true;
}

export async function httpJson(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: Uint8Array | string | null;
    timeout?: number;
    provider?: string | null;
  } = {},
): Promise<unknown> {
  const method = opts.method ?? "GET";
  const headers = { ...(opts.headers ?? {}) };
  const timeout = opts.timeout ?? 20.0;

  // Validate latin-1
  try {
    for (const [k, v] of Object.entries(headers)) {
      if (!isLatin1(k) || !isLatin1(v)) throw new Error("latin1");
    }
  } catch (e) {
    throw new Error("token com caractere especial; cole de novo no painel");
  }

  let label: string;
  try {
    const netloc = new URL(url).host;
    label = (opts.provider ?? labelFromHost(netloc)).toUpperCase();
  } catch {
    label = (opts.provider ?? "UNKNOWN").toUpperCase();
  }

  const start = performance.now();
  let resp: Response;
  try {
    // Ensure User-Agent
    if (!headers["User-Agent"] && !headers["user-agent"]) headers["User-Agent"] = DEFAULT_USER_AGENT;
    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout * 1000),
    };
    if (opts.body != null) fetchOpts.body = opts.body as BodyInit;
    resp = await fetch(url, fetchOpts);
  } catch (exc: unknown) {
    const elapsedMs = performance.now() - start;
    // Check if it's a latin char error already wrapped
    if (exc instanceof Error && exc.message.includes("token com caractere")) throw exc;
    // emulate UnicodeEncodeError check - fetch may throw TypeError for invalid header
    const msg = exc instanceof Error ? exc.message : String(exc);
    if (msg.includes("token com caractere") || msg.toLowerCase().includes("latin")) {
      throw new Error("token com caractere especial; cole de novo no painel");
    }
    logOutboundInternal(method, url, { label, status: null, elapsedMs, error: String(exc) });
    throw new Error(`rede ${method} ${url}: ${exc}`);
  }

  const elapsedMs = performance.now() - start;
  logOutboundInternal(method, url, { label, status: resp.status, elapsedMs });

  if (resp.status >= 400) {
    const buf = await resp.arrayBuffer();
    const errBody = Buffer.from(buf).toString("utf-8").slice(0, 300);
    const extra = rateLimitExtra(resp.headers);
    const retry = parseRetryAfter(resp.headers.get("Retry-After"));
    throw new HttpError(`HTTP ${resp.status} ${method} ${url}${extra}: ${errBody}`, {
      status: resp.status,
      retryAfterS: retry,
    });
  }
  const text = await resp.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON inválido de ${url}: ${e}`);
  }
}
export const http_json = httpJson;

export async function httpForm(
  url: string,
  fields: Record<string, string>,
  opts: { timeout?: number; provider?: string | null } = {},
): Promise<unknown> {
  const body = new URLSearchParams(fields).toString();
  return httpJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    timeout: opts.timeout ?? 20.0,
    provider: opts.provider ?? null,
  });
}
export const http_form = httpForm;
