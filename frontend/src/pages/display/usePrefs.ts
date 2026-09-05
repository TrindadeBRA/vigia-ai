import { useEffect, useState } from "react";
import type { WidgetKind } from "../../components/AddWidgetModal";
import type { Lang } from "../../i18n";
import type { ThemeName } from "../../theme";

export type Prefs = { theme: ThemeName; accent: number; lang: Lang; focus?: boolean; widgets?: WidgetKind[] };

export function usePrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void] {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      const raw = localStorage.getItem("vigia_display_prefs");
      if (raw) return { theme: "dark", accent: 0, lang: "pt", ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { theme: "dark", accent: 0, lang: "pt" };
  });
  useEffect(() => {
    try {
      localStorage.setItem("vigia_display_prefs", JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);
  return [prefs, (fn) => setPrefs(fn)];
}
