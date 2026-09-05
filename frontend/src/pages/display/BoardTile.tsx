import { useDraggable, useDroppable } from "@dnd-kit/core";
import { isCloneId, normalizeSize, type CardSize } from "../../board";
import { cn } from "../../cn";
import { ntcGenerateReadableColor, useNameToColor } from "../../hooks/useNameToColor";
import type { T } from "../../i18n";
import { cardLabel, errorText, viewFade } from "../../tw";
import { Icon, MetricRow } from "./MetricRow";
import { TileChrome } from "./SizeMenu";
import {
  AdsenseTileCard,
  BitcoinTileCard,
  ClaudeTileCard,
  ClockTileCard,
  CreditsTileCard,
  CurrenciesTileCard,
  CursorTileCard,
  EyeTileCard,
  GitTileCard,
  GptTileCard,
  ImageTileCard,
  NoteTileCard,
  RetroAchievementsTileCard,
  RssTileCard,
  WeatherTileCard,
} from "./TileCards";
import type { Pal, ProviderMeta } from "./types";

export function ProviderCard({
  p,
  pal,
  size,
  dragging,
  lifted,
  t,
  nowMs,
  grip,
  bg,
  readonly,
  onOpen,
  onSetSize,
  onDuplicate,
  onRemove,
  onSetBg,
  onFree,
}: {
  p: ProviderMeta;
  pal: Pal;
  size: CardSize;
  dragging?: boolean;
  lifted?: boolean;
  t: T;
  nowMs?: number;
  grip?: object;
  bg?: string | null;
  readonly?: boolean;
  onOpen: () => void;
  onSetSize: (next: CardSize) => void;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
  onSetBg?: (id: string, next: string | null) => void;
  onFree?: (id: string) => void;
}) {
  // Cards dedicados com layout por tamanho
  if (p.provider === "claude") {
    return <ClaudeTileCard p={p} pal={pal} size={size} dragging={dragging} lifted={lifted} t={t} nowMs={nowMs} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "cursor") {
    return <CursorTileCard p={p} pal={pal} size={size} dragging={dragging} lifted={lifted} t={t} nowMs={nowMs} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "gpt") {
    return <GptTileCard p={p} pal={pal} size={size} dragging={dragging} lifted={lifted} t={t} nowMs={nowMs} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "bitcoin") {
    return <BitcoinTileCard p={p} pal={pal} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "adsense") {
    return <AdsenseTileCard p={p} pal={pal} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "openrouter" || p.provider === "deepseek" || p.provider === "opencode" || p.provider === "fal") {
    return <CreditsTileCard p={p} pal={pal} size={size} dragging={dragging} lifted={lifted} t={t} nowMs={nowMs} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "weather" || p.kind === "weather") {
    return <WeatherTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "currencies" || p.kind === "currencies") {
    return <CurrenciesTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "git" || p.kind === "git") {
    return <GitTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "retroachievements" || p.kind === "retroachievements") {
    return <RetroAchievementsTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "rss" || p.kind === "rss") {
    return <RssTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onOpen={onOpen} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  // Widgets extras: sem "conta"/dados de backend, só visuais
  if (p.provider === "clock") {
    return <ClockTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} nowMs={nowMs ?? Date.now()} grip={grip} bg={bg} readonly={readonly} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "eye") {
    return <EyeTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onFree={onFree} />;
  }
  if (p.provider === "note" || p.kind === "note") {
    return <NoteTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onUpdate={(id, patch) => (p as unknown as { _onNoteUpdate?: (id: string, patch: { text?: string; color?: string }) => void })._onNoteUpdate?.(id, patch)} />;
  }
  if (p.provider === "image" || p.kind === "image") {
    return <ImageTileCard p={p} size={size} dragging={dragging} lifted={lifted} t={t} grip={grip} bg={bg} readonly={readonly} onSetSize={onSetSize} onDuplicate={onDuplicate} onRemove={onRemove} onSetBg={onSetBg} onEdit={() => onOpen()} onTransformChange={(id, next) => (p as unknown as { _onImageTransform?: (id: string, next: { x: number; y: number; scale: number }) => void })._onImageTransform?.(id, next)} />;
  }
  const sm = normalizeSize(size) === "sm";
  const { ready: ntcReady } = useNameToColor();
  void ntcReady;
  const fallbackBg = (p as unknown as { _bg?: string | null })._bg ?? null;
  const bgForStyle = fallbackBg;
  const fg = bgForStyle ? (ntcGenerateReadableColor(bgForStyle)?.[0] ?? null) : null;
  const toRgba = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  };
  const genericStyle = bgForStyle && fg
    ? ({
      backgroundColor: bgForStyle,
      color: fg,
      ["--card" as unknown as string]: bgForStyle,
      ["--card-border" as unknown as string]: toRgba(fg, 0.14),
      ["--chip" as unknown as string]: toRgba(fg, 0.1),
      ["--text" as unknown as string]: fg,
      ["--text-dim" as unknown as string]: toRgba(fg, 0.78),
      ["--text-muted" as unknown as string]: toRgba(fg, 0.58),
      borderColor: toRgba(fg, 0.14),
    } as React.CSSProperties)
    : bgForStyle
      ? ({ backgroundColor: bgForStyle } as React.CSSProperties)
      : undefined;
  const onSetBgGeneric = (p as unknown as { _onSetBg?: (id: string, next: string | null) => void })._onSetBg;
  return (
    <div
      className={cn(
        "group/tile relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border bg-panel shadow-card",
        "px-3.5 pb-3 pt-3",
        lifted && "border-accent shadow-card-hover rotate-[1.5deg] cursor-grabbing",
        dragging && !lifted && "border-dashed border-edge opacity-35",
        !dragging && !lifted && "border-edge transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover",
        "[.flat_&]:shadow-none [.flat_&]:hover:translate-y-0 [.flat_&]:rotate-0",
        !lifted && viewFade,
      )}
      style={genericStyle}
    >
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} isClone={isCloneId(p.id)} onDuplicate={onDuplicate} onRemove={onRemove} bg={fallbackBg} onSetBg={onSetBgGeneric} onFree={onFree} />
      ) : null}
      <button type="button" className={cn("flex min-w-0 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-ink", sm ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")} onClick={onOpen}>
        <div className="relative shrink-0">
          <Icon id={p.provider} compact={sm} large={!sm} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", p.ok ? "bg-good" : "bg-bad")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", sm ? "text-[12.5px]" : "text-[14px]")}>{p.title}</div>
          {p.label ? <div className={cardLabel}>{p.label}</div> : null}
        </div>
      </button>
      <button
        type="button"
        className={cn(
          "flex min-h-0 flex-1 cursor-pointer flex-col overflow-hidden border-0 bg-transparent p-0 text-left text-ink",
          sm ? "justify-center gap-0" : normalizeSize(size) === "wxl" ? "justify-evenly gap-1" : normalizeSize(size) === "wl" ? "justify-evenly gap-1" : normalizeSize(size) === "xl" ? "justify-evenly gap-1" : normalizeSize(size) === "lg" ? "justify-center gap-1" : (p.metrics?.length ?? 0) > 1 ? "justify-evenly" : "justify-center",
        )}
        onClick={onOpen}
      >
        {!p.ok ? (
          <div className={cn(errorText, sm && "text-[11px] leading-snug")}>{p.error || ""}</div>
        ) : (
          (() => {
            const ns = normalizeSize(size);
            const slice = sm ? 2 : ns === "lg" ? 2 : ns === "xl" ? 4 : ns === "wl" ? 4 : ns === "wxl" ? 8 : (p.metrics?.length ?? 0);
            return (p.metrics ?? []).slice(0, slice).map((m, i) => (
              <MetricRow key={i} {...m} pal={pal} compact={sm} nowMs={nowMs} t={t} />
            ));
          })()
        )}
      </button>
    </div>
  );
}

export function EmptySlot({ id, active, preview }: { id: string; active: boolean; preview?: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full min-h-0 rounded-2xl border border-dashed transition-colors duration-150",
        preview ? "border-accent bg-chip" : active ? "border-edge bg-chip/30" : "border-transparent",
      )}
      aria-hidden
    />
  );
}

export function BoardTile({
  p,
  pal,
  size,
  t,
  nowMs,
  col,
  row,
  rect,
  bg,
  onOpen,
  onSetSize,
  onDuplicate,
  onRemove,
  onSetBg,
  onFree,
}: {
  p: ProviderMeta;
  pal: Pal;
  size: CardSize;
  t: T;
  nowMs: number;
  col: number;
  row: number;
  rect: { w: number; h: number };
  bg?: string | null;
  onOpen: () => void;
  onSetSize: (next: CardSize) => void;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
  onSetBg?: (id: string, next: string | null) => void;
  onFree?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: p.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: p.id });
  // injeta bg/onSetBg via props extras para ProviderCard genérico
  if (bg !== undefined) (p as unknown as Record<string, unknown>)._bg = bg;
  if (onSetBg) (p as unknown as Record<string, unknown>)._onSetBg = onSetBg;
  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={{ gridColumn: `${col + 1} / span ${rect.w}`, gridRow: `${row + 1} / span ${rect.h}`, zIndex: isDragging ? 2 : 1 }}
      className="min-h-0 min-w-0 h-full"
    >
      <ProviderCard
        p={p}
        pal={pal}
        size={size}
        t={t}
        nowMs={nowMs}
        dragging={isDragging}
        grip={{ ...attributes, ...listeners }}
        bg={bg}
        onOpen={onOpen}
        onSetSize={onSetSize}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onSetBg={onSetBg}
        onFree={onFree}
      />
    </div>
  );
}
