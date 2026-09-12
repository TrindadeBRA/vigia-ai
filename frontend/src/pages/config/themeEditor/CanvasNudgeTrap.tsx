import { useEffect, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from "react";

export function isCanvasNudgeTrap(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && el.dataset.canvasNudge !== undefined;
}

export function arrowDir(e: { key: string; code?: string; keyCode?: number }): "left" | "right" | "up" | "down" | null {
  const key = e.key;
  if (key === "ArrowLeft" || key === "Left") return "left";
  if (key === "ArrowRight" || key === "Right") return "right";
  if (key === "ArrowUp" || key === "Up") return "up";
  if (key === "ArrowDown" || key === "Down") return "down";
  if (e.code === "ArrowLeft") return "left";
  if (e.code === "ArrowRight") return "right";
  if (e.code === "ArrowUp") return "up";
  if (e.code === "ArrowDown") return "down";
  switch (e.keyCode) {
    case 37:
      return "left";
    case 39:
      return "right";
    case 38:
      return "up";
    case 40:
      return "down";
    default:
      return null;
  }
}

/** Safari só dispara setas em campo editável — div/button com foco não recebe keydown.
 * Este textarea invisível segura o teclado enquanto um elemento do canvas está selecionado. */
export function CanvasNudgeTrap({
  active,
  trapRef,
  onNudge,
}: {
  active: boolean;
  trapRef: MutableRefObject<HTMLTextAreaElement | null>;
  onNudge: (dx: number, dy: number) => void;
}) {
  useEffect(() => {
    if (!active) return;
    const el = trapRef.current;
    if (!el) return;
    const id = window.setTimeout(() => el.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(id);
  }, [active, trapRef]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const dir = arrowDir(e);
    if (dir) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      onNudge(dir === "left" ? -step : dir === "right" ? step : 0, dir === "up" ? -step : dir === "down" ? step : 0);
      return;
    }
    if (e.key.length === 1) e.preventDefault();
  }

  return (
    <textarea
      ref={trapRef}
      data-canvas-nudge=""
      aria-label="Mover elemento no canvas"
      tabIndex={active ? 0 : -1}
      inputMode="none"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      rows={1}
      defaultValue=""
      onChange={(e) => {
        e.currentTarget.value = "";
      }}
      onKeyDown={onKeyDown}
      className="pointer-events-none absolute left-0 top-0 z-10 overflow-hidden"
      style={{ width: 1, height: 1, fontSize: 16, clipPath: "inset(50%)", caretColor: "transparent" }}
    />
  );
}

export function focusCanvasNudgeTrap(trapRef: MutableRefObject<HTMLTextAreaElement | null>) {
  const el = trapRef.current;
  if (!el) return;
  window.setTimeout(() => el.focus({ preventScroll: true }), 0);
}
