import { useEffect, useRef, useState } from "react";
import { cn } from "../cn";
import { useRequest } from "../hooks/useRequest";
import type { Lang, T } from "../i18n";
import { THEME_STR } from "../pages/config/themeCopy";
import { Button, FieldStatus, Modal, SelectField } from "../pages/config/ui";

type ProviderStatus = {
    pexels: { configured: boolean };
    unsplash: { configured: boolean };
    wallhaven: { configured: boolean; has_key?: boolean };
    giphy: { configured: boolean };
};

type SearchItem = {
    id: string;
    provider: string;
    thumb?: string;
    full?: string;
    preview?: string;
    resolution?: string;
    photographer?: string;
    title?: string;
    type?: string;
};

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("falha ao ler arquivo"));
        r.readAsDataURL(file);
    });
}

function isValidImageUrl(s: string): boolean {
    const v = s.trim();
    if (!v) return false;
    if (v.startsWith("data:image/")) return true;
    try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

export function ImageWidgetModal({
    open,
    onClose,
    onAdd,
    lang,
    t,
    editSrc,
    editLabel,
    onSaveEdit,
    mode = "add",
}: {
    open: boolean;
    onClose: () => void;
    onAdd: (src: string, fit: "cover" | "contain", label?: string) => void;
    lang: Lang;
    t: T;
    editSrc?: string | null;
    editLabel?: string | null;
    onSaveEdit?: (src: string, fit: "cover" | "contain", label?: string) => void;
    mode?: "add" | "edit";
}) {
    if (!open) return null;
    return (
        <Modal title={mode === "edit" ? (t.imageEditTitle ?? "Editar imagem") : (t.imageAddTitle ?? "Adicionar imagem")} onClose={onClose} wide>
            <ImageWidgetContent
                onClose={onClose}
                onAdd={onAdd}
                lang={lang}
                t={t}
                editSrc={editSrc}
                editLabel={editLabel}
                onSaveEdit={onSaveEdit}
                mode={mode}
            />
        </Modal>
    );
}

function ImageWidgetContent({
    onClose,
    onAdd,
    lang,
    t,
    editSrc,
    editLabel,
    onSaveEdit,
    mode,
}: {
    onClose: () => void;
    onAdd: (src: string, fit: "cover" | "contain", label?: string) => void;
    lang: Lang;
    t: T;
    editSrc?: string | null;
    editLabel?: string | null;
    onSaveEdit?: (src: string, fit: "cover" | "contain", label?: string) => void;
    mode: "add" | "edit";
}) {
    const c = THEME_STR[lang];
    const [tab, setTab] = useState<"upload" | "url" | "search">("upload");
    const [urlValue, setUrlValue] = useState(editSrc && !editSrc.startsWith("data:") ? editSrc : "");
    const [fit, setFit] = useState<"cover" | "contain">("cover");
    const [label, setLabel] = useState(editLabel || "");
    const [preview, setPreview] = useState<string | null>(editSrc || null);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const uploadReq = useRequest();
    const urlReq = useRequest();

    // search state
    const [providers, setProviders] = useState<ProviderStatus | null>(null);
    const [searchProvider, setSearchProvider] = useState<"wallhaven" | "pexels" | "unsplash" | "giphy">("wallhaven");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [searchPage, setSearchPage] = useState(1);
    const searchReq = useRequest();
    const importReq = useRequest();

    useEffect(() => {
        fetch("/api/wallpapers", { cache: "no-store" })
            .then((r) => r.json())
            .then((j) => setProviders(j.providers))
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (editSrc) setPreview(editSrc);
    }, [editSrc]);

    const canSearch =
        searchProvider === "wallhaven"
            ? true
            : searchProvider === "pexels"
                ? Boolean(providers?.pexels.configured)
                : searchProvider === "unsplash"
                    ? Boolean(providers?.unsplash.configured)
                    : Boolean(providers?.giphy.configured);

    async function handleFile(file: File) {
        if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem");
        if (file.size > 8_000_000) throw new Error("Imagem muito grande (máx 8MB)");
        const dataUrl = await fileToDataUrl(file);
        setPreview(dataUrl);
        return { ok: true };
    }

    function handleUrlConfirm() {
        const v = urlValue.trim();
        if (!isValidImageUrl(v)) throw new Error("URL inválida — use http(s) ou data:image/...");
        setPreview(v);
        return { ok: true };
    }

    async function handleSearch(page = 1) {
        if (!searchQuery.trim()) throw new Error(c.searchError);
        const q = encodeURIComponent(searchQuery.trim());
        const url = `/api/wallpapers/search/${searchProvider}?q=${q}&page=${page}&per_page=15`;
        const r = await fetch(url);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { error?: string }).error || c.searchError);
        const results = (j as { results?: SearchItem[] }).results || [];
        if (page === 1) setSearchResults(results);
        else setSearchResults((prev) => [...prev, ...results]);
        setSearchPage(page);
        return { ok: true };
    }

    function handlePickSearch(item: SearchItem) {
        const src = item.full || item.preview || item.thumb || "";
        if (!src) return;
        setPreview(src);
        setTab("url");
        setUrlValue(src);
    }

    function handleConfirm() {
        const src = (preview || "").trim();
        if (!src) throw new Error(t.imageNeedSrc ?? "Escolha uma imagem");
        if (mode === "edit" && onSaveEdit) onSaveEdit(src, fit, label.trim() || undefined);
        else onAdd(src, fit, label.trim() || undefined);
        onClose();
        return { ok: true };
    }

    const confirmReq = useRequest();

    return (
        <div className="flex flex-col gap-5">
            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-surface p-1">
                {[
                    { id: "upload", label: t.imageTabUpload ?? "Upload" },
                    { id: "url", label: t.imageTabUrl ?? "URL / Base64" },
                    { id: "search", label: t.imageTabSearch ?? "Buscar" },
                ].map((tb) => (
                    <button
                        key={tb.id}
                        type="button"
                        className={cn(
                            "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                            tab === tb.id ? "bg-panel text-ink shadow-sm" : "text-ink3 hover:text-ink",
                        )}
                        onClick={() => setTab(tb.id as typeof tab)}
                    >
                        {tb.label}
                    </button>
                ))}
            </div>

            {/* Preview */}
            {preview ? (
                <div className="overflow-hidden rounded-xl border border-edge bg-black/5">
                    <div className="flex items-center justify-between gap-2 border-b border-edge bg-chip px-3 py-2">
                        <span className="text-xs font-semibold text-ink2">{t.imagePreview ?? "Prévia"}</span>
                        <div className="flex items-center gap-2">
                            <select
                                value={fit}
                                onChange={(e) => setFit(e.target.value as typeof fit)}
                                className="rounded-lg border border-edge bg-canvas px-2 py-1 text-xs text-ink"
                            >
                                <option value="cover">{t.imageFitCover ?? "Preencher"}</option>
                                <option value="contain">{t.imageFitContain ?? "Conter"}</option>
                            </select>
                            <button
                                type="button"
                                className="rounded-lg bg-bad px-2 py-1 text-xs font-bold text-white hover:bg-bad/90"
                                onClick={() => { setPreview(null); setUrlValue(""); }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="flex max-h-[220px] items-center justify-center bg-black/10 p-2">
                        <img
                            src={preview}
                            alt="preview"
                            className={cn("max-h-[200px] max-w-full rounded-lg", fit === "contain" ? "object-contain" : "object-cover")}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                    </div>
                    <div className="px-3 py-2">
                        <input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder={t.imageLabelPh ?? "Legenda opcional"}
                            className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink3"
                        />
                    </div>
                </div>
            ) : null}

            {/* Tab: Upload */}
            {tab === "upload" ? (
                <div className="flex flex-col gap-3">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadReq.run(() => handleFile(f), { error: "Falha ao carregar imagem" });
                            e.target.value = "";
                        }}
                    />
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileRef.current?.click()}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            const f = e.dataTransfer.files?.[0];
                            if (f) void uploadReq.run(() => handleFile(f), { error: "Falha ao carregar imagem" });
                        }}
                        className={cn(
                            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-canvas px-6 py-10 text-center transition-colors",
                            dragOver ? "border-accent bg-chip" : "border-edge hover:border-accent/50 hover:bg-chip/50",
                        )}
                    >
                        <div className="flex size-12 items-center justify-center rounded-full bg-chip text-ink3">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-ink">{t.imageDropHint ?? "Arraste uma imagem ou clique para selecionar"}</p>
                            <p className="mt-1 text-xs text-ink3">PNG, JPG, GIF, WebP — até 8MB</p>
                        </div>
                        <span className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink">{t.imageChooseFile ?? "Escolher arquivo"}</span>
                    </div>
                    <FieldStatus status={uploadReq.status} message={uploadReq.message} />
                </div>
            ) : null}

            {/* Tab: URL */}
            {tab === "url" ? (
                <div className="flex flex-col gap-3">
                    <p className="text-xs leading-relaxed text-ink3">{t.imageUrlHint ?? "Cole a URL da imagem ou um data:image/... base64"}</p>
                    <div className="flex gap-2">
                        <input
                            value={urlValue}
                            onChange={(e) => setUrlValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void urlReq.run(async () => handleUrlConfirm(), { error: "URL inválida" }); }}
                            placeholder="https://... ou data:image/png;base64,..."
                            className="flex-1 rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
                        />
                        <Button disabled={!urlValue.trim()} loading={urlReq.busy} onClick={() => void urlReq.run(async () => handleUrlConfirm(), { error: "URL inválida" })}>
                            {t.imageUseUrl ?? "Usar"}
                        </Button>
                    </div>
                    <FieldStatus status={urlReq.status} message={urlReq.message} />
                    {urlValue.trim() && !isValidImageUrl(urlValue) ? <p className="text-xs text-warn">URL deve começar com http(s):// ou data:image/</p> : null}
                </div>
            ) : null}

            {/* Tab: Search */}
            {tab === "search" ? (
                <div className="flex flex-col gap-3">
                    <p className="text-xs text-ink3">{c.searchPlaceholder} — Wallhaven não precisa de key; Pexels/Unsplash/Giphy precisam.</p>
                    <div className="flex flex-wrap gap-2">
                        <SelectField
                            wrapperClassName="flex shrink-0 flex-col gap-1.5"
                            className="w-auto min-w-[11rem]"
                            value={searchProvider}
                            onChange={(e) => setSearchProvider(e.target.value as typeof searchProvider)}
                            options={[
                                { value: "wallhaven", label: `Wallhaven ${providers?.wallhaven.configured ? "✓" : ""}` },
                                { value: "pexels", label: `Pexels ${providers?.pexels.configured ? "✓" : " — precisa de key"}` },
                                { value: "unsplash", label: `Unsplash ${providers?.unsplash.configured ? "✓" : " — precisa de key"}` },
                                { value: "giphy", label: `Giphy ${providers?.giphy.configured ? "✓" : " — precisa de key"}` },
                            ]}
                        />
                        <div className="flex flex-1 gap-2">
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") void searchReq.run(() => handleSearch(1), { error: c.searchError }); }}
                                placeholder={c.searchPlaceholder}
                                className="flex-1 rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
                            />
                            <Button disabled={!searchQuery.trim() || !canSearch} loading={searchReq.busy} onClick={() => void searchReq.run(() => handleSearch(1), { error: c.searchError })}>
                                {searchReq.busy ? c.searching : c.searchButton}
                            </Button>
                        </div>
                    </div>
                    {!canSearch ? <p className="text-xs text-warn">{c.searchNeedsKey(searchProvider === "pexels" ? c.providerPexels : searchProvider === "unsplash" ? c.providerUnsplash : "Giphy")}</p> : null}
                    <FieldStatus status={searchReq.status} message={searchReq.message} />
                    {searchResults.length > 0 ? (
                        <>
                            <p className="text-xs text-ink3">{searchResults.length} resultados</p>
                            <div className="grid max-h-[280px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                                {searchResults.map((r) => (
                                    <div key={`${r.provider}-${r.id}`} className="overflow-hidden rounded-[12px] border border-edge bg-canvas">
                                        <button type="button" className="aspect-[16/10] w-full overflow-hidden border-0 bg-black/10 p-0" onClick={() => handlePickSearch(r)} disabled={importReq.busy}>
                                            <img src={r.thumb || r.preview || r.full || ""} alt={r.id} className="size-full object-cover" loading="lazy" />
                                        </button>
                                        <div className="p-2">
                                            <p className="truncate text-[11px] font-medium text-ink2">{r.provider} · {r.resolution || r.title?.slice(0, 20) || r.id}</p>
                                            <Button variant="secondary" onClick={() => handlePickSearch(r)} className="mt-2 w-full text-xs">
                                                Usar
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button variant="ghost" onClick={() => void searchReq.run(() => handleSearch(searchPage + 1), { error: c.searchError })} loading={searchReq.busy}>
                                Carregar mais
                            </Button>
                            <FieldStatus status={importReq.status} message={importReq.message} />
                        </>
                    ) : null}
                </div>
            ) : null}

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-edge pt-4">
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button disabled={!preview} loading={confirmReq.busy} onClick={() => void confirmReq.run(async () => handleConfirm(), { error: t.imageNeedSrc ?? "Escolha uma imagem" })}>
                    {mode === "edit" ? (t.save ?? "Salvar") : (t.imageAdd ?? "Adicionar")}
                </Button>
            </div>
            <FieldStatus status={confirmReq.status} message={confirmReq.message} />
        </div>
    );
}
