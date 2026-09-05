import { closestCorners, pointerWithin, type CollisionDetection } from "@dnd-kit/core";
import { baseIdFromClone, emptyBoard, isCloneId, type BoardLayout } from "../../board";
import type { BoardsMap } from "../../hooks/useGridBoards";
import type { ProviderMeta } from "./types";

export const boardCollision: CollisionDetection = (args: Parameters<CollisionDetection>[0]) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

/** Layout salvo para a quantidade exata de colunas visíveis (o "breakpoint" é o número de colunas, não um bucket fixo). */
export function boardForCols(boards: BoardsMap, cols: number): BoardLayout {
  return boards[cols] || emptyBoard();
}

// ── Exportar/importar grade (board.size/pos) como JSON ─────────────────

export function downloadBoardJson(board: BoardLayout) {
  const payload = { version: 1, exported_at: new Date().toISOString(), board };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vigia-grade-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseBoardJson(text: string): BoardLayout | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const candidate = data && typeof data === "object" && "board" in (data as Record<string, unknown>) ? (data as Record<string, unknown>).board : data;
  if (!candidate || typeof candidate !== "object") return null;
  const { size, pos } = candidate as Record<string, unknown>;
  if (typeof size !== "object" || size === null || typeof pos !== "object" || pos === null) return null;
  return candidate as BoardLayout;
}

// ── Clones: expande ProviderMeta com blocos duplicados salvos no board ─────

export function expandProvidersWithClones(base: ProviderMeta[], board: BoardLayout | undefined): ProviderMeta[] {
  if (!board) return base;
  const byId = new Map(base.map((p) => [p.id, p]));
  const out: ProviderMeta[] = [...base];
  // coleta clones salvos em board.pos/size que começam com baseId + CLONE_SEP
  for (const key of new Set([...Object.keys(board.pos), ...Object.keys(board.size)])) {
    if (!isCloneId(key)) continue;
    const baseId = baseIdFromClone(key);
    const orig = byId.get(baseId);
    if (!orig) continue;
    if (out.some((p) => p.id === key)) continue;
    out.push({ ...orig, id: key });
  }
  return out;
}

export function baseIdForProvider(id: string): string {
  return isCloneId(id) ? baseIdFromClone(id) : id;
}
