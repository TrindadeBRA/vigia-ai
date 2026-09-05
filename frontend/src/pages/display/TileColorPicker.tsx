import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../cn";
import { ntcGenerateColor, ntcGenerateReadableColor, useNameToColor } from "../../hooks/useNameToColor";

function normalizeHexInput(v: string): string | null {
    const s = v.trim();
    if (!s) return null;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s.slice(1).split("").map((c) => c + c).join("").toLowerCase()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{8}$/.test(s)) return `#${s.slice(1, 7).toLowerCase()}`;
    return null;
}

export function TileColorPicker({
    value,
    onChange,
}: {
    value: string | null;
    onChange: (next: string | null) => void;
}) {
    const { ready } = useNameToColor();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(value || "");
    const [native, setNative] = useState(value || "#6366f1");
    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (value) {
            setText(value);
            const n = normalizeHexInput(value);
            if (n) setNative(n);
        }
    }, [value]);

    // preview from arbitrary text via NameToColor
    const previewHex = useMemo(() => {
        if (!text.trim()) return null;
        const direct = normalizeHexInput(text.trim());
        if (direct) return direct;
        if (!ready) return null;
        return ntcGenerateColor(text.trim());
    }, [text, ready]);

    const readable = useMemo(() => {
        const hex = previewHex || (value ? normalizeHexInput(value) : null);
        if (!hex) return null;
        if (!ready) return null;
        const pair = ntcGenerateReadableColor(hex);
        return pair ? pair[0] : null;
    }, [previewHex, value, ready]);

    const currentReadable = useMemo(() => {
        if (!value) return null;
        if (!ready) return null;
        const pair = ntcGenerateReadableColor(value);
        return pair ? pair[0] : null;
    }, [value, ready]);

    useEffect(() => {
        if (!open) return;
        const update = () => {
            const r = btnRef.current?.getBoundingClientRect();
            if (!r) return;
            const w = 280;
            const h = 260;
            let top = r.bottom + 6;
            let left = r.right - w;
            if (left < 8) left = 8;
            if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
            if (top + h > window.innerHeight - 8) top = r.top - h - 6;
            if (top < 8) top = 8;
            setPos({ top, left });
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t)) return;
            if (popRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const hasBg = !!value;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border text-ink3 hover:bg-chip hover:text-ink",
                    hasBg ? "border-edge bg-chip" : "border-transparent hover:border-edge",
                )}
                title={hasBg ? `Cor: ${value} — clique para alterar` : "Cor de fundo"}
                aria-label="Cor de fundo"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
            >
                {/* palette icon + swatch */}
                <span className="relative flex size-[14px] items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 4a8 8 0 1 0 0 16h1.5a1.8 1.8 0 0 0 1.3-3.1 1.8 1.8 0 0 1 1.3-3.1H17a3 3 0 0 0 3-3c0-3.8-3.6-6.8-8-6.8Z" />
                        <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" />
                        <circle cx="11" cy="8" r="1.1" fill="currentColor" stroke="none" />
                        <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                    </svg>
                    {hasBg ? (
                        <span
                            className="absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full border border-white shadow-sm"
                            style={{ background: value! }}
                            aria-hidden
                        />
                    ) : null}
                </span>
            </button>

            {open && pos
                ? createPortal(
                    <div
                        ref={popRef}
                        role="dialog"
                        aria-label="Seletor de cor do card"
                        className="fixed z-[120] flex w-[280px] flex-col gap-3 rounded-2xl border border-edge bg-panel p-3 shadow-card-hover"
                        style={{ top: pos.top, left: pos.left }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-ink">Cor de fundo</span>
                            <a
                                href="https://github.com/zonaro/NameToColor"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-medium text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80"
                            >
                                NameToColor ↗
                            </a>
                        </div>

                        <p className="m-0 text-[11px] leading-[1.4] text-ink3">
                            Digite qualquer texto (ex.: &quot;azul escuro&quot;, &quot;vermelho&quot;, &quot;#ff6600&quot;) — a cor é gerada via <code className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">generateColor</code>. O texto usa{" "}
                            <code className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">generateReadableColor</code> para contraste WCAG.
                        </p>

                        <div className="flex gap-2">
                            <input
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="ex.: oceano, #ff6600, azul claro"
                                className="min-w-0 flex-1 rounded-[10px] border border-edge bg-canvas px-3 py-2 text-[13px] text-ink placeholder:text-ink3 focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent"
                            />
                            <input
                                type="color"
                                value={normalizeHexInput(native) || "#6366f1"}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setNative(v);
                                    setText(v);
                                }}
                                className="size-9 shrink-0 cursor-pointer rounded-[10px] border border-edge bg-panel p-1"
                                title="Seletor nativo"
                            />
                        </div>

                        {/* preview */}
                        {previewHex ? (
                            <div
                                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                                style={{
                                    background: previewHex,
                                    borderColor: "color-mix(in srgb, var(--card-border) 60%, transparent)",
                                    color: readable || (currentReadable ?? "#fff"),
                                }}
                            >
                                <span
                                    className="size-8 shrink-0 rounded-full border shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)]"
                                    style={{ background: previewHex, borderColor: "rgba(0,0,0,.12)" }}
                                    aria-hidden
                                />
                                <div className="flex min-w-0 flex-col">
                                    <span className="font-mono text-[12px] font-bold" style={{ color: readable || currentReadable || "#fff" }}>
                                        {previewHex.toUpperCase()}
                                    </span>
                                    <span className="text-[11px] opacity-80" style={{ color: readable || currentReadable || "#fff" }}>
                                        Texto legível: {readable || "—"}
                                    </span>
                                </div>
                                <span className="ml-auto text-[10px] font-medium opacity-60" style={{ color: readable || currentReadable || "#fff" }}>
                                    preview
                                </span>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-edge bg-canvas px-3 py-2.5 text-center text-[11px] text-ink3">
                                Digite um nome, cor ou texto livre para gerar a cor
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={!previewHex}
                                onClick={() => {
                                    if (!previewHex) return;
                                    onChange(previewHex);
                                    setOpen(false);
                                }}
                                className="flex-1 rounded-[10px] bg-accent px-3 py-2 text-[13px] font-bold text-accent-ink shadow-btn hover:enabled:-translate-y-px disabled:opacity-40"
                            >
                                Aplicar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(null);
                                    setText("");
                                    setOpen(false);
                                }}
                                className="rounded-[10px] border border-edge bg-canvas px-3 py-2 text-[13px] font-semibold text-ink hover:bg-chip disabled:opacity-40"
                                disabled={!hasBg && !previewHex}
                            >
                                Limpar
                            </button>
                        </div>

                        {hasBg ? (
                            <div className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-2 text-[11px] text-ink3">
                                <span className="size-3 shrink-0 rounded-full border border-edge" style={{ background: value! }} aria-hidden />
                                <span className="font-mono text-[11px] text-ink">{value!.toUpperCase()}</span>
                                <span className="ml-auto">atual</span>
                            </div>
                        ) : null}
                    </div>,
                    document.body,
                )
                : null}
        </>
    );
}
