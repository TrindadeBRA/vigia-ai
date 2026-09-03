import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../cn";
import { useRequest } from "../../hooks/useRequest";
import type { Lang } from "../../i18n";
import { cfgStatus } from "../../tw";
import { THEME_STR, type ThemeCopy } from "./themeCopy";
import { Button, Card, FieldStatus, SelectField } from "./ui";

type WallpaperItem = {
    id: string;
    source: string;
    provider?: string | null;
    external_id?: string | null;
    preview_url?: string | null;
    created_at?: string | null;
    has_preview: boolean;
};

type ProviderStatus = {
    pexels: { configured: boolean; needs_key: boolean };
    wallhaven: { configured: boolean; has_key?: boolean; needs_key: boolean };
    unsplash: { configured: boolean; needs_key: boolean };
};

type SearchResult = {
    id: string;
    provider: string;
    width?: number;
    height?: number;
    url?: string;
    thumb?: string;
    full?: string;
    preview?: string;
    photographer?: string;
    resolution?: string;
};

function apiFail(j: unknown, fallback: string): string {
    if (j && typeof j === "object") {
        const o = j as { ok?: boolean; error?: string; detail?: unknown };
        if (typeof o.error === "string" && o.error) return o.error;
        if (typeof o.detail === "string" && o.detail) return o.detail;
    }
    return fallback;
}

type WallpaperApi = {
    c: ThemeCopy;
    wallpapers: WallpaperItem[];
    selectedId: string | null;
    providers: ProviderStatus | null;
    searchProvider: "pexels" | "wallhaven" | "unsplash";
    setSearchProvider: (v: "pexels" | "wallhaven" | "unsplash") => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    searchResults: SearchResult[];
    searchTotal: number | null;
    searchPage: number;
    listReq: ReturnType<typeof useRequest>;
    uploadReq: ReturnType<typeof useRequest>;
    selectReq: ReturnType<typeof useRequest>;
    searchReq: ReturnType<typeof useRequest>;
    importReq: ReturnType<typeof useRequest>;
    canSearch: boolean;
    fetchAll: () => Promise<void>;
    handleUpload: (file: File) => Promise<{ ok: boolean }>;
    handleDelete: (id: string) => Promise<{ ok: boolean }>;
    handleSelect: (id: string) => Promise<{ ok: boolean }>;
    handleSearch: (page?: number) => Promise<{ ok: boolean; error?: string }>;
    handleImport: (item: SearchResult) => Promise<{ ok: boolean }>;
};

const WallpaperCtx = createContext<WallpaperApi | null>(null);

function useWp(): WallpaperApi {
    const ctx = useContext(WallpaperCtx);
    if (!ctx) throw new Error("WallpaperManager: contexto ausente");
    return ctx;
}

export function WallpaperManager({
    lang,
    onSelectedChange,
    onLocalPreview,
    children,
}: {
    lang: Lang;
    onSelectedChange?: (id: string | null) => void;
    onLocalPreview?: (url: string | null) => void;
    children: ReactNode;
}) {
    const c = THEME_STR[lang];
    const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [providers, setProviders] = useState<ProviderStatus | null>(null);

    const [searchProvider, setSearchProvider] = useState<"pexels" | "wallhaven" | "unsplash">("wallhaven");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchTotal, setSearchTotal] = useState<number | null>(null);
    const [searchPage, setSearchPage] = useState(1);

    const listReq = useRequest();
    const uploadReq = useRequest();
    const selectReq = useRequest();
    const searchReq = useRequest();
    const importReq = useRequest();

    const fetchAll = useCallback(async () => {
        try {
            const r = await fetch("/api/wallpapers?scope=theme");
            const j = (await r.json()) as { wallpapers: WallpaperItem[]; selected_id?: string | null; providers: ProviderStatus };
            const list = j.wallpapers || [];
            const selected = j.selected_id || list[0]?.id || null;
            setWallpapers(list);
            setSelectedId(selected);
            setProviders(j.providers || null);
            onSelectedChange?.(selected);
            onLocalPreview?.(null);
            window.dispatchEvent(new CustomEvent("vigia:wallpapers-updated"));
        } catch {
            /* ignore */
        }
    }, [onSelectedChange, onLocalPreview]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    async function handleUpload(file: File) {
        const localUrl = URL.createObjectURL(file);
        onLocalPreview?.(localUrl);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scope", "theme");
        const r = await fetch("/api/wallpapers/upload?scope=theme", { method: "POST", body: fd });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string; id?: string };
        if (!r.ok || j.ok === false) {
            onLocalPreview?.(null);
            URL.revokeObjectURL(localUrl);
            throw new Error(apiFail(j, c.importError));
        }
        if (j.id) onSelectedChange?.(j.id);
        await fetchAll();
        URL.revokeObjectURL(localUrl);
        return { ok: true };
    }

    async function handleDelete(id: string) {
        const r = await fetch(`/api/wallpapers/${id}`, { method: "DELETE" });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string };
        if (!r.ok || j.ok === false) throw new Error(apiFail(j, c.wallpapersRemove));
        await fetchAll();
        return { ok: true };
    }

    async function handleSelect(id: string) {
        if (id === selectedId) {
            onSelectedChange?.(id);
            return { ok: true };
        }
        const r = await fetch("/api/wallpapers/selected", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string; selected_id?: string | null };
        if (!r.ok || j.ok === false) throw new Error(apiFail(j, c.wallpaperSelectError));
        const next = j.selected_id || id;
        setSelectedId(next);
        onSelectedChange?.(next);
        window.dispatchEvent(new CustomEvent("vigia:wallpapers-updated"));
        return { ok: true };
    }

    async function handleSearch(page = 1) {
        if (!searchQuery.trim()) return { ok: false, error: c.searchError };
        const q = encodeURIComponent(searchQuery.trim());
        const url = `/api/wallpapers/search/${searchProvider}?q=${q}&page=${page}&per_page=15`;
        const r = await fetch(url);
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string; results?: SearchResult[]; total?: number };
        if (!r.ok) throw new Error((j as { error?: string }).error || c.searchError);
        const results = (j as { results?: SearchResult[] }).results || [];
        if (page === 1) setSearchResults(results);
        else setSearchResults((prev) => [...prev, ...results]);
        setSearchTotal((j as { total?: number }).total ?? null);
        setSearchPage(page);
        return { ok: true };
    }

    async function handleImport(item: SearchResult) {
        const previewUrl = item.preview || item.thumb || item.full || item.url;
        if (previewUrl) onLocalPreview?.(previewUrl);
        const body = {
            provider: item.provider,
            id: item.id,
            image_url: item.full || item.preview || item.thumb || item.url,
            thumb: item.thumb || item.preview,
            preview: item.preview || item.thumb,
            scope: "theme",
        };
        const r = await fetch("/api/wallpapers/import?scope=theme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: string; id?: string };
        if (!r.ok || j.ok === false) {
            onLocalPreview?.(null);
            throw new Error(apiFail(j, c.importError));
        }
        if (j.id) onSelectedChange?.(j.id);
        await fetchAll();
        return { ok: true };
    }

    const canSearch = (() => {
        if (searchProvider === "wallhaven") return true;
        if (searchProvider === "pexels") return providers?.pexels.configured;
        if (searchProvider === "unsplash") return providers?.unsplash.configured;
        return false;
    })();

    const api: WallpaperApi = {
        c,
        wallpapers,
        selectedId,
        providers,
        searchProvider,
        setSearchProvider,
        searchQuery,
        setSearchQuery,
        searchResults,
        searchTotal,
        searchPage,
        listReq,
        uploadReq,
        selectReq,
        searchReq,
        importReq,
        canSearch: Boolean(canSearch),
        fetchAll,
        handleUpload,
        handleDelete,
        handleSelect,
        handleSearch,
        handleImport,
    };

    return <WallpaperCtx.Provider value={api}>{children}</WallpaperCtx.Provider>;
}

export function WallpaperLibrary() {
    const {
        c,
        wallpapers,
        selectedId,
        providers,
        searchProvider,
        setSearchProvider,
        searchQuery,
        setSearchQuery,
        searchResults,
        searchTotal,
        searchPage,
        uploadReq,
        selectReq,
        listReq,
        searchReq,
        importReq,
        canSearch,
        fetchAll,
        handleUpload,
        handleDelete,
        handleSelect,
        handleSearch,
        handleImport,
    } = useWp();
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col gap-6">
            <Card title={c.wallpapers} lead={c.wallpapersLead}>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadReq.run(() => handleUpload(f), { success: c.imported, error: c.importError });
                        e.target.value = "";
                    }}
                />
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={uploadReq.busy}>
                        {uploadReq.busy ? c.wallpapersUploading : c.wallpapersUpload}
                    </Button>
                    <Button variant="ghost" onClick={() => void fetchAll()}>
                        Atualizar
                    </Button>
                </div>
                <p className={cfgStatus}>{c.wallpaperSelectHint}</p>
                <FieldStatus status={uploadReq.status} message={uploadReq.message} />
                <FieldStatus status={selectReq.status} message={selectReq.message} />
                <FieldStatus status={listReq.status} message={listReq.message} />

                {wallpapers.length === 0 ? (
                    <p className={cfgStatus}>{c.wallpapersEmpty}</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {wallpapers.map((w) => {
                            const active = w.id === selectedId;
                            return (
                                <div
                                    key={w.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => void selectReq.run(() => handleSelect(w.id), { error: c.wallpaperSelectError })}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            void selectReq.run(() => handleSelect(w.id), { error: c.wallpaperSelectError });
                                        }
                                    }}
                                    className={cn(
                                        "group relative cursor-pointer overflow-hidden rounded-[12px] border bg-canvas text-left",
                                        active ? "border-accent ring-2 ring-accent/40" : "border-edge hover:border-accent/50",
                                    )}
                                >
                                    <div className="aspect-[16/10] overflow-hidden bg-black/10">
                                        <img
                                            src={`/api/wallpapers/${w.id}/preview`}
                                            alt={w.id}
                                            className="size-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                        <span className="truncate text-[11px] font-medium text-ink2">
                                            {w.provider ? `${w.provider}:${w.external_id || w.id.slice(0, 6)}` : w.id.slice(0, 8)}
                                        </span>
                                        <button
                                            type="button"
                                            className="shrink-0 rounded-full bg-bad px-2 py-0.5 text-[11px] font-bold text-white hover:bg-bad/90"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Remover ${w.id}?`)) void uploadReq.run(() => handleDelete(w.id), { success: c.imported, error: c.importError });
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    {active ? (
                                        <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                                            {c.wallpaperSelected}
                                        </span>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <Card title={c.searchResults} lead={c.searchPlaceholder}>
                <div className="flex flex-col gap-3">
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
                            ]}
                        />
                        <div className="flex flex-1 gap-2">
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void searchReq.run(() => handleSearch(1), { error: c.searchError });
                                }}
                                placeholder={c.searchPlaceholder}
                                className="flex-1 rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
                            />
                            <Button
                                disabled={!searchQuery.trim() || !canSearch}
                                loading={searchReq.busy}
                                onClick={() => void searchReq.run(() => handleSearch(1), { error: c.searchError })}
                            >
                                {searchReq.busy ? c.searching : c.searchButton}
                            </Button>
                        </div>
                    </div>
                    {!canSearch ? (
                        <p className={`${cfgStatus} text-warn`}>
                            {c.searchNeedsKey(searchProvider === "pexels" ? c.providerPexels : c.providerUnsplash)}
                        </p>
                    ) : null}
                    <FieldStatus status={searchReq.status} message={searchReq.message} />
                    {searchResults.length > 0 ? (
                        <>
                            <p className={cfgStatus}>
                                {searchResults.length} {c.searchResults.toLowerCase()} {searchTotal ? `· total ~${searchTotal}` : ""}
                            </p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {searchResults.map((r) => (
                                    <div key={`${r.provider}-${r.id}`} className="overflow-hidden rounded-[12px] border border-edge bg-canvas">
                                        <button
                                            type="button"
                                            className="aspect-[16/10] w-full overflow-hidden border-0 bg-black/10 p-0"
                                            onClick={() => void importReq.run(() => handleImport(r), { success: c.imported, error: c.importError })}
                                            disabled={importReq.busy}
                                        >
                                            <img src={r.thumb || r.preview || r.full || ""} alt={r.id} className="size-full object-cover" loading="lazy" />
                                        </button>
                                        <div className="p-2">
                                            <p className="truncate text-[11px] font-medium text-ink2">
                                                {r.provider} · {r.resolution || (r.width && r.height ? `${r.width}×${r.height}` : r.id)}
                                            </p>
                                            {r.photographer ? <p className="truncate text-[11px] text-ink3">{r.photographer}</p> : null}
                                            <Button
                                                variant="secondary"
                                                onClick={() => void importReq.run(() => handleImport(r), { success: c.imported, error: c.importError })}
                                                loading={importReq.busy}
                                                className="mt-2 w-full"
                                            >
                                                {importReq.busy ? c.importing : c.importButton}
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
                    ) : searchReq.status === "success" && searchResults.length === 0 && searchQuery ? (
                        <p className={cfgStatus}>{c.searchNoResults}</p>
                    ) : null}
                </div>
            </Card>
        </div>
    );
}

