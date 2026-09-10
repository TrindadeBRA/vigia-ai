import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";
import { CloseIcon } from "./icons";
import { EyeMark } from "./Logo";

export type ToastVariant = "success" | "error";

type ToastItem = {
  id: number;
  variant: ToastVariant;
  message: string;
};

const DURATION_MS: Record<ToastVariant, number> = {
  success: 4200,
  error: 6000,
};

/** Recolore só o EyeMark deste toast — --accent/--glow são custom properties,
 * então sobrescrever num wrapper localiza o efeito sem tocar no tema global. */
const ICON_VARS: Record<ToastVariant, { "--accent": string; "--glow": string }> = {
  success: { "--accent": "#8cbe94", "--glow": "rgba(140,190,148,.18)" },
  error: { "--accent": "#de6d6b", "--glow": "rgba(222,109,107,.18)" },
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
const timers = new Map<number, number>();

function notify(): void {
  for (const cb of listeners) cb(items);
}

function dismiss(id: number): void {
  const timer = timers.get(id);
  if (timer != null) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  items = items.filter((t) => t.id !== id);
  notify();
}

function schedule(id: number, ms: number): void {
  const timer = window.setTimeout(() => dismiss(id), ms);
  timers.set(id, timer);
}

function pause(id: number): void {
  const timer = timers.get(id);
  if (timer != null) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
}

function resume(id: number, ms: number): void {
  if (timers.has(id)) return;
  schedule(id, ms);
}

function emit(variant: ToastVariant, message: string): void {
  if (!message) return;
  const id = nextId++;
  items = [...items, { id, variant, message }];
  notify();
  schedule(id, DURATION_MS[variant]);
}

/** API imperativa — chame de qualquer hook/função, sem precisar de contexto React. */
export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
};

function useToastItems(): ToastItem[] {
  const [state, setState] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}

/** Monta uma vez perto da raiz do app (ver App.tsx). */
export function ToastViewport() {
  const list = useToastItems();
  if (list.length === 0) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col-reverse items-end gap-2 sm:inset-x-auto sm:right-4"
      aria-live="polite"
    >
      {list.map((item) => (
        <div
          key={item.id}
          role={item.variant === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-[360px] items-start gap-2.5 rounded-2xl border border-edge bg-panel py-2.5 pl-3 pr-2 shadow-card-hover animate-slide-in",
            "border-l-[3px]",
            item.variant === "success" && "border-l-good",
            item.variant === "error" && "border-l-bad",
          )}
          onMouseEnter={() => pause(item.id)}
          onMouseLeave={() => resume(item.id, DURATION_MS[item.variant])}
        >
          <span className="mt-0.5 shrink-0" style={ICON_VARS[item.variant] as React.CSSProperties}>
            <EyeMark size={22} />
          </span>
          <p className="m-0 min-w-0 flex-1 whitespace-pre-line break-words text-[13px] leading-[1.45] text-ink">
            {item.message}
          </p>
          <button
            type="button"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink3 transition-colors duration-150 hover:bg-chip hover:text-ink"
            onClick={() => dismiss(item.id)}
            aria-label="×"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
