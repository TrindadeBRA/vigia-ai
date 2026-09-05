import { useEffect, useState } from "react";
import { FREE_MAX_H, FREE_MIN_H, FREE_MIN_W, type Rect } from "../../board";
import type { T } from "../../i18n";
import { Modal } from "../config/ui";

export function FreeSizeModal({
    open,
    onClose,
    onApply,
    t,
    cols,
    initial,
}: {
    open: boolean;
    onClose: () => void;
    onApply: (rect: Rect) => void;
    t: T;
    cols: number;
    initial?: Rect | null;
}) {
    const maxW = Math.max(1, cols);
    const [w, setW] = useState(String(initial?.w ?? 2));
    const [h, setH] = useState(String(initial?.h ?? 2));
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setW(String(initial?.w ?? 2));
        setH(String(initial?.h ?? 2));
        setErr(null);
    }, [open, initial?.w, initial?.h]);

    if (!open) return null;

    function handleApply() {
        const wi = Math.floor(Number(w));
        const hi = Math.floor(Number(h));
        if (!Number.isFinite(wi) || !Number.isFinite(hi) || wi < FREE_MIN_W || wi > maxW || hi < FREE_MIN_H || hi > FREE_MAX_H) {
            setErr(t.freeSizeInvalid);
            return;
        }
        onApply({ w: wi, h: hi });
        onClose();
    }

    return (
        <Modal title={t.freeSizeTitle} onClose={onClose}>
            <p className="m-0 text-[13px] leading-relaxed text-ink2">{t.freeSizeLead}</p>
            <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[.4px] text-ink3">{t.freeSizeWidth}</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={FREE_MIN_W}
                        max={maxW}
                        step={1}
                        value={w}
                        onChange={(e) => { setW(e.target.value); setErr(null); }}
                        className="h-10 rounded-[10px] border border-edge bg-canvas px-3 text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder={`1–${maxW}`}
                    />
                    <span className="text-[11px] text-ink3">{t.freeSizeWidthHint(maxW)}</span>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[.4px] text-ink3">{t.freeSizeHeight}</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={FREE_MIN_H}
                        max={FREE_MAX_H}
                        step={1}
                        value={h}
                        onChange={(e) => { setH(e.target.value); setErr(null); }}
                        className="h-10 rounded-[10px] border border-edge bg-canvas px-3 text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder={`1–${FREE_MAX_H}`}
                    />
                    <span className="text-[11px] text-ink3">{t.freeSizeHeightHint}</span>
                </label>
            </div>
            {err ? <p className="m-0 rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] font-medium text-bad">{err}</p> : null}
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    className="rounded-[10px] border border-edge bg-transparent px-4 py-2 text-[13px] font-bold text-ink hover:bg-chip"
                    onClick={onClose}
                >
                    {t.freeSizeCancel}
                </button>
                <button
                    type="button"
                    className="rounded-[10px] bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink hover:opacity-90"
                    onClick={handleApply}
                >
                    {t.freeSizeApply}
                </button>
            </div>
        </Modal>
    );
}
