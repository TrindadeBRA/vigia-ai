import type { ThemeName } from "./theme";
import { PALETTES, hexToRgba } from "./theme";

export const POLL_MS = 60000;
export const FETCH_OK_FLASH_MS = 1500;
/** Snapshot mais novo que isso conta como ciclo fresco (check verde). */
export const FRESH_PAYLOAD_MS = 2500;

export function nextFetchAtMs(updatedAt: string, pollMs: number, nowMs = Date.now()): number {
  const serverMs = Date.parse(updatedAt);
  if (Number.isNaN(serverMs)) return nowMs + pollMs;
  return serverMs + pollMs;
}

export function countdownSecs(nextAt: number, nowMs: number, pollS: number): number {
  return Math.max(0, Math.min(pollS, Math.ceil((nextAt - nowMs) / 1000)));
}

export function payloadAgeMs(updatedAt: string, nowMs = Date.now()): number | null {
  const serverMs = Date.parse(updatedAt);
  if (Number.isNaN(serverMs)) return null;
  return nowMs - serverMs;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function barColor(pct: number | null | undefined, pal: (typeof PALETTES)[ThemeName]): string {
  if (pct == null || pct < 0) return pal.textMuted;
  if (pct < 70) return pal.good;
  if (pct < 90) return pal.warn;
  return pal.bad;
}

export function barGlow(pct: number | null | undefined, pal: (typeof PALETTES)[ThemeName]): string {
  if (pct == null || pct < 70) return "none";
  if (pct < 90) return `0 0 7px ${hexToRgba(pal.warn, 0.4)}`;
  return `0 0 10px ${hexToRgba(pal.bad, 0.55)}`;
}

export function fmtPct(pct: number | null | undefined): string {
  return pct == null || pct < 0 ? "--" : `${Math.round(pct)}%`;
}

export function fmtRemain(pct: number | null | undefined): string {
  return pct == null || pct < 0 ? "--" : fmtPct(100 - clamp(pct, 0, 100));
}

export function fmtUsd(cents: number | null | undefined): string {
  if (cents == null || cents < 0) return "--";
  if (cents === 0) return "$0.00";
  const reais = Math.trunc(cents / 100);
  const cc = Math.abs(cents % 100);
  return cc === 0 ? `$${reais}` : `$${reais}.${String(cc).padStart(2, "0")}`;
}

export function fmtWhen(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (s.length >= 16 && s[4] === "-" && s[10] === "T") {
    return `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 13)}h${s.slice(14, 16)}`;
  }
  return s;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Interpreta ISO ou o formato da tela (`30/09 17h07`, BRT) como epoch ms. */
export function parseResetMs(raw: string | null | undefined, nowMs = Date.now()): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return iso;
  const m = /^(\d{2})\/(\d{2})\s+(\d{2})h(\d{2})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mo = Number(m[2]);
  const hh = Number(m[3]);
  const mi = Number(m[4]);
  const y = new Date(nowMs).getFullYear();
  const mk = (year: number) => Date.parse(`${year}-${pad2(mo)}-${pad2(dd)}T${pad2(hh)}:${pad2(mi)}:00-03:00`);
  let t = mk(y);
  if (Number.isNaN(t)) return null;
  if (t < nowMs - 24 * 3600 * 1000) t = mk(y + 1);
  return Number.isNaN(t) ? null : t;
}

/** Cronômetro até o reset. Plano GPT free não tem janela 5h — usa a cota longa. */
export function fmtCountdown(resetsAt: string | null | undefined, nowMs = Date.now()): string | null {
  const end = parseResetMs(resetsAt, nowMs);
  if (end == null) return null;
  const sec = Math.max(0, Math.floor((end - nowMs) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

export function fmtClock(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
