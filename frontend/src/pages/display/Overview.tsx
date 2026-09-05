import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  cardBg,
  cardRect,
  CELL_GAP,
  colsForWidth,
  displayBoard,
  dropTarget,
  duplicateBoard,
  emptyCells,
  getCustomRect,
  isCloneId,
  normalizeSize,
  packBoard,
  padRowsForHeight,
  placeCard,
  rectCells,
  rectFor,
  removeCloneBoard,
  rowPxFor,
  setCardBg,
  setCardSize,
  setFreeCardSize,
  slotKey,
  syncBoard,
  type BoardLayout,
  type CardSize,
  type Cell
} from "../../board";
import { cn } from "../../cn";
import { DownloadIcon, MaximizeIcon, MinimizeIcon, UploadIcon } from "../../components/icons";
import { payloadAgeMs } from "../../format";
import { gridWallpaperUrl } from "../../hooks/useGridWallpaper";
import type { T } from "../../i18n";
import { accentLink, emptyNote, num, overviewBoard } from "../../tw";
import { boardCollision, downloadBoardJson, parseBoardJson } from "./boardHelpers";
import { FreeSizeModal } from "./FreeSizeModal";
import { BoardTile, EmptySlot, ProviderCard } from "./BoardTile";
import type { Pal, ProviderMeta } from "./types";

/** Largura da sidebar (Sidebar `w-[264px]`) — usada para compensar o cálculo de colunas do grid quando ela some no modo foco. */
const SIDEBAR_W = 264;

function GridIOButtons({ board, onImport, t }: { board: BoardLayout; onImport: (b: BoardLayout) => void; t: T }) {
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function flash(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg((m) => (m === text ? null : m)), 3000);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBoardJson(String(reader.result || ""));
      if (!parsed) {
        flash(t.gridImportError);
        return;
      }
      onImport(parsed);
      flash(t.gridImported);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink" title={t.exportGrid} aria-label={t.exportGrid} onClick={() => downloadBoardJson(board)}>
        <DownloadIcon size={14} />
      </button>
      <button type="button" className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink" title={t.importGrid} aria-label={t.importGrid} onClick={() => inputRef.current?.click()}>
        <UploadIcon size={14} />
      </button>
      <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={handleFile} />
      {msg ? <span className="text-[11.5px] text-ink3">{msg}</span> : null}
    </div>
  );
}

export function Overview({
  providers,
  updatedAt,
  now,
  t,
  pal,
  board,
  onBoard,
  onColsChange,
  onOpen,
  focus,
  onToggleFocus,
  gridWallpaperId,
  onOpenWallpaper,
  onOpenAddWidget,
  kiosk,
  onRemoveImage,
  onDuplicateImage,
  onRemoveNote,
  onDuplicateNote,
  onUpdateNote,
  wallpaperParallax = true,
}: {
  providers: ProviderMeta[];
  updatedAt: string;
  now: number;
  t: T;
  pal: Pal;
  board: BoardLayout;
  onBoard: (fn: (b: BoardLayout) => BoardLayout) => void;
  onColsChange?: (cols: number) => void;
  onOpen: (id: string) => void;
  focus: boolean;
  onToggleFocus: () => void;
  gridWallpaperId: string | null;
  onOpenWallpaper: () => void;
  onOpenAddWidget: () => void;
  kiosk?: boolean;
  onRemoveImage?: (id: string) => void;
  onDuplicateImage?: (id: string) => void;
  onRemoveNote?: (id: string) => void;
  onDuplicateNote?: (id: string) => void;
  onUpdateNote?: (id: string, patch: { text?: string; color?: string }) => void;
  /** Wallpaper fixo (parallax): ancorado na área visível do `<main>`, não estica com o conteúdo e não rola com o grid. Default true. */
  wallpaperParallax?: boolean;
}) {
  const failing = providers.filter((p) => !p.ok).length;
  const age = payloadAgeMs(updatedAt, now);
  const agoS = age == null ? null : Math.max(0, Math.round(age / 1000));
  const byId = new Map(providers.map((p) => [p.id, p]));
  const ids = providers.map((p) => p.id);
  const idsKey = ids.join("|");
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(8);
  const [pad, setPad] = useState(12);
  const [fillPx, setFillPx] = useState(0);
  const [cellPx, setCellPx] = useState(104);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liftSize, setLiftSize] = useState<{ w: number; h: number } | null>(null);
  const [dropPreview, setDropPreview] = useState<Cell | null>(null);
  const [freeTarget, setFreeTarget] = useState<string | null>(null);
  const [bgRect, setBgRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const unitPx = rowPxFor(cellPx);
  const readonly = Boolean(kiosk);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const layout = displayBoard(ids, board, cols);
  const holes = emptyCells(ids, layout, cols, pad);
  const active = activeId ? byId.get(activeId) : null;
  const activeSize: CardSize = activeId ? normalizeSize(layout.size[activeId]) : "md";
  const activeRect = activeId ? cardRect(layout, activeId, cols) : rectFor(activeSize, cols);
  const holeKeys = new Set(holes.map((h) => `${h.r}:${h.c}`));
  const previewCells = dropPreview && activeId ? rectCells(dropPreview, activeRect) : [];
  const previewKeys = new Set(previewCells.map((c) => `${c.r}:${c.c}`));

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth < 1) return;
      // Modo foco esconde a sidebar (só ocupa espaço acima de 860px) e o grid ganha essa
      // largura de volta — descontamos aqui pra manter a mesma quantidade de colunas do
      // modo normal, independente do device, e trocar de modo não trocar de "board" salvo.
      const widthForCols = focus && window.innerWidth > 860 ? Math.max(0, el.clientWidth - SIDEBAR_W) : el.clientWidth;
      const nextCols = colsForWidth(widthForCols);
      setCols(nextCols);
      onColsChange?.(nextCols);
      const cell = Math.max(80, Math.floor((el.clientWidth - CELL_GAP * Math.max(0, nextCols - 1)) / Math.max(1, nextCols)));
      setCellPx(cell);
      const main = el.closest("main");
      const gridBox = el.getBoundingClientRect();
      const mainRect = main ? main.getBoundingClientRect() : null;
      const mainBottom = mainRect ? mainRect.bottom : window.innerHeight;
      if (mainRect) {
        setBgRect({ top: mainRect.top, left: mainRect.left, width: mainRect.width, height: mainRect.height });
      }
      const tiles = [...el.children].filter((node) => node.querySelector('[aria-label="Arrastar"], [aria-label="Drag"], [aria-label="Arrastrar"]'));
      const lastBottom = tiles.reduce((max, node) => Math.max(max, node.getBoundingClientRect().bottom), gridBox.top);
      const leftover = Math.round(mainBottom - lastBottom);
      setFillPx(Math.max(0, Math.round(mainBottom - gridBox.top)));
      setPad(padRowsForHeight(leftover, cell));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.closest("main")) ro.observe(el.closest("main") as Element);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [idsKey, focus]);

  useEffect(() => {
    onBoard((b) => syncBoard(ids, b, b.layoutCols || cols));
  }, [idsKey]);

  function onDragStart(e: DragStartEvent) {
    if (readonly) return;
    setActiveId(String(e.active.id));
    setDropPreview(null);
    const box = e.active.rect.current.initial;
    setLiftSize(box ? { w: box.width, h: box.height } : null);
  }

  function onDragOver(e: DragOverEvent) {
    if (readonly) return;
    const from = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || over === from) {
      setDropPreview(null);
      return;
    }
    const dest = dropTarget(over, layout);
    if (!dest) {
      setDropPreview(null);
      return;
    }
    {
      const r = cardRect(layout, from, cols);
      const clamped = { r: dest.r, c: Math.max(0, Math.min(dest.c, Math.max(0, cols - r.w))) };
      setDropPreview(clamped);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    if (readonly) return;
    const from = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setLiftSize(null);
    setDropPreview(null);
    if (!over || over === from) return;
    const dest = dropTarget(over, layout);
    if (!dest) return;
    onBoard((b) => {
      const cur = displayBoard(ids, b, cols);
      return placeCard(ids, cur, from, dest, cols);
    });
  }

  function handleDuplicate(id: string) {
    onBoard((b) => {
      const cur = displayBoard(ids, b, cols);
      return duplicateBoard(ids, cur, id, cols);
    });
  }

  function handleRemove(id: string) {
    if (id.startsWith("img:")) {
      onRemoveImage?.(id);
      onBoard((b) => {
        const size = { ...b.size };
        const pos = { ...b.pos };
        const bg = { ...(b.bg || {}) };
        delete size[id];
        delete pos[id];
        delete bg[id];
        return { ...b, size, pos, bg };
      });
      return;
    }
    if (id.startsWith("note:")) {
      onRemoveNote?.(id);
      onBoard((b) => {
        const size = { ...b.size };
        const pos = { ...b.pos };
        const bg = { ...(b.bg || {}) };
        delete size[id];
        delete pos[id];
        delete bg[id];
        return { ...b, size, pos, bg };
      });
      return;
    }
    onBoard((b) => removeCloneBoard(b, id));
  }

  function handleDuplicateImage(id: string) {
    if (id.startsWith("img:")) {
      onDuplicateImage?.(id);
      return;
    }
    handleDuplicate(id);
  }

  function handleDuplicateNote(id: string) {
    if (id.startsWith("note:")) {
      onDuplicateNote?.(id);
      return;
    }
    handleDuplicate(id);
  }

  const gridBgUrl = gridWallpaperUrl(gridWallpaperId);
  const parallax = wallpaperParallax && Boolean(bgRect);
  return (
    <div className={cn("flex min-h-full flex-col", gridBgUrl && !parallax && "relative", gridBgUrl && !parallax && !focus && "overflow-hidden rounded-xl")}>
      {/* Grid wallpaper: por padrão fixo (parallax) — ancorado na área visível do <main>, ponta a ponta,
          sem esticar e sem rolar junto do grid; só os cards se movem por cima ao rolar. */}
      {gridBgUrl ? (
        parallax && bgRect ? (
          <div className="pointer-events-none fixed z-0" style={{ top: bgRect.top, left: bgRect.left, width: bgRect.width, height: bgRect.height }} aria-hidden>
            <img
              key={gridWallpaperId}
              src={gridBgUrl}
              alt=""
              draggable={false}
              className="size-full object-cover"
              style={{ imageRendering: "auto" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>
        ) : (
          <>
            <img
              key={gridWallpaperId}
              src={gridBgUrl}
              alt=""
              draggable={false}
              className={cn(
                "pointer-events-none object-cover",
                focus ? "fixed inset-0 z-0 size-full" : "absolute inset-0 z-0 size-full",
              )}
              style={{ imageRendering: "auto" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className={cn("pointer-events-none", focus ? "fixed inset-0 z-0 bg-black/25" : "absolute inset-0 z-0 bg-black/25")} aria-hidden />
          </>
        )
      ) : null}
      <div className={cn("relative z-10 flex flex-col", gridBgUrl && !focus && "p-3", focus && gridBgUrl && "p-4")}>
        <div className="mb-[18px] flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink2">
            <span className={cn("size-[7px] shrink-0 rounded-full", failing ? "bg-bad shadow-[0_0_5px_var(--bad)]" : "bg-good shadow-[0_0_5px_var(--good)]", "[.flat_&]:shadow-none")} />
            <span>{failing ? t.errorsCount(failing) : t.allOk}</span>
            <span className={num}>{agoS != null ? `· ${agoS < 3 ? t.agoNow : t.agoSecs(agoS)}` : ""}</span>
          </div>
          {kiosk ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-edge bg-chip px-2.5 py-1 text-[12px] font-medium text-ink2 hover:border-accent hover:text-ink"
                title={t.resetLayout}
                onClick={() =>
                  onBoard((b) => {
                    const baseIds = ids.filter((id) => !isCloneId(id));
                    const clean: BoardLayout = { size: {}, pos: {}, bg: {}, layoutCols: b.layoutCols };
                    for (const id of baseIds) {
                      if (b.size[id]) clean.size[id] = b.size[id];
                      if (b.pos[id]) clean.pos[id] = b.pos[id];
                      if (b.bg?.[id]) (clean.bg as Record<string, string>)[id] = b.bg[id];
                    }
                    return packBoard(baseIds, displayBoard(baseIds, clean, cols), cols);
                  })
                }
              >
                {t.resetLayout}
              </button>
              <button
                type="button"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink"
                title={t.addWidget}
                aria-label={t.addWidget}
                onClick={onOpenAddWidget}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <button
                type="button"
                className={cn("flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink", focus && "border-accent text-accent")}
                title="Wallpaper do grid"
                aria-label="Wallpaper do grid"
                onClick={onOpenWallpaper}
              >
                {/* ícone simples de imagem */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
              </button>
              <button
                type="button"
                className={cn(
                  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink",
                  focus && "border-accent text-accent",
                )}
                title={t.focusMode}
                aria-label={t.focusMode}
                onClick={onToggleFocus}
              >
                {focus ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
              </button>
              <GridIOButtons board={board} onImport={(b) => onBoard(() => b)} t={t} />
            </div>
          )}
        </div>
        {providers.length === 0 ? (
          <div className={emptyNote}>
            {t.noProviders}{" "}
            <Link to="/display/config" className={accentLink}>
              {t.configCta}
            </Link>
          </div>
        ) : readonly ? (
          <div
            ref={gridRef}
            className={cn(overviewBoard, "min-h-0 flex-1")}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridAutoRows: unitPx,
              minHeight: fillPx > 0 ? fillPx : undefined,
            }}
          >
            {ids.map((id) => {
              const p = byId.get(id);
              const pos = layout.pos[id];
              if (!p || !pos) return null;
              const size = normalizeSize(layout.size[id]);
              const bg = cardBg(layout, id);
              const isNote = id.startsWith("note:");
              if (isNote && onUpdateNote) {
                (p as unknown as Record<string, unknown>)._onNoteUpdate = onUpdateNote;
              }
              return (
                <div
                  key={id}
                  style={{ gridColumn: `${pos.c + 1} / span ${cardRect(layout, id, cols).w}`, gridRow: `${pos.r + 1} / span ${cardRect(layout, id, cols).h}` }}
                  className="min-h-0 min-w-0 h-full"
                >
                  <ProviderCard
                    p={p}
                    pal={pal}
                    size={size}
                    t={t}
                    nowMs={now}
                    bg={bg}
                    onOpen={() => onOpen(id)}
                    onSetSize={() => { }}
                    readonly={true}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={boardCollision}
            autoScroll={{ threshold: { x: 0.08, y: 0.12 }, acceleration: 12 }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => { setActiveId(null); setLiftSize(null); setDropPreview(null); }}
          >
            <div
              ref={gridRef}
              className={cn(overviewBoard, "min-h-0 flex-1")}
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridAutoRows: unitPx,
                minHeight: fillPx > 0 ? fillPx : undefined,
              }}
            >
              {holes.map((cell) => (
                <div
                  key={slotKey(cell.r, cell.c)}
                  style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
                  className="min-h-0 min-w-0 h-full"
                >
                  <EmptySlot
                    id={slotKey(cell.r, cell.c)}
                    active={Boolean(activeId)}
                    preview={previewKeys.has(`${cell.r}:${cell.c}`)}
                  />
                </div>
              ))}
              {ids.map((id) => {
                const p = byId.get(id);
                const pos = layout.pos[id];
                if (!p || !pos) return null;
                const size = normalizeSize(layout.size[id]);
                const bg = cardBg(layout, id);
                const isImage = id.startsWith("img:");
                const isNote = id.startsWith("note:");
                // injeta handler de update para notas
                if (isNote && onUpdateNote) {
                  (p as unknown as Record<string, unknown>)._onNoteUpdate = onUpdateNote;
                }
                return (
                  <BoardTile
                    key={id}
                    p={p}
                    pal={pal}
                    size={size}
                    t={t}
                    nowMs={now}
                    col={pos.c}
                    row={pos.r}
                    rect={cardRect(layout, id, cols)}
                    bg={bg}
                    onOpen={() => onOpen(id)}
                    onSetSize={(next) => {
                      if (next === "free") { setFreeTarget(id); return; }
                      onBoard((b) => setCardSize(ids, displayBoard(ids, b, cols), id, next, cols));
                    }}
                    onFree={(fid) => setFreeTarget(fid)}
                    onDuplicate={isImage ? handleDuplicateImage : isNote ? handleDuplicateNote : handleDuplicate}
                    onRemove={handleRemove}
                    onSetBg={(cid, next) => onBoard((b) => setCardBg(ids, displayBoard(ids, b, cols), cid, next))}
                  />
                );
              })}
              {previewCells
                .filter((cell) => !holeKeys.has(`${cell.r}:${cell.c}`))
                .map((cell) => (
                  <div
                    key={`drop-preview-${cell.r}:${cell.c}`}
                    aria-hidden
                    className="pointer-events-none z-[3] min-h-0 min-w-0 rounded-2xl border border-dashed border-accent bg-chip transition-colors duration-150"
                    style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
                  />
                ))}
            </div>
            <DragOverlay zIndex={80} dropAnimation={null}>
              {active ? (
                <div
                  className="pointer-events-none cursor-grabbing"
                  style={(() => { const r = activeId ? cardRect(layout, activeId, cols) : rectFor(activeSize, cols); return { width: liftSize?.w || (r.w * cellPx + (r.w - 1) * CELL_GAP), height: liftSize?.h || (r.h * unitPx + (r.h - 1) * CELL_GAP) }; })()}
                >
                  <ProviderCard p={active} pal={pal} size={activeSize} t={t} nowMs={now} lifted onOpen={() => { }} onSetSize={() => { }} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
      <FreeSizeModal
        open={Boolean(freeTarget)}
        onClose={() => setFreeTarget(null)}
        cols={cols}
        initial={freeTarget ? getCustomRect(layout, freeTarget) : null}
        t={t}
        onApply={(rect) => {
          if (!freeTarget) return;
          const fid = freeTarget;
          onBoard((b) => setFreeCardSize(ids, displayBoard(ids, b, cols), fid, rect, cols));
        }}
      />
    </div>
  );
}
