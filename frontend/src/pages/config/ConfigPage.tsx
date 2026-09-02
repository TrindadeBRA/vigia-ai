import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton";
import { accentLink, cfgGrid, cfgHint, cfgStatus, pageCol, viewFade } from "../../tw";
import { AdSenseConfigCard } from "./AdSenseConfigCard";
import { CurrenciesConfigCard } from "./CurrenciesConfigCard";
import { ProviderCard } from "./ProviderCard";
import { Button, Fold } from "./ui";
import { usePublicConfig } from "./usePublicConfig";
import { WeatherConfigCard } from "./WeatherConfigCard";

export type { ConfigOutlet } from "./usePublicConfig";

const CURSOR_CMD = `(db="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
[ -f "$db" ] || { echo "Erro: Cursor não parece instalado neste Mac."; exit 1; }
tmp=$(mktemp) && cp "$db" "$tmp" || { echo "Erro: não consegui copiar o banco (permissão?)."; exit 1; }
val=$(sqlite3 "$tmp" "SELECT value FROM ItemTable WHERE key='cursorAuth/accessToken'" 2>&1)
rm -f "$tmp"
[ -n "$val" ] && echo "$val" || echo "Vazio — a conta não guarda sessão nessa tabela, refaça sign-out/sign-in no Cursor.")`;

export default function ConfigPage() {
  const { c, cfg, phase, reload, setPhase } = usePublicConfig();

  if (phase === "loading" && !cfg) {
    return <Skeleton page="config" />;
  }

  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
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
    <div className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">
          {c.configSetupHint}{" "}
          <Link to="/display/setup" className={accentLink}>{c.toolsTitle}</Link>
        </p>
      </header>

      <div className="mt-2 w-full">
        <h2 className="mb-1 mt-0 text-base font-bold">{c.accountsTitle}</h2>
        <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.accountsLead}</p>
      </div>

      <div className={cfgGrid}>
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
          usesLocalApp={false}
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

      <div className="mt-2 w-full">
        <h2 className="mb-1 mt-0 text-base font-bold">{c.financeiroTitle}</h2>
        <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.financeiroLead}</p>
      </div>
      <div className={cfgGrid}>
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

      <div className="mt-2 w-full">
        <h2 className="mb-1 mt-0 text-base font-bold">{c.outrosTitle}</h2>
        <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.outrosLead}</p>
      </div>
      <div className={cfgGrid}>
        <WeatherConfigCard weather={cfg.weather} c={c} onReload={reload} />
      </div>
    </div>
  );
}
