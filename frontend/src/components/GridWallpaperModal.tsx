import { useEffect, useRef, useState } from "react";
import { cn } from "../cn";
import { useRequest } from "../hooks/useRequest";
import { useGridWallpaper } from "../hooks/useGridWallpaper";
import { Button, FieldStatus, Modal, SelectField } from "../pages/config/ui";
import { THEME_STR } from "../pages/config/themeCopy";
import type { Lang } from "../i18n";

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
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [searchProvider, setSearchProvider] = useState<"pexels" | "wallhaven" | "unsplash">("wallhaven");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; provider: string; thumb?: string; full?: string; preview?: string; resolution?: string; photographer?: string }>>([]);
  const [searchPage, setSearchPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/wallpapers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setProviders(j.providers))
      .catch(() => {});
  }, []);

  const canSearch = searchProvider === "wallhaven" ? true : searchProvider === "pexels" ? Boolean(providers?.pexels.configured) : Boolean(providers?.unsplash.configured);

  async function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/wallpapers/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || c.importError);
    // define como grid
    if (j.id) await setGridWallpaper(j.id);
    await fetchAll();
    return { ok: true };
  }

  async function handleSearch(page = 1) {
    if (!searchQuery.trim()) throw new Error(c.searchError);
    const q = encodeURIComponent(searchQuery.trim());
    const url = `/api/wallpapers/search/${searchProvider}?q=${q}&page=${page}&per_page=15`;
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
    };
    const r = await fetch("/api/wallpapers/import", {
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
        <Button variant="ghost" disabled={!gridId} onClick={() => void selectReq.run(async () => { await setGridWallpaper(null); return { ok: true }; }, { success: "Removido do grid", error: "falha" })}>
          Remover do grid
        </Button>
        <span className="self-center text-xs text-ink3">{gridId ? `Ativo: ${gridId.slice(0, 8)}` : "Nenhum wallpaper no grid"}</span>
      </div>
      <FieldStatus status={uploadReq.status} message={uploadReq.message} />
      <FieldStatus status={selectReq.status} message={selectReq.message} />

      {wallpapers.length === 0 ? (
        <p className="text-sm text-ink3">{c.wallpapersEmpty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  <span className="truncate text-[11px] font-medium text-ink2">{w.provider ? `${w.provider}:${w.external_id || w.id.slice(0,6)}` : w.id.slice(0,8)}</span>
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
            <Button disabled={!searchQuery.trim() || !canSearch} loading={searchReq.busy} onClick={() => void searchReq.run(() => handleSearch(1), { error: c.searchError })}>
              {searchReq.busy ? c.searching : c.searchButton}
            </Button>
          </div>
        </div>
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
