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

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
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
  onAddImage,
  onAddNote,
}: {
  open: boolean;
  onClose: () => void;
  enabled: WidgetKind[];
  onToggle: (kind: WidgetKind) => void;
  t: T;
  onAddImage?: () => void;
  onAddNote?: () => void;
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
        {/* Imagem: multi-instância — sempre mostra "Adicionar" */}
        <div className="flex items-center gap-3 rounded-[12px] border border-edge bg-canvas px-3 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-ink2 shadow-[inset_0_0_0_1px_var(--card-border)]">
            <ImageIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-[650]">{t.widgetImage ?? "Imagem"}</div>
            <div className="truncate text-[11.5px] text-ink3">{t.widgetImageDesc ?? "Foto, URL ou busca"}</div>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg border-0 bg-accent px-2.5 py-1.5 text-[12.5px] font-bold text-accent-ink hover:enabled:-translate-y-px"
            onClick={() => onAddImage?.()}
          >
            {t.widgetAdd}
          </button>
        </div>
        {/* Nota: multi-instância — sempre mostra "Adicionar" */}
        <div className="flex items-center gap-3 rounded-[12px] border border-edge bg-canvas px-3 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-ink2 shadow-[inset_0_0_0_1px_var(--card-border)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-[650]">{t.widgetNote || "Nota"}</div>
            <div className="truncate text-[11.5px] text-ink3">{t.widgetNoteDesc || "Post-it com Markdown e cor"}</div>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg border-0 bg-accent px-2.5 py-1.5 text-[12.5px] font-bold text-accent-ink hover:enabled:-translate-y-px"
            onClick={() => onAddNote?.()}
          >
            {t.widgetAdd}
          </button>
        </div>
      </div>
    </Modal>
  );
}
