import { useEffect, useRef, useState } from "react";
import { clampBoxCenter } from "./state";

export function ThemeLayer({
  x,
  y,
  containerSize,
  children,
}: {
  x: number;
  y: number;
  containerSize: { width: number; height: number };
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setBoxSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width: cw, height: ch } = containerSize;
  const left = cw > 0 ? clampBoxCenter(x * cw, boxSize.width, cw) : x * 100;
  const top = ch > 0 ? clampBoxCenter(y * ch, boxSize.height, ch) : y * 100;
  return (
    <div
      ref={boxRef}
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={cw > 0 && ch > 0 ? { left: `${left}px`, top: `${top}px` } : { left: `${left}%`, top: `${top}%` }}
    >
      {children}
    </div>
  );
}
