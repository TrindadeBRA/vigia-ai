import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchConfig } from "../../api/client";
import type { ConfigPublic } from "../../api/types";
import type { Lang } from "../../i18n";
import { BoardCard } from "./BoardCard";
import { CONFIG_STR } from "./copy";
import { NetworkCard } from "./NetworkCard";
import { ProviderCard } from "./ProviderCard";
import { Button, Fold, Skeleton } from "./ui";
import { UsageCheck } from "./UsageCheck";

export type ConfigOutlet = { lang: Lang };

const CURSOR_CMD = `(db="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
[ -f "$db" ] || { echo "Erro: Cursor não parece instalado neste Mac."; exit 1; }
tmp=$(mktemp) && cp "$db" "$tmp" || { echo "Erro: não consegui copiar o banco (permissão?)."; exit 1; }
val=$(sqlite3 "$tmp" "SELECT value FROM ItemTable WHERE key='cursorAuth/accessToken'" 2>&1)
rm -f "$tmp"
[ -n "$val" ] && echo "$val" || echo "Vazio — a conta não guarda sessão nessa tabela, refaça sign-out/sign-in no Cursor.")`;

export default function ConfigPage() {
  const ctx = useOutletContext<ConfigOutlet | null>();
  const c = CONFIG_STR[ctx?.lang || "pt"];
  const [cfg, setCfg] = useState<ConfigPublic | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(async () => {
    try {
      const d = await fetchConfig();
      setCfg(d);
      setPhase("ready");
    } catch {
      setPhase((p) => (p === "ready" ? "ready" : "error"));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (phase === "loading" && !cfg) {
    return (
      <div className="cfg-page view-fade">
        <header className="cfg-head">
          <h1>{c.title}</h1>
        </header>
        <Skeleton />
      </div>
    );
  }

  if (phase === "error" && !cfg) {
    return (
      <div className="cfg-page view-fade">
        <header className="cfg-head">
          <h1>{c.title}</h1>
          <p className="cfg-lead">{c.loadError}</p>
        </header>
        <p className="cfg-status err">{c.offline}</p>
        <Button onClick={() => { setPhase("loading"); void reload(); }}>{c.retry}</Button>
      </div>
    );
  }

  if (!cfg) return null;

  const common = { inDocker: cfg.in_docker, c, onReload: reload };

  return (
    <div className="cfg-page view-fade">
      <header className="cfg-head">
        <h1>{c.title}</h1>
        <p className="cfg-lead">{c.lead}</p>
      </header>

      <div className="cfg-section-head">
        <h2>{c.accountsTitle}</h2>
        <p>{c.accountsLead}</p>
      </div>

      <div className="cfg-grid">
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
            <p className="cfg-hint">{c.cursorHint}</p>
            <pre className="cfg-pre">{CURSOR_CMD}</pre>
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
      </div>

      <div className="cfg-section-head">
        <h2>{c.toolsTitle}</h2>
        <p>{c.toolsLead}</p>
      </div>

      <BoardCard cfg={cfg} c={c} />

      <div className="cfg-grid">
        <UsageCheck c={c} />
        <NetworkCard cfg={cfg} c={c} onReload={reload} />
      </div>
    </div>
  );
}
