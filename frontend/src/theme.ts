export type ThemeName = "dark" | "light" | "contrast";

export const PALETTES: Record<
  ThemeName,
  {
    bg: string;
    card: string;
    cardBorder: string;
    track: string;
    chip: string;
    text: string;
    textDim: string;
    textMuted: string;
    good: string;
    warn: string;
    bad: string;
    shadow: string;
  }
> = {
  dark: {
    bg: "#101419",
    card: "#192021",
    cardBorder: "#3a3d42",
    track: "#292d31",
    chip: "#212a2c",
    text: "#f7f3ef",
    textDim: "#adaeb5",
    textMuted: "#6b6d73",
    good: "#8cbe94",
    warn: "#e6a65a",
    bad: "#de6d6b",
    shadow: "rgba(0, 0, 0, .5)",
  },
  light: {
    bg: "#efebd6",
    card: "#fffbf7",
    cardBorder: "#c5c6c5",
    track: "#dedfde",
    chip: "#f5f1e8",
    text: "#191819",
    textDim: "#4a4d4a",
    textMuted: "#7b7d7b",
    good: "#317131",
    warn: "#c57500",
    bad: "#c52d29",
    shadow: "rgba(64, 52, 28, .16)",
  },
  contrast: {
    bg: "#000000",
    card: "#000000",
    cardBorder: "#ffffff",
    track: "#424142",
    chip: "#000000",
    text: "#ffffff",
    textDim: "#ffffff",
    textMuted: "#c5c2c5",
    good: "#00ff00",
    warn: "#ffff00",
    bad: "#ff0000",
    shadow: "rgba(0, 0, 0, 0)",
  },
};

export const ACCENTS: Record<ThemeName, string[]> = {
  dark: ["#e63931", "#ff9619", "#f7db21", "#4ad252", "#3ab2de", "#4a8eff", "#c555de"],
  light: ["#c52421", "#d64900", "#c59600", "#198e21", "#008a9c", "#2149bd", "#8400ce"],
  contrast: ["#ff0000", "#ffa600", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"],
};

export const PROVIDER_ICON: Record<string, string> = {
  claude: "/icons/claude.png",
  gpt: "/icons/gpt.png",
  cursor: "/icons/cursor.png",
  openrouter: "/icons/openrouter.png",
  deepseek: "/icons/deepseek.png",
  opencode: "/icons/opencode.png",
  fal: "/icons/fal.png",
  bitcoin: "/icons/bitcoin.png",
  weather: "/icons/weather.png",
  currencies: "/icons/currencies.png",
};

export function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function inverseOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#000000" : "#ffffff";
}

export function applyThemeVars(
  pal: (typeof PALETTES)[ThemeName],
  accent: string,
  flat: boolean,
): void {
  const root = document.documentElement.style;
  root.setProperty("--bg", pal.bg);
  root.setProperty("--card", pal.card);
  root.setProperty("--card-border", pal.cardBorder);
  root.setProperty("--track", pal.track);
  root.setProperty("--chip", pal.chip);
  root.setProperty("--text", pal.text);
  root.setProperty("--text-dim", pal.textDim);
  root.setProperty("--text-muted", pal.textMuted);
  root.setProperty("--good", pal.good);
  root.setProperty("--warn", pal.warn);
  root.setProperty("--bad", pal.bad);
  root.setProperty("--accent", accent);
  root.setProperty("--accent-ink", inverseOn(accent));
  root.setProperty("--shadow", pal.shadow);
  root.setProperty("--glow", flat ? "rgba(0,0,0,0)" : hexToRgba(accent, 0.16));
  root.setProperty("--bg-translucent", hexToRgba(pal.bg, flat ? 1 : 0.82));
}
