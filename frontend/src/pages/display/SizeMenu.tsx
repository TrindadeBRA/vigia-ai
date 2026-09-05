import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeSize, type CardSize } from "../../board";
import { cn } from "../../cn";
import { CheckIcon, CopyIcon, GripIcon, TrashIcon } from "../../components/icons";
import type { T } from "../../i18n";

const CARD_ORDER: CardSize[] = ["sm", "sw", "sx", "sc", "scw", "md", "lg", "xl", "wm", "wl", "wxl"];

export function sizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "xs") return t.widgetQuarter;
  if (s === "sm") return t.cardSmall;
  if (s === "sw") return t.cardSmallWeek;
  if (s === "sx") return t.cardSmallOnDemand;
  if (s === "sc") return t.cardSmallCrypto;
  if (s === "scw") return t.cardSmallCryptoWeek;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wm") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

export function SizeIcon({ size, className }: { size: CardSize; className?: string }) {
  const s = normalizeSize(size);
  if (s === "xs") return <span className={cn("block size-[4px] rounded-[1px] border-[1.5px] border-current", className)} />;
  if (s === "sm") return <span className={cn("block size-[7px] rounded-[2px] border-[1.5px] border-current", className)} />;
  if (s === "sw") return <span className={cn("block size-[7px] rounded-[2px] border-[1.5px] border-dashed border-current", className)} />;
  if (s === "sx") return <span className={cn("block size-[7px] rounded-[2px] border-[1.5px] border-dotted border-current", className)} />;
  if (s === "sc") return <span className={cn("block size-[7px] rounded-full border-[1.5px] border-current", className)} />;
  if (s === "scw") return <span className={cn("block size-[7px] rounded-full border-[1.5px] border-dashed border-current", className)} />;
  if (s === "md") return <span className={cn("block size-[11px] rounded-[2px] border-[1.5px] border-current", className)} />;
  if (s === "lg") return <span className={cn("flex size-[11px] gap-px", className)}><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /></span>;
  if (s === "wm") return <span className={cn("flex size-[11px] flex-col gap-px", className)}><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /></span>;
  if (s === "wl") return <span className={cn("flex size-[11px] flex-col gap-px", className)}><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /><span className="flex-1 rounded-[1px] border-[1.4px] border-current" /></span>;
  if (s === "wxl") return <span className={cn("grid size-[11px] grid-cols-2 gap-px", className)}><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /></span>;
  return <span className={cn("grid size-[11px] grid-cols-2 gap-px", className)}><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /><span className="rounded-[1px] border-[1.4px] border-current" /></span>;
}

export function SizeMenu({ size, t, onChange, allowed, getLabel }: { size: CardSize; t: T; onChange: (next: CardSize) => void; allowed?: CardSize[]; getLabel?: (s: CardSize) => string }) {
  const cur = normalizeSize(size);
  const order = allowed && allowed.length ? allowed : CARD_ORDER;
  const labelFor = getLabel || ((s: CardSize) => sizeLabel(s, t));
  // Se o tamanho atual não está entre os permitidos (ex: veio de localStorage antigo com wxl), mostra mesmo assim
  const displayOrder = order.includes(cur) ? order : [...order, cur];
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 110;
      const menuH = displayOrder.length * 20 + 4;
      let top = r.bottom + 4;
      let left = r.right - menuW;
      if (left < 8) left = 8;
      if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 4;
      if (top < 8) top = 8;
      setPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="flex size-[18px] shrink-0 items-center justify-center rounded-md text-ink3 transition-colors duration-150 hover:bg-chip hover:text-ink"
        title={labelFor(cur)}
        aria-label={labelFor(cur)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <SizeIcon size={cur} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[100] min-w-[110px] rounded-lg border border-edge bg-panel p-0.5 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {displayOrder.map((s) => {
            const active = s === cur;
            return (
              <button
                key={s}
                role="menuitem"
                type="button"
                className={cn("flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors", active ? "bg-accent text-accent-ink" : "text-ink hover:bg-chip")}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
              >
                <span className={cn("flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border", active ? "border-accent-ink/30 bg-accent-ink/15" : "border-edge bg-chip")}><SizeIcon size={s} className={active ? "text-accent-ink" : "text-ink3"} /></span>
                <span className="flex-1 font-medium leading-none">{labelFor(s)}</span>
                {active ? <CheckIcon size={10} /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

const TILE_CHROME_CHIP = "opacity-0 pointer-events-none transition-opacity duration-150 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100 max-[860px]:pointer-events-auto max-[860px]:opacity-100";

/** Chrome flutuante do tile: alça de arrastar isolada à esquerda (evita clique acidental nos outros botões) + duplicar/tamanho/remover à direita. */
export function TileChrome({
  id,
  t,
  grip,
  size,
  onSetSize,
  allowed,
  getLabel,
  isClone,
  onDuplicate,
  onRemove,
}: {
  id: string;
  t: T;
  grip?: object;
  size: CardSize;
  onSetSize: (next: CardSize) => void;
  allowed?: CardSize[];
  getLabel?: (s: CardSize) => string;
  isClone: boolean;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <>
      <div className={cn("absolute left-1 top-1 z-[3] flex items-center rounded-lg border border-edge bg-chip", TILE_CHROME_CHIP)}>
        <button type="button" className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink3 touch-none hover:bg-chip hover:text-ink active:cursor-grabbing" aria-label={t.dragCard} title={t.dragCard} {...grip}><GripIcon size={14} /></button>
      </div>
      <div className={cn("absolute right-1 top-1 z-[3] flex items-center rounded-lg border border-edge bg-chip", TILE_CHROME_CHIP)}>
        {onDuplicate ? <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink3 hover:bg-chip hover:text-ink" title="Duplicar" aria-label="Duplicar" onClick={(e) => { e.stopPropagation(); onDuplicate(id); }}><CopyIcon size={12} /></button> : null}
        <SizeMenu size={size} t={t} onChange={onSetSize} allowed={allowed} getLabel={getLabel} />
        {isClone && onRemove ? <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-bad hover:bg-chip" title="Remover" aria-label="Remover" onClick={(e) => { e.stopPropagation(); onRemove(id); }}><TrashIcon size={12} /></button> : null}
      </div>
    </>
  );
}
