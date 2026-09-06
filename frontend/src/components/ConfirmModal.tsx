import { Modal } from "../pages/config/ui";

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel} closeLabel={cancelLabel}>
      <p className="m-0 text-sm leading-relaxed text-ink2">{body}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-edge bg-transparent px-3.5 py-2 text-[13.5px] font-bold text-ink2 hover:bg-chip hover:text-ink"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="rounded-lg border-0 bg-bad px-3.5 py-2 text-[13.5px] font-bold text-white hover:enabled:-translate-y-px"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
