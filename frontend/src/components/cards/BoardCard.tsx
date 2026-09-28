import { useDroppable } from "@dnd-kit/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  boardInnerDropId,
  INNER_GAP,
  INNER_MAX_COLS,
  INNER_MAX_ROWS,
  INNER_MIN_COLS,
  cardBg,
  cardRect,
  displayBoard,
  emptyBoard,
  innerSlotKey,
  normalizeSize,
  occupancy,
  occupiedRows,
  rectCells,
  rectFor,
  type BoardLayout,
  type CardSize,
  type Cell,
  type Rect,
} from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import type { ProviderMeta } from "../../pages/display/types";
import { CARD_ORDER, SizeMenu } from "../../pages/display/SizeMenu";
import { TileColorPicker } from "../../pages/display/TileColorPicker";

/** Widget "Board" — contêiner que abriga outros widgets numa grade 1:1. */
export function boardAllowedSizes(): CardSize[] {
  return ["md", "lg", "xl", "wl", "wxl", "free"];
}

export function boardSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "xl") return t.cardXl;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  if (s === "free") return t.cardFree;
  return t.cardNormal;
}

/** Extras injetados pelo Overview (padrão `_onX` usado em todo o display). */
type BoardExtras = {
  _innerProviders?: ProviderMeta[];
  _innerBoard?: BoardLayout;
  _boardTitle?: string | null;
  _boardEditable?: boolean;
  /** Retângulo do quadro no grid pai (w×h) — a grade interna replica exatamente esse tamanho. */
  _boardRect?: Rect;
  _onRenameTitle?: (title: string) => void;
  _onInnerRemove?: (id: string) => void;
  _onInnerSetSize?: (id: string, size: CardSize) => void;
  _onInnerSetBg?: (id: string, next: string | null) => void;
  _renderInner?: (innerP: ProviderMeta, innerSize: CardSize) => ReactNode;
  _onInnerGrid?: (g: { cols: number; rows: number }) => void;
  /** Célula alvo do preview de drop livre dentro do quadro (slot vazio destacado). */
  _innerDropPreview?: Cell | null;
  /** Id real do tile interno sendo arrastado (para desenhar o retângulo do preview). */
  _innerDragId?: string | null;
};

/** Não rende enquanto a caixa não foi medida uma vez (1 frame). Grade interna = retângulo do quadro no grid pai (cols×rows), 1:1. */
function gridFromBox(cols: number, rows: number, w: number) {
  const c = Math.max(1, Math.min(INNER_MAX_COLS, Math.floor(cols)));
  const r = Math.max(1, Math.min(INNER_MAX_ROWS, Math.floor(rows)));
  const slotPx = Math.max(12, Math.floor((w - INNER_GAP * (c - 1)) / c));
  return { cols: c, slotPx, rows: r };
}

/** Célula vazia do grid interno — droppable no modo editável, decorativa no kiosk. */
function InnerSlot({ id, active, preview, droppable }: { id: string; active: boolean; preview?: boolean; droppable?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable, data: { inner: true } });
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className={cn(
        "min-h-0 min-w-0 rounded-lg border border-dashed transition-colors duration-150",
        preview || isOver ? "border-accent bg-chip" : active ? "border-edge/70 bg-chip/20" : "border-edge/40 bg-chip/10",
      )}
    />
  );
}

export function BoardBoardCard({ p, size, t }: { p: ProviderMeta; size: CardSize; t: T }) {
  const s = normalizeSize(size);
  const compact = s === "md" || s === "lg";
  const e = p as unknown as BoardExtras;
  const innerProviders = e._innerProviders ?? [];
  const innerIdsKey = innerProviders.map((x) => x.id).join("|");
  const editable = Boolean(e._boardEditable);
  const displayTitle = e._boardTitle?.trim() || p.title;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lastGridKey = useRef("");

  const { setNodeRef, isOver } = useDroppable({ id: boardInnerDropId(p.id), data: { inner: true } });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth < 4 || el.clientHeight < 4) return;
      setBox((prev) => (prev && prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const boardRect = e._boardRect ?? rectFor(size, 8);
  const baseGrid = box && box.w > 4 ? gridFromBox(boardRect.w, boardRect.h, box.w) : null;

  const innerIds = useMemo(() => innerProviders.map((x) => x.id), [innerIdsKey]);
  const innerLayout = useMemo(() => displayBoard(innerIds, e._innerBoard ?? emptyBoard(), baseGrid?.cols ?? INNER_MIN_COLS), [innerIdsKey, e._innerBoard, baseGrid?.cols]);

  // Rows = altura real do conteúdo + 1 (respiro) — conteúdo maior que o grid
  // derivado do rect não renderiza slot vazio e o drop livre vira firstFreeCell.
  const grid = useMemo(() => {
    if (!baseGrid) return null;
    const contentRows = occupiedRows(innerIds, innerLayout, baseGrid.cols) + 1;
    const rows = Math.min(INNER_MAX_ROWS, Math.max(baseGrid.rows, contentRows));
    return rows === baseGrid.rows ? baseGrid : { ...baseGrid, rows };
  }, [baseGrid, innerLayout, innerIdsKey]);

  const emptySlots: Cell[] = useMemo(() => {
    if (!grid) return [];
    const occ = occupancy(innerIds, innerLayout, grid.cols);
    const out: Cell[] = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!occ.has(`${r}:${c}`)) out.push({ r, c });
      }
    }
    return out;
  }, [grid?.cols, grid?.rows, innerIdsKey, innerLayout]);

  // Tamanhos que cabem no quadro atual (cols×rows) — o SizeMenu só mostra o que dá pra encaixar sem estourar.
  const innerAllowed = useMemo<CardSize[]>(() => {
    if (!grid) return [];
    return CARD_ORDER.filter((s) => {
      if (s === "free") return false;
      const r = rectFor(s, grid.cols);
      return r.w <= grid.cols && r.h <= grid.rows;
    });
  }, [grid?.cols, grid?.rows]);

  useEffect(() => {
    if (!grid || !e._onInnerGrid) return;
    const key = `${grid.cols}x${grid.rows}`;
    if (lastGridKey.current === key) return;
    lastGridKey.current = key;
    e._onInnerGrid({ cols: grid.cols, rows: grid.rows });
  }, [grid?.cols, grid?.rows, e._onInnerGrid]);

  const dropPreview = e._innerDropPreview ?? null;
  const dragId = e._innerDragId && innerIds.includes(e._innerDragId) ? e._innerDragId : null;
  const previewCells = dropPreview && dragId && grid
    ? rectCells(dropPreview, cardRect(innerLayout, dragId, grid.cols))
    : [];
  const previewKeys = new Set(previewCells.map((c) => `${c.r}:${c.c}`));
  const dragActive = Boolean(e._innerDragId);

  const startRename = () => {
    setDraft(displayTitle);
    setEditing(true);
  };
  const commitRename = () => {
    setEditing(false);
    e._onRenameTitle?.(draft.trim());
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onBlur={commitRename}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") commitRename();
              else if (ev.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 rounded-md border border-edge bg-chip px-1.5 py-0.5 text-[12.5px] font-[650] leading-none text-ink outline-none focus:border-accent"
            aria-label={t.boardRename}
          />
        ) : (
          <span className={cn("min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{displayTitle}</span>
        )}
        {editable && e._onRenameTitle && !editing ? (
          <button
            type="button"
            onClick={startRename}
            title={t.boardRename}
            aria-label={t.boardRename}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink3 opacity-0 transition-opacity hover:text-ink group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 [.is-revealed_&]:opacity-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
        ) : null}
      </div>
      <div
        ref={(node) => {
          setNodeRef(node);
          boxRef.current = node;
        }}
        className={cn("relative min-h-0 flex-1 overflow-hidden rounded-xl transition-shadow", isOver && "ring-2 ring-inset ring-accent/70")}
        style={grid ? { display: "grid", gridTemplateColumns: `repeat(${grid.cols}, ${grid.slotPx}px)`, gridAutoRows: `${grid.slotPx}px`, gap: INNER_GAP, alignContent: "start" } : undefined}
      >
        {emptySlots.map((cell) => (
          <div
            key={`${cell.r}:${cell.c}`}
            className="min-h-0 min-w-0"
            style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
          >
            <InnerSlot
              id={innerSlotKey(p.id, cell.r, cell.c)}
              active={dragActive}
              preview={previewKeys.has(`${cell.r}:${cell.c}`)}
              droppable={editable}
            />
          </div>
        ))}
        {innerProviders.map((innerP) => {
          const pos = innerLayout.pos[innerP.id];
          if (!pos || !grid) return null;
          const rect = cardRect(innerLayout, innerP.id, grid.cols);
          const innerSize = normalizeSize(innerLayout.size[innerP.id]);
          return (
            <div
              key={innerP.id}
              className="group/inner relative min-h-0 min-w-0 rounded-lg"
              style={{ gridColumn: `${pos.c + 1} / span ${rect.w}`, gridRow: `${pos.r + 1} / span ${rect.h}`, zIndex: 2 }}
            >
              {e._renderInner ? e._renderInner(innerP, innerSize) : null}
              {(editable && (e._onInnerRemove || e._onInnerSetSize || e._onInnerSetBg)) ? (
                <div className="absolute right-1 top-1 z-[3] flex items-center rounded-lg border border-edge bg-chip opacity-0 shadow-sm transition-opacity group-hover/inner:opacity-100 group-focus-within/inner:opacity-100 [.is-revealed_&]:opacity-100">
                  {e._onInnerSetSize ? (
                    <SizeMenu size={innerSize} t={t} allowed={innerAllowed} onChange={(next) => e._onInnerSetSize?.(innerP.id, next)} />
                  ) : null}
                  {e._onInnerSetBg ? (
                    <TileColorPicker value={cardBg(innerLayout, innerP.id)} onChange={(next) => e._onInnerSetBg?.(innerP.id, next)} />
                  ) : null}
                  {e._onInnerRemove ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      title={t.boardItemRemove}
                      aria-label={t.boardItemRemove}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        e._onInnerRemove?.(innerP.id);
                      }}
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-chip hover:text-bad"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {previewCells.map((cell) => (
          <div
            key={`inner-preview-${cell.r}:${cell.c}`}
            aria-hidden
            className="pointer-events-none z-[3] min-h-0 min-w-0 rounded-lg border border-dashed border-accent bg-chip/70"
            style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
          />
        ))}
        {innerProviders.length === 0 && editable ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] leading-snug text-ink3">{t.boardDropHint}</div>
        ) : null}
      </div>
    </div>
  );
}