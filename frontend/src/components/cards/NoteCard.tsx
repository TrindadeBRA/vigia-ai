import { useEffect, useRef, useState } from "react";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";

/* ── Cores post-it ────────────────────────────────────────────────── */
export type NoteColorId = "yellow" | "pink" | "blue" | "green" | "orange" | "purple" | "mint" | "gray";

export type NoteColor = { id: NoteColorId; bg: string; text: string; border: string; dot: string };

export const NOTE_COLORS: NoteColor[] = [
    { id: "yellow", bg: "#fef08a", text: "#422006", border: "#fde047", dot: "#eab308" },
    { id: "orange", bg: "#fed7aa", text: "#431407", border: "#fdba74", dot: "#f97316" },
    { id: "pink", bg: "#fbcfe8", text: "#4a044e", border: "#f9a8d4", dot: "#ec4899" },
    { id: "purple", bg: "#ddd6fe", text: "#2e1065", border: "#c4b5fd", dot: "#8b5cf6" },
    { id: "blue", bg: "#bfdbfe", text: "#1e3a5f", border: "#93c5fd", dot: "#3b82f6" },
    { id: "mint", bg: "#a7f3d0", text: "#064e3b", border: "#6ee7b7", dot: "#10b981" },
    { id: "green", bg: "#bbf7d0", text: "#14532d", border: "#86efac", dot: "#22c55e" },
    { id: "gray", bg: "#f1f5f9", text: "#1e293b", border: "#e2e8f0", dot: "#94a3b8" },
];

export function noteColorFor(id: string | undefined): NoteColor {
    return NOTE_COLORS.find((c) => c.id === id) || NOTE_COLORS[0];
}

/* ── Tamanhos ─────────────────────────────────────────────────────── */
export function noteAllowedSizes(): CardSize[] {
    return ["sm", "md", "lg", "xl", "wl"];
}

export function noteSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return t.widgetSmall;
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "xl") return t.cardXl;
    if (s === "wl") return t.cardWl;
    return t.cardNormal;
}

/* ── Markdown leve (sem dependência) ──────────────────────────────── */
function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMd(s: string): string {
    // code inline `code`
    s = s.replace(/`([^`]+?)`/g, (_, c) => `<code class="rounded bg-black/10 px-1 py-0.5 text-[0.9em] font-mono">${escapeHtml(c)}</code>`);
    // bold **text** e __text__
    s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+?)__/g, "<strong>$1</strong>");
    // italic *text* e _text_ (evita conflitar com bold já processado)
    s = s.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
    s = s.replace(/_([^_]+?)_/g, "<em>$1</em>");
    // links [text](url)
    s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline decoration-current/30 underline-offset-2 hover:decoration-current">$1</a>');
    // autolink simples
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline decoration-current/30 underline-offset-2 hover:decoration-current">$1</a>');
    return s;
}

export function renderMarkdownToHtml(md: string): string {
    if (!md.trim()) return "";
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let inList: "ul" | "ol" | null = null;
    let inCodeBlock = false;
    let codeBuf: string[] = [];
    let inBlockquote = false;
    let bqBuf: string[] = [];
    let taskIndex = 0;

    const flushList = () => {
        if (inList) { html += `</${inList}>`; inList = null; }
    };
    const flushBlockquote = () => {
        if (inBlockquote) {
            const inner = bqBuf.map((l) => `<p class="m-0">${inlineMd(escapeHtml(l))}</p>`).join("");
            html += `<blockquote class="my-1 border-l-2 border-current/20 pl-2 italic opacity-80">${inner}</blockquote>`;
            bqBuf = []; inBlockquote = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trimEnd();

        // code block ``` 
        if (line.trim().startsWith("```")) {
            if (!inCodeBlock) { flushList(); flushBlockquote(); inCodeBlock = true; codeBuf = []; }
            else {
                html += `<pre class="my-1 overflow-x-auto rounded bg-black/10 p-2 text-[12px] leading-relaxed"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
                inCodeBlock = false; codeBuf = [];
            }
            continue;
        }
        if (inCodeBlock) { codeBuf.push(raw); continue; }

        // blockquote
        if (line.trim().startsWith(">")) {
            if (!inBlockquote) { flushList(); inBlockquote = true; bqBuf = []; }
            bqBuf.push(line.replace(/^\s*>\s?/, ""));
            continue;
        } else if (inBlockquote) { flushBlockquote(); }

        // hr
        if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
            flushList(); html += `<hr class="my-2 border-current/15" />`; continue;
        }
        // heading
        const hm = /^(#{1,3})\s+(.*)$/.exec(line.trim());
        if (hm) {
            flushList();
            const level = hm[1].length;
            const text = inlineMd(escapeHtml(hm[2]));
            const cls = level === 1 ? "text-[15px] font-bold leading-tight" : level === 2 ? "text-[13px] font-bold leading-tight" : "text-[12.5px] font-semibold leading-tight";
            html += `<h${level} class="${cls} my-1">${text}</h${level}>`;
            continue;
        }
        // task list: - [ ] ou - [x]
        const taskM = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
        if (taskM) {
            const checked = taskM[1].toLowerCase() === "x";
            const content = inlineMd(escapeHtml(taskM[2]));
            if (inList !== "ul") { flushList(); html += "<ul class=\"my-1 list-none pl-0 space-y-1\">"; inList = "ul"; }
            html += `<li class="flex items-start gap-2 leading-snug"><input type="checkbox" data-task-index="${taskIndex}" ${checked ? "checked" : ""} class="mt-0.5 size-4 shrink-0 rounded border-edge accent-accent cursor-pointer" /><span class="${checked ? "line-through opacity-60" : ""}">${content}</span></li>`;
            taskIndex++;
            continue;
        }
        // ul
        const ulm = /^[-*]\s+(.*)$/.exec(line.trim());
        if (ulm) {
            if (inList !== "ul") { flushList(); html += "<ul class=\"my-1 list-disc pl-4 space-y-0.5\">"; inList = "ul"; }
            html += `<li class="leading-snug">${inlineMd(escapeHtml(ulm[1]))}</li>`;
            continue;
        }
        // ol
        const olm = /^\d+\.\s+(.*)$/.exec(line.trim());
        if (olm) {
            if (inList !== "ol") { flushList(); html += "<ol class=\"my-1 list-decimal pl-4 space-y-0.5\">"; inList = "ol"; }
            html += `<li class="leading-snug">${inlineMd(escapeHtml(olm[1]))}</li>`;
            continue;
        }
        // empty line
        if (line.trim() === "") { flushList(); flushBlockquote(); html += ""; continue; }
        // paragraph
        flushList();
        html += `<p class="my-1 leading-snug">${inlineMd(escapeHtml(line))}</p>`;
    }
    flushList(); flushBlockquote();
    if (inCodeBlock) {
        html += `<pre class="my-1 overflow-x-auto rounded bg-black/10 p-2 text-[12px]"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
    }
    return html;
}

/* ── Toggle de task list ────────────────────────────────────────── */
export function toggleTask(text: string, taskIndex: number): string {
    let cur = 0;
    return text.split("\n").map((line) => {
        const m = /^\s*[-*]\s+\[([ xX])\]\s+/.exec(line);
        if (!m) return line;
        if (cur === taskIndex) {
            cur++;
            const checked = m[1].toLowerCase() === "x";
            const next = checked ? " " : "x";
            return line.replace(/\[([ xX])\]/, `[${next}]`);
        }
        cur++;
        return line;
    }).join("\n");
}

/* ── Card ─────────────────────────────────────────────────────────── */
export function NoteBoardCard({
    text,
    colorId,
    size,
    readonly,
    onUpdate,
    t,
    onEditingChange,
}: {
    text: string;
    colorId: string;
    size: CardSize;
    readonly?: boolean;
    onUpdate: (patch: { text?: string; color?: string }) => void;
    t: T;
    onEditingChange?: (editing: boolean) => void;
}) {
    void colorId;
    void size;
    const [editing, setEditing] = useState(false);
    useEffect(() => { if (readonly && editing) setEditing(false); }, [readonly, editing]);
    useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);
    const [draft, setDraft] = useState(text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const html = renderMarkdownToHtml(text);

    useEffect(() => { setDraft(text); }, [text]);
    useEffect(() => {
        if (editing) {
            requestAnimationFrame(() => {
                textareaRef.current?.focus();
                const el = textareaRef.current;
                if (el) el.selectionStart = el.selectionEnd = el.value.length;
            });
        }
    }, [editing]);

    // auto-save com debounce enquanto digita
    useEffect(() => {
        if (!editing) return;
        if (draft === text) return;
        const id = window.setTimeout(() => onUpdate({ text: draft }), 500);
        return () => window.clearTimeout(id);
    }, [draft, editing, text, onUpdate]);

    const handleBlur = () => {
        if (draft !== text) onUpdate({ text: draft });
        setEditing(false);
    };

    const wrapSelection = (marker: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = draft;
        const selected = val.slice(start, end);
        let newVal: string;
        let newStart: number;
        let newEnd: number;
        if (start === end) {
            if (marker === "**") {
                newVal = val.slice(0, start) + "****" + val.slice(end);
                newStart = newEnd = start + 2;
            } else {
                newVal = val.slice(0, start) + "**" + val.slice(end);
                newStart = newEnd = start + 1;
            }
        } else {
            const beforeMarker = val.slice(start - marker.length, start);
            const afterMarker = val.slice(end, end + marker.length);
            const isWrapped = beforeMarker === marker && afterMarker === marker;
            if (isWrapped) {
                newVal = val.slice(0, start - marker.length) + selected + val.slice(end + marker.length);
                newStart = start - marker.length;
                newEnd = newStart + selected.length;
            } else {
                newVal = val.slice(0, start) + marker + selected + marker + val.slice(end);
                newStart = start + marker.length;
                newEnd = newStart + selected.length;
            }
        }
        setDraft(newVal);
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = newStart;
                textareaRef.current.selectionEnd = newEnd;
                textareaRef.current.focus();
            }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && (e.key === "b" || e.key === "B")) {
            e.preventDefault();
            wrapSelection("**");
            return;
        }
        if (isMod && (e.key === "i" || e.key === "I")) {
            e.preventDefault();
            wrapSelection("*");
            return;
        }
        if (e.key === "Enter") {
            const ta = e.currentTarget;
            const { selectionStart, selectionEnd, value } = ta;
            const before = value.slice(0, selectionStart);
            const after = value.slice(selectionEnd);
            const atEndOfLine = after === "" || after[0] === "\n";
            if (!atEndOfLine) return;
            if (selectionStart !== selectionEnd) return;
            const lineStart = before.lastIndexOf("\n") + 1;
            const line = before.slice(lineStart);

            const taskMatch = /^(\s*)([-*])\s+\[([ xX])\]\s+(.*)$/.exec(line);
            if (taskMatch) {
                const indent = taskMatch[1];
                const bullet = taskMatch[2];
                const content = taskMatch[4];
                if (content.trim() === "") {
                    e.preventDefault();
                    const newValue = before.slice(0, lineStart) + after;
                    setDraft(newValue);
                    requestAnimationFrame(() => {
                        if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
                    });
                    return;
                }
                e.preventDefault();
                const nextPrefix = `${indent}${bullet} [ ] `;
                const newValue = before + "\n" + nextPrefix + after;
                const newPos = selectionStart + 1 + nextPrefix.length;
                setDraft(newValue);
                requestAnimationFrame(() => {
                    if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
                });
                return;
            }

            const orderedMatch = /^(\s*)(\d+)([.)])\s+(.*)$/.exec(line);
            if (orderedMatch) {
                const indent = orderedMatch[1];
                const num = parseInt(orderedMatch[2], 10);
                const delim = orderedMatch[3];
                const content = orderedMatch[4];
                if (content.trim() === "") {
                    e.preventDefault();
                    const newValue = before.slice(0, lineStart) + after;
                    setDraft(newValue);
                    requestAnimationFrame(() => {
                        if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
                    });
                    return;
                }
                e.preventDefault();
                const nextPrefix = `${indent}${num + 1}${delim} `;
                const newValue = before + "\n" + nextPrefix + after;
                const newPos = selectionStart + 1 + nextPrefix.length;
                setDraft(newValue);
                requestAnimationFrame(() => {
                    if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
                });
                return;
            }

            const bulletMatch = /^(\s*)([-*])\s+(.*)$/.exec(line);
            if (bulletMatch) {
                const indent = bulletMatch[1];
                const bullet = bulletMatch[2];
                const content = bulletMatch[3];
                if (content.trim() === "") {
                    e.preventDefault();
                    const newValue = before.slice(0, lineStart) + after;
                    setDraft(newValue);
                    requestAnimationFrame(() => {
                        if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
                    });
                    return;
                }
                e.preventDefault();
                const nextPrefix = `${indent}${bullet} `;
                const newValue = before + "\n" + nextPrefix + after;
                const newPos = selectionStart + 1 + nextPrefix.length;
                setDraft(newValue);
                requestAnimationFrame(() => {
                    if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
                });
                return;
            }
        }
    };

    const onContentClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" && target.getAttribute("type") === "checkbox" && target.hasAttribute("data-task-index")) {
            if (readonly) return;
            e.preventDefault();
            e.stopPropagation();
            const idx = Number(target.getAttribute("data-task-index"));
            if (!Number.isNaN(idx)) {
                const next = toggleTask(text, idx);
                if (next !== text) onUpdate({ text: next });
            }
            return;
        }
        if (target.closest("a")) return;
        // clique simples não edita — só duplo clique
    };

    const onContentDoubleClick = (e: React.MouseEvent) => {
        if (readonly) return;
        const target = e.target as HTMLElement;
        if (target.closest("a")) return;
        if (target.tagName === "INPUT" && target.hasAttribute("data-task-index")) return;
        setEditing(true);
    };

    return (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
                {editing ? (
                    <div className="flex h-full flex-col gap-1.5">
                        <textarea
                            ref={textareaRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") { e.preventDefault(); handleBlur(); return; }
                                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleBlur(); return; }
                                handleKeyDown(e);
                            }}
                            onBlur={handleBlur}
                            placeholder={t.widgetNotePlaceholder || "Escreva sua nota... (Markdown suportado)"}
                            className="min-h-[80px] flex-1 resize-none rounded-lg border border-edge bg-panel p-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink3 focus:border-accent"
                            rows={6}
                        />
                        <div className="text-[10px] leading-none text-ink3">Markdown: **negrito** *itálico* `código` [link](url) # título - lista · - [ ] tarefa · Esc ou ⌘/Ctrl+Enter salva e sai</div>
                    </div>
                ) : (
                    <div
                        className={cn("h-full overflow-auto p-1 text-[13px] leading-relaxed text-ink", !text.trim() && "flex items-center justify-center")}
                        onClick={onContentClick}
                        onDoubleClick={onContentDoubleClick}
                        role={readonly ? undefined : "button"}
                        tabIndex={readonly ? -1 : 0}
                        onKeyDown={(e) => { if (readonly) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}
                    >
                        {text.trim() ? (
                            <div className="prose prose-sm max-w-none break-words text-ink [&_a]:break-all [&_a]:text-accent [&_a]:underline" onClick={onContentClick} onDoubleClick={onContentDoubleClick} dangerouslySetInnerHTML={{ __html: html }} />
                        ) : (
                            <span className="text-center text-[12.5px] text-ink3" onDoubleClick={readonly ? undefined : onContentDoubleClick}>{t.widgetNoteEmpty || "Toque duas vezes para escrever..."}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
