export type CardSize = "xs" | "sm" | "sw" | "sx" | "sc" | "scw" | "md" | "lg" | "xl" | "wl" | "wm" | "wxl" | "free";

export type Cell = { r: number; c: number };

export type Rect = { w: number; h: number };

export type BoardLayout = {
  size: Record<string, CardSize>;
  pos: Record<string, Cell>;
  /** Cor de fundo por card (hex #rrggbb). Texto é derivado via generateReadableColor. */
  bg?: Record<string, string>;
  /** Tamanho livre por card: retângulo custom quando size === "free". */
  custom?: Record<string, Rect>;
  /** Colunas no momento em que o usuário posicionou os cards. Resize não altera isso. */
  layoutCols?: number;
  /** Layout antigo (lista). Lido só na migração. */
  order?: string[];
};

export const FREE_MIN_W = 1;
export const FREE_MAX_H = 10;
export const FREE_MIN_H = 1;

export function normalizeCustomRect(v: unknown): Rect | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const w = Number((r as Record<string, unknown>).w);
  const h = Number((r as Record<string, unknown>).h);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  const wi = Math.floor(w);
  const hi = Math.floor(h);
  if (wi < 1 || hi < 1) return null;
  return { w: wi, h: hi };
}

export function clampFreeRect(rect: Rect, cols: number): Rect {
  return {
    w: Math.max(FREE_MIN_W, Math.min(Math.floor(rect.w), Math.max(1, cols))),
    h: Math.max(FREE_MIN_H, Math.min(Math.floor(rect.h), FREE_MAX_H)),
  };
}

export function getCustomRect(board: BoardLayout | undefined, id: string): Rect | null {
  const raw = (board?.custom as Record<string, unknown> | undefined)?.[id];
  return normalizeCustomRect(raw);
}

export function cardRect(board: BoardLayout | undefined, id: string, cols: number): Rect {
  const size = board?.size?.[id];
  if (normalizeSize(size) === "free") {
    const custom = getCustomRect(board, id);
    if (custom) return clampFreeRect(custom, cols);
    return { w: Math.min(2, Math.max(1, cols)), h: 2 };
  }
  return rectFor(size, cols);
}

export function setFreeCardSize(ids: string[], board: BoardLayout, id: string, rect: Rect, cols: number): BoardLayout {
  if (!ids.includes(id) && !board.pos[id] && !board.size[id]) return board;
  const clamped = clampFreeRect(rect, cols);
  const next: BoardLayout = {
    ...board,
    size: { ...board.size, [id]: "free" as CardSize },
    custom: { ...(board.custom || {}), [id]: clamped },
  };
  const pos = board.pos[id];
  if (!pos) return next;
  const dest = clampCell(pos, clamped, cols);
  if (clamped.w <= 2 && clamped.h <= 2) return withLayoutCols({ ...next, pos: { ...board.pos, [id]: dest } }, cols);
  return placeCard(ids, next, id, dest, cols);
}

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
  return { size: {}, pos: {}, bg: {} };
}

export function cardBg(board: BoardLayout | undefined, id: string): string | null {
  const v = board?.bg?.[id];
  return typeof v === "string" && v ? v : null;
}

export function normalizeCardBg(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  // aceita #rgb, #rrggbb, #rrggbbaa -> normaliza para #rrggbb
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s.slice(1).split("").map((c) => c + c).join("").toLowerCase()}`;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return `#${s.slice(1, 7).toLowerCase()}`;
  return null;
}

export function setCardBg(ids: string[], board: BoardLayout, id: string, color: string | null): BoardLayout {
  if (!ids.includes(id) && !cardBg(board, id) && !color) return board;
  const nextBg = { ...(board.bg || {}) };
  const norm = normalizeCardBg(color);
  if (norm) nextBg[id] = norm;
  else delete nextBg[id];
  // se não mudou, retorna o mesmo objeto
  const prev = normalizeCardBg(board.bg?.[id] ?? null);
  if (prev === norm) return board;
  return { ...board, bg: nextBg };
}

export const MIN_COLS = 4;

export function colsForWidth(width: number): number {
  if (width <= 0) return 8;
  // grid 1/4: largura da célula = metade do normal, então dobra colunas visuais mas mantém mesmo tamanho de card
  const quarterMin = Math.max(84, Math.round(CELL_MIN / 2));
  const base = Math.floor((width + CELL_GAP) / (quarterMin + CELL_GAP));
  // menor device/resolução nunca fica abaixo de MIN_COLS colunas, mesmo em telas muito estreitas
  return Math.max(MIN_COLS, base);
}

export function normalizeSize(s: string | undefined): CardSize {
  if (s === "xs" || s === "sm" || s === "sw" || s === "sx" || s === "sc" || s === "scw" || s === "md" || s === "lg" || s === "xl" || s === "wl" || s === "wm" || s === "wxl" || s === "free") return s;
  // migração: "lg" antigo (2×2) vira "xl" (extra grande), resto vira "md" (normal)
  if (s === "lg") return "xl";
  return "md";
}

export function rectFor(size: CardSize | undefined, cols: number): Rect {
  const s = normalizeSize(size);
  // grid 1/4: xs 1×1 quarter ≈84×44 quadradinho — literalmente 1 célula do grid fino
  if (s === "xs") return { w: 1, h: 1 };
  // grid 1/4: sm/sw/sx 2×1 quarter ≈188×83 retângulo largo, md 2×2 quarter ≈188×180 quadrado
  if (s === "sm" || s === "sw" || s === "sx" || s === "sc" || s === "scw") return { w: 2, h: 1 };
  if (s === "md") return { w: 2, h: 2 };
  if (s === "lg") return { w: Math.min(4, Math.max(2, cols)), h: 2 };
  if (s === "wl") return { w: Math.min(4, Math.max(2, cols)), h: 8 };
  if (s === "wm") return { w: 2, h: 3 };
  if (s === "wxl") return { w: Math.min(4, Math.max(2, cols)), h: 8 };
  if (s === "free") return { w: Math.min(2, Math.max(1, cols)), h: 2 };
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

/** Célula de origem (top-left) após clamp — igual ao que placeCard usa ao soltar. */
export function dropPreviewCell(target: Cell, size: CardSize | undefined, cols: number): Cell {
  return clampCell(target, rectFor(size, cols), cols);
}

/** Todas as células cobertas por um retângulo a partir da origem. */
export function rectCells(origin: Cell, rect: Rect): Cell[] {
  const cells: Cell[] = [];
  for (let r = origin.r; r < origin.r + rect.h; r++) {
    for (let c = origin.c; c < origin.c + rect.w; c++) {
      cells.push({ r, c });
    }
  }
  return cells;
}

export function occupancy(ids: string[], board: BoardLayout, cols: number): Map<string, string> {
  const occ = new Map<string, string>();
  for (const id of ids) {
    const pos = board.pos[id];
    if (!pos) continue;
    const rect = cardRect(board, id, cols);
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
    max = Math.max(max, pos.r + cardRect(board, id, cols).h - 1);
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

function packRowMajorBoard(ids: string[], board: BoardLayout, cols: number): Record<string, Cell> {
  const occ = new Map<string, string>();
  const pos: Record<string, Cell> = {};
  for (const id of ids) {
    const rect = cardRect(board, id, cols);
    const cell = firstFree(occ, rect, cols, 64);
    pos[id] = cell;
    visitRect(cell, rect, (r, c) => occ.set(`${r}:${c}`, id));
  }
  return pos;
}

export function packBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const size: Record<string, CardSize> = {};
  const bg: Record<string, string> = {};
  const custom: Record<string, Rect> = {};
  for (const id of ids) {
    size[id] = normalizeSize(board.size[id]);
    const norm = normalizeCardBg(board.bg?.[id] ?? null);
    if (norm) bg[id] = norm;
    if (size[id] === "free") {
      const cr = getCustomRect(board, id);
      if (cr) custom[id] = clampFreeRect(cr, cols);
      else custom[id] = { w: Math.min(2, Math.max(1, cols)), h: 2 };
    }
  }
  const tmpBoard: BoardLayout = { size, pos: {}, bg, custom, layoutCols: cols };
  return { size, pos: packRowMajorBoard(ids, tmpBoard, cols), bg, custom: Object.keys(custom).length ? custom : undefined, layoutCols: cols };
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

  // preserva bg só para ids existentes, normalizado (precisa vir antes do uso em tmpForOcc)
  const bg: Record<string, string> = {};
  for (const id of ids) {
    const raw = (prev.bg as Record<string, string> | undefined)?.[id];
    const norm = normalizeCardBg(raw);
    if (norm) bg[id] = norm;
  }
  const custom: Record<string, Rect> = {};
  for (const id of ids) {
    if (normalizeSize(prev.size[id]) === "free") {
      const cr = getCustomRect(prev, id);
      if (cr) custom[id] = clampFreeRect(cr, cols);
    }
  }
  // também preserva custom de ids que já eram free mas ainda não tinham pos
  for (const id of Object.keys(prev.custom || {})) {
    if (ids.includes(id) && !custom[id]) {
      const cr = normalizeCustomRect((prev.custom as Record<string, Rect>)[id]);
      if (cr) custom[id] = clampFreeRect(cr, cols);
    }
  }

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
      const tmpForOcc: BoardLayout = { size, pos, bg, custom, layoutCols: prev.layoutCols };
      const occ = occupancy(ids.filter((id) => pos[id]), tmpForOcc, cols);
      for (const id of missing) {
        const rect = cardRect(tmpForOcc, id, cols);
        const cell = firstFree(occ, rect, cols, 64);
        pos[id] = cell;
        visitRect(cell, rect, (r, c) => occ.set(`${r}:${c}`, id));
      }
    }
  }

  for (const id of Object.keys(pos)) {
    if (!seen.has(id)) delete pos[id];
  }
  return { size, pos, bg, custom: Object.keys(custom).length ? custom : undefined, layoutCols: prev.layoutCols };
}

function overlaps(ids: string[], board: BoardLayout, cols: number): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    const pos = board.pos[id];
    if (!pos) return true;
    const rect = cardRect(board, id, cols);
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
    return pos.c + cardRect(board, id, cols).w <= cols;
  });
}

/** Layout só para desenhar: se a largura mudou, reempilha sem gravar o localStorage. */
export function displayBoard(ids: string[], board: BoardLayout, cols: number): BoardLayout {
  const synced = syncBoard(ids, board, cols);
  const savedCols = board.layoutCols;
  const sameCols = savedCols == null || savedCols === cols;
  if (sameCols && cardsFit(ids, synced, cols) && !overlaps(ids, synced, cols)) return synced;
  const ordered = readingOrder(ids, synced);
  return { size: synced.size, pos: packRowMajorBoard(ordered, synced, cols), bg: synced.bg, custom: synced.custom, layoutCols: savedCols };
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
    pos[id] = clampCell(cur, cardRect(next, id, cols), cols);
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
      const rect = cardRect(next, id, cols);
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
    if ((normalizeCardBg(a.bg?.[id] ?? null) || "") !== (normalizeCardBg(b.bg?.[id] ?? null) || "")) return false;
    const ca = a.custom?.[id] ? `${a.custom[id].w}x${a.custom[id].h}` : "";
    const cb = b.custom?.[id] ? `${b.custom[id].w}x${b.custom[id].h}` : "";
    if (ca !== cb) return false;
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
  const rect = cardRect(board, id, cols);
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
    const oRect = cardRect(board, other, cols);
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
  const custom = { ...(board.custom || {}) };
  if (size === "free") {
    // free sem rect explícito mantém o anterior ou usa 2x2
    if (!custom[id]) custom[id] = { w: Math.min(2, Math.max(1, cols)), h: 2 };
  } else {
    delete custom[id];
  }
  const next: BoardLayout = { ...board, size: { ...board.size, [id]: size }, custom: Object.keys(custom).length ? custom : undefined };
  const pos = board.pos[id];
  if (!pos) return next;
  const rect = size === "free" ? clampFreeRect(custom[id] || { w: 2, h: 2 }, cols) : rectFor(size, cols);
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
  const bgSrc = normalizeCardBg(board.bg?.[id] ?? board.bg?.[baseId] ?? null);
  const customSrc = (board.custom?.[id] || board.custom?.[baseId]) as Rect | undefined;
  const nextCustom = { ...(board.custom || {}) } as Record<string, Rect>;
  if (size === "free" && customSrc) nextCustom[newId] = clampFreeRect(customSrc, cols);
  else if (size === "free" && !customSrc) nextCustom[newId] = { w: Math.min(2, Math.max(1, cols)), h: 2 };
  const next: BoardLayout = { size: { ...board.size, [newId]: size as CardSize }, pos: { ...board.pos }, bg: { ...(board.bg || {}), ...(bgSrc ? { [newId]: bgSrc } : {}) }, custom: Object.keys(nextCustom).length ? nextCustom : undefined, layoutCols: board.layoutCols };
  const occ = occupancy([...ids, newId], { ...board, size: next.size, pos: next.pos }, cols);
  // place new clone at first free
  const rect = size === "free" ? clampFreeRect((next.custom?.[newId] as Rect) || { w: 2, h: 2 }, cols) : rectFor(size as CardSize, cols);
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
  const bg = { ...(board.bg || {}) };
  const custom = { ...(board.custom || {}) } as Record<string, Rect>;
  delete size[id];
  delete pos[id];
  delete bg[id];
  delete custom[id];
  return { ...board, size, pos, bg, custom: Object.keys(custom).length ? custom : undefined };
}
