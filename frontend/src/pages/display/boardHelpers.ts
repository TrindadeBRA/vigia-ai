import { closestCorners, pointerWithin, type CollisionDetection } from "@dnd-kit/core";
import { baseIdFromClone, emptyBoard, isCloneId, type BoardLayout } from "../../board";
import type { BoardsMap } from "../../hooks/useGridBoards";
import type { ProviderMeta } from "./types";

export const boardCollision: CollisionDetection = (args: Parameters<CollisionDetection>[0]) => {
  // O card arrastado continua no DOM na posição antiga (só o DragOverlay segue o
  // cursor) e também é um droppable — sem excluir ele mesmo, passar o ponteiro
  // sobre a própria área antiga resolve "over" pro próprio card, e o caller trata
  // isso como "não moveu" (over === from). Isso travava mover o card pra qualquer
  // posição que ainda se sobrepusesse ao retângulo antigo dele.
  const droppableContainers = args.droppableContainers.filter((c) => c.id !== args.active.id);
  const filteredArgs = { ...args, droppableContainers };
  const hits = pointerWithin(filteredArgs);
  return hits.length ? hits : closestCorners(filteredArgs);
};

/** Layout salvo para a quantidade exata de colunas visíveis (o "breakpoint" é o número de colunas, não um bucket fixo). */
export function boardForCols(boards: BoardsMap, cols: number): BoardLayout {
  return boards[cols] || emptyBoard();
}

// ── Exportar/importar grade (todos os boards salvos, por qtd. de colunas) ──
// v1 exportava só o board da resolução atual — reimportar numa janela com
// número de colunas diferente perdia o arranjo (layoutCols batia errado e o
// board era reempilhado). v2 exporta o mapa `boards` inteiro, cada bucket
// já com seu próprio layoutCols, então qualquer janela reencontra o layout
// que já usou.

export function downloadBoardJson(boards: BoardsMap) {
  const payload = { version: 2, exported_at: new Date().toISOString(), boards };
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

function validateBoard(candidate: unknown): BoardLayout | null {
  if (!candidate || typeof candidate !== "object") return null;
  const { size, pos } = candidate as Record<string, unknown>;
  if (typeof size !== "object" || size === null || typeof pos !== "object" || pos === null) return null;
  // bg/custom são opcionais; se vierem, valida que são objetos
  const bg = (candidate as Record<string, unknown>).bg;
  if (bg !== undefined && (typeof bg !== "object" || bg === null)) return null;
  const custom = (candidate as Record<string, unknown>).custom;
  if (custom !== undefined && (typeof custom !== "object" || custom === null)) return null;
  return candidate as BoardLayout;
}

/**
 * Aceita o formato novo (v2, `{ boards }` com todos os buckets) e o antigo
 * (v1, `{ board }` ou o board cru) — arquivos exportados antes continuam
 * importáveis, entrando no bucket `fallbackCols` (a janela atual) já que não
 * carregam um mapa completo.
 */
export function parseBoardsJson(text: string, fallbackCols: number): BoardsMap | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.boards && typeof obj.boards === "object") {
    const out: BoardsMap = {};
    for (const [cols, raw] of Object.entries(obj.boards as Record<string, unknown>)) {
      const b = validateBoard(raw);
      if (b) out[cols] = b;
    }
    return Object.keys(out).length ? out : null;
  }
  const candidate = "board" in obj ? obj.board : obj;
  const b = validateBoard(candidate);
  if (!b) return null;
  const key = b.layoutCols ? String(b.layoutCols) : String(fallbackCols);
  return { [key]: b };
}

// ── Clones: expande ProviderMeta com blocos duplicados salvos no board ─────

export function expandProvidersWithClones(base: ProviderMeta[], board: BoardLayout | undefined): ProviderMeta[] {
  if (!board) return base;
  const byId = new Map(base.map((p) => [p.id, p]));
  const out: ProviderMeta[] = [...base];
  // coleta clones salvos em board.pos/size/bg que começam com baseId + CLONE_SEP
  for (const key of new Set([...Object.keys(board.pos), ...Object.keys(board.size), ...Object.keys(board.bg || {}), ...Object.keys(board.custom || {})])) {
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
