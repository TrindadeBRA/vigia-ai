import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ProviderCardPublic } from "../../api/types";
import { PageBreadcrumb } from "../../components/PageBreadcrumb";
import { Skeleton } from "../../components/Skeleton";
import { SearchIcon } from "../../components/icons";
import { isDesktop } from "../../desktop";
import { accentLink, cfgGrid, cfgHint, cfgStatus, pageCol, viewFade } from "../../tw";
import { AdSenseConfigCard } from "./AdSenseConfigCard";
import { AndroidConfigCard } from "./AndroidConfigCard";
import { CalendarConfigCard } from "./CalendarConfigCard";
import { CameraConfigCard } from "./CameraConfigCard";
import { CurrenciesConfigCard } from "./CurrenciesConfigCard";
import { DesktopCard } from "./DesktopCard";
import { EmulatorConfigCard } from "./EmulatorConfigCard";
import { GitConfigCard } from "./GitConfigCard";
import { GithubConfigCard, GithubProfilesConfigCard } from "./GithubConfigCard";
import { ProviderCard } from "./ProviderCard";
import { RetroAchievementsConfigCard } from "./RetroAchievementsConfigCard";
import { RssConfigCard } from "./RssConfigCard";
import { SpotifyConfigCard } from "./SpotifyConfigCard";
import { WallpaperProviderCards } from "./WallpaperProvidersConfigCard";
import { WeatherConfigCard } from "./WeatherConfigCard";
import { YoutubeMusicConfigCard } from "./YoutubeMusicConfigCard";
import { Button, Fold } from "./ui";
import { usePublicConfig } from "./usePublicConfig";

export type { ConfigOutlet } from "./usePublicConfig";

const CURSOR_CMD = `(db="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
[ -f "$db" ] || { echo "Erro: Cursor não parece instalado neste Mac."; exit 1; }
tmp=$(mktemp) && cp "$db" "$tmp" || { echo "Erro: não consegui copiar o banco (permissão?)."; exit 1; }
val=$(sqlite3 "$tmp" "SELECT value FROM ItemTable WHERE key='cursorAuth/accessToken'" 2>&1)
rm -f "$tmp"
[ -n "$val" ] && echo "$val" || echo "Vazio — a conta não guarda sessão nessa tabela, refaça sign-out/sign-in no Cursor.")`;

function normSearch(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function ConfigPage() {
  const { c, cfg, phase, reload, setPhase, lang } = usePublicConfig();
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const noResultsRef = useRef<HTMLParagraphElement>(null);

  // Busca só entre os cards desta página (id="cfg-*"): filtra pelo texto
  // inteiro de cada card, sem lista de rótulos pra manter — some tudo que
  // não bate, e esconde a seção inteira se nenhum card dela sobrar.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = normSearch(search.trim());
    const cards = root.querySelectorAll<HTMLElement>('[id^="cfg-"]');
    let anyVisibleOverall = false;
    cards.forEach((el) => {
      const match = !q || normSearch(el.textContent || "").includes(q);
      el.style.display = match ? "" : "none";
      if (match) anyVisibleOverall = true;
    });
    const sections = root.querySelectorAll<HTMLElement>("[data-cfg-section]");
    sections.forEach((sec) => {
      const anyVisible = !q || Array.from(sec.querySelectorAll<HTMLElement>('[id^="cfg-"]')).some((card) => card.style.display !== "none");
      sec.style.display = anyVisible ? "" : "none";
    });
    if (noResultsRef.current) noResultsRef.current.style.display = q && !anyVisibleOverall ? "" : "none";
  }, [search, cfg]);

  if (phase === "loading" && !cfg) {
    return <Skeleton page="config" />;
  }

  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <PageBreadcrumb current={c.title} lang={lang} className="mb-2" />
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button onClick={() => { setPhase("loading"); void reload(); }}>{c.retry}</Button>
      </div>
    );
  }

  if (!cfg) return null;

  const common = { inDocker: cfg.in_docker, c, onReload: reload };

  return (
    <div ref={rootRef} className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <PageBreadcrumb current={c.title} lang={lang} className="mb-2" />
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">
          {c.configSetupHint}{" "}
          <Link to="/display/setup" className={accentLink}>{c.toolsTitle}</Link>
        </p>
      </header>

      <div className="w-full">
        <label className="flex items-center gap-2.5 rounded-full border border-edge bg-canvas px-4 py-2.5 text-[13.5px] text-ink2 focus-within:border-transparent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
          <SearchIcon size={15} className="shrink-0 text-ink3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={c.configSearchPlaceholder}
            className="w-full min-w-0 border-0 bg-transparent text-ink outline-none focus-visible:!outline-none placeholder:text-ink3"
          />
        </label>
        <p ref={noResultsRef} className="m-0 mt-2 hidden text-[13px] text-ink3">{c.configSearchEmpty}</p>
      </div>

      <div data-cfg-section>
        <div className="mt-2 w-full">
          <h2 className="mb-1 mt-0 text-base font-bold">{c.accountsTitle}</h2>
          <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.accountsLead}</p>
        </div>

        <div className={`${cfgGrid} mt-3`}>
          <ProviderCard
            title="Claude"
            blurb={c.claudeBlurb}
            providerId="claude"
            p={cfg.providers.claude}
            pasteKey="claude_paste"
            hiddenKey="claude_hidden"
            labelKey="claude_local_label"
            placeholder={c.tokenPh}
            usesLocalApp
            {...common}
          />
          <ProviderCard
            title="GPT"
            blurb={c.gptBlurb}
            providerId="gpt"
            p={cfg.providers.gpt}
            pasteKey="gpt_paste"
            hiddenKey="gpt_hidden"
            labelKey="gpt_local_label"
            placeholder={c.gptTokenPh}
            usesLocalApp
            {...common}
          />
          <ProviderCard
            title="Cursor"
            blurb={c.cursorBlurb}
            providerId="cursor"
            p={cfg.providers.cursor}
            pasteKey="cursor_paste"
            hiddenKey="cursor_hidden"
            labelKey="cursor_local_label"
            placeholder={c.cursorTokenPh}
            usesLocalApp
            {...common}
          >
            <Fold summary={c.cursorAdvanced}>
              <p className={cfgHint}>{c.cursorHint}</p>
              <pre className="mb-0 mt-2 overflow-x-auto rounded-[10px] bg-canvas px-3 py-2.5 text-[11.5px] leading-[1.45] text-ink2">{CURSOR_CMD}</pre>
            </Fold>
          </ProviderCard>
          <ProviderCard
            title="OpenRouter"
            blurb={c.openrouterBlurb}
            providerId="openrouter"
            p={cfg.providers.openrouter}
            pasteKey="openrouter_paste"
            hiddenKey="openrouter_hidden"
            labelKey="openrouter_primary_label"
            placeholder={c.orTokenPh}
            usesLocalApp={false}
            {...common}
          />
          <ProviderCard
            title="DeepSeek"
            blurb={c.deepseekBlurb}
            providerId="deepseek"
            p={cfg.providers.deepseek}
            pasteKey="deepseek_paste"
            hiddenKey="deepseek_hidden"
            labelKey="deepseek_primary_label"
            placeholder={c.dsKeyPh}
            usesLocalApp={false}
            {...common}
          />
          <ProviderCard
            title="OpenCode"
            blurb={c.opencodeBlurb}
            providerId="opencode"
            p={cfg.providers.opencode}
            pasteKey="opencode_paste"
            hiddenKey="opencode_hidden"
            labelKey="opencode_primary_label"
            placeholder={c.ocKeyPh}
            usesLocalApp
            {...common}
          />
          <ProviderCard
            title="fal.ai"
            blurb={c.falBlurb}
            providerId="fal"
            p={cfg.providers.fal}
            pasteKey="fal_paste"
            hiddenKey="fal_hidden"
            labelKey="fal_primary_label"
            placeholder={c.falKeyPh}
            usesLocalApp={false}
            {...common}
          />
        </div>
      </div>

      <div data-cfg-section>
        <div className="mt-2 w-full">
          <h2 className="mb-1 mt-0 text-base font-bold">{c.financeiroTitle}</h2>
          <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.financeiroLead}</p>
        </div>
        <div className={`${cfgGrid} mt-3`}>
          <ProviderCard
            title="Bitcoin"
            blurb={c.bitcoinBlurb}
            providerId="bitcoin"
            p={cfg.providers.bitcoin}
            pasteKey="bitcoin_paste"
            hiddenKey="bitcoin_hidden"
            labelKey="bitcoin_primary_label"
            placeholder={c.bitcoinAddressPh}
            usesLocalApp={false}
            {...common}
          />
          <AdSenseConfigCard p={cfg.providers.adsense} listenPort={cfg.listen.port} {...common} />
          <CurrenciesConfigCard currencies={cfg.currencies} c={c} onReload={reload} />
        </div>
      </div>

      <div data-cfg-section>
        <div className="mt-2 w-full">
          <h2 className="mb-1 mt-0 text-base font-bold">{c.outrosTitle}</h2>
          <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.outrosLead}</p>
        </div>
        <div className={`${cfgGrid} mt-3`}>
          <WeatherConfigCard weather={cfg.weather} c={c} onReload={reload} />
          <GitConfigCard git={cfg.git} c={c} onReload={reload} />
          <RetroAchievementsConfigCard c={c} onReload={reload} provider={cfg.providers.retroachievements as unknown as { configured: boolean; hidden: boolean; label: string; suffix: string | null; mode: string; accounts: Array<{ id: string; label: string; suffix: string | null }> }} />
          <CalendarConfigCard calendar={cfg.calendar} c={c} onReload={reload} />
          <RssConfigCard rss={cfg.rss} c={c} onReload={reload} />
          <GithubConfigCard github={cfg.github} c={c} onReload={reload} />
          <GithubProfilesConfigCard github={cfg.github} c={c} onReload={reload} />
          <CameraConfigCard c={c} />
          <AndroidConfigCard c={c} />
          <SpotifyConfigCard p={cfg.providers.spotify} listenPort={cfg.listen.port} {...common} />
          <YoutubeMusicConfigCard p={(cfg.providers as Record<string, unknown>).youtubemusic as ProviderCardPublic ?? { source: "missing", label: "", configured: false, suffix: null, mode: "need_paste", hidden: false, local_label: "", primary_label: "", accounts: [] } as unknown as ProviderCardPublic} listenPort={cfg.listen.port} {...common} />
        </div>
      </div>

      <div data-cfg-section>
        <div className="mt-2 w-full">
          <h2 className="mb-1 mt-0 text-base font-bold">Emulador</h2>
          <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">EmulatorJS via CDN — cada plataforma habilitada vira um card com seletor de jogos, reset e tela cheia. Saves sincronizados no servidor (entre dispositivos).</p>
        </div>
        <div className={`${cfgGrid} mt-3`}>
          <EmulatorConfigCard c={c} onReload={reload} />
        </div>
      </div>

      <div data-cfg-section>
        <div className="mt-2 w-full">
          <h2 className="mb-1 mt-0 text-base font-bold">{c.wallpaperProvidersTitle}</h2>
          <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.wallpaperProvidersLead}</p>
        </div>
        <div id="cfg-wallpapers" className={`${cfgGrid} mt-3`}>
          <WallpaperProviderCards c={c} />
        </div>
      </div>

      {/* Só existe dentro do app Electron; no navegador não renderiza nada. */}
      {isDesktop() ? (
        <div className={`${cfgGrid} mt-2`}>
          <DesktopCard c={c} />
        </div>
      ) : null}
    </div>
  );
}
