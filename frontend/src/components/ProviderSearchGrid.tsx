import { Button } from "../pages/config/ui";

export type ProviderSearchGridItem = {
  id: string;
  provider: string;
  thumb?: string;
  full?: string;
  preview?: string;
  resolution?: string;
  photographer?: string;
  title?: string;
  type?: string;
  width?: number;
  height?: number;
  import_url?: string;
};

export function ProviderSearchGrid({
  items,
  busy,
  useLabel,
  onUse,
  gifBadge,
}: {
  items: ProviderSearchGridItem[];
  busy?: boolean;
  useLabel: string;
  onUse: (item: ProviderSearchGridItem) => void;
  gifBadge?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((r) => {
        const isGif = r.type === "gif" || r.provider === "giphy";
        return (
          <div key={`${r.provider}-${r.id}`} className="relative overflow-hidden rounded-[12px] border border-edge bg-canvas">
            <button
              type="button"
              className="aspect-[16/10] w-full overflow-hidden border-0 bg-black/10 p-0"
              onClick={() => onUse(r)}
              disabled={busy}
            >
              <img src={r.thumb || r.preview || r.full || ""} alt={r.id} className="size-full object-cover" loading="lazy" />
            </button>
            {isGif && gifBadge ? (
              <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">{gifBadge}</span>
            ) : null}
            <div className="p-2">
              <p className="truncate text-[11px] font-medium text-ink2">
                {r.provider} · {r.resolution || r.title?.slice(0, 20) || (r.width && r.height ? `${r.width}×${r.height}` : r.id)}
              </p>
              {r.photographer ? <p className="truncate text-[11px] text-ink3">{r.photographer}</p> : null}
              <Button variant="secondary" onClick={() => onUse(r)} loading={busy} className="mt-2 w-full text-xs">
                {useLabel}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function wallpaperMediaSrc(w: { id: string; kind?: string | null; original_url?: string | null }): string {
  if (w.kind === "gif") return w.original_url || `/api/wallpapers/${w.id}/original`;
  return `/api/wallpapers/${w.id}/preview`;
}
