import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { cn } from "../cn";
import type { Lang, T } from "../i18n";
import { CONFIG_STR } from "../pages/config/copy";
import type { ProviderMeta } from "../pages/display/types";
import { PROVIDER_ICON } from "../theme";
import { sideItem, sideItemActive } from "../tw";
import { SearchIcon } from "./icons";

type Item = {
  key: string;
  label: string;
  group: "nav" | "accounts" | "settings";
  icon?: string;
  emoji?: string;
  status?: boolean;
  run: () => void;
};

// Ignora acento/diacrítico na busca ("orquiter" ainda acha "OpenRouter").
function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Paleta de comando (Cmd/Ctrl+K) — pula pra qualquer página, conta conectada
 * ou card de Configurações sem precisar navegar pela sidebar/scroll manual.
 * Vive dentro de Display.tsx porque "visão geral"/"conta" são estado interno
 * (goOverview/onSelect), não rotas — ver pages/Display.tsx. */
export function CommandPalette(props: {
  open: boolean;
  onClose: () => void;
  onOverview: () => void;
  onSelectAccount: (id: string) => void;
  providers: ProviderMeta[];
  lang: Lang;
  t: T;
}) {
  const { open, onClose, onOverview, onSelectAccount, providers, lang, t } = props;
  const navigate = useNavigate();
  const c = CONFIG_STR[lang];
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const goto = (path: string) => () => {
    navigate(path);
    onClose();
  };

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      { key: "overview", label: t.overview, group: "nav", run: () => { onOverview(); onClose(); } },
      { key: "now", label: t.now, group: "nav", run: goto("/display/now") },
      { key: "config", label: t.config, group: "nav", run: goto("/display/config") },
      { key: "board", label: t.board, group: "nav", run: goto("/display/setup") },
      { key: "theme", label: t.theme, group: "nav", run: goto("/display/theme") },
      { key: "alarms", label: t.alarms, group: "nav", run: goto("/display/alarms") },
      { key: "mining", label: t.mining, group: "nav", run: goto("/display/mining") },
      { key: "emulator", label: t.emulatorLibrary, group: "nav", emoji: "🎮", run: goto("/display/emulator") },
    ];

    const accounts: Item[] = providers.map((p) => ({
      key: `acc-${p.id}`,
      label: p.label ? `${p.title} · ${p.label}` : p.title,
      group: "accounts",
      icon: PROVIDER_ICON[p.provider],
      status: p.ok,
      run: () => { onSelectAccount(p.id); onClose(); },
    }));

    const anchor = (id: string, label: string, icon?: string): Item => ({
      key: id,
      label,
      group: "settings",
      icon,
      run: goto(`/display/config#${id}`),
    });

    const settings: Item[] = [
      anchor("cfg-claude", "Claude", PROVIDER_ICON.claude),
      anchor("cfg-gpt", "GPT", PROVIDER_ICON.gpt),
      anchor("cfg-cursor", "Cursor", PROVIDER_ICON.cursor),
      anchor("cfg-openrouter", "OpenRouter", PROVIDER_ICON.openrouter),
      anchor("cfg-deepseek", "DeepSeek", PROVIDER_ICON.deepseek),
      anchor("cfg-opencode", "OpenCode", PROVIDER_ICON.opencode),
      anchor("cfg-fal", "fal.ai", PROVIDER_ICON.fal),
      anchor("cfg-bitcoin", "Bitcoin", PROVIDER_ICON.bitcoin),
      anchor("cfg-adsense", "AdSense", PROVIDER_ICON.adsense),
      anchor("cfg-currencies", c.currenciesTitle, PROVIDER_ICON.currencies),
      anchor("cfg-weather", c.weatherTitle, PROVIDER_ICON.weather),
      anchor("cfg-git", c.gitTitle, PROVIDER_ICON.git),
      anchor("cfg-retroachievements", c.retroTitle, PROVIDER_ICON.retroachievements),
      anchor("cfg-calendar", c.calendarTitle, PROVIDER_ICON.calendar),
      anchor("cfg-rss", c.rssTitle, PROVIDER_ICON.rss),
      anchor("cfg-github", c.githubTitle, PROVIDER_ICON.github),
      anchor("cfg-github-profiles", c.githubProfileTitle, PROVIDER_ICON.github),
      anchor("cfg-camera", c.cameraTitle),
      anchor("cfg-android", c.androidTitle),
      anchor("cfg-spotify", "Spotify", PROVIDER_ICON.spotify),
      anchor("cfg-youtubemusic", "YouTube Music", PROVIDER_ICON.youtubemusic),
      anchor("cfg-emulator", "Emulador (EmulatorJS)"),
      anchor("cfg-wallpapers", c.wallpaperProvidersTitle),
    ];

    return [...nav, ...accounts, ...settings];
  }, [providers, t, c, navigate, onClose, onOverview, onSelectAccount]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return items;
    return items
      .map((it) => ({ it, i: norm(it.label).indexOf(q) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.it);
  }, [items, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest" }); }, [active]);

  if (!open) return null;

  const groupLabel = { nav: t.cmdPaletteNav, accounts: t.accounts, settings: t.config } as const;
  let lastGroup: Item["group"] | null = null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 pt-[10vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.cmdPaletteOpen}
        className="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-edge px-4 py-3">
          <SearchIcon size={17} className="shrink-0 text-ink3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.cmdPalettePlaceholder}
            className="w-full min-w-0 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); }
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="m-0 px-3 py-6 text-center text-[13px] text-ink3">{t.cmdPaletteEmpty}</p>
          ) : (
            filtered.map((it, idx) => {
              const showHeader = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <div key={it.key}>
                  {showHeader ? (
                    <div className="mb-1 mt-2.5 px-[9px] text-[10.5px] font-bold uppercase tracking-[.6px] text-ink3 first:mt-1">
                      {groupLabel[it.group]}
                    </div>
                  ) : null}
                  <button
                    ref={idx === active ? activeRef : undefined}
                    type="button"
                    className={cn(sideItem, idx === active && sideItemActive)}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => it.run()}
                  >
                    {it.icon ? (
                      <img className="size-[18px] shrink-0 object-contain" src={it.icon} alt="" draggable={false} />
                    ) : it.emoji ? (
                      <span className="w-[18px] shrink-0 text-center text-[15px] leading-none">{it.emoji}</span>
                    ) : (
                      <span className="size-[18px] shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{it.label}</span>
                    {it.status !== undefined ? (
                      <span className={cn("size-1.5 shrink-0 rounded-full", it.status ? "bg-good" : "bg-bad")} />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
