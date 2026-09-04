// Datas (BRT) e números (percentual, centavos) para o payload de /usage.

const BRT_TZ = "America/Sao_Paulo";

// ---------- helpers for timezone formatting ----------

function getBrtParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  let hour = parseInt(map.hour, 10);
  // Some Intl implementations return 24 for midnight
  if (hour === 24) hour = 0;
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = getBrtParts(date);
  // wall time as if it were UTC
  const wallUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  // For tz string, we assume BRT_TZ, but keep param for generic
  // If tz != BRT_TZ, recompute with that tz
  if (tz !== BRT_TZ) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const p2 = fmt.formatToParts(date);
    const m2: Record<string, string> = {};
    for (const pp of p2) if (pp.type !== "literal") m2[pp.type] = pp.value;
    let h2 = parseInt(m2.hour, 10);
    if (h2 === 24) h2 = 0;
    const wall2 = Date.UTC(parseInt(m2.year, 10), parseInt(m2.month, 10) - 1, parseInt(m2.day, 10), h2, parseInt(m2.minute, 10), parseInt(m2.second, 10));
    return Math.round((wall2 - date.getTime()) / 60000);
  }
  return Math.round((wallUtcMs - date.getTime()) / 60000);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${pad2(hh)}:${pad2(mm)}`;
}

// ---------- exported API ----------

export function isoBrt(dt?: Date | null): string {
  const date = dt == null ? new Date() : dt;
  // date is absolute; format its wall time in BRT
  const parts = getBrtParts(date);
  const offsetMin = tzOffsetMinutes(date, BRT_TZ);
  const offsetStr = formatOffset(offsetMin);
  return `${pad4(parts.year)}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}${offsetStr}`;
}

export function telaBrt(dt: Date): string {
  const parts = getBrtParts(dt);
  return `${pad2(parts.day)}/${pad2(parts.month)} ${pad2(parts.hour)}h${pad2(parts.minute)}`;
}

export function utcNow(): string {
  return isoBrt();
}

export function pick(...values: unknown[]): unknown {
  for (const v of values) if (v !== null && v !== undefined) return v;
  return null;
}

export function asPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  try {
    // handle boolean like Python (True -> 1.0)
    if (typeof value === "boolean") n = value ? 1 : 0;
    else n = Number(value);
    if (Number.isNaN(n)) {
      // Python float('nan') -> nan, round(nan) -> nan
      // we return NaN to preserve? But spec says float|None, so return NaN as number
      return NaN;
    }
    if (!Number.isFinite(n)) return null;
  } catch {
    return null;
  }
  if (n < 0) n = 0.0;
  if (0 <= n && n <= 1.5) n = n * 100.0;
  if (n > 100) n = 100.0;
  return Math.round(n * 10) / 10;
}

export function claudeUtilizationPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  try {
    if (typeof value === "boolean") n = value ? 1 : 0;
    else n = Number(value);
    if (Number.isNaN(n)) return NaN;
    if (!Number.isFinite(n)) return null;
  } catch {
    return null;
  }
  if (n < 0) n = 0.0;
  if (0 < n && n < 1) n = n * 100.0;
  if (n > 100) n = 100.0;
  return Math.round(n * 10) / 10;
}

export function asPercentPoints(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  try {
    if (typeof value === "boolean") n = value ? 1 : 0;
    else n = Number(value);
    if (Number.isNaN(n)) return NaN;
    if (!Number.isFinite(n)) return null;
  } catch {
    return null;
  }
  if (n < 0) n = 0.0;
  if (n > 100) n = 100.0;
  return Math.round(n * 10) / 10;
}

export function ratioPercent(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  let pct = (numerator / denominator) * 100.0;
  if (pct < 0) pct = 0.0;
  if (pct > 100) pct = 100.0;
  return Math.round(pct * 10) / 10;
}

export function telaDataUtc(dt: Date): string {
  return `${pad2(dt.getUTCDate())}/${pad2(dt.getUTCMonth() + 1)}`;
}

function fromUnix(n: number): Date {
  if (n > 1e11) n = n / 1000.0;
  return new Date(n * 1000);
}

function isDigitString(s: string): boolean {
  return /^\d+$/.test(s);
}
function isFloatString(s: string): boolean {
  // emulate Python s.replace(".", "", 1).isdigit()
  if (!s.includes(".")) return false;
  const idx = s.indexOf(".");
  // only one dot allowed for this check? Python replace only first dot, so "1.2.3" -> "12.3" not digit => false
  // But to match Python, we check after removing first dot the rest is all digits and at least one digit
  const removed = s.slice(0, idx) + s.slice(idx + 1);
  if (removed === "") return false;
  return /^\d+$/.test(removed);
}

export function parseWhen(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const dict = value as Record<string, unknown>;
    const sec = pick(dict.seconds, (dict as any).secondsTime);
    if (sec === null || sec === undefined) return null;
    let n: number;
    try {
      n = Number(sec);
      if (Number.isNaN(n) || !Number.isFinite(n)) return null;
    } catch {
      return null;
    }
    const nanos = (dict as any).nanos ?? 0;
    try {
      n += Number(nanos) / 1e9;
    } catch {
      // pass
    }
    return fromUnix(n);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    if (isDigitString(s)) {
      const intVal = parseInt(s, 10);
      // fall through to numeric check below
      value = intVal;
    } else if (isFloatString(s)) {
      const f = parseFloat(s);
      if (!Number.isNaN(f)) {
        value = f;
      } else {
        // try iso fallback
        const d = new Date(s.replace("Z", "+00:00"));
        if (!Number.isNaN(d.getTime())) return d;
        return null;
      }
    } else {
      try {
        const d = new Date(s.replace("Z", "+00:00"));
        if (!Number.isNaN(d.getTime())) return d;
        return null;
      } catch {
        return null;
      }
    }
  }
  if (typeof value === "number" && value > 1e9) {
    return fromUnix(value);
  }
  return null;
}

export function isoOrNone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().includes("/") && value.trim().includes("h")) {
    return value.trim();
  }
  const dt = parseWhen(value);
  if (dt === null) {
    const s = value !== null && value !== undefined ? String(value).trim() : "";
    return s || null;
  }
  return isoBrt(dt);
}

export function cycleEndLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length >= 5 && value.trim().slice(2, 3) === "/") {
    return value.trim().slice(0, 5);
  }
  const dt = parseWhen(value);
  if (dt === null) return null;
  return telaDataUtc(dt);
}

export function fmtResetWhen(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{2}\/\d{2}(\s+\d{2}h\d{2})?$/.test(s)) return s;
  const dt = parseWhen(value);
  if (dt === null) return s;
  return telaBrt(dt);
}

export function moneyCents(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  let n: number;
  try {
    n = Number(value);
    if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  } catch {
    return null;
  }
  return Math.round(n);
}

// snake_case aliases
export const iso_brt = isoBrt;
export const tela_brt = telaBrt;
export const utc_now = utcNow;
export const as_percent = asPercent;
export const claude_utilization_percent = claudeUtilizationPercent;
export const as_percent_points = asPercentPoints;
export const ratio_percent = ratioPercent;
export const tela_data_utc = telaDataUtc;
export const parse_when = parseWhen;
export const iso_or_none = isoOrNone;
export const cycle_end_label = cycleEndLabel;
export const fmt_reset_when = fmtResetWhen;
export const money_cents = moneyCents;

// internal for testing heuristic
export const _from_unix = fromUnix;
