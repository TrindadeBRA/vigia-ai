import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { addAccount, clearSecret, deleteAccount, fetchConfig, fetchUsage, patchConfig } from "../api/client";
import type { ConfigPublic, ProviderCardPublic, UsagePayload } from "../api/types";

const MASK = "•".repeat(24);
const CURSOR_CMD = `(db="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
[ -f "$db" ] || { echo "Erro: Cursor não parece instalado neste Mac."; exit 1; }
tmp=$(mktemp) && cp "$db" "$tmp" || { echo "Erro: não consegui copiar o banco (permissão?)."; exit 1; }
val=$(sqlite3 "$tmp" "SELECT value FROM ItemTable WHERE key='cursorAuth/accessToken'" 2>&1)
rm -f "$tmp"
[ -n "$val" ] && echo "$val" || echo "Vazio — a conta não guarda sessão nessa tabela, refaça sign-out/sign-in no Cursor.")`;

function Dot({ state }: { state: "ok" | "warn" | "missing" }) {
  const cls = state === "ok" ? "bg-good" : state === "warn" ? "bg-warn" : "bg-bad";
  return <span className={`h-2 w-2 rounded-full ${cls}`} />;
}

function badge(p: ProviderCardPublic): { state: "ok" | "warn" | "missing"; text: string } {
  if (p.configured) return { state: "ok", text: "Conectado" };
  if (p.source === "expired") return { state: "warn", text: "Expirado" };
  return { state: "missing", text: "Falta configurar" };
}

function ExtraList({
  provider,
  accounts,
  onRemoved,
}: {
  provider: string;
  accounts: { id: string; label: string; suffix: string | null }[];
  onRemoved: () => void;
}) {
  if (!accounts.length) return <p className="text-xs text-ink3">Nenhuma conta extra.</p>;
  return (
    <div className="space-y-2">
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{a.label || "(sem apelido)"}</p>
            <p className="text-xs text-ink3">•••• {a.suffix || "----"}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-edge px-2 py-1 text-xs hover:bg-surface"
            onClick={async () => {
              await deleteAccount(provider, a.id);
              onRemoved();
            }}
          >
            Remover
          </button>
        </div>
      ))}
    </div>
  );
}

function ProviderBlock({
  title,
  blurb,
  p,
  pasteKey,
  hiddenKey,
  labelKey,
  noun,
  placeholder,
  onBoardContinues,
  extraProvider,
  children,
  reload,
}: {
  title: string;
  blurb: string;
  p: ProviderCardPublic;
  pasteKey: string;
  hiddenKey: string;
  labelKey: string;
  noun: "token" | "key";
  placeholder: string;
  onBoardContinues: string;
  extraProvider: string;
  children?: ReactNode;
  reload: () => Promise<void>;
}) {
  const b = badge(p);
  const hasPaste = p.mode === "paste";
  const editable = p.mode !== "local";
  const [secret, setSecret] = useState(hasPaste ? MASK : "");
  const [label, setLabel] = useState(p.local_label || p.primary_label || "");
  const [msg, setMsg] = useState("");
  const [labelMsg, setLabelMsg] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [accMsg, setAccMsg] = useState("");

  useEffect(() => {
    setSecret(hasPaste ? MASK : "");
    setLabel(p.local_label || p.primary_label || "");
  }, [hasPaste, p.local_label, p.primary_label]);

  return (
    <article className="rounded-2xl border border-edge bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dot state={b.state} />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <span className={`text-xs font-medium ${b.state === "ok" ? "text-good" : b.state === "warn" ? "text-warn" : "text-bad"}`}>{b.text}</span>
      </div>
      <p className="mt-1 text-xs text-ink3">{blurb}</p>
      <p className="mt-1 text-xs text-ink3">{p.label}</p>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink2">
        <input
          type="checkbox"
          className="rounded border-edge accent-accent"
          checked={!p.hidden}
          onChange={async (e) => {
            const hidden = !e.target.checked;
            const out = await patchConfig({ [hiddenKey]: hidden });
            setMsg(out.ok ? (hidden ? `Oculto na placa. ${onBoardContinues}` : "Voltou a aparecer na placa.") : out.error || "Falha");
            await reload();
          }}
        />
        Mostrar na placa
      </label>
      <label className="mt-2 block text-xs text-ink3">Apelido (opcional)</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input className="min-w-0 flex-1 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex.: Assinatura Pessoal" />
        <button
          type="button"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent/90"
          onClick={async () => {
            const out = await patchConfig({ [labelKey]: label });
            setLabelMsg(out.ok ? "Apelido salvo." : out.error || "Falha");
            await reload();
          }}
        >
          Salvar
        </button>
      </div>
      <p className="mt-1 min-h-[1.25rem] text-xs text-ink3">{labelMsg}</p>
      {children}
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="password"
          autoComplete="off"
          disabled={!editable}
          placeholder={editable ? placeholder : "gerenciado pelo app local"}
          className="min-w-0 flex-1 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={secret}
          onFocus={() => {
            if (secret === MASK) setSecret("");
          }}
          onChange={(e) => setSecret(e.target.value)}
        />
        <button
          type="button"
          disabled={!editable}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          onClick={async () => {
            const v = secret.trim();
            if (!v || v === MASK) return;
            const out = await patchConfig({ [pasteKey]: v });
            setSecret("");
            setMsg(out.ok ? (noun === "token" ? "Token salvo." : "Key salva.") : out.error || "Falha");
            await reload();
          }}
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={!hasPaste}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"
          onClick={async () => {
            const out = await clearSecret(pasteKey);
            setMsg(out.ok ? (noun === "token" ? "Token apagado." : "Key apagada.") : out.error || "Falha");
            await reload();
          }}
        >
          Apagar {noun}
        </button>
      </div>
      <p className="mt-2 min-h-[1.25rem] text-xs text-ink3">{msg}</p>
      <div className="mt-4 border-t border-edge pt-3">
        <p className="text-xs font-medium text-ink2">Contas adicionais</p>
        <div className="mt-2">
          <ExtraList provider={extraProvider} accounts={p.accounts} onRemoved={() => void reload()} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="min-w-0 flex-1 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm" placeholder="Apelido" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <input type="password" className="min-w-0 flex-1 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm" placeholder={placeholder} value={newSecret} onChange={(e) => setNewSecret(e.target.value)} />
          <button
            type="button"
            className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface"
            onClick={async () => {
              if (!newSecret.trim()) {
                setAccMsg("Cole o token/key antes de adicionar.");
                return;
              }
              const out = await addAccount(extraProvider, newLabel, newSecret);
              setAccMsg(out.ok ? "Conta adicionada." : out.error || "Falha");
              if (out.ok) {
                setNewLabel("");
                setNewSecret("");
              }
              await reload();
            }}
          >
            + Adicionar conta
          </button>
        </div>
        <p className="mt-1 min-h-[1.25rem] text-xs text-ink3">{accMsg}</p>
      </div>
    </article>
  );
}

export default function Panel() {
  const [cfg, setCfg] = useState<ConfigPublic | null>(null);
  const [err, setErr] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [host, setHost] = useState("0.0.0.0");
  const [port, setPort] = useState("8787");
  const [mock, setMock] = useState(false);
  const [serverMsg, setServerMsg] = useState("");
  const [test, setTest] = useState<UsagePayload | null>(null);
  const [testing, setTesting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await fetchConfig();
      setCfg(d);
      setHost(d.listen.host);
      setPort(String(d.listen.port));
      setMock(d.mock);
      setErr("");
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!cfg) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-ink">
        <p className="text-ink2">{err || "Carregando…"}</p>
      </main>
    );
  }

  const downloadSecrets = () => {
    const blob = new Blob([cfg.urls.secrets_h_file], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "secrets.h";
    a.click();
    URL.revokeObjectURL(url);
    setCopyMsg("Baixado — mova para firmware/src/secrets.h e preencha o Wi-Fi.");
  };

  const saveServer = async (e: FormEvent) => {
    e.preventDefault();
    const out = await patchConfig({ host, port: Number(port), mock });
    setServerMsg(out.ok ? (out.restart_needed_for_port ? "Salvo. Reinicie o coletor para aplicar a porta." : "Salvo.") : out.error || "Falha");
    await reload();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 pb-20 sm:px-6">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Vigia AI</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Painel do coletor</h1>
          </div>
          <a href="/display" className="mt-1 shrink-0 rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-ink2 hover:border-accent hover:text-accent">
            Abrir mostrador web ↗
          </a>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink2">
          Roda neste computador e publica as cotas na sua rede local. A placa ESP32 só lê o JSON — nunca vê tokens.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-edge bg-panel p-5">
        <h2 className="text-base font-semibold">Arquivo para a placa</h2>
        <p className="mt-1 text-sm text-ink2">
          Baixe o <code className="text-ink2">secrets.h</code> e mova para <code className="text-ink2">firmware/src/</code>.
        </p>
        <button type="button" onClick={downloadSecrets} className="mt-4 w-full rounded-lg bg-accent px-3 py-3 text-sm font-semibold text-white hover:bg-accent/90">
          Baixar secrets.h
        </button>
        {!cfg.urls.board_ok ? <p className="mt-2 text-xs text-warn">Nenhum IP de Wi-Fi encontrado — confira a rede antes de gravar a placa.</p> : null}
        <p className="mt-2 text-xs text-accent">{cfg.urls.usage_lan}</p>
        <p className="mt-2 min-h-[1.25rem] text-xs text-good">{copyMsg}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Contas</h2>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <ProviderBlock
            title="Claude"
            blurb="Cota da assinatura (sessão de 5h e semana) — a mesma do Claude Code, não a key sk-ant-…"
            p={cfg.providers.claude}
            pasteKey="claude_paste"
            hiddenKey="claude_hidden"
            labelKey="claude_local_label"
            noun="token"
            placeholder="Token OAuth"
            onBoardContinues="O login local continua."
            extraProvider="claude"
            reload={reload}
          />
          <ProviderBlock
            title="GPT"
            blurb="Cota da assinatura ChatGPT / Codex (sessão e semana) — o mesmo login do `codex login`, não a key sk-…"
            p={cfg.providers.gpt}
            pasteKey="gpt_paste"
            hiddenKey="gpt_hidden"
            labelKey="gpt_local_label"
            noun="token"
            placeholder="Token OAuth do Codex"
            onBoardContinues="O login local continua."
            extraProvider="gpt"
            reload={reload}
          />
          <ProviderBlock
            title="Cursor"
            blurb="% do plano. Sem API key oficial — lê o login salvo pelo app."
            p={cfg.providers.cursor}
            pasteKey="cursor_paste"
            hiddenKey="cursor_hidden"
            labelKey="cursor_local_label"
            noun="token"
            placeholder="Token de sessão"
            onBoardContinues="O login local continua."
            extraProvider="cursor"
            reload={reload}
          >
            <p className="mt-2 text-xs text-ink3">Se o JWT local faltar: Settings → Account → sair e entrar de novo. Ou rode no Terminal e cole o resultado:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas px-3 py-2 text-xs text-ink2">{CURSOR_CMD}</pre>
          </ProviderBlock>
          <ProviderBlock
            title="OpenRouter"
            blurb="Créditos da conta. Crie a key em openrouter.ai/settings/keys."
            p={cfg.providers.openrouter}
            pasteKey="openrouter_paste"
            hiddenKey="openrouter_hidden"
            labelKey="openrouter_primary_label"
            noun="key"
            placeholder="sk-or-…"
            onBoardContinues="A key continua salva."
            extraProvider="openrouter"
            reload={reload}
          />
          <ProviderBlock
            title="DeepSeek"
            blurb="Saldo da conta. Crie a key em platform.deepseek.com/api_keys."
            p={cfg.providers.deepseek}
            pasteKey="deepseek_paste"
            hiddenKey="deepseek_hidden"
            labelKey="deepseek_primary_label"
            noun="key"
            placeholder="sk-…"
            onBoardContinues="A key continua salva."
            extraProvider="deepseek"
            reload={reload}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-edge bg-panel p-5">
        <h2 className="text-base font-semibold">Testar agora</h2>
        <p className="mt-1 text-sm text-ink2">Busca as cotas uma vez, sem esperar o próximo ciclo da placa.</p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          onClick={async () => {
            setTesting(true);
            try {
              setTest(await fetchUsage());
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? "Consultando…" : "Buscar cotas agora"}
        </button>
        {test ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["claude", "gpt", "cursor", "openrouter", "deepseek"] as const).map((name) => {
              const list = test[name] || [];
              const title =
                name === "openrouter" ? "OpenRouter" : name === "gpt" ? "GPT" : name === "deepseek" ? "DeepSeek" : name[0].toUpperCase() + name.slice(1);
              if (!list.length) {
                return (
                  <div key={name} className="rounded-xl border border-edge bg-surface/40 p-3">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs text-ink3">não listado na placa</p>
                  </div>
                );
              }
              return list.map((b) => (
                <div key={`${name}-${b.id}`} className={`rounded-xl border p-3 ${b.ok ? "border-good/30 bg-good/10" : "border-bad/30 bg-bad/10"}`}>
                  <p className="text-sm font-medium">{b.label ? `${title} · ${b.label}` : title}</p>
                  <p className={`mt-1 text-xs ${b.ok ? "text-good" : "text-bad"}`}>
                    {b.ok
                      ? name === "claude" || name === "gpt"
                        ? `sessão ${(b as { session_percent?: number }).session_percent ?? "—"}%`
                        : `${(b as { percent?: number }).percent ?? "—"}%`
                      : b.error || "falhou"}
                  </p>
                </div>
              ));
            })}
          </div>
        ) : null}
      </section>

      <form onSubmit={saveServer} className="mt-6 rounded-2xl border border-edge bg-panel/50 p-5">
        <h3 className="text-sm font-semibold">Servidor</h3>
        <p className="mt-1 text-xs text-ink3">HOST 0.0.0.0 deixa a ESP32 alcançar este computador. Mudar a porta exige reiniciar.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink3">
            Porta
            <input className="mt-1 w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} />
          </label>
          <label className="text-xs text-ink3">
            Bind HOST
            <input className="mt-1 w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink" value={host} onChange={(e) => setHost(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink2">
          <input type="checkbox" className="rounded border-edge accent-accent" checked={mock} onChange={(e) => setMock(e.target.checked)} />
          Modo mock — dados de exemplo, sem chamar as APIs
        </label>
        <button type="submit" className="mt-3 rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface">
          Salvar
        </button>
        <p className="mt-2 min-h-[1.25rem] text-xs text-ink3">{serverMsg}</p>
        <p className="mt-3 text-xs text-ink3">
          Docker: <code className="text-ink2">./dev up --docker</code> na raiz. Swagger: <a className="text-accent underline" href="/docs">/docs</a>.
        </p>
      </form>
    </main>
  );
}
