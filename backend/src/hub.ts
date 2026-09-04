import { utcNow } from "./formatting.js";
import { UsagePayloadSchema } from "./schemas.js";
import { buildPayload } from "./usage.js";

export const DEFAULT_INTERVAL_S = 60;
export const HEARTBEAT_S = 15;

export function intervalS(): number {
  const raw = process.env.USAGE_INTERVAL_S ?? String(DEFAULT_INTERVAL_S);
  let value: number;
  try {
    value = parseInt(raw, 10);
    if (Number.isNaN(value)) return DEFAULT_INTERVAL_S;
  } catch {
    return DEFAULT_INTERVAL_S;
  }
  return Math.max(15, Math.min(value, 600));
}

function logFailures(payload: Record<string, unknown>): void {
  for (const name of ["claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal", "bitcoin", "adsense"]) {
    const arr = payload[name] as unknown;
    if (!Array.isArray(arr)) continue;
    for (const acc of arr) {
      if (acc !== null && typeof acc === "object" && !(acc as Record<string, unknown>).ok) {
        const dict = acc as Record<string, unknown>;
        const who = dict.label || dict.id || "?";
        console.log(`[${utcNow()}] ERRO ${name} (${who}): ${dict.error}`);
      }
    }
  }
  const w = payload.weather as unknown;
  if (w !== null && typeof w === "object" && !Array.isArray(w) && !(w as Record<string, unknown>).ok && (w as Record<string, unknown>).error) {
    console.log(`[${utcNow()}] ERRO weather: ${(w as Record<string, unknown>).error}`);
  }
  const cu = payload.currencies as unknown;
  if (cu !== null && typeof cu === "object" && !Array.isArray(cu) && !(cu as Record<string, unknown>).ok && (cu as Record<string, unknown>).error) {
    console.log(`[${utcNow()}] ERRO currencies: ${(cu as Record<string, unknown>).error}`);
  }
}

class HubQueue {
  private items: Array<Record<string, unknown> | null> = [];
  private waiters: Array<(v: Record<string, unknown> | null | typeof TIMEOUT) => void> = [];
  private maxSize = 4;
  put(payload: Record<string, unknown> | null): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      waiter(payload);
      return;
    }
    if (this.items.length >= this.maxSize) {
      // mimic Python: try put, if full get_nowait then try put again, else discard
      try {
        this.items.shift();
      } catch {}
    }
    if (this.items.length < this.maxSize) {
      this.items.push(payload);
    } else {
      // dead queue case handled by hub
    }
  }
  tryPut(payload: Record<string, unknown> | null): boolean {
    if (this.items.length >= this.maxSize) return false;
    this.items.push(payload);
    // if waiter exists, deliver immediately
    if (this.waiters.length > 0) {
      const v = this.items.shift()!;
      const w = this.waiters.shift()!;
      w(v);
    }
    return true;
  }
  async next(timeoutMs: number): Promise<Record<string, unknown> | null | typeof TIMEOUT> {
    if (this.items.length > 0) {
      return this.items.shift()!;
    }
    return new Promise<Record<string, unknown> | null | typeof TIMEOUT>((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      const waiter = (v: Record<string, unknown> | null | typeof TIMEOUT) => {
        if (timer) clearTimeout(timer);
        resolve(v);
      };
      this.waiters.push(waiter);
      timer = setTimeout(() => {
        // remove waiter if still pending
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        resolve(TIMEOUT);
      }, timeoutMs);
    });
  }
  // for broadcast handling where we need to know if full
  isFull(): boolean {
    return this.items.length >= this.maxSize;
  }
  shift(): Record<string, unknown> | null | undefined {
    return this.items.shift();
  }
  size(): number {
    return this.items.length;
  }
}

const TIMEOUT = Symbol("timeout");

export class UsageHub {
  seconds: number;
  private _latest: Record<string, unknown> | null = null;
  private _queues: Set<HubQueue> = new Set();
  private _task: NodeJS.Timeout | null = null;
  private _onPayload: ((p: Record<string, unknown>) => void) | null;
  deviceIp: string | null = null;
  deviceSeenAt: number | null = null;
  deviceWidth: number | null = null;
  deviceHeight: number | null = null;
  private _lock: Promise<void> = Promise.resolve();
  private _lockRelease: (() => void) | null = null;

  constructor(seconds?: number | null, onPayload?: ((p: Record<string, unknown>) => void) | null) {
    this.seconds = seconds ?? intervalS();
    this._onPayload = onPayload ?? null;
  }

  noteDevice(ip: string | null | undefined, screen: string | null | undefined): void {
    if (!ip) return;
    this.deviceIp = ip;
    this.deviceSeenAt = performance.now() / 1000; // monotonic seconds similar to time.monotonic
    // also store wall clock? python uses time.monotonic
    // deviceSeenAt is monotonic float
    if (screen) {
      const [wS, , hS] = partition(screen, "x");
      try {
        this.deviceWidth = parseInt(wS, 10);
        this.deviceHeight = parseInt(hS, 10);
        if (Number.isNaN(this.deviceWidth)) this.deviceWidth = null;
        if (Number.isNaN(this.deviceHeight)) this.deviceHeight = null;
      } catch {}
    }
  }

  async start(): Promise<void> {
    if (this._task !== null) return;
    // background initial refresh (not blocking startup)
    void this.refresh().catch(() => {});
    this._task = setInterval(() => {
      void this.refresh().catch(() => {});
    }, this.seconds * 1000);
    // allow Node to not keep process alive only for this timer? not needed
    if (this._task && typeof (this._task as unknown as { unref?: () => void }).unref === "function") {
      (this._task as unknown as { unref: () => void }).unref();
    }
  }

  async stop(): Promise<void> {
    if (this._task !== null) {
      clearInterval(this._task);
      this._task = null;
    }
    for (const q of [...this._queues]) {
      try {
        q.put(null);
      } catch {}
    }
  }

  async refresh(opts: { forceQuota?: boolean } = {}): Promise<Record<string, unknown>> {
    return this.withLock(async () => {
      const payload = await buildPayload({ forceQuota: opts.forceQuota ?? false });
      this._latest = payload;
      logFailures(payload as Record<string, unknown>);
      this.broadcast(payload as Record<string, unknown>);
      if (this._onPayload) {
        // run in background not delaying refresh
        const onPayload = this._onPayload;
        void (async () => {
          try {
            await Promise.resolve(onPayload(payload as Record<string, unknown>));
          } catch (exc) {
            console.log(`[${utcNow()}] ERRO on_payload: ${exc}`);
          }
        })();
      }
      return payload as Record<string, unknown>;
    });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this._lock;
    let release!: () => void;
    const next = new Promise<void>((res) => (release = res));
    this._lock = next;
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  snapshot(): Record<string, unknown> | null {
    return this._latest;
  }

  private broadcast(payload: Record<string, unknown>): void {
    const dead: HubQueue[] = [];
    for (const q of this._queues) {
      // mimic Python queue logic
      if (!q.tryPut(payload)) {
        // queue full -> drop oldest then try again
        q.shift();
        if (!q.tryPut(payload)) {
          dead.push(q);
        }
      }
    }
    for (const q of dead) this._queues.delete(q);
  }

  subscribe(): HubQueue {
    const q = new HubQueue();
    this._queues.add(q);
    return q;
  }

  unsubscribe(queue: HubQueue): void {
    this._queues.delete(queue);
  }
}

function partition(s: string, sep: string): [string, string, string] {
  const idx = s.indexOf(sep);
  if (idx === -1) return [s, "", ""];
  return [s.slice(0, idx), sep, s.slice(idx + sep.length)];
}

export function formatSse(payload: Record<string, unknown>): string {
  let data: string;
  try {
    const validated = UsagePayloadSchema.parse(payload);
    data = JSON.stringify(validated);
  } catch {
    data = JSON.stringify(payload);
  }
  return `event: usage\ndata: ${data}\n\n`;
}

export async function* sseBytes(hub: UsageHub): AsyncGenerator<string | Uint8Array | Buffer> {
  const queue = hub.subscribe();
  try {
    yield ": connected\n\n";
    const latest = hub.snapshot();
    if (latest !== null) {
      yield formatSse(latest);
    }
    while (true) {
      const item = await queue.next(HEARTBEAT_S * 1000);
      if (item === TIMEOUT) {
        yield ": ping\n\n";
        continue;
      }
      if (item === null) {
        break;
      }
      yield formatSse(item as Record<string, unknown>);
    }
  } finally {
    hub.unsubscribe(queue);
  }
}

// aliases
export const format_sse = formatSse;
export const sse_bytes = sseBytes;
export const interval_s = intervalS;
