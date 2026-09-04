import { isRateLimit, retryAfterS, resultIsRateLimited } from "./httpClient.js";
import { provider as providerCfg } from "./store.js";

export const TTL_S: Record<string, number> = {
  claude: 60,
  gpt: 60,
  cursor: 60,
  openrouter: 60,
  deepseek: 60,
  opencode: 60,
  fal: 60,
  bitcoin: 60,
  adsense: 300,
  weather: 600,
  currencies: 60,
};

export const FORCEABLE: ReadonlySet<string> = new Set([
  "claude",
  "gpt",
  "cursor",
  "openrouter",
  "deepseek",
  "opencode",
  "fal",
]);

const DEFAULT_TTL_S = 60;
const MIN_BACKOFF_S = 60.0;

function nowMonotonic(): number {
  // performance.now is monotonic (ms), convert to seconds
  return performance.now() / 1000;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    let v: string;
    try {
      const raw = obj[k];
      if (raw !== null && typeof raw === "object") v = stableStringify(raw);
      else if (typeof raw === "string") v = JSON.stringify(raw);
      else if (typeof raw === "number" || typeof raw === "boolean") v = JSON.stringify(raw);
      else if (raw === null || raw === undefined) v = "null";
      else v = JSON.stringify(String(raw));
    } catch {
      v = JSON.stringify(String(obj[k]));
    }
    parts.push(JSON.stringify(k) + ":" + v);
  }
  return "{" + parts.join(",") + "}";
}

export class RefreshCache {
  private freshAt = new Map<string, number>();
  private value = new Map<string, unknown>();
  private fingerprint = new Map<string, string>();
  private backoffUntil = new Map<string, number>();
  private inflight = new Map<string, Promise<unknown>>();

  reset(): void {
    this.freshAt.clear();
    this.value.clear();
    this.fingerprint.clear();
    this.backoffUntil.clear();
    this.inflight.clear();
  }

  get(name: string): unknown | null {
    return this.value.has(name) ? this.value.get(name)! : null;
  }

  due(name: string, opts: { fingerprint?: string; force?: boolean } = {}): boolean {
    const fingerprint = opts.fingerprint ?? "";
    const force = opts.force ?? false;
    const now = nowMonotonic();
    const ttl = TTL_S[name] ?? DEFAULT_TTL_S;
    if (now < (this.backoffUntil.get(name) ?? 0)) return false;
    if ((this.fingerprint.get(name) ?? null) !== fingerprint) return true;
    if (force && FORCEABLE.has(name)) return true;
    const last = this.freshAt.get(name);
    if (last === undefined) return true;
    return now - last >= ttl;
  }

  store(name: string, value: unknown, opts: { fingerprint?: string } = {}): void {
    const fingerprint = opts.fingerprint ?? "";
    this.value.set(name, value);
    this.freshAt.set(name, nowMonotonic());
    this.fingerprint.set(name, fingerprint);
    this.backoffUntil.delete(name);
  }

  noteRateLimit(name: string, retryAfter: number | null | undefined, value: unknown | null = null): void {
    const ttl = Number(TTL_S[name] ?? DEFAULT_TTL_S);
    const wait = Math.max(MIN_BACKOFF_S, retryAfter ?? ttl);
    this.backoffUntil.set(name, nowMonotonic() + wait);
    if (value !== null && value !== undefined && !this.value.has(name)) {
      this.value.set(name, value);
    }
  }

  take(
    name: string,
    value: unknown,
    opts: { fingerprint?: string; error?: unknown } = {},
  ): unknown {
    const fingerprint = opts.fingerprint ?? "";
    const error = opts.error ?? null;
    const limited = isRateLimit(error) || resultIsRateLimited(value);
    if (limited) {
      const previous = this.get(name);
      this.noteRateLimit(name, retryAfterS((error ?? value) as unknown), value);
      return previous !== null && previous !== undefined ? previous : value;
    }
    this.store(name, value, { fingerprint });
    return value;
  }

  // Inflight coalescing: ensure concurrent fetches for same name share one promise
  async coalesce<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(name);
    if (existing) return existing as Promise<T>;
    const p = (async () => {
      try {
        return await fn();
      } finally {
        this.inflight.delete(name);
      }
    })();
    this.inflight.set(name, p as Promise<unknown>);
    return p;
  }

  // Convenience: check due and coalesce fetch with caching
  async getOrFetch<T>(
    name: string,
    fingerprint: string,
    fetcher: () => Promise<T>,
    opts: { force?: boolean } = {},
  ): Promise<T> {
    if (!this.due(name, { fingerprint, force: opts.force ?? false })) {
      return this.get(name) as T;
    }
    return this.coalesce(name, async () => {
      // re-check due inside coalesce gate to avoid race
      if (!this.due(name, { fingerprint, force: opts.force ?? false })) {
        return this.get(name) as T;
      }
      try {
        const value = await fetcher();
        this.take(name, value, { fingerprint });
        return value as T;
      } catch (e) {
        if (isRateLimit(e)) {
          const prev = this.get(name);
          this.noteRateLimit(name, retryAfterS(e), null);
          if (prev !== null) return prev as T;
        }
        throw e;
      }
    });
  }
}

export function fingerprint(cfg: Record<string, unknown>, name: string): string {
  let blob: unknown;
  if (name === "weather" || name === "currencies") {
    blob = (cfg as Record<string, unknown>)[name] ?? {};
  } else {
    blob = providerCfg(cfg as Record<string, unknown>, name);
  }
  try {
    // Use stable sorted JSON
    if (blob !== null && typeof blob === "object") return stableStringify(blob);
    return JSON.stringify(blob, null, 0) ?? String(blob);
  } catch {
    return String(blob);
  }
}

export const cache = new RefreshCache();

// snake_case aliases
export const TTL_s = TTL_S;
export const FORCEABLE_SET = FORCEABLE;
