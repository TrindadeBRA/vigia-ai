import { useEffect, useState } from "react";

const CDN_CORE = "https://cdn.jsdelivr.net/gh/zonaro/NameToColor@main/NameToColor.js";
const CDN_PTBR = "https://cdn.jsdelivr.net/gh/zonaro/NameToColor@main/NameToColor.ptBR.js";

declare global {
  interface Window {
    generateColor?: (input: unknown) => string | string[];
    generateReadableColor?: (input: unknown) => [string, string];
    listColors?: (
      pageNumber?: number,
      pageSize?: number,
      locale?: string,
    ) => {
      items: { Color: string; Hexadecimal: string }[];
      pageNumber: number;
      pageCount: number;
      totalItems: number;
    };
    colorName?: (input: unknown, locale?: string) => string | null;
    colorNames?: (input: unknown, locale?: string) => string[];
    closestName?: (input: unknown, locale?: string) => string | null;
    closestNames?: (input: unknown, locale?: string) => string[];
    normalizeHex?: (input: unknown) => string;
    generateThemePalette?: (input: string, count?: number) => string[];
    generateMonochrome?: (input: string, count?: number) => string[];
    isLight?: (input: unknown) => boolean;
    isDark?: (input: unknown) => boolean;
    mood?: (input: unknown, locale?: string) => string[];
    hexToRgb?: (hex: string) => { r: number; g: number; b: number };
    hexToHsl?: (hex: string) => { h: number; s: number; l: number };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function useNameToColor() {
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.generateColor);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadScript(CDN_CORE);
        await loadScript(CDN_PTBR);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (!ready) load();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return { ready, error };
}

export function ntcGenerateColor(input: string): string | null {
  if (!window.generateColor) return null;
  try {
    const r = window.generateColor(input);
    if (Array.isArray(r)) return (r[0] as string) ?? null;
    const s = r as string;
    // normalize to #rrggbb (plugin may return #rrggbbaa for rgba)
    return s?.slice(0, 7) ?? null;
  } catch {
    return null;
  }
}

export function ntcClosestName(input: string, locale?: string): string | null {
  if (!window.closestName) return null;
  try {
    return window.closestName(input, locale) ?? null;
  } catch {
    return null;
  }
}

export function ntcColorName(input: string, locale?: string): string | null {
  if (!window.colorName) return null;
  try {
    return window.colorName(input, locale) ?? null;
  } catch {
    return null;
  }
}

export function ntcListColors(page?: number, size?: number, locale?: string) {
  if (!window.listColors) return null;
  try {
    return window.listColors(page, size, locale) ?? null;
  } catch {
    return null;
  }
}

export function ntcMood(input: string, locale?: string): string[] {
  if (!window.mood) return [];
  try {
    return window.mood(input, locale) ?? [];
  } catch {
    return [];
  }
}

export function ntcGenerateReadableColor(input: string): [string, string] | null {
  if (!window.generateReadableColor) return null;
  try {
    const r = window.generateReadableColor(input);
    if (Array.isArray(r) && r.length === 2) return r as [string, string];
    return null;
  } catch {
    return null;
  }
}
