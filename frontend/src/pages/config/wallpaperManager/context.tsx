import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRequest } from "../../../hooks/useRequest";
import type { Lang } from "../../../i18n";
import { THEME_STR, type ThemeCopy } from "../themeCopy";
import { WALLHAVEN_DEFAULTS, wallhavenFiltersToQuery, type WallhavenFilters } from "./wallhavenFilters";

export type WallpaperItem = {
    id: string;
    source: string;
    provider?: string | null;
    external_id?: string | null;
    preview_url?: string | null;
    created_at?: string | null;
    has_preview: boolean;
};

export type ProviderStatus = {
    pexels: { configured: boolean; needs_key: boolean };
    wallhaven: { configured: boolean; has_key?: boolean; needs_key: boolean };
    unsplash: { configured: boolean; needs_key: boolean };
};

export type SearchResult = {
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

export type WallpaperApi = {
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
    wallhavenFilters: WallhavenFilters;
    setWallhavenFilters: (v: WallhavenFilters) => void;
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

export function useWp(): WallpaperApi {
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
    const [wallhavenFilters, setWallhavenFilters] = useState<WallhavenFilters>({ ...WALLHAVEN_DEFAULTS });

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
        const isWallhaven = searchProvider === "wallhaven";
        if (!searchQuery.trim() && !isWallhaven) return { ok: false, error: c.searchError };
        const q = encodeURIComponent(searchQuery.trim());
        const perPage = isWallhaven && !searchQuery.trim() && page === 1 ? 9 : 15;
        let url = `/api/wallpapers/search/${searchProvider}?page=${page}&per_page=${perPage}`;
        if (searchQuery.trim()) url += `&q=${q}`;
        if (isWallhaven) {
            const extra = wallhavenFiltersToQuery(wallhavenFilters);
            const qs = new URLSearchParams(extra).toString();
            if (qs) url += `&${qs}`;
        }
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
        wallhavenFilters,
        setWallhavenFilters,
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
