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

export function fmtBrl(cents: number | null | undefined): string {
  if (cents == null || cents < 0) return "--";
  if (cents === 0) return "R$0,00";
  const reais = Math.trunc(cents / 100);
  const cc = Math.abs(cents % 100);
  return `R$${reais.toLocaleString("pt-BR")},${String(cc).padStart(2, "0")}`;
}

export function fmtMoney(cents: number | null | undefined, currency?: string | null): string {
  const cur = (currency || "USD").toUpperCase();
  if (cur === "BRL") return fmtBrl(cents);
  if (cur === "USD") return fmtUsd(cents);
  if (cents == null || cents < 0) return "--";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${cur} ${(cents / 100).toFixed(2)}`;
  }
}

export function fmtBtc(btc: number | null | undefined): string {
  if (btc == null || btc < 0) return "--";
  return `${btc.toFixed(8)} BTC`;
}

const CURRENCY_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-AR" };

/** Formata um preço na moeda `base` (ISO 4217) respeitando o idioma da UI. */
export function fmtCurrencyAmount(price: number | null | undefined, base: string, lang: string = "pt"): string {
  if (price == null || !Number.isFinite(price)) return "--";
  const locale = CURRENCY_LOCALE[lang] || "pt-BR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: base, maximumFractionDigits: price >= 1 ? 2 : 6 }).format(price);
  } catch {
    return `${price.toFixed(2)} ${base}`;
  }
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
  if (/^\d{4}-/.test(s) || s.includes("T")) {
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) return iso;
  }
  const m = /^(\d{2})\/(\d{2})\s+(\d{2})h(\d{2})$/.exec(s);
  if (m) {
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
  const dmy = /^(\d{2})\/(\d{2})$/.exec(s);
  if (!dmy) return null;
  const dd = Number(dmy[1]);
  const mo = Number(dmy[2]);
  const y = new Date(nowMs).getFullYear();
  const mk = (year: number) => Date.parse(`${year}-${pad2(mo)}-${pad2(dd)}T00:00:00-03:00`);
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

// ── Weather helpers ──────────────────────────────────────────────────

export const WMO_LABELS: Record<number, string> = {
  0: "Céu limpo", 1: "Predom. limpo", 2: "Parcial. nublado", 3: "Encoberto",
  45: "Nevoeiro", 48: "Nevoeiro c/ geada",
  51: "Chuvisco fraco", 53: "Chuvisco", 55: "Chuvisco forte", 56: "Chuvisco congelante", 57: "Chuvisco congelante forte",
  61: "Chuva fraca", 63: "Chuva", 65: "Chuva forte", 66: "Chuva congelante", 67: "Chuva congelante forte",
  71: "Neve fraca", 73: "Neve", 75: "Neve forte", 77: "Grãos de neve",
  80: "Pancadas fracas", 81: "Pancadas", 82: "Pancadas fortes", 85: "Pancadas de neve", 86: "Pancadas de neve fortes",
  95: "Trovoada", 96: "Trovoada c/ granizo", 99: "Trovoada c/ granizo forte",
};

export const WMO_EMOJI: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "❄️",
  80: "🌦️", 81: "🌦️", 82: "⛈️", 85: "🌨️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

export function wmoLabel(code: number | null | undefined): string {
  if (code == null) return "--";
  return WMO_LABELS[code] || `Código ${code}`;
}

export function wmoEmoji(code: number | null | undefined): string {
  if (code == null) return "🌡️";
  return WMO_EMOJI[code] || "🌡️";
}

export function fmtTemp(v: number | null | undefined, unit = "°C"): string {
  if (v == null) return "--";
  return `${Math.round(v)}${unit}`;
}

export function fmtWind(v: number | null | undefined, unit = "km/h"): string {
  if (v == null) return "--";
  return `${Math.round(v)} ${unit}`;
}

export function fmtPrecip(v: number | null | undefined, unit = "mm"): string {
  if (v == null) return "--";
  return `${v.toFixed(1)} ${unit}`;
}

export function fmtHumidity(v: number | null | undefined): string {
  if (v == null) return "--";
  return `${Math.round(v)}%`;
}

export function fmtPressure(v: number | null | undefined): string {
  if (v == null) return "--";
  return `${Math.round(v)} hPa`;
}

export function windDir(deg: number | null | undefined): string {
  if (deg == null) return "--";
  const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

export function fmtHourLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || iso;
    return `${String(d.getHours()).padStart(2, "0")}h`;
  } catch {
    return iso.slice(11, 16) || iso;
  }
}

export function weatherDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function weatherTodayKey(currentTime?: string | null, timezone?: string | null): string {
  if (currentTime) return weatherDayKey(currentTime);
  if (timezone) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    } catch {
      // timezone inválido — cai no fallback abaixo
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export function isSameWeatherDay(a: string, b: string): boolean {
  return weatherDayKey(a) === weatherDayKey(b);
}

export function fmtDayLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}`;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(5, 10) || iso;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return iso.slice(5, 10) || iso;
  }
}
