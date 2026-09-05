import { useEffect, useRef, useState } from "react";
import { cn } from "../cn";
import { useGridWallpaper } from "../hooks/useGridWallpaper";
import { useRequest } from "../hooks/useRequest";
import type { Lang } from "../i18n";
import { THEME_STR } from "../pages/config/themeCopy";
import { Button, FieldStatus, Modal, SelectField } from "../pages/config/ui";
import { WallhavenAdvancedFilters } from "../pages/config/wallpaperManager/WallhavenAdvancedFilters";
import { WALLHAVEN_DEFAULTS, wallhavenFiltersToQuery, type WallhavenFilters } from "../pages/config/wallpaperManager/wallhavenFilters";

type ProviderStatus = {
  pexels: { configured: boolean };
  unsplash: { configured: boolean };
  wallhaven: { configured: boolean; has_key?: boolean };
};

export function GridWallpaperModal({ open, onClose, lang }: { open: boolean; onClose: () => void; lang: Lang }) {
  if (!open) return null;
  return (
    <Modal title="Wallpaper do grid" onClose={onClose} wide>
      <GridWallpaperContent lang={lang} />
    </Modal>
  );
}

function GridWallpaperContent({ lang }: { lang: Lang }) {
  const c = THEME_STR[lang];
  const { wallpapers, gridId, fetchAll, setGridWallpaper } = useGridWallpaper();
  const selectReq = useRequest();
  const uploadReq = useRequest();
  const importReq = useRequest();
  const searchReq = useRequest();
  const deleteReq = useRequest();
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [searchProvider, setSearchProvider] = useState<"pexels" | "wallhaven" | "unsplash">("wallhaven");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; provider: string; thumb?: string; full?: string; preview?: string; resolution?: string; photographer?: string }>>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [wallhavenFilters, setWallhavenFilters] = useState<WallhavenFilters>({ ...WALLHAVEN_DEFAULTS });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/wallpapers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setProviders(j.providers))
      .catch(() => { });
  }, []);

  // Wallhaven: carrega 9 wallpapers automaticamente ao abrir (mesmo sem busca)
  useEffect(() => {
    if (searchProvider !== "wallhaven") return;
    if (searchResults.length > 0) return;
    if (searchReq.busy) return;
    void searchReq.run(() => handleSearch(1), { error: c.searchError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchProvider]);

  const canSearch = searchProvider === "wallhaven" ? true : searchProvider === "pexels" ? Boolean(providers?.pexels.configured) : Boolean(providers?.unsplash.configured);

  async function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("scope", "grid");
    const r = await fetch("/api/wallpapers/upload?scope=grid", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || c.importError);
    // define como grid
    if (j.id) await setGridWallpaper(j.id);
    await fetchAll();
    return { ok: true };
  }

  async function handleSearch(page = 1) {
    const isWallhaven = searchProvider === "wallhaven";
    if (!searchQuery.trim() && !isWallhaven) throw new Error(c.searchError);
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
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error || c.searchError);
    const results = (j as { results?: typeof searchResults }).results || [];
    if (page === 1) setSearchResults(results);
    else setSearchResults((prev) => [...prev, ...results]);
    setSearchPage(page);
    return { ok: true };
  }

  async function handleImport(item: (typeof searchResults)[number]) {
    const body = {
      provider: item.provider,
      id: item.id,
      image_url: item.full || item.preview || item.thumb,
      thumb: item.thumb || item.preview,
      preview: item.preview || item.thumb,
      scope: "grid",
    };
    const r = await fetch("/api/wallpapers/import?scope=grid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || c.importError);
    if (j.id) await setGridWallpaper(j.id);
    await fetchAll();
    return { ok: true };
  }

  async function handleDelete(id: string) {
    const r = await fetch(`/api/wallpapers/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({})) as { ok?: boolean; error?: string };
    if (!r.ok || j.ok === false) throw new Error(j.error || "falha ao remover");
    await fetchAll();
    return { ok: true };
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-ink2">
        O wallpaper será exibido apenas na área do grid, em alta qualidade (imagem original). Ao ativar o modo tela cheia, ele expande para toda a tela.
        Reutiliza o mesmo seletor/biblioteca do tema.
      </p>

      <div className="flex flex-wrap gap-2">
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
        <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={uploadReq.busy}>
          {uploadReq.busy ? c.wallpapersUploading : c.wallpapersUpload}
        </Button>
        <Button
          variant={gridId ? "secondary" : "ghost"}
          disabled={!gridId}
          onClick={() => void selectReq.run(async () => { await setGridWallpaper(null); await fetchAll(); return { ok: true }; }, { success: "Removido do grid", error: "falha ao remover" })}
        >
          Remover background
        </Button>
        <span className="self-center text-xs text-ink3">{gridId ? `Ativo: ${gridId.slice(0, 8)}` : "Nenhum wallpaper no grid"}</span>
      </div>
      <FieldStatus status={uploadReq.status} message={uploadReq.message} />
      <FieldStatus status={selectReq.status} message={selectReq.message} />
      <FieldStatus status={deleteReq.status} message={deleteReq.message} />

      {wallpapers.length === 0 ? (
        <p className="text-sm text-ink3">{c.wallpapersEmpty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Tile para remover / sem background - sempre visível como primeira opção */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => void selectReq.run(async () => { await setGridWallpaper(null); await fetchAll(); return { ok: true }; }, { success: "Background removido", error: "falha ao remover" })}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void selectReq.run(async () => { await setGridWallpaper(null); await fetchAll(); return { ok: true }; }, { success: "Background removido", error: "falha ao remover" }); } }}
            className={cn("group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border bg-canvas p-4 text-center aspect-[16/10]", !gridId ? "border-accent ring-2 ring-accent/40 bg-chip" : "border-dashed border-edge hover:border-accent/50 hover:bg-chip/50")}
          >
            <div className={cn("flex size-10 items-center justify-center rounded-full border", !gridId ? "bg-accent text-accent-ink border-accent" : "bg-chip text-ink3 border-edge")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
            </div>
            <span className="text-xs font-bold leading-tight">{!gridId ? "Sem background ✓" : "Remover background"}</span>
            <span className="text-[11px] leading-tight text-ink3">Nenhum wallpaper no grid</span>
          </div>
          {wallpapers.map((w) => {
            const active = w.id === gridId;
            return (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => void selectReq.run(() => setGridWallpaper(w.id).then(() => ({ ok: true })), { success: "Wallpaper do grid atualizado", error: "falha" })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void selectReq.run(() => setGridWallpaper(w.id).then(() => ({ ok: true })), { success: "Wallpaper do grid atualizado", error: "falha" }); } }}
                className={cn("group relative cursor-pointer overflow-hidden rounded-[12px] border bg-canvas text-left", active ? "border-accent ring-2 ring-accent/40" : "border-edge hover:border-accent/50")}
              >
                <div className="aspect-[16/10] overflow-hidden bg-black/10">
                  <img src={`/api/wallpapers/${w.id}/preview`} alt={w.id} className="size-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-[11px] font-medium text-ink2">{w.provider ? `${w.provider}:${w.external_id || w.id.slice(0, 6)}` : w.id.slice(0, 8)}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-bad px-1.5 py-0.5 text-[11px] font-bold text-white hover:bg-bad/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remover wallpaper ${w.id.slice(0, 8)} da biblioteca?`)) void deleteReq.run(() => handleDelete(w.id), { success: "Removido", error: "falha ao remover" });
                    }}
                    title="Remover da biblioteca"
                  >
                    ×
                  </button>
                </div>
                {active ? <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">No grid</span> : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-edge pt-4">
        <h4 className="text-sm font-bold">Buscar novos wallpapers</h4>
        <p className="mt-1 text-xs text-ink3">{c.searchPlaceholder} — Wallhaven não precisa de key; Pexels/Unsplash precisam.</p>
        <div className="mt-3 flex flex-wrap gap-2">
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
              onKeyDown={(e) => { if (e.key === "Enter") void searchReq.run(() => handleSearch(1), { error: c.searchError }); }}
              placeholder={c.searchPlaceholder}
              className="flex-1 rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
            />
            <Button disabled={(!searchQuery.trim() && searchProvider !== "wallhaven") || !canSearch} loading={searchReq.busy} onClick={() => void searchReq.run(() => handleSearch(1), { error: c.searchError })}>
              {searchReq.busy ? c.searching : c.searchButton}
            </Button>
          </div>
        </div>
        {searchProvider === "wallhaven" ? (
          <div className="mt-3">
            <WallhavenAdvancedFilters value={wallhavenFilters} onChange={setWallhavenFilters} />
          </div>
        ) : null}
        {!canSearch ? <p className="mt-2 text-xs text-warn">{c.searchNeedsKey(searchProvider === "pexels" ? c.providerPexels : c.providerUnsplash)}</p> : null}
        <FieldStatus status={searchReq.status} message={searchReq.message} />
        {searchResults.length > 0 ? (
          <>
            <p className="mt-3 text-xs text-ink3">{searchResults.length} resultados</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {searchResults.map((r) => (
                <div key={`${r.provider}-${r.id}`} className="overflow-hidden rounded-[12px] border border-edge bg-canvas">
                  <button type="button" className="aspect-[16/10] w-full overflow-hidden border-0 bg-black/10 p-0" onClick={() => void importReq.run(() => handleImport(r), { success: c.imported, error: c.importError })} disabled={importReq.busy}>
                    <img src={r.thumb || r.preview || r.full || ""} alt={r.id} className="size-full object-cover" loading="lazy" />
                  </button>
                  <div className="p-2">
                    <p className="truncate text-[11px] font-medium text-ink2">{r.provider} · {r.resolution || r.id}</p>
                    <Button variant="secondary" onClick={() => void importReq.run(() => handleImport(r), { success: c.imported, error: c.importError })} loading={importReq.busy} className="mt-2 w-full">
                      {importReq.busy ? c.importing : c.importButton}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" onClick={() => void searchReq.run(() => handleSearch(searchPage + 1), { error: c.searchError })} loading={searchReq.busy} className="mt-3">
              Carregar mais
            </Button>
            <FieldStatus status={importReq.status} message={importReq.message} />
          </>
        ) : null}
      </div>
    </div>
  );
}
