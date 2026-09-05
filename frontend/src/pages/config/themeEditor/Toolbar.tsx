import { forwardRef, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../cn";

export const ToolButton = forwardRef<HTMLButtonElement, { icon: ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }>(
  ({ icon, label, active, disabled, onClick }, ref) => (
    <div className="group/tool relative flex size-11 shrink-0 items-center justify-center">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex size-full items-center justify-center rounded-[12px] border text-ink2 transition-colors duration-150",
          active ? "border-accent bg-chip text-accent" : "border-transparent hover:border-edge hover:bg-chip hover:text-ink",
          disabled && "cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent hover:text-ink2",
        )}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-[110] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-edge bg-panel px-2 py-1 text-[11.5px] font-[650] text-ink opacity-0 shadow-card-hover transition-opacity delay-150 duration-150",
          "group-hover/tool:opacity-100 group-focus-within/tool:opacity-100",
          "lg:left-full lg:top-1/2 lg:mt-0 lg:translate-x-0 lg:-translate-y-1/2 lg:ml-2",
        )}
      >
        {label}
      </span>
    </div>
  ),
);
ToolButton.displayName = "ToolButton";

export function ToolbarDivider() {
  return <div aria-hidden className="my-0.5 h-7 w-px shrink-0 bg-edge lg:my-0.5 lg:h-px lg:w-7" />;
}

export function ToolPopover({
  anchorRef,
  open,
  onClose,
  width = 280,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      let left = r.right + 10;
      let top = r.top;
      if (left + width > window.innerWidth - 8) left = Math.max(8, r.left - width - 10);
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      const maxTop = window.innerHeight - 8;
      if (top > maxTop - 120) top = Math.max(8, maxTop - 360);
      setPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      className="fixed z-[100] max-h-[70vh] overflow-y-auto rounded-2xl border border-edge bg-panel p-3 shadow-card-hover"
      style={{ top: pos.top, left: pos.left, width }}
    >
      {children}
    </div>,
    document.body,
  );
}
