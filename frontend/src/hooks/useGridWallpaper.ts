import { useCallback, useEffect, useState } from "react";

type WallpaperItem = {
  id: string;
  source: string;
  provider?: string | null;
  external_id?: string | null;
  preview_url?: string | null;
  created_at?: string | null;
  has_preview: boolean;
};

export function useGridWallpaper() {
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [gridId, setGridId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/wallpapers?scope=grid", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { wallpapers: WallpaperItem[]; grid_selected_id?: string | null; selected_id?: string | null };
      setWallpapers(j.wallpapers || []);
      // prefere grid_selected_id, fallback null
      setGridId(j.grid_selected_id || null);
      // também tenta endpoint dedicado (mais recente)
      try {
        const rg = await fetch("/api/wallpapers/grid/selected", { cache: "no-store" });
        if (rg.ok) {
          const jg = (await rg.json()) as { grid_selected_id?: string | null };
          if (jg.grid_selected_id !== undefined) setGridId(jg.grid_selected_id);
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const onUpdate = () => void fetchAll();
    window.addEventListener("vigia:wallpapers-updated", onUpdate);
    window.addEventListener("vigia:grid-wallpaper-updated", onUpdate);
    return () => {
      window.removeEventListener("vigia:wallpapers-updated", onUpdate);
      window.removeEventListener("vigia:grid-wallpaper-updated", onUpdate);
    };
  }, [fetchAll]);

  const setGridWallpaper = useCallback(async (id: string | null) => {
    const r = await fetch("/api/wallpapers/grid/selected", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id || null }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "falha ao definir wallpaper do grid");
    }
    const j = (await r.json().catch(() => ({}))) as { grid_selected_id?: string | null };
    const next = j.grid_selected_id ?? id;
    setGridId(next);
    window.dispatchEvent(new CustomEvent("vigia:grid-wallpaper-updated"));
    window.dispatchEvent(new CustomEvent("vigia:wallpapers-updated"));
    return next;
  }, []);

  return { wallpapers, gridId, loading, fetchAll, setGridWallpaper };
}

export function gridWallpaperUrl(id: string | null): string | null {
  if (!id) return null;
  // alta qualidade: usa endpoint original sem otimização
  return `/api/wallpapers/${id}/original`;
}
