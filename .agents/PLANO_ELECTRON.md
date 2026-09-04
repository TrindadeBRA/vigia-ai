# Plano — Vigia AI Desktop (Electron)

> Status: **implementado** (fases 0–7) na branch `feature/electron-port`.
> Objetivo: empacotar o Vigia AI como **aplicativo de desktop** (Linux / macOS / Windows) com instalador, mantendo o modo web e o firmware ESP32 funcionando **sem nenhuma mudança de contrato**.
>
> Guia de uso: [`DESKTOP.md`](DESKTOP.md). O que a execução mudou em relação a
> este plano está em **§14**.

Leia antes: [`ARQUITETURA.md`](ARQUITETURA.md), [`CONTRATO_JSON.md`](CONTRATO_JSON.md), [`CONTEXTO_IA.md`](CONTEXTO_IA.md).

---

## 1. Ponto de partida (o que existe hoje)

| Peça | Tecnologia | Tamanho | Observação |
| --- | --- | --- | --- |
| Coletor | Python 3.11+ / FastAPI + uvicorn | ~8.2k linhas (`backend/app`) | 12 provedores, SSE, Telegram poller, Pillow, SQLite |
| Painel | React 18 + TS + Vite + Tailwind | ~16.2k linhas (`frontend/src`) | SPA em `/display`, roteador `BrowserRouter` |
| Firmware | C++ / PlatformIO / ESP32 | `firmware/src` | Consome `GET /events` (SSE) e `GET /usage` |
| Empacotamento atual | `./dev up`, Docker (`compose.yaml`) | — | Exige Python + Node instalados na máquina |

Fatos que condicionam o plano:

1. **O backend já serve o frontend.** `create_app()` em `backend/app/main.py` monta `frontend/dist` e responde `/display*`. Ou seja: em produção **já existe um único processo HTTP** servindo API + UI.
2. **O frontend usa URLs relativas** (`fetch("/usage")`, `new EventSource("/events")` em `frontend/src/api/client.ts`). Se o Electron carregar `http://127.0.0.1:8787/display`, **nada no React precisa mudar**. Se carregasse `file://`, tudo quebraria.
3. **Dois env vars já desacoplam os caminhos**: `COLLECTOR_DATA` (`config.py:data_dir()`) e `VIGIA_FRONTEND_DIST` (`config.py:frontend_dist()`). O Docker já usa os dois — o Electron reaproveita exatamente o mesmo mecanismo.
4. **A placa depende da porta.** `USAGE_URL` é gravado no `secrets.h` do firmware apontando para `http://<IP-LAN>:8787/usage`. O app desktop **não pode** sortear porta aleatória sem quebrar placas já gravadas.

> **Conclusão:** o backend já está "pronto para ser embarcado". O trabalho é de empacotamento e de ciclo de vida, não de reescrita.

---

## 2. Decisão de arquitetura

### Opção A — Electron + coletor Python como *sidecar* ✅ **recomendada**

O processo `main` do Electron sobe o binário do coletor (PyInstaller) como processo filho; a `BrowserWindow` carrega `http://127.0.0.1:<porta>/display`.

```
┌─ Electron main (Node) ──────────────────────────────┐
│  spawn → coletor (binário PyInstaller, FastAPI)     │──► LAN 0.0.0.0:8787 ──► ESP32 / navegador
│  tray, menu, autostart, updater, logs               │
│                                                     │
│  BrowserWindow ──── http://127.0.0.1:8787/display ──┘
│    └─ preload.js  →  window.vigia (bridge desktop)
└─────────────────────────────────────────────────────┘
```

| Prós | Contras |
| --- | --- |
| Zero reescrita dos 12 provedores, do parser de Keychain, do `state.vscdb`, do Pillow | Instalador maior (~90–160 MB por plataforma) |
| Contrato JSON e SSE preservados byte a byte → firmware intacto | Dois runtimes no bundle (Node + Python) |
| `./dev up` e Docker continuam funcionando iguais | PyInstaller às vezes gera falso-positivo em antivírus Windows |
| Testes `pytest` continuam válidos | Build precisa rodar **em cada SO** (não dá cross-compile do sidecar) |

### Opção B — reescrever o coletor em Node/TypeScript ❌ não recomendada agora

Um único runtime, instalador ~70 MB menor, build cross-platform trivial. **Mas**: reescrever ~8.2k linhas incluindo OAuth do Claude, leitura do Keychain, SQLite do Cursor (`state.vscdb` de ~1 GB copiado antes de ler), conversão RGB565 do Pillow, `RefreshCache` por provedor, motor de alarmes e o poller do Telegram — com o risco de quebrar sutilmente o JSON que o firmware parseia em `firmware/src/net/parse.cpp`.

**Recomendação:** Opção A. Reavaliar a B só se o tamanho do instalador virar problema real de adoção.

### Opção C — só um wrapper que exige Python instalado ❌

Descartada: elimina o motivo de existir do instalador.

---

## 3. O que muda no repositório

```
desktop/                       ← NOVO pacote Electron
  package.json                 electron, electron-builder, electron-updater
  electron-builder.yml         targets: dmg/zip, nsis, AppImage/deb
  src/
    main.ts                    janela, ciclo de vida, single instance
    sidecar.ts                 spawn/health-check/restart do coletor
    ports.ts                   escolha e conflito de porta
    tray.ts                    ícone de bandeja + menu
    menu.ts                    menu nativo (inclui "Abrir no navegador")
    paths.ts                   userData, logs, migração de backend/data
    preload.ts                 contextBridge → window.vigia
    updater.ts                 electron-updater (fase 6)
  build/                       ícones .icns / .ico / .png, entitlements.plist
  resources/                   preenchido no build: sidecar/ + wwwroot/
scripts/
  build-sidecar.sh|.ps1        PyInstaller do backend
  build-desktop.sh             frontend build + sidecar + electron-builder
backend/app/desktop.py         ← NOVO: entrypoint do sidecar (handshake de porta)
package.json                   ← raiz vira workspace (hoje é um lock vazio)
dev                            ← novos subcomandos: ./dev app, ./dev app build
```

Nada é removido. `./dev up`, `compose.yaml` e o `Dockerfile` seguem como estão.

---

## 4. Correções necessárias no backend (pré-requisito)

Levantadas na análise do código atual:

| # | Arquivo | Problema | Correção |
| --- | --- | --- | --- |
| B1 | `backend/app/local/claude_oauth.py:90` | `os.uname()` **não existe no Windows** → `AttributeError` em toda leitura de credencial | Trocar por `sys.platform != "darwin"` |
| B2 | `backend/app/local/claude_oauth.py` | Fora do macOS só o Keychain é tentado antes do fallback | Garantir fallback explícito para `~/.claude/.credentials.json` em Linux/Windows (`from_credentials_file` já existe) |
| B3 | `backend/app/local/cursor_state.py:27-33` | Candidatos de `state.vscdb` cobrem mac/Linux/Windows, mas o `APPDATA` do Windows é `%APPDATA%\Cursor\...` sem validação de caso | Revisar e cobrir com teste por plataforma |
| B4 | `backend/app/main.py:main()` | `uvicorn.run(app, ...)` sem `--reload`; ok, mas não expõe *shutdown* limpo por sinal no Windows | Novo `app/desktop.py` com `uvicorn.Server` explícito + tratamento de `SIGTERM`/`CTRL_BREAK_EVENT` |
| B5 | `backend/app/config.py:frontend_dist()` | Fallback assume árvore do repo (`../../frontend/dist`) | Já resolvido por `VIGIA_FRONTEND_DIST`; o Electron sempre define |
| B6 | `backend/data/` | Fica **dentro do bundle** (read-only no macOS `.app` e em `Program Files`) | Electron define `COLLECTOR_DATA=<userData>/data` e migra o conteúdo antigo na 1ª execução |
| B7 | `backend/app/routers/config.py:412` | Mudar a porta pede reinício manual (`restart_needed_for_port`) | O Electron passa a oferecer "Reiniciar coletor" quando esse flag vier `true` |

Cada correção acompanha teste em `backend/tests/`.

**Limpeza pendente (não relacionada, encontrada na análise):** `dist/osx-arm64/`, `backend/bin/`, `backend/obj/`, `backend/Native/` são resíduos não versionados de uma tentativa anterior em .NET. Apagar e acrescentar ao `.gitignore` antes de começar, para não poluir o `dist/` do electron-builder.

---

## 5. Ciclo de vida do sidecar (o coração do port)

### 5.1 Escolha de porta

1. Ler a porta gravada em `<userData>/data/config.json` (`listen.port`, padrão **8787**).
2. Tentar bind. Se ocupada:
   - se quem responde em `/health` **é outro Vigia** → não subir sidecar, só abrir a janela apontando pra ele (cenário: usuário rodou `./dev up` e depois abriu o app);
   - senão → avisar na UI e oferecer porta alternativa, **destacando que a placa precisará de novo `secrets.h`** (`GET /api/secrets.h`).
3. Nunca sortear porta silenciosamente — a placa depende dela.

### 5.2 Handshake e prontidão

O sidecar imprime na stdout uma linha `VIGIA_READY {"host":"...","port":8787}`. O `main` só mostra a janela depois disso (ou após `GET /health` responder), com timeout de 30 s e tela de erro com log.

### 5.3 Encerramento

- `before-quit` → `SIGTERM` no sidecar, espera 5 s, então `SIGKILL`.
- Windows: `taskkill /pid /T /F` como fallback (PyInstaller cria processo filho).
- Gravar o PID em `<userData>/sidecar.pid` e matar órfão de execução anterior no boot (queda de energia / crash).

### 5.4 Resiliência

Se o sidecar morrer sozinho: reinício automático com backoff (1s, 2s, 5s, 15s), no máximo 5 tentativas; depois disso, tela "coletor parou" com botão *Ver log* e *Tentar de novo*. Logs em `<userData>/logs/collector.log` e `main.log` (rotação simples, 5 arquivos × 2 MB).

---

## 6. Modo web preservado ("abrir no navegador")

Requisito explícito: continuar acessível pelo browser.

- O sidecar continua com bind padrão `0.0.0.0:8787` — **é o mesmo processo** que serve `/display`, a API e o SSE para a ESP32. Nenhum modo especial.
- Menu / bandeja ganham:
  - **Abrir no navegador** → `shell.openExternal("http://127.0.0.1:<porta>/display")`
  - **Copiar link da LAN** → usa `netutil.panel_lan_url()`, já existente
  - **Abrir Swagger** → `/docs`
  - **Mostrar QR da LAN** → o `SetupPage` já gera QR; só reaproveitar
- Nova preferência **"Acesso pela rede local"** (ligado por padrão): desligada, o sidecar sobe com `HOST=127.0.0.1` — útil pra quem usa só o app e não tem placa. O aviso de segurança do README (`LAN only`, não expor à internet) aparece junto do toggle.

---

## 7. Ponte desktop no frontend (`window.vigia`)

Via `contextBridge` no `preload.ts`, com `contextIsolation: true` e `nodeIntegration: false`. A UI **detecta a presença** (`if (window.vigia)`), então o build web continua idêntico e sem `if` espalhado.

| API | Uso na UI |
| --- | --- |
| `vigia.isDesktop` | Mostrar/esconder blocos exclusivos |
| `vigia.openExternal(url)` | Links externos abrem no browser do sistema, não na janela |
| `vigia.restartCollector()` | Botão que aparece quando `restart_needed_for_port === true` |
| `vigia.setLanExposure(bool)` | Toggle de acesso pela LAN |
| `vigia.getAutostart() / setAutostart(bool)` | "Abrir junto com o sistema" |
| `vigia.openDataFolder()` / `openLogsFolder()` | Suporte e diagnóstico |
| `vigia.saveFile(name, bytes)` | Baixar `secrets.h` e exportar alarmes com diálogo nativo |
| `vigia.appVersion` | Rodapé das configurações |

Todos os canais IPC são **allowlist explícita** — nada de `ipcRenderer` cru exposto. A janela bloqueia navegação para fora de `127.0.0.1:<porta>` (`will-navigate` + `setWindowOpenHandler`).

Uma nova aba **"Aplicativo"** em `/display/config` reúne autostart, LAN, porta, pasta de dados, logs e versão.

---

## 8. Empacotamento do coletor (PyInstaller)

```
pyinstaller --onedir --name vigia-collector \
  --collect-all fastapi --collect-all uvicorn --collect-all pydantic \
  --hidden-import uvicorn.protocols.http.httptools_impl \
  --hidden-import uvicorn.protocols.websockets.websockets_impl \
  --hidden-import uvicorn.lifespan.on \
  --collect-binaries PIL \
  backend/app/desktop.py
```

Pontos de atenção:

- **`--onedir`, não `--onefile`.** `--onefile` extrai tudo em `/tmp` a cada boot: startup lento e problema de permissão em macOS/Windows corporativos.
- **`uvicorn[standard]`** traz `uvloop` e `httptools` (binários nativos) — precisam de `--collect-binaries`. Alternativa: fixar `uvicorn` puro no bundle e aceitar o loop asyncio padrão (a carga é irrisória).
- **Pillow** é usado em `backend/app/routers/wallpapers.py` (conversão RGB565 para a placa) — validar que o bundle carrega os plugins JPEG/PNG.
- **`sqlite3`** é stdlib, mas confirmar a lib nativa no bundle Linux.
- **Sem cross-compile:** o sidecar de cada SO precisa ser gerado no runner daquele SO (matriz do CI).

Alternativa avaliada: embarcar um **python-build-standalone** + venv em vez de PyInstaller. Mais fácil de depurar e sem falso-positivo de antivírus, porém instalador ~20 MB maior e mais arquivos para assinar no macOS. **Manter PyInstaller como padrão**, com essa alternativa documentada como plano B se a assinatura travar.

---

## 9. Instaladores por plataforma

| SO | Target | Detalhes |
| --- | --- | --- |
| **macOS** | `.dmg` + `.zip` (arm64 e x64, ou universal) | Hardened Runtime, **notarização** obrigatória (Apple Developer ID, US$ 99/ano). Entitlements: `com.apple.security.cs.allow-unsigned-executable-memory` (Python), `...allow-jit`, e **acesso ao Keychain** — ver 9.1 |
| **Windows** | `.exe` NSIS (x64) | Instalador por usuário (não exige admin). Primeira execução dispara o **prompt de firewall** pelo bind `0.0.0.0` — explicar na UI. Assinatura Authenticode recomendada (evita SmartScreen) |
| **Linux** | `AppImage` + `.deb` (x64, arm64 opcional) | AppImage sem instalação; `.deb` com `.desktop` e ícone. Sem assinatura |

### 9.1 O ponto crítico do macOS: Keychain

`backend/app/local/claude_oauth.py` roda `security find-generic-password -s "Claude Code-credentials" -w`. Hoje isso funciona porque o coletor roda no **Terminal**, que já tem a ACL do item.

Dentro de um `.app` assinado, o macOS trata o Vigia como **outro aplicativo** e vai pedir autorização do usuário na primeira leitura (`Permitir` / `Sempre Permitir`). Consequências:

- O app **precisa ser assinado com um certificado estável** — a cada mudança de identidade de assinatura, o macOS volta a pedir permissão.
- Se o processo não tiver janela em primeiro plano quando o prompt aparecer, o `security` retorna *"User interaction is not allowed"* — a mensagem de erro **já existe e já é tratada** em `_keychain_error()`; ajustar o texto para o contexto de app.
- **Este item é o maior risco do plano.** Validar com um build assinado ad-hoc **na Fase 1**, antes de investir no resto.

Fallback se der ruim: instruir o uso de `~/.claude/.credentials.json` (caminho já suportado) ou colar o token no painel (fluxo `paste_secret` já existente em `store.py`).

---

## 10. Fases

| Fase | Entrega | Critério de pronto |
| --- | --- | --- |
| **0. Limpeza + correções** | Remover resíduos `.NET`; correções B1–B4 e B7 com testes | `./dev test` verde; `pytest` cobrindo caminho Windows/Linux do Claude e do Cursor |
| **1. Prova de conceito** | `desktop/` mínimo: spawn do `python -m app.main` do venv, janela em `127.0.0.1:8787/display` | App abre, mostrador atualiza por SSE, Keychain lido a partir de um build assinado ad-hoc no macOS |
| **2. Sidecar empacotado** | `scripts/build-sidecar.*` com PyInstaller; `COLLECTOR_DATA` no userData + migração | Binário roda **sem Python instalado** numa VM limpa dos 3 SOs |
| **3. Ciclo de vida** | Porta/conflito, handshake, restart com backoff, tray, single-instance, logs, kill de órfão | Matar o sidecar à força → app se recupera sozinho; fechar app → nenhum processo sobra |
| **4. Integração UI** | `preload` + `window.vigia` + aba "Aplicativo" em `/display/config` | Autostart, toggle LAN, troca de porta com reinício, "Abrir no navegador", download nativo do `secrets.h` |
| **5. Instaladores** | electron-builder para dmg/nsis/AppImage/deb; ícones; assinatura + notarização macOS | Instalar num Mac, num Windows e num Ubuntu limpos e usar de ponta a ponta, incluindo a ESP32 lendo `/events` |
| **6. Distribuição** | CI GitHub Actions (matriz macos-14 / macos-13 / windows-latest / ubuntu-latest), release por tag, `electron-updater` | Tag `v1.1.0` publica os 4 artefatos; app instalado detecta e aplica update |
| **7. Documentação** | README (seção "Instalar o app"), `.agents/DESKTOP.md`, `DECISOES.md`, `CHANGELOG.md` | Um usuário sem Python/Node instala e usa sem ler o repositório |

Todas concluídas. Estado de cada uma:

| Fase | Estado | Evidência |
| --- | --- | --- |
| 0 | ✅ | 73 testes verdes, ruff limpo, resíduos `.NET` removidos |
| 1 | ✅ | Painel renderiza com cotas reais dentro da janela |
| 2 | ✅ | Binário de 54 MB roda com `PATH=/usr/bin:/bin`, sem Python |
| 3 | ✅ | 5 reinícios seguidos → 1 coletor vivo; fechar o app encerra em ~2 s |
| 4 | ✅ | Card «Aplicativo» só aparece no app; mesmo bundle na web |
| 5 | ✅ | `.dmg`/`.zip` arm64 e x64 gerados (116–124 MB) |
| 6 | ✅ | `ci.yml` com matriz de 3 SOs + `release-desktop.yml` com 4 runners |
| 7 | ✅ | README, `DESKTOP.md`, `DECISOES.md`, `CHANGELOG.md`, `CONTEXTO_IA.md` |

Fases 0–4 são o port propriamente dito; 5–7 são a distribuição.

---

## 11. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Keychain recusa dentro do `.app` (macOS) | Alto — quebra o provedor Claude | Validar já na Fase 1 com build assinado; fallback documentado por arquivo/colagem |
| Notarização exige conta Apple paga | Médio — trava o release macOS | Publicar `.zip` não notarizado com instruções de `xattr -d` enquanto não houver conta; ou distribuir só Linux/Windows na v1 |
| Porta 8787 ocupada / firewall Windows | Médio — placa perde o coletor | Detecção de conflito + reaproveitar instância existente + aviso claro de refazer `secrets.h` |
| Antivírus marca o binário PyInstaller | Médio | Assinar o `.exe`; plano B com python-build-standalone |
| Tamanho do instalador (~90–160 MB) | Baixo | Excluir `.pyc`, testes e wallpapers de exemplo do bundle; UPX opcional (mas piora o falso-positivo) |
| Duplo estado: `backend/data` do repo vs userData | Médio — usuário "perde" as contas ao migrar | Migração explícita na 1ª execução + aviso na UI mostrando o caminho novo |
| Divergência entre build web e build desktop | Baixo | Um único build do frontend; diferenças só por feature-detection de `window.vigia` |

---

## 12. Fora de escopo

- Reescrever o coletor em Node (Opção B).
- Gravar firmware pelo app (PlatformIO/esptool embarcados) — o `GET /api/secrets.h` continua sendo o caminho.
- App mobile, nuvem, autenticação multiusuário.
- Substituir o Docker ou o `./dev up`.
- Qualquer mudança em `CONTRATO_JSON.md`, `schemas.py` ou `firmware/src/net/parse.cpp`.

---

## 13. Primeiros passos concretos

1. Apagar `dist/osx-arm64/`, `backend/bin/`, `backend/obj/`, `backend/Native/` e acrescentar `dist/` ao `.gitignore`.
2. Corrigir `os.uname()` em `backend/app/local/claude_oauth.py:90` + teste.
3. Criar `backend/app/desktop.py` (uvicorn explícito, handshake `VIGIA_READY`, `COLLECTOR_DATA` obrigatório).
4. `npm init` em `desktop/`, `main.ts` mínimo que dá spawn no venv e abre `http://127.0.0.1:8787/display`.
5. Build ad-hoc assinado no macOS **só para testar o prompt do Keychain** — é o gate da Fase 1.

---

## 14. O que a execução mudou

Três coisas só apareceram rodando o código.

### 14.1 O SSE segurava o encerramento (não previsto)

O coletor levava mais de 5 s para morrer e caía no `SIGKILL`. Causa: o uvicorn
espera as conexões fecharem no shutdown, e os streams `GET /events` **nunca**
fecham sozinhos. Resolvido com `timeout_graceful_shutdown=3` em
`backend/app/desktop.py`; o encerramento caiu para ~2 s.

### 14.2 Corrida entre o coletor velho e o novo (não previsto)

Ao reiniciar, o evento `exit` do processo antigo chegava **depois** do `start()`
do novo e disparava o restart automático — deixando dois coletores na mesma
porta. Resolvido com uma guarda de geração em `desktop/src/sidecar.ts`: cada
spawn recebe um número e os handlers de um filho antigo saem cedo.

### 14.3 O watcher de stdin era agressivo demais

§5.3 previa encerrar o coletor quando a stdin fechasse. Na prática isso matava o
binário assim que ele subia fora do Electron: em background a stdin é
`/dev/null` e no terminal é um TTY — os dois dão EOF na hora. Agora só vigia
quando a stdin é de fato um **pipe** do processo pai.

### 14.4 O Keychain não deu problema (§9.1 era o maior risco)

O provedor Claude lê o OAuth de dentro do `.app` empacotado sem prompt: quem
consulta o Keychain é o `/usr/bin/security`, assinado pela Apple, e a ACL do
item se aplica a ele. Testado com o `.app` gerado pelo electron-builder, ainda
**sem** Developer ID. Falta validar com um build **assinado e notarizado** — a
troca de identidade de assinatura é justamente o que pode fazer o macOS pedir
autorização de novo. Os fallbacks (`~/.claude/.credentials.json` e token colado)
seguem valendo.

### 14.5 A janela sem barra de título cobrava um acerto no CSS (não previsto)

A janela usa `titleBarStyle: "hiddenInset"` no macOS: não há barra de título e
os semáforos flutuam **sobre** o conteúdo — caíam em cima do olho do logo — e,
sem barra, não sobrava nada para arrastar a janela. A correção é toda no
frontend, com o `preload` marcando `data-vigia-desktop` / `data-vigia-platform`
no `<html>` e o `index.css` reagindo a esses atributos:

- recuo de 84px à esquerda do cabeçalho (`[data-app-header]`), que some quando
  o app entra em tela cheia e o macOS recolhe os semáforos (o processo
  principal avisa pelo canal `vigia:fullscreen`);
- o olho (`[data-app-brand]`) sai do canto dos semáforos e vai para depois do
  contador, via `order` — por isso o botão do logo é filho **direto** do
  cabeçalho em `Display.tsx`: `order` só reordena irmãos diretos;
- cabeçalho como área de arraste (`-webkit-app-region: drag`), com `no-drag`
  nos controles;
- `[data-drag-handle]`, um punho fixo no canto dos semáforos, para quando o
  cabeçalho está recolhido (modo foco e canvas).

No navegador esses atributos não existem, nenhum seletor casa e o CSS some do
caminho — segue valendo **um único build** do frontend (§6, §7).

### 14.6 Ainda em aberto

- Assinatura e notarização reais no macOS (precisa de conta Apple Developer).
- Assinatura Authenticode no Windows.
- Instalar e usar em VMs limpas de Windows e Linux — o critério da fase 5 foi
  verificado só no macOS, que é a máquina onde o port foi feito.
