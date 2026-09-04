import { cn } from "../cn";
import type { T } from "../i18n";
import { Modal } from "../pages/config/ui";
import { EyeMark } from "./Logo";

export type WidgetKind = "clock" | "eye";

export const WIDGET_KINDS: WidgetKind[] = ["clock", "eye"];

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function widgetLabel(kind: WidgetKind, t: T): string {
  return kind === "clock" ? t.widgetClock : t.widgetEye;
}

function widgetIcon(kind: WidgetKind) {
  return kind === "clock" ? <ClockIcon /> : <EyeMark size={20} follow={false} />;
}

export function AddWidgetModal({
  open,
  onClose,
  enabled,
  onToggle,
  t,
}: {
  open: boolean;
  onClose: () => void;
  enabled: WidgetKind[];
  onToggle: (kind: WidgetKind) => void;
  t: T;
}) {
  if (!open) return null;
  return (
    <Modal title={t.addWidget} onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink2">{t.addWidgetHint}</p>
      <div className="flex flex-col gap-2">
        {WIDGET_KINDS.map((kind) => {
          const active = enabled.includes(kind);
          return (
            <div
              key={kind}
              className={cn(
                "flex items-center gap-3 rounded-[12px] border px-3 py-2.5",
                active ? "border-accent bg-chip" : "border-edge bg-canvas",
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-ink2 shadow-[inset_0_0_0_1px_var(--card-border)]">
                {widgetIcon(kind)}
              </div>
              <span className="min-w-0 flex-1 truncate text-[14px] font-[650]">{widgetLabel(kind, t)}</span>
              <button
                type="button"
                className={cn(
                  "shrink-0 cursor-pointer rounded-lg border-0 px-2.5 py-1.5 text-[12.5px] font-bold",
                  active ? "bg-bad/15 text-bad hover:bg-bad/25" : "bg-accent text-accent-ink hover:enabled:-translate-y-px",
                )}
                onClick={() => onToggle(kind)}
              >
                {active ? t.widgetRemove : t.widgetAdd}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
