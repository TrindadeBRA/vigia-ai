import { NavLink } from "react-router-dom";
import { cn } from "../../cn";
import { BellIcon, ChipIcon, GitHubIcon, GridIcon, HeartIcon, PaletteIcon, SlidersIcon } from "../../components/icons";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { accentLink, sideItem, sideItemActive } from "../../tw";
import type { ProviderMeta } from "./types";

export function Sidebar(props: {
  providers: ProviderMeta[];
  section: string;
  selectedId: string | null;
  open: boolean;
  onOverview: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  nowActive: boolean;
  configActive: boolean;
  setupActive: boolean;
  themeActive: boolean;
  alarmsActive: boolean;
  onOpenPix: () => void;
  t: T;
}) {
  const { providers, section, selectedId, open, onOverview, onSelect, onClose, nowActive, configActive, setupActive, themeActive, alarmsActive, onOpenPix, t } = props;
  const onPage = configActive || setupActive || themeActive || alarmsActive || nowActive;
  const heading = "mb-1.5 px-[9px] text-[10.5px] font-bold uppercase tracking-[.6px] text-ink3";
  return (
    <nav
      className={cn(
        "flex h-full min-h-0 w-[264px] shrink-0 flex-col overflow-hidden border-r border-edge px-2 pb-3 pt-3",
        "max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 max-[860px]:top-14 max-[860px]:z-30 max-[860px]:h-auto max-[860px]:w-[82vw] max-[860px]:max-w-[320px] max-[860px]:-translate-x-full max-[860px]:bg-canvas max-[860px]:transition-transform max-[860px]:duration-200",
        open && "max-[860px]:translate-x-0",
      )}
    >
      <div className="flex shrink-0 flex-col gap-px">
        <button className={cn(sideItem, section === "overview" && !nowActive && !onPage && sideItemActive)} onClick={() => { onOverview(); onClose(); }}>
          <GridIcon size={16} /> {t.overview}
        </button>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className={heading}>{t.accounts}</div>
        <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
          {providers.length === 0 ? (
            <div className="px-[9px] py-1.5 text-[12.5px] text-ink3">
              {t.noProviders}{" "}
              <NavLink to="/display/config" className={accentLink} onClick={onClose}>
                {t.configCta}
              </NavLink>
            </div>
          ) : (
            providers.map((p) => (
              <button key={p.id} data-provider-id={p.id} className={cn(sideItem, "shrink-0", section === "account" && selectedId === p.id && !onPage && sideItemActive)} onClick={() => { onSelect(p.id); onClose(); }}>
                <img className="size-[22px] shrink-0 object-contain" src={PROVIDER_ICON[p.provider]} alt={p.provider} draggable={false} />
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold">{p.title}</div>
                  {p.label ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{p.label}</div> : null}
                </div>
                <span className={cn("size-1.5 shrink-0 rounded-full", p.ok ? "bg-good" : "bg-bad")} />
              </button>
            ))
          )}
        </div>
      </div>
      <div className="mt-3 flex shrink-0 flex-col gap-px border-t border-edge pt-3">
        <div className={heading}>{t.setup}</div>
        <NavLink to="/display/config" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <SlidersIcon size={16} /> {t.config}
        </NavLink>
        <NavLink to="/display/setup" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <ChipIcon size={16} /> {t.board}
        </NavLink>
        <NavLink to="/display/theme" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <PaletteIcon size={16} /> {t.theme}
        </NavLink>
        <NavLink to="/display/alarms" className={({ isActive }) => cn(sideItem, isActive && sideItemActive)} onClick={onClose}>
          <BellIcon size={16} /> {t.alarms}
        </NavLink>
      </div>
      <div className="mt-1 flex shrink-0 items-center gap-1.5 border-t border-edge pt-1">
        <a
          className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-[9px] py-2 text-left text-[12.5px] text-ink3 no-underline transition-colors duration-150 hover:bg-chip hover:text-ink2"
          href="https://github.com/TrindadeBRA/vigia-ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GitHubIcon size={15} /> GitHub
        </a>
        <button
          type="button"
          onClick={onOpenPix}
          className="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#e11d48]/25 bg-[#e11d48]/10 px-2.5 py-1.5 text-[12px] font-bold text-[#e11d48] no-underline transition-colors duration-150 hover:border-[#e11d48]/45 hover:bg-[#e11d48]/18"
        >
          <HeartIcon size={12} className="transition-transform duration-150 group-hover:scale-110" /> Apoiar
        </button>
      </div>
    </nav>
  );
}
