export type CardSize = "sm" | "sw" | "sx" | "sc" | "scw" | "md" | "lg" | "xl" | "wl" | "wm" | "wxl";

export type Cell = { r: number; c: number };

export type Rect = { w: number; h: number };

export type BoardLayout = {
  size: Record<string, CardSize>;
  pos: Record<string, Cell>;
  /** Colunas no momento em que o usuário posicionou os cards. Resize não altera isso. */
  layoutCols?: number;
  /** Layout antigo (lista). Lido só na migração. */
  order?: string[];
};

export const CELL_MIN = 168;
export const CELL_GAP = 14;
export const SLOT_MIN = 104;
export const CELL_ROW = 0.96;
// unidade = meia linha normal: permite card pequeno = 1/2 do normal (2 pequenos empilham = 1 normal)
// grid 1/4 = quarter: 4 unidades = 1 normal, pequeno quadradinho = 2×2 quarter = mesmo visual mas grid mais fino
export const CELL_ROW_HALF = 0.48;

export function rowPxFor(cellPx: number): number {
  return Math.max(88, Math.round(cellPx * CELL_ROW));
}
export function halfRowPxFor(cellPx: number): number {
  return Math.max(44, Math.round((rowPxFor(cellPx) - CELL_GAP) / 2));
}
export function quarterRowPxFor(cellPx: number): number {
  return Math.max(22, Math.round((halfRowPxFor(cellPx) - CELL_GAP) / 2));
}

export const MIN_PAD_ROWS = 12;

export function emptyBoard(): BoardLayout {
  return { size: {}, pos: {} };
}

export function colsForWidth(width: number): number {
  if (width <= 0) return 8;
  // grid 1/4: largura da célula = metade do normal, então dobra colunas visuais mas mantém mesmo tamanho de card
  const quarterMin = Math.max(84, Math.round(CELL_MIN / 2));
  return Math.max(2, Math.floor((width + CELL_GAP) / (quarterMin + CELL_GAP)));
}

export function normalizeSize(s: string | undefined): CardSize {
  if (s === "sm" || s === "sw" || s === "sx" || s === "sc" || s === "scw" || s === "md" || s === "lg" || s === "xl" || s === "wl" || s === "wm" || s === "wxl") return s;
  // migração: "lg" antigo (2×2) vira "xl" (extra grande), resto vira "md" (normal)
  if (s === "lg") return "xl";
  return "md";
}

export function rectFor(size: CardSize | undefined, cols: number): Rect {
  const s = normalizeSize(size);
  // grid 1/4: sm/sw/sx 2×1 quarter ≈188×83 retângulo largo, md 2×2 quarter ≈188×180 quadrado
  if (s === "sm" || s === "sw" || s === "sx" || s === "sc" || s === "scw") return { w: 2, h: 1 };
  if (s === "md") return { w: 2, h: 2 };
  if (s === "lg") return { w: Math.min(4, Math.max(2, cols)), h: 2 };
  if (s === "wl") return { w: 2, h: 8 };
  if (s === "wm") return { w: 2, h: 3 };
  if (s === "wxl") return { w: Math.min(4, Math.max(2, cols)), h: 8 };
  return { w: Math.min(4, Math.max(2, cols)), h: 4 };
}

export function spanFor(size: CardSize | undefined, cols: number): number {
  return rectFor(size, cols).w;
}

export function slotKey(r: number, c: number): string {
  return `slot:${r}:${c}`;
}

export function parseSlot(id: string): Cell | null {
  const m = /^slot:(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}

function visitRect(origin: Cell, rect: Rect, fn: (r: number, c: number) => void) {
  for (let r = origin.r; r < origin.r + rect.h; r++) {
    for (let c = origin.c; c < origin.c + rect.w; c++) fn(r, c);
  }
}

function clampCell(cell: Cell, rect: Rect, cols: number): Cell {
  const c = Math.max(0, Math.min(cell.c, Math.max(0, cols - rect.w)));
  return { r: Math.max(0, cell.r), c };
}

export function occupancy(ids: string[], board: BoardLayout, cols: number): Map<string, string> {
  const occ = new Map<string, string>();
  for (const id of ids) {
    const pos = board.pos[id];
    if (!pos) continue;
    const rect = rectFor(board.size[id], cols);
    visitRect(pos, rect, (r, c) => occ.set(`${r}:${c}`, id));
  }
  return occ;
}

function isFree(occ: Map<string, string>, cell: Cell, rect: Rect, cols: number, ignore?: string): boolean {
  if (cell.c < 0 || cell.r < 0 || cell.c + rect.w > cols) return false;
  let ok = true;
  visitRect(cell, rect, (r, c) => {
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
    max = Math.max(max, pos.r + rectFor(board.size[id], cols).h - 1);
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
  const rowH = rowPxFor(cellPx) + CELL_GAP;
  if (leftoverPx <= 0) return MIN_PAD_ROWS;
  return Math.max(MIN_PAD_ROWS, Math.ceil((leftoverPx + CELL_GAP) / rowH));
}

function firstFree(occ: Map<string, string>, rect: Rect, cols: number, rows: number): Cell {
  const limit = Math.max(rows, 16);
  for (let r = 0; r < limit; r++) {
    for (let c = 0; c <= cols - rect.w; c++) {
      if (isFree(occ, { r, c }, rect, cols)) return { r, c };
    }
  }
  return { r: limit, c: 0 };
}

function packRowMajor(ids: string[], size: Record<string, CardSize>, cols: number): Record<string, Cell> {
  const occ = new Map<string, string>();
  const pos: Record<string, Cell> = {};
  for (const id of ids) {
    const rect = rectFor(size[id], cols);
    const cell = firstFree(occ, rect, cols, 64);
    pos[id] = cell;
    visitRect(cell, rect, (r, c) => occ.set(`${r}:${c}`, id));
  }
  return pos;
}

export function packBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const size: Record<string, CardSize> = {};
  for (const id of ids) size[id] = normalizeSize(board.size[id]);
  return { size, pos: packRowMajor(ids, size, cols), layoutCols: cols };
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
  for (const id of ids) size[id] = normalizeSize(prev.size[id]);

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
        const rect = rectFor(size[id], cols);
        const cell = firstFree(occ, rect, cols, 64);
        pos[id] = cell;
        visitRect(cell, rect, (r, c) => occ.set(`${r}:${c}`, id));
      }
    }
  }

  for (const id of Object.keys(pos)) {
    if (!seen.has(id)) delete pos[id];
  }
  return { size, pos, layoutCols: prev.layoutCols };
}

function overlaps(ids: string[], board: BoardLayout, cols: number): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    const pos = board.pos[id];
    if (!pos) return true;
    const rect = rectFor(board.size[id], cols);
    let hit = false;
    visitRect(pos, rect, (r, c) => {
      const key = `${r}:${c}`;
      if (seen.has(key)) hit = true;
      seen.add(key);
    });
    if (hit) return true;
  }
  return false;
}

function readingOrder(ids: string[], board: BoardLayout): string[] {
  return [...ids].sort((a, b) => {
    const pa = board.pos[a] || { r: 0, c: 0 };
    const pb = board.pos[b] || { r: 0, c: 0 };
    return pa.r - pb.r || pa.c - pb.c;
  });
}

function cardsFit(ids: string[], board: BoardLayout, cols: number): boolean {
  return ids.every((id) => {
    const pos = board.pos[id];
    if (!pos) return false;
    return pos.c + rectFor(board.size[id], cols).w <= cols;
  });
}

/** Layout só para desenhar: se a largura mudou, reempilha sem gravar o localStorage. */
export function displayBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const synced = syncBoard(ids, board, cols);
  const savedCols = board.layoutCols;
  const sameCols = savedCols == null || savedCols === cols;
  if (sameCols && cardsFit(ids, synced, cols) && !overlaps(ids, synced, cols)) return synced;
  const ordered = readingOrder(ids, synced);
  return { size: synced.size, pos: packRowMajor(ordered, synced.size, cols), layoutCols: savedCols };
}

export function withLayoutCols(board: BoardLayout, cols: number): BoardLayout {
  return { ...board, layoutCols: cols };
}

export function fitBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const next = syncBoard(ids, board, cols);
  const pos: Record<string, Cell> = { ...next.pos };
  for (const id of ids) {
    const cur = pos[id];
    if (!cur) continue;
    pos[id] = clampCell(cur, rectFor(next.size[id], cols), cols);
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
      const rect = rectFor(next.size[id], cols);
      const cell = firstFree(fresh, rect, cols, 64);
      pos[id] = cell;
      visitRect(cell, rect, (r, c) => fresh.set(`${r}:${c}`, id));
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
  // clones extras: se b tem clone de ids que a não tem (ou vice-versa), não é igual
  const aKeys = new Set([...Object.keys(a.pos || {}), ...Object.keys(a.size || {})]);
  const bKeys = new Set([...Object.keys(b.pos || {}), ...Object.keys(b.size || {})]);
  for (const k of bKeys) {
    if (!aKeys.has(k) && isCloneId(k) && ids.includes(baseIdFromClone(k))) return false;
    if (!aKeys.has(k) && ids.includes(k)) return false;
  }
  for (const k of aKeys) {
    if (!bKeys.has(k) && isCloneId(k) && ids.includes(baseIdFromClone(k))) return false;
    if (!bKeys.has(k) && ids.includes(k)) return false;
  }
  return true;
}

export function placeCard(ids: string[], board: BoardLayout, id: string, target: Cell, cols: number): BoardLayout {
  if (!ids.includes(id)) return board;
  const rect = rectFor(board.size[id], cols);
  const dest = clampCell(target, rect, cols);
  const from = board.pos[id] || dest;
  const others = ids.filter((x) => x !== id);
  const occ = occupancy(others, board, cols);
  const hit = new Set<string>();
  visitRect(dest, rect, (r, c) => {
    const owner = occ.get(`${r}:${c}`);
    if (owner) hit.add(owner);
  });
  if (from.r === dest.r && from.c === dest.c && hit.size === 0) return board;

  const pos: Record<string, Cell> = { ...board.pos, [id]: dest };
  for (const other of hit) {
    const oRect = rectFor(board.size[other], cols);
    const ignoreOcc = occupancy(
      ids.filter((x) => x !== other),
      { ...board, pos },
      cols,
    );
    if (isFree(ignoreOcc, from, oRect, cols)) {
      pos[other] = clampCell(from, oRect, cols);
    } else {
      pos[other] = firstFree(ignoreOcc, oRect, cols, Math.max(8, dest.r + 3));
    }
  }
  const next = { ...board, pos };
  return sameBoard(board, next, ids) ? board : withLayoutCols(next, cols);
}

export function setCardSize(ids: string[], board: BoardLayout, id: string, size: CardSize, cols: number): BoardLayout {
  const next = { ...board, size: { ...board.size, [id]: size } };
  const pos = board.pos[id];
  if (!pos) return next;
  const rect = rectFor(size, cols);
  const dest = clampCell(pos, rect, cols);
  if (rect.w <= 2 && rect.h <= 2) return withLayoutCols({ ...next, pos: { ...board.pos, [id]: dest } }, cols);
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

// ── Clones: múltiplos blocos do mesmo provider (ex: 2× Claude) ──────────

export const CLONE_SEP = "::clone:";

export function isCloneId(id: string): boolean {
  return id.includes(CLONE_SEP);
}

export function baseIdFromClone(id: string): string {
  const idx = id.indexOf(CLONE_SEP);
  return idx >= 0 ? id.slice(0, idx) : id;
}

export function nextCloneId(baseId: string, board: BoardLayout): string {
  let max = 0;
  for (const key of Object.keys(board.pos)) {
    if (key === baseId || key.startsWith(baseId + CLONE_SEP)) {
      const suffix = key.slice(baseId.length + CLONE_SEP.length);
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  for (const key of Object.keys(board.size)) {
    if (key.startsWith(baseId + CLONE_SEP)) {
      const suffix = key.slice(baseId.length + CLONE_SEP.length);
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${baseId}${CLONE_SEP}${max + 1}`;
}

export function duplicateBoard(ids: string[], board: BoardLayout, id: string, cols: number): BoardLayout {
  const baseId = baseIdFromClone(id);
  if (!ids.includes(baseId) && !ids.includes(id)) return board;
  const newId = nextCloneId(baseId, board);
  const size = board.size[id] || board.size[baseId] || "md";
  const next: BoardLayout = { size: { ...board.size, [newId]: size as CardSize }, pos: { ...board.pos }, layoutCols: board.layoutCols };
  const occ = occupancy([...ids, newId], { ...board, size: next.size, pos: next.pos }, cols);
  // place new clone at first free
  const rect = rectFor(size as CardSize, cols);
  const free = firstFree(occ, rect, cols, 64);
  // firstFree was computed with newId already in occupancy? recalc without newId
  const occ2 = occupancy(ids, board, cols);
  const free2 = firstFree(occ2, rect, cols, 64);
  next.pos[newId] = free2;
  void free;
  return next;
}

export function removeCloneBoard(board: BoardLayout, id: string): BoardLayout {
  if (!isCloneId(id)) return board;
  const size = { ...board.size };
  const pos = { ...board.pos };
  delete size[id];
  delete pos[id];
  return { ...board, size, pos };
}
