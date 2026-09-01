export type CardSize = "lg" | "sm";

export type Cell = { r: number; c: number };

export type BoardLayout = {
  size: Record<string, CardSize>;
  pos: Record<string, Cell>;
  /** Layout antigo (lista). Lido só na migração. */
  order?: string[];
};

export const CELL_MIN = 128;
export const CELL_GAP = 14;
export const SLOT_MIN = 104;
export const CELL_ROW = 0.88;

export function rowPxFor(cellPx: number): number {
  return Math.max(88, Math.round(cellPx * CELL_ROW));
}

export const MIN_PAD_ROWS = 3;

export function emptyBoard(): BoardLayout {
  return { size: {}, pos: {} };
}

export function colsForWidth(width: number): number {
  if (width <= 0) return 4;
  return Math.max(1, Math.floor((width + CELL_GAP) / (CELL_MIN + CELL_GAP)));
}

export function spanFor(size: CardSize | undefined, cols: number): number {
  return size === "sm" ? 1 : Math.min(2, Math.max(1, cols));
}

export function slotKey(r: number, c: number): string {
  return `slot:${r}:${c}`;
}

export function parseSlot(id: string): Cell | null {
  const m = /^slot:(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}

function visitRect(origin: Cell, span: number, fn: (r: number, c: number) => void) {
  for (let r = origin.r; r < origin.r + span; r++) {
    for (let c = origin.c; c < origin.c + span; c++) fn(r, c);
  }
}

function clampCell(cell: Cell, span: number, cols: number): Cell {
  const c = Math.max(0, Math.min(cell.c, Math.max(0, cols - span)));
  return { r: Math.max(0, cell.r), c };
}

export function occupancy(ids: string[], board: BoardLayout, cols: number): Map<string, string> {
  const occ = new Map<string, string>();
  for (const id of ids) {
    const pos = board.pos[id];
    if (!pos) continue;
    const span = spanFor(board.size[id], cols);
    visitRect(pos, span, (r, c) => occ.set(`${r}:${c}`, id));
  }
  return occ;
}

function isFree(occ: Map<string, string>, cell: Cell, span: number, cols: number, ignore?: string): boolean {
  if (cell.c < 0 || cell.r < 0 || cell.c + span > cols) return false;
  let ok = true;
  visitRect(cell, span, (r, c) => {
    const owner = occ.get(`${r}:${c}`);
    if (owner && owner !== ignore) ok = false;
  });
  return ok;
}

function maxRowOf(ids: string[], board: BoardLayout, cols: number): number {
  let max = -1;
  for (const id of ids) {
    const pos = board.pos[id];
    if (!pos) continue;
    max = Math.max(max, pos.r + spanFor(board.size[id], cols) - 1);
  }
  return max;
}

export function occupiedRows(ids: string[], board: BoardLayout, cols = 4): number {
  return Math.max(1, maxRowOf(ids, board, cols) + 1);
}

export function rowCount(ids: string[], board: BoardLayout, cols: number, pad = MIN_PAD_ROWS): number {
  return occupiedRows(ids, board, cols) + pad;
}

export function padRowsForHeight(leftoverPx: number, cellPx = SLOT_MIN): number {
  const rowH = cellPx + CELL_GAP;
  if (leftoverPx <= 0) return MIN_PAD_ROWS;
  return Math.max(MIN_PAD_ROWS, Math.ceil((leftoverPx + CELL_GAP) / rowH));
}

function firstFree(occ: Map<string, string>, span: number, cols: number, rows: number): Cell {
  const limit = Math.max(rows, 8);
  for (let r = 0; r < limit; r++) {
    for (let c = 0; c <= cols - span; c++) {
      if (isFree(occ, { r, c }, span, cols)) return { r, c };
    }
  }
  return { r: limit, c: 0 };
}

function packRowMajor(ids: string[], size: Record<string, CardSize>, cols: number): Record<string, Cell> {
  const occ = new Map<string, string>();
  const pos: Record<string, Cell> = {};
  for (const id of ids) {
    const span = spanFor(size[id], cols);
    const cell = firstFree(occ, span, cols, 32);
    pos[id] = cell;
    visitRect(cell, span, (r, c) => occ.set(`${r}:${c}`, id));
  }
  return pos;
}

export function packBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const size: Record<string, CardSize> = {};
  for (const id of ids) size[id] = board.size[id] === "sm" ? "sm" : "lg";
  return { size, pos: packRowMajor(ids, size, cols) };
}

function migrateOrder(ids: string[], prev: BoardLayout, cols: number): Record<string, Cell> {
  const seen = new Set(ids);
  const ordered = [...(prev.order || []).filter((id) => seen.has(id)), ...ids.filter((id) => !(prev.order || []).includes(id))];
  return packRowMajor(ordered, prev.size, cols);
}

export function syncBoard(ids: string[], board: BoardLayout | undefined, cols = 4): BoardLayout {
  const prev = board || emptyBoard();
  const seen = new Set(ids);
  const size: Record<string, CardSize> = {};
  for (const id of ids) size[id] = prev.size[id] === "sm" ? "sm" : "lg";

  let pos: Record<string, Cell> = {};
  const hasPos = ids.some((id) => prev.pos?.[id]);
  if (!hasPos && (prev.order?.length || 0) > 0) {
    pos = migrateOrder(ids, { ...prev, size }, cols);
  } else {
    for (const id of ids) {
      if (prev.pos?.[id]) pos[id] = prev.pos[id];
    }
    const missing = ids.filter((id) => !pos[id]);
    if (missing.length) {
      const occ = occupancy(ids.filter((id) => pos[id]), { size, pos }, cols);
      for (const id of missing) {
        const span = spanFor(size[id], cols);
        const cell = firstFree(occ, span, cols, 32);
        pos[id] = cell;
        visitRect(cell, span, (r, c) => occ.set(`${r}:${c}`, id));
      }
    }
  }

  for (const id of Object.keys(pos)) {
    if (!seen.has(id)) delete pos[id];
  }
  return { size, pos };
}

export function fitBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const next = syncBoard(ids, board, cols);
  const pos: Record<string, Cell> = { ...next.pos };
  for (const id of ids) {
    const cur = pos[id];
    if (!cur) continue;
    pos[id] = clampCell(cur, spanFor(next.size[id], cols), cols);
  }
  const owners = new Map<string, string[]>();
  occupancy(ids, { ...next, pos }, cols).forEach((id, key) => {
    const list = owners.get(key) || [];
    list.push(id);
    owners.set(key, list);
  });
  const conflicted = new Set<string>();
  owners.forEach((list) => {
    if (list.length > 1) list.forEach((id) => conflicted.add(id));
  });
  if (conflicted.size) {
    const fresh = occupancy(
      ids.filter((id) => !conflicted.has(id)),
      { ...next, pos },
      cols,
    );
    for (const id of ids) {
      if (!conflicted.has(id)) continue;
      const span = spanFor(next.size[id], cols);
      const cell = firstFree(fresh, span, cols, 32);
      pos[id] = cell;
      visitRect(cell, span, (r, c) => fresh.set(`${r}:${c}`, id));
    }
  }
  const fitted = { ...next, pos };
  return sameBoard(board, fitted, ids) ? board : fitted;
}

export function sameBoard(a: BoardLayout | undefined, b: BoardLayout, ids: string[]): boolean {
  if (!a) return false;
  for (const id of ids) {
    if ((a.size[id] || "lg") !== (b.size[id] || "lg")) return false;
    const pa = a.pos?.[id];
    const pb = b.pos?.[id];
    if (!pa || !pb || pa.r !== pb.r || pa.c !== pb.c) return false;
  }
  return true;
}

export function placeCard(ids: string[], board: BoardLayout, id: string, target: Cell, cols: number): BoardLayout {
  if (!ids.includes(id)) return board;
  const span = spanFor(board.size[id], cols);
  const dest = clampCell(target, span, cols);
  const from = board.pos[id] || dest;
  const others = ids.filter((x) => x !== id);
  const occ = occupancy(others, board, cols);
  const hit = new Set<string>();
  visitRect(dest, span, (r, c) => {
    const owner = occ.get(`${r}:${c}`);
    if (owner) hit.add(owner);
  });
  if (from.r === dest.r && from.c === dest.c && hit.size === 0) return board;

  const pos: Record<string, Cell> = { ...board.pos, [id]: dest };
  for (const other of hit) {
    const oSpan = spanFor(board.size[other], cols);
    const ignoreOcc = occupancy(
      ids.filter((x) => x !== other),
      { ...board, pos },
      cols,
    );
    if (isFree(ignoreOcc, from, oSpan, cols)) {
      pos[other] = clampCell(from, oSpan, cols);
    } else {
      pos[other] = firstFree(ignoreOcc, oSpan, cols, Math.max(8, dest.r + 3));
    }
  }
  const next = { ...board, pos };
  return sameBoard(board, next, ids) ? board : next;
}

export function setCardSize(ids: string[], board: BoardLayout, id: string, size: CardSize, cols: number): BoardLayout {
  const next = { ...board, size: { ...board.size, [id]: size } };
  const pos = board.pos[id];
  if (!pos) return next;
  const span = spanFor(size, cols);
  const dest = clampCell(pos, span, cols);
  if (span === 1) return { ...next, pos: { ...board.pos, [id]: dest } };
  return placeCard(ids, next, id, dest, cols);
}

export function emptyCells(ids: string[], board: BoardLayout, cols: number, pad = MIN_PAD_ROWS): Cell[] {
  const rows = rowCount(ids, board, cols, pad);
  const occ = occupancy(ids, board, cols);
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occ.has(`${r}:${c}`)) cells.push({ r, c });
    }
  }
  return cells;
}

export function dropTarget(overId: string, board: BoardLayout): Cell | null {
  const slot = parseSlot(overId);
  if (slot) return slot;
  const pos = board.pos[overId];
  return pos || null;
}
