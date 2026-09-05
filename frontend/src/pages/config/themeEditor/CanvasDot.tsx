import { useEffect, useRef, useState } from "react";
import { cn } from "../../../cn";
import { clamp } from "./themeState";

// Espelha o clampBoxCenter do firmware (ui/customtheme.cpp): mantém a caixa
// do widget inteira dentro do canvas, mesmo perto das bordas — sem isso, a
// prévia web (que só recorta via overflow:hidden) parecia caber onde a
// placa de fato cortava o widget, já que os tamanhos de caixa nunca eram
// levados em conta na posição exibida.
function clampBoxCenter(rawCenter: number, boxSize: number, containerSize: number): number {
  if (!containerSize || !boxSize) return rawCenter;
  if (boxSize >= containerSize) return containerSize / 2;
  return clamp(rawCenter, boxSize / 2, containerSize - boxSize / 2);
}

export function CanvasDot({
  x,
  y,
  canvasRef,
  containerSize,
  selected,
  title,
  onSelect,
  onDrag,
  onRemove,
  removeLabel,
  children,
}: {
  x: number;
  y: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  containerSize: { width: number; height: number };
  selected: boolean;
  title: string;
  onSelect: () => void;
  onDrag: (x: number, y: number) => void;
  onRemove?: () => void;
  removeLabel?: string;
  children: React.ReactNode;
}) {
  const dotRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = dotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setBoxSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onDrag(clamp((e.clientX - rect.left) / rect.width, 0, 1), clamp((e.clientY - rect.top) / rect.height, 0, 1));
  };
  const { width: cw, height: ch } = containerSize;
  const left = cw > 0 ? clampBoxCenter(x * cw, boxSize.width, cw) : x * 100;
  const top = ch > 0 ? clampBoxCenter(y * ch, boxSize.height, ch) : y * 100;
  return (
    <div
      ref={dotRef}
      role="button"
      tabIndex={0}
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      style={cw > 0 && ch > 0 ? { left: `${left}px`, top: `${top}px` } : { left: `${left}%`, top: `${top}%` }}
      className={cn(
        "absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none items-center justify-center rounded-[10px] outline-none active:cursor-grabbing",
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : "ring-1 ring-white/40",
      )}
    >
      {children}
      {selected && onRemove ? (
        <button
          type="button"
          title={removeLabel}
          aria-label={removeLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-2 -top-2 flex size-5 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-bad text-[12px] font-bold leading-none text-white shadow"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
