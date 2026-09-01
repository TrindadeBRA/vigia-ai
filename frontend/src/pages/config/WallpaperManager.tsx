import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../cn";
import { useRequest } from "../../hooks/useRequest";
import type { Lang } from "../../i18n";
import { cfgStatus } from "../../tw";
import { THEME_STR } from "./themeCopy";
import { Button, Card, Checkbox, FieldStatus, TextField } from "./ui";

type WallpaperItem = {
    id: string;
    source: string;
    provider?: string | null;
    external_id?: string | null;
    preview_url?: string | null;
    created_at?: string | null;
    has_preview: boolean;
};

type SlideshowConfig = {
    enabled: boolean;
    interval: number;
    order: string[];
    count: number;
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

export function WallpaperManager({ lang }: { lang: Lang }) {
    const c = THEME_STR[lang];
    const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
    const [slideshow, setSlideshow] = useState<SlideshowConfig>({ enabled: false, interval: 5, order: [], count: 0 });
    const [providers, setProviders] = useState<ProviderStatus | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);

    const [pexelsKey, setPexelsKey] = useState("");
    const [unsplashKey, setUnsplashKey] = useState("");
    const [wallhavenKey, setWallhavenKey] = useState("");

    const [searchProvider, setSearchProvider] = useState<"pexels" | "wallhaven" | "unsplash">("wallhaven");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchTotal, setSearchTotal] = useState<number | null>(null);
    const [searchPage, setSearchPage] = useState(1);

    const fileRef = useRef<HTMLInputElement>(null);
    const listReq = useRequest();
    const uploadReq = useRequest();
    const slideshowReq = useRequest();
    const providerReq = useRequest();
    const searchReq = useRequest();
    const importReq = useRequest();

    const fetchAll = useCallback(async () => {
        try {
            const r = await fetch("/api/wallpapers");
            const j = (await r.json()) as { wallpapers: WallpaperItem[]; slideshow: SlideshowConfig; providers: ProviderStatus };
            setWallpapers(j.wallpapers || []);
            setSlideshow(j.slideshow || { enabled: false, interval: 5, order: [], count: 0 });
            setProviders(j.providers || null);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    // Ordena wallpapers conforme slideshow.order quando slideshow ativo
    const orderedWallpapers = (() => {
        if (!slideshow.enabled || slideshow.order.length === 0) return wallpapers;
        const map = new Map(wallpapers.map((w) => [w.id, w]));
        const ordered: WallpaperItem[] = [];
        for (const id of slideshow.order) {
            const w = map.get(id);
            if (w) ordered.push(w);
        }
        // Adiciona os que não estão na ordem (novos)
        for (const w of wallpapers) {
            if (!slideshow.order.includes(w.id)) ordered.push(w);
        }
        return ordered;
    })();

    async function handleUpload(file: File) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/wallpapers/upload", { method: "POST", body: fd });
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string; id?: string };
        if (!j.ok) throw new Error(j.error || c.importError);
        await fetchAll();
        return { ok: true };
    }

    async function handleDelete(id: string) {
        const r = await fetch(`/api/wallpapers/${id}`, { method: "DELETE" });
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
        if (!j.ok) throw new Error(j.error || c.wallpapersRemove);
        await fetchAll();
        return { ok: true };
    }

    async function handleSlideshowSave() {
        const body = {
            enabled: slideshow.enabled,
            interval: slideshow.interval,
            order: slideshow.order,
        };
        const r = await fetch("/api/wallpapers/slideshow", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
        if (!j.ok) throw new Error(j.error || c.slideshowError);
        await fetchAll();
        return { ok: true };
    }

    async function handleProviderSave() {
        const body: Record<string, string> = {};
        if (pexelsKey.trim()) body.pexels_key = pexelsKey.trim();
        if (unsplashKey.trim()) body.unsplash_key = unsplashKey.trim();
        if (wallhavenKey.trim() || wallhavenKey === "") body.wallhaven_key = wallhavenKey.trim();
        // Se todos vazios e já configurados, não envia
        if (Object.keys(body).length === 0) return { ok: true };
        const r = await fetch("/api/wallpapers/providers", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
        if (!j.ok) throw new Error(j.error || c.providerError);
        setPexelsKey("");
        setUnsplashKey("");
        setWallhavenKey("");
        await fetchAll();
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
        const body = {
            provider: item.provider,
            id: item.id,
            image_url: item.full || item.preview || item.thumb || item.url,
            thumb: item.thumb || item.preview,
            preview: item.preview || item.thumb,
        };
        const r = await fetch("/api/wallpapers/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
        if (!j.ok) throw new Error(j.error || c.importError);
        await fetchAll();
        return { ok: true };
    }

    function handleDragStart(id: string) {
        setDragId(id);
    }
    function handleDragOver(e: React.DragEvent, overId: string) {
        e.preventDefault();
        if (!dragId || dragId === overId) return;
    }
    function handleDrop(e: React.DragEvent, targetId: string) {
        e.preventDefault();
        if (!dragId || dragId === targetId) {
            setDragId(null);
            return;
        }
        const order = [...slideshow.order];
        // Se order vazio, inicializa com wallpapers ids
        const currentOrder = order.length > 0 ? order : wallpapers.map((w) => w.id);
        const fromIdx = currentOrder.indexOf(dragId);
        const toIdx = currentOrder.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) {
            setDragId(null);
            return;
        }
        const [moved] = currentOrder.splice(fromIdx, 1);
        currentOrder.splice(toIdx, 0, moved);
        setSlideshow((s) => ({ ...s, order: currentOrder }));
        setDragId(null);
    }

    const canSearch = (() => {
        if (searchProvider === "wallhaven") return true;
        if (searchProvider === "pexels") return providers?.pexels.configured;
        if (searchProvider === "unsplash") return providers?.unsplash.configured;
        return false;
    })();

    return (
        <div className="flex flex-col gap-6">
            {/* Slideshow */}
            <Card title={c.slideshow} lead={c.slideshowLead}>
                <Checkbox
                    label={c.slideshowEnabled}
                    checked={slideshow.enabled}
                    onChange={(e) => setSlideshow((s) => ({ ...s, enabled: e.target.checked }))}
                />
                <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink3">{c.slideshowInterval}</span>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={1}
                            max={120}
                            value={slideshow.interval}
                            onChange={(e) => setSlideshow((s) => ({ ...s, interval: Number(e.target.value) }))}
                            className="flex-1 accent-accent"
                        />
                        <span className="min-w-[56px] rounded-[8px] border border-edge bg-canvas px-2 py-1 text-center text-sm font-semibold text-ink">
                            {slideshow.interval} min
                        </span>
                    </div>
                    <span className={cfgStatus}>{c.slideshowIntervalHint}</span>
                </label>
                {wallpapers.length > 0 ? (
                    <p className={cfgStatus}>
                        {wallpapers.length} {c.slideshowCount} · {slideshow.enabled ? `troca a cada ${slideshow.interval} min` : "slideshow desativado"}
                    </p>
                ) : (
                    <p className={cfgStatus}>{c.slideshowEmpty}</p>
                )}
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void slideshowReq.run(handleSlideshowSave, { success: c.slideshowSaved, error: c.slideshowError })} loading={slideshowReq.busy}>
                        {slideshowReq.busy ? c.slideshowSaving : c.providerSave}
                    </Button>
                </div>
                <FieldStatus status={slideshowReq.status} message={slideshowReq.message} />
            </Card>

            {/* Wallpapers */}
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
                <FieldStatus status={uploadReq.status} message={uploadReq.message} />
                <FieldStatus status={listReq.status} message={listReq.message} />

                {orderedWallpapers.length === 0 ? (
                    <p className={cfgStatus}>{c.wallpapersEmpty}</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {orderedWallpapers.map((w, idx) => (
                            <div
                                key={w.id}
                                draggable={slideshow.enabled}
                                onDragStart={() => handleDragStart(w.id)}
                                onDragOver={(e) => handleDragOver(e, w.id)}
                                onDrop={(e) => handleDrop(e, w.id)}
                                onDragEnd={() => setDragId(null)}
                                className={cn(
                                    "group relative overflow-hidden rounded-[12px] border bg-canvas",
                                    slideshow.enabled ? "cursor-grab active:cursor-grabbing" : "",
                                    dragId === w.id ? "opacity-50" : "",
                                    "border-edge",
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
                                        {slideshow.enabled ? `${idx + 1}. ` : ""}
                                        {w.provider ? `${w.provider}:${w.external_id || w.id.slice(0, 6)}` : w.id.slice(0, 8)}
                                    </span>
                                    <button
                                        type="button"
                                        className="shrink-0 rounded-full bg-bad px-2 py-0.5 text-[11px] font-bold text-white hover:bg-bad/90"
                                        onClick={() => {
                                            if (confirm(`Remover ${w.id}?`)) void uploadReq.run(() => handleDelete(w.id), { success: c.imported, error: c.importError });
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                                {slideshow.enabled ? (
                                    <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                        #{idx + 1}
                                    </span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
                {slideshow.enabled && orderedWallpapers.length > 1 ? (
                    <p className={cfgStatus}>{c.dragHint}</p>
                ) : null}
            </Card>

            {/* Provedores */}
            <Card title={c.providers} lead={c.providersLead}>
                <div className="grid gap-4">
                    {/* Pexels */}
                    <div className="rounded-[12px] border border-edge bg-canvas p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-bold text-ink">{c.providerPexels}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", providers?.pexels.configured ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad")}>
                                {providers?.pexels.configured ? c.providerConfigured : c.providerNotConfigured}
                            </span>
                        </div>
                        <p className={cfgStatus}>{c.providerNeedsKey}</p>
                        <TextField
                            label={c.providerKeyLabel}
                            value={pexelsKey}
                            placeholder={c.providerKeyPlaceholder}
                            onChange={(e) => setPexelsKey(e.target.value)}
                        />
                    </div>
                    {/* Wallhaven */}
                    <div className="rounded-[12px] border border-edge bg-canvas p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-bold text-ink">{c.providerWallhaven}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", "bg-ok/15 text-ok")}>
                                {providers?.wallhaven.has_key ? `${c.providerConfigured} (key)` : c.providerConfigured}
                            </span>
                        </div>
                        <p className={cfgStatus}>{c.providerOptionalKey}</p>
                        <TextField
                            label={c.providerKeyLabel}
                            value={wallhavenKey}
                            placeholder={c.providerKeyPlaceholder}
                            onChange={(e) => setWallhavenKey(e.target.value)}
                        />
                    </div>
                    {/* Unsplash */}
                    <div className="rounded-[12px] border border-edge bg-canvas p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-bold text-ink">{c.providerUnsplash}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", providers?.unsplash.configured ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad")}>
                                {providers?.unsplash.configured ? c.providerConfigured : c.providerNotConfigured}
                            </span>
                        </div>
                        <p className={cfgStatus}>{c.providerNeedsKey}</p>
                        <TextField
                            label={c.providerKeyLabel}
                            value={unsplashKey}
                            placeholder={c.providerKeyPlaceholder}
                            onChange={(e) => setUnsplashKey(e.target.value)}
                        />
                    </div>
                </div>
                <Button onClick={() => void providerReq.run(handleProviderSave, { success: c.providerSaved, error: c.providerError })} loading={providerReq.busy}>
                    {providerReq.busy ? c.providerSaving : c.providerSave}
                </Button>
                <FieldStatus status={providerReq.status} message={providerReq.message} />
            </Card>

            {/* Busca */}
            <Card title={c.searchResults} lead={c.searchPlaceholder}>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={searchProvider}
                            onChange={(e) => setSearchProvider(e.target.value as typeof searchProvider)}
                            className="rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink"
                        >
                            <option value="wallhaven">Wallhaven {providers?.wallhaven.configured ? "✓" : ""}</option>
                            <option value="pexels">Pexels {providers?.pexels.configured ? "✓" : " — precisa de key"}</option>
                            <option value="unsplash">Unsplash {providers?.unsplash.configured ? "✓" : " — precisa de key"}</option>
                        </select>
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
                            {searchProvider === "pexels" ? "Configure a API key do Pexels acima para buscar." : "Configure a API key do Unsplash acima para buscar."}
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
                                        <div className="aspect-[16/10] overflow-hidden bg-black/10">
                                            <img src={r.thumb || r.preview || r.full || ""} alt={r.id} className="size-full object-cover" loading="lazy" />
                                        </div>
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
