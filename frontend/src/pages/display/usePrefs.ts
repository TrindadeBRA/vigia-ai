import { useEffect, useState } from "react";
import type { WidgetKind } from "../../components/AddWidgetModal";
import type { NoteColorId } from "../../components/cards/NoteCard";
import type { Lang } from "../../i18n";
import type { ThemeName } from "../../theme";

export type NoteData = { id: string; text: string; color: NoteColorId };

export type Prefs = { theme: ThemeName; accent: number; accentCustom?: string | null; lang: Lang; focus?: boolean; widgets?: WidgetKind[]; notes?: NoteData[] };

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
