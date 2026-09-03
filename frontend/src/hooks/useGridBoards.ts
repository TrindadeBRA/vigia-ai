import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardLayout } from "../board";

export type BoardsMap = Record<string, BoardLayout>;

const LS_KEY = "vigia_grid_boards";
const LEGACY_PREFS_KEY = "vigia_display_prefs";
const SAVE_DEBOUNCE_MS = 600;
// migração única do sistema antigo de 3 buckets (mobile/tablet/desktop) para
// colunas exatas — valor representativo de cada bucket antigo
const LEGACY_BP_COLS: Record<string, string> = { mobile: "4", tablet: "8", desktop: "12" };

function readCache(): BoardsMap {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as BoardsMap;
  } catch {
    /* ignore */
  }
  return {};
}

function writeCache(boards: BoardsMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(boards));
  } catch {
    /* ignore */
  }
}

/** Lê o `boards`/`board` (3 buckets) que ficavam dentro de vigia_display_prefs, uma vez. */
function migrateLegacyBoards(): BoardsMap {
  try {
    const raw = localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) return {};
    const prefs = JSON.parse(raw) as { board?: BoardLayout; boards?: Record<string, BoardLayout> };
    const out: BoardsMap = {};
    for (const [bp, board] of Object.entries(prefs.boards || {})) {
      const cols = LEGACY_BP_COLS[bp];
      if (cols && board) out[cols] = board;
    }
    if (!Object.keys(out).length && prefs.board) out["8"] = prefs.board;
    return out;
  } catch {
    return {};
  }
}

/**
 * Layouts do grid persistidos no coletor (JSON em /api/board), indexados pela
 * quantidade de colunas visíveis — assim o grid editado no celular reaparece
 * igual no monitor fullHD, e o contrário também, em vez de ficar preso ao
 * localStorage de um navegador só.
 */
export function useGridBoards(): [BoardsMap, (fn: (b: BoardsMap) => BoardsMap) => void, boolean] {
  const [boards, setBoardsState] = useState<BoardsMap>(() => {
    const cached = readCache();
    if (Object.keys(cached).length) return cached;
    return migrateLegacyBoards();
  });
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const persist = useCallback((next: BoardsMap) => {
    writeCache(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch("/api/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boards: next }),
      }).catch(() => { /* offline: fica só no cache local até a próxima tentativa */ });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/board", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { boards?: BoardsMap };
        if (cancelled) return;
        if (j.boards && Object.keys(j.boards).length) {
          setBoardsState(j.boards);
          writeCache(j.boards);
        } else {
          // servidor ainda não tem nada salvo: usa o que já temos (cache local
          // ou migração antiga) como semente inicial pro servidor.
          setBoardsState((cur) => {
            if (Object.keys(cur).length) persist(cur);
            return cur;
          });
        }
      } catch {
        /* offline: segue com o cache local */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [persist]);

  const setBoards = useCallback((fn: (b: BoardsMap) => BoardsMap) => {
    setBoardsState((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      persist(next);
      return next;
    });
  }, [persist]);

  return [boards, setBoards, ready];
}
