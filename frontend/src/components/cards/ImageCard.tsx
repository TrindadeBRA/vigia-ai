import { useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";

export type ImageFit = "cover" | "contain";

export function imageAllowedSizes(): CardSize[] {
    return ["xs", "sm", "md", "lg", "xl", "wl", "wm", "wxl"];
}

export function imageSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "xs") return t.widgetQuarter;
    if (s === "sm") return t.widgetSmall;
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "xl") return t.cardXl;
    if (s === "wl") return t.cardWl;
    if (s === "wm") return "Médio alto";
    if (s === "wxl") return t.cardWxl;
    return t.cardNormal;
}

function ImagePlaceholder({ t, compact }: { t: T; compact?: boolean }) {
    return (
        <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center", compact && "gap-1 p-2")}>
            <div className={cn("flex items-center justify-center rounded-xl bg-chip text-ink3", compact ? "size-8" : "size-12")}>
                <svg width={compact ? 16 : 22} height={compact ? 16 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
            </div>
            <span className={cn("font-medium text-ink3", compact ? "text-[11px]" : "text-[12.5px]")}>{t.imageEmpty ?? "Sem imagem"}</span>
            {!compact ? <span className="text-[11px] text-ink3">{t.imageEmptyHint ?? "Clique para configurar"}</span> : null}
        </div>
    );
}

export function ImageBoardCard({
    src,
    fit = "cover",
    transform,
    t,
    size,
    readonly,
    onConfigure,
    onTransformChange,
}: {
    src: string | null | undefined;
    fit?: ImageFit;
    transform?: { x: number; y: number; scale: number } | null;
    t: T;
    size: CardSize;
    readonly?: boolean;
    onConfigure?: () => void;
    onTransformChange?: (next: { x: number; y: number; scale: number }) => void;
}) {
    const [err, setErr] = useState(false);
    const s = normalizeSize(size);
    const compact = s === "xs" || s === "sm";
    const hasSrc = Boolean(src && src.trim() && !err);

    if (!hasSrc) {
        return (
            <button
                type="button"
                className="flex h-full min-h-0 w-full flex-1 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
                onClick={readonly ? undefined : onConfigure}
                disabled={Boolean(readonly)}
                aria-label={t.imageConfigure ?? "Configurar imagem"}
            >
                <ImagePlaceholder t={t} compact={compact} />
            </button>
        );
    }

    const isCover = fit !== "contain";
    const tx = transform ?? { x: 0, y: 0, scale: 1 };
    const canPanZoom = !readonly && isCover && Boolean(onTransformChange);

    // drag state
    const containerRef = useState(() => ({ current: null as HTMLDivElement | null }))[0];
    const dragRef = useState(() => ({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 }))[0];
    const imgNaturalRef = useState(() => ({ w: 0, h: 0 }))[0];

    function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

    function getBounds(scale: number) {
        const el = containerRef.current;
        const iw = imgNaturalRef.w;
        const ih = imgNaturalRef.h;
        if (!el || !iw || !ih) {
            const fallback = 40 * scale + 20;
            return { maxX: fallback, maxY: fallback };
        }
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        if (cw <= 0 || ch <= 0) return { maxX: 0, maxY: 0 };
        // object-contain base scale: image fits inside container
        const baseScale = Math.min(cw / iw, ch / ih);
        const renderedW = iw * baseScale * scale;
        const renderedH = ih * baseScale * scale;
        // max translate in % so that image edge aligns with container edge
        const maxX = renderedW > cw ? ((renderedW - cw) / 2 / cw) * 100 : 0;
        const maxY = renderedH > ch ? ((renderedH - ch) / 2 / ch) * 100 : 0;
        return { maxX, maxY };
    }

    function handlePointerDown(e: React.PointerEvent) {
        if (!canPanZoom) return;
        if (e.button !== 0) return;
        dragRef.dragging = true;
        dragRef.startX = e.clientX;
        dragRef.startY = e.clientY;
        dragRef.origX = tx.x;
        dragRef.origY = tx.y;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
    }
    function handlePointerMove(e: React.PointerEvent) {
        if (!dragRef.dragging || !canPanZoom) return;
        const dx = e.clientX - dragRef.startX;
        const dy = e.clientY - dragRef.startY;
        const el = containerRef.current;
        const cw = el?.clientWidth ?? 200;
        // convert px delta to % of container
        const dxPct = (dx / cw) * 100;
        const dyPct = (dy / (el?.clientHeight ?? cw)) * 100;
        const { maxX, maxY } = getBounds(tx.scale);
        const nx = clamp(dragRef.origX + dxPct, -maxX, maxX);
        const ny = clamp(dragRef.origY + dyPct, -maxY, maxY);
        onTransformChange?.({ x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)), scale: tx.scale });
        e.preventDefault();
    }
    function handlePointerUp(e: React.PointerEvent) {
        if (!dragRef.dragging) return;
        dragRef.dragging = false;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    function handleWheel(e: React.WheelEvent) {
        if (!canPanZoom) return;
        if (!e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const nextScale = clamp(tx.scale + delta, 1, 3);
        if (nextScale === tx.scale) return;
        const { maxX, maxY } = getBounds(nextScale);
        const nx = clamp(tx.x, -maxX, maxX);
        const ny = clamp(tx.y, -maxY, maxY);
        onTransformChange?.({ x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)), scale: Number(nextScale.toFixed(2)) });
    }
    function handleDoubleClick(e: React.MouseEvent) {
        if (!canPanZoom) return;
        e.preventDefault();
        e.stopPropagation();
        onTransformChange?.({ x: 0, y: 0, scale: 1 });
    }

    // contain: simple object-contain, no transform
    if (!isCover) {
        return (
            <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden rounded-[10px] bg-black/5">
                <img
                    src={src!}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-contain"
                    style={{ imageRendering: "auto" }}
                    onError={() => setErr(true)}
                />
            </div>
        );
    }

    const transformStyle = `translate(${tx.x}%, ${tx.y}%) scale(${tx.scale})`;

    return (
        <div
            ref={(el) => { containerRef.current = el; }}
            className={cn("flex h-full min-h-0 w-full flex-1 overflow-hidden rounded-[10px] bg-black/5", canPanZoom && "cursor-grab active:cursor-grabbing touch-none select-none")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            title={canPanZoom ? "Arraste para mover · Shift+scroll para zoom · duplo clique para resetar" : undefined}
        >
            <img
                src={src!}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
                style={{ imageRendering: "auto", transform: transformStyle, transformOrigin: "center center", willChange: "transform" }}
                onLoad={(e) => {
                    const img = e.currentTarget;
                    imgNaturalRef.w = img.naturalWidth;
                    imgNaturalRef.h = img.naturalHeight;
                }}
                onError={() => setErr(true)}
            />
        </div>
    );
}
