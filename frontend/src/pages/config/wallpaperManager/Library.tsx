import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../cn";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { ProviderSearchGrid, wallpaperMediaSrc } from "../../../components/ProviderSearchGrid";
import { cfgStatus } from "../../../tw";
import { Button, Card, FieldStatus, SelectField } from "../ui";
import { useWp } from "./context";
import { WallhavenAdvancedFilters } from "./WallhavenAdvancedFilters";

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
        wallhavenFilters,
        setWallhavenFilters,
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
        reorder,
        reorderReq,
    } = useWp();
    const fileRef = useRef<HTMLInputElement>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    // Wallhaven: carrega 9 wallpapers automaticamente ao abrir (mesmo sem busca)
    useEffect(() => {
        if (searchProvider !== "wallhaven") return;
        if (searchResults.length > 0) return;
        if (searchReq.busy) return;
        void searchReq.run(() => handleSearch(1), { error: c.searchError });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchProvider]);

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
                    <>
                        <p className={`${cfgStatus} text-ink3`}>Arraste para reordenar.</p>
                        <FieldStatus status={reorderReq.status} message={reorderReq.message} />
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e: DragEndEvent) => {
                                const { active, over } = e;
                                if (!over || active.id === over.id) return;
                                const oldIndex = wallpapers.findIndex((w) => w.id === String(active.id));
                                const newIndex = wallpapers.findIndex((w) => w.id === String(over.id));
                                if (oldIndex === -1 || newIndex === -1) return;
                                const nextIds = arrayMove(wallpapers.map((w) => w.id), oldIndex, newIndex);
                                void reorderReq.run(() => reorder(nextIds).then(() => ({ ok: true })), { error: "falha ao reordenar" });
                            }}
                        >
                            <SortableContext items={wallpapers.map((w) => w.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {wallpapers.map((w) => (
                                        <SortableThemeWallpaperTile
                                            key={w.id}
                                            w={w}
                                            active={w.id === selectedId}
                                            selectedLabel={c.wallpaperSelected}
                                            gifBadge={c.gifBadge}
                                            onSelect={() => void selectReq.run(() => handleSelect(w.id), { error: c.wallpaperSelectError })}
                                            onDelete={() => setConfirmingDeleteId(w.id)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </>
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
                                { value: "giphy", label: `Giphy ${providers?.giphy?.configured ? "✓" : " — precisa de key"}` },
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
                                disabled={(!searchQuery.trim() && searchProvider !== "wallhaven") || !canSearch}
                                loading={searchReq.busy}
                                onClick={() => void searchReq.run(() => handleSearch(1), { error: c.searchError })}
                            >
                                {searchReq.busy ? c.searching : c.searchButton}
                            </Button>
                        </div>
                    </div>
                    {searchProvider === "wallhaven" ? (
                        <WallhavenAdvancedFilters value={wallhavenFilters} onChange={setWallhavenFilters} />
                    ) : null}
                    {!canSearch ? (
                        <p className={`${cfgStatus} text-warn`}>
                            {c.searchNeedsKey(searchProvider === "pexels" ? c.providerPexels : searchProvider === "unsplash" ? c.providerUnsplash : c.providerGiphy)}
                        </p>
                    ) : null}
                    {searchProvider === "giphy" ? <p className={`${cfgStatus} text-ink3`}>{c.gifBoardHint}</p> : null}
                    <FieldStatus status={searchReq.status} message={searchReq.message} />
                    {searchResults.length > 0 ? (
                        <>
                            <p className={cfgStatus}>
                                {searchResults.length} {c.searchResults.toLowerCase()} {searchTotal ? `· total ~${searchTotal}` : ""}
                            </p>
                            <ProviderSearchGrid
                                items={searchResults}
                                busy={importReq.busy}
                                useLabel={importReq.busy ? c.importing : c.importButton}
                                gifBadge={c.gifBadge}
                                onUse={(r) => void importReq.run(() => handleImport(r), { success: c.imported, error: c.importError })}
                            />
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
            <ConfirmModal
                open={Boolean(confirmingDeleteId)}
                title={c.wallpaperRemoveConfirmTitle}
                body={c.wallpaperRemoveConfirmBody(confirmingDeleteId || "")}
                confirmLabel={c.wallpaperRemoveConfirmAction}
                cancelLabel={c.cancel}
                onCancel={() => setConfirmingDeleteId(null)}
                onConfirm={() => {
                    const id = confirmingDeleteId;
                    setConfirmingDeleteId(null);
                    if (id) void uploadReq.run(() => handleDelete(id), { success: c.imported, error: c.importError });
                }}
            />
        </div>
    );
}

function SortableThemeWallpaperTile({ w, active, selectedLabel, gifBadge, onSelect, onDelete }: { w: { id: string; provider?: string | null; external_id?: string | null; kind?: string | null; original_url?: string | null }; active: boolean; selectedLabel: string; gifBadge: string; onSelect: () => void; onDelete: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
    return (
        <div
            ref={setNodeRef}
            style={style}
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
            className={cn("group relative cursor-pointer overflow-hidden rounded-[12px] border bg-canvas text-left", active ? "border-accent ring-2 ring-accent/40" : "border-edge hover:border-accent/50", isDragging && "ring-2 ring-accent/30")}
        >
            <div className="aspect-[16/10] overflow-hidden bg-black/10">
                <img src={wallpaperMediaSrc(w)} alt={w.id} className="size-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-[11px] font-medium text-ink2">{w.provider ? `${w.provider}:${w.external_id || w.id.slice(0, 6)}` : w.id.slice(0, 8)}</span>
                <div className="flex shrink-0 items-center gap-1">
                    <span aria-label="Arrastar para reordenar" title="Arrastar para reordenar" className="flex size-6 cursor-grab items-center justify-center rounded-full border border-edge bg-canvas text-ink3 hover:bg-chip active:cursor-grabbing" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} {...attributes} {...listeners}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><circle cx="3" cy="3" r="1.2" fill="currentColor" /><circle cx="9" cy="3" r="1.2" fill="currentColor" /><circle cx="3" cy="6" r="1.2" fill="currentColor" /><circle cx="9" cy="6" r="1.2" fill="currentColor" /><circle cx="3" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /></svg>
                    </span>
                    <button type="button" className="shrink-0 rounded-full bg-bad px-2 py-0.5 text-[11px] font-bold text-white hover:bg-bad/90" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
                </div>
            </div>
            {w.kind === "gif" ? <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{gifBadge}</span> : null}
            {active ? <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">{selectedLabel}</span> : null}
        </div>
    );
}
