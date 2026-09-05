export type ThemeName = "dark" | "light" | "contrast" | "auto";

export type ResolvedThemeName = Exclude<ThemeName, "auto">;

export function getSystemTheme(): ResolvedThemeName {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: ThemeName): ResolvedThemeName {
  if (theme !== "auto") return theme;
  return getSystemTheme();
}

export const PALETTES: Record<
  ResolvedThemeName,
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
    bg: "#0f0f0f",
    card: "#1c1c1c",
    cardBorder: "#2e2e2e",
    track: "#2a2a2a",
    chip: "#232323",
    text: "#f5f5f5",
    textDim: "#a1a1a1",
    textMuted: "#737373",
    good: "#8cbe94",
    warn: "#e6a65a",
    bad: "#de6d6b",
    shadow: "rgba(0, 0, 0, .55)",
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

export const ACCENTS: Record<ResolvedThemeName, string[]> = {
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
  bitcoin: "/icons/bitcoin.png?v=20260901",
  adsense: "/icons/adsense.png?v=20260901",
  retroachievements: "/icons/retroachievements.png",
  weather: "/icons/weather.png?v=20260901",
  currencies: "/icons/currencies.png",
  git: "/icons/git.png",
  calendar: "/icons/calendar.png",
  calendarTasks: "/icons/calendar.png",
  rss: "/icons/rss.png",
};

// URL da página oficial de plano/uso de cada provider de IA (usado para o atalho "ver site oficial").
export const PROVIDER_SITE_URL: Record<string, string> = {
  claude: "https://claude.ai/settings/usage",
  gpt: "https://chatgpt.com/#settings/Usage",
  cursor: "https://cursor.com/dashboard?tab=usage",
  openrouter: "https://openrouter.ai/settings/credits",
  deepseek: "https://platform.deepseek.com/usage",
  opencode: "https://opencode.ai",
  fal: "https://fal.ai/dashboard/billing",
  retroachievements: "https://retroachievements.org/controlpanel.php",
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
  pal: (typeof PALETTES)[ResolvedThemeName],
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
  // Sincroniza <meta name="theme-color"> com a cor de destaque (accent / NameToColor)
  // para colorir a barra do navegador / PWA no mobile e desktop.
  if (typeof document !== "undefined") {
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      m.content = accent;
      document.head.appendChild(m);
    } else {
      metas.forEach((m) => m.setAttribute("content", accent));
    }
  }
}
