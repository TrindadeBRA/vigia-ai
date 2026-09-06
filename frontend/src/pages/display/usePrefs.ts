import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetKind } from "../../components/AddWidgetModal";
import type { Lang } from "../../i18n";
import type { ThemeName } from "../../theme";

export type Prefs = { theme: ThemeName; accent: number; accentCustom?: string | null; lang: Lang; focus?: boolean; widgets?: WidgetKind[]; wallpaperParallax?: boolean };

const DEFAULT_PREFS: Prefs = { theme: "dark", accent: 0, lang: "pt" };
const LEGACY_LS_KEY = "vigia_display_prefs";
const SAVE_DEBOUNCE_MS = 500;

/** Migração única do vigia_display_prefs antigo (localStorage) pro backend. */
function readLegacyPrefs(): Partial<Prefs> | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    localStorage.removeItem(LEGACY_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<Prefs>;
  } catch {
    return null;
  }
}

/**
 * Preferências de exibição (tema, cor, idioma, foco, widgets ligados),
 * persistidas no coletor (/api/prefs) — sem localStorage como fonte de
 * verdade, pra web e Electron enxergarem sempre a mesma coisa.
 */
export function usePrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void, boolean] {
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const persist = useCallback((next: Prefs) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch("/api/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => { /* offline: tenta de novo na próxima mudança */ });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/prefs", { cache: "no-store" });
        const j = r.ok ? ((await r.json()) as Partial<Prefs>) : {};
        if (cancelled) return;
        if (j && typeof j === "object" && Object.keys(j).length) {
          setPrefsState({ ...DEFAULT_PREFS, ...j });
        } else {
          const legacy = readLegacyPrefs();
          if (legacy) {
            const next = { ...DEFAULT_PREFS, ...legacy };
            setPrefsState(next);
            persist(next);
          }
        }
      } catch {
        /* offline: fica no default até a próxima tentativa */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [persist]);

  const setPrefs = useCallback((fn: (p: Prefs) => Prefs) => {
    setPrefsState((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      persist(next);
      return next;
    });
  }, [persist]);

  return [prefs, setPrefs, ready];
}
