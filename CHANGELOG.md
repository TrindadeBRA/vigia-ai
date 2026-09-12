# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Fixed

- **App desktop não encerrava (ou demorava ~13s) ao clicar em Sair**: o coletor Node tinha dois caminhos de shutdown — o acionado por `SIGTERM`/`SIGINT` derrubava sockets SSE abertos (ex.: `/events` da ESP32/painel) depois de um prazo curto, mas o acionado pelo fechamento do `stdin` (o caminho usado pelo Electron ao "Sair") chamava `app.close()` sem essa rede de segurança — com qualquer conexão SSE de longa duração ainda aberta, o processo nunca encerrava por conta própria, e o app só saía depois do timeout de 10s do lado do Electron forçar um `SIGTERM`. Os dois caminhos agora compartilham a mesma rotina de shutdown (`backend/src/desktop.ts`); o timeout de fallback no Electron caiu de 10s para 5s (`desktop/src/sidecar.ts`).

### Added

- **Baixar firmware no app instalado**: em `/display/setup`, se a pasta `firmware/` não existir (Brew/cask), **Baixar firmware** puxa o tarball da tag GitHub desta versão (`POST /api/firmware/source`) e habilita o flash USB — ainda é preciso `pio` no host.

- **Flash da ESP32 pelo painel** (`/display/setup`): preenche SSID (detectado na Wi-Fi do host) e `USAGE_URL` da LAN, grava `firmware/src/secrets.h` e dispara `pio run -e esp32dev -t upload` sem sair da tela — `GET/PUT /api/firmware`, `POST /api/firmware/flash`. O comando `./dev firmware flash` continua válido.

- **Coletor em Node.js** — port completo de `backend/app` (FastAPI/Python, ~8.3k linhas) para **Node 22 LTS + Fastify + Zod + Vitest** (`backend/src/`). Mesma árvore de responsabilidades, mesmo contrato JSON (`CONTRATO_JSON.md`) e mesmo framing SSE (`GET /events`), mas sem PyInstaller: bundle `esbuild` + `node:sqlite` builtin + `jimp` puro JS. Harness `scripts/diff-contract.mjs` compara `GET /usage` byte-a-byte entre `backend-python-legacy/` (8788) e Node (8787) — paridade OK.
- 83 testes Vitest (`backend/src/*.test.ts`) portados 1:1 de `backend-python-legacy/tests/*.py` (12 arquivos, ~1.1k linhas) — `pytest` → `vitest`, `TestClient` → `app.inject()`.
- `scripts/build-collector.sh` (esbuild) substitui `scripts/build-sidecar.sh` (PyInstaller `--onedir` ~54 MB por SO).

### Changed

- Firmware: ícones clicáveis do menu (header) maiores nas quatro bordas — relógio 9→12 px de raio, recarregar tema 8→11, "i" 9→12, e o alvo de toque de cada um subiu junto (relógio 34→44 px, mineração 44→54, recarregar 32→42, "i" 34→40). O ícone de mineração é bitmap fixo 20×20 e não escala: só o alvo cresceu. Os respiros internos foram reduzidos na mesma medida em que os raios subiram, então o espaço que cada atalho exige no vão continua igual ao de antes e nenhum deles passa a sumir nas telas estreitas.
- `Dockerfile` single-stage `node:20-alpine` (build frontend + runtime backend) — remove `python:3.12-slim`.
- `./dev` — `ensure_python()` → `ensure_backend_node()`, `run_backend()` `node dist/main.js`, `cmd_test` `vitest` + `tsc` (backend/frontend/desktop), `cmd_lint` `tsc --noEmit`.
- `desktop/src/sidecar.ts` / `paths.ts` — `ELECTRON_RUN_AS_NODE=1` e `collectorBundle()` (`backend/dist/desktop.js`) em vez do binário PyInstaller; `devCollector()` fallback `backend/src/desktop.ts` via `tsx`.
- `README.md` / `.agents/CONTEXTO_IA.md` / `.agents/BACKEND.md` / `.agents/DECISOES.md` — revertem a decisão anterior de não reescrever o coletor e documentam o port Node.

### Added

- Provedor **GPT** (cota da assinatura ChatGPT / Codex CLI via `~/.codex/auth.json` e `GET /backend-api/wham/usage`). Card no firmware, no mostrador e no painel.
- Template de issue de feature.
- **Alarmes + Telegram** (`/display/alarms`): regras de provedor + métrica + limiar, edge-triggered, disparando mensagem no Telegram quando cruzadas. Nome sugerido automaticamente e edição inline das regras — ver `.agents/NOTIFICACOES.md`.
- Provedor **Bitcoin** (endereço público de carteira → saldo on-chain via Blockstream Esplora + cotação USD/BRL via CoinGecko, sem chave privada). Card no firmware, no mostrador e no painel — ver `.agents/APIS_BITCOIN.md`.
- Seção **Financeiro** no painel de configuração (Bitcoin + AdSense + cotação de moedas).
- Provedor **AdSense** (OAuth Google → ganhos estimados de hoje + saldo não pago). Card no firmware, no mostrador e no painel, ao lado do Bitcoin — ver `.agents/APIS_ADSENSE.md`.
- **Cotação de moedas** (`/api/currencies`): lista livre do usuário, moedas fiat (câmbio via open.er-api.com) ou cripto (CoinGecko, com busca embutida), todas convertidas pra uma moeda base configurável. Card no mostrador web **e no firmware** (Início, Agora e detalhe).
- Card **Clima** no firmware (Início, Agora e detalhe), no mesmo padrão de Moedas: objeto único no `/usage`, some da placa se desligado/oculto.
- **Papéis de parede**: upload de imagem, busca e importação de Pexels/Wallhaven/Unsplash pro fundo do editor de tema (ESP32) e pro grid do `/display`, com biblioteca própria e conversão automática pra RAW RGB565 — ver `.agents/CONTRATO_TEMA.md`.
- Card **AdSense** no mostrador (`/display`), no mesmo padrão dos demais provedores.
- Layout do board (`/display`) agora também persiste no backend (`/api/board`), além do `localStorage` — sincroniza entre dispositivos na mesma LAN.
- **Exportar/Importar alarmes** (`/display/alarms`): baixa as regras salvas como JSON e repõe a partir de um arquivo — ver `.agents/NOTIFICACOES.md`.
- **App desktop (Electron)** para Linux, macOS e Windows, com instaladores (`.dmg`, `.exe` NSIS, `.AppImage`, `.deb`). O app embarca o coletor FastAPI (PyInstaller) e carrega o mesmo `/display` que o navegador e a placa usam — sem exigir Python ou Node instalados. Bandeja, abrir junto com o sistema, toggle de acesso pela LAN, "abrir no navegador", diálogo nativo pro `secrets.h`, e auto-update — ver `.agents/DESKTOP.md`.
- `backend/app/desktop.py`: entrypoint do coletor como sidecar, com handshake `VIGIA_READY`/`VIGIA_ERROR` e encerramento por fechamento da stdin (Windows não entrega `SIGTERM`).
- `./dev app` e `./dev app build`; `./dev test` passou a incluir o typecheck do desktop.

### Fixed

- **Firmware parava de receber o SSE e o contador ficava travado em zero** — o payload do `/usage` passou de 20 KB (clima, RSS, storage e APOD entraram nele) e o leitor de `/events` montava a linha byte-a-byte numa `String`, que realoca de 16 em 16 bytes, e ainda tirava mais três cópias inteiras dela (o parâmetro por valor, o `substring(5)` e o buffer do evento) antes do parse — mais de 100 KB de heap por evento. Quando uma dessas alocações não cabia, a `String` do Arduino falha **em silêncio** (volta vazia): o evento nunca era despachado, `g_lastFetchMs` parava no lugar e o selo do contador congelava em zero. Como os bytes continuavam chegando (o coletor manda `: ping` a cada 15 s), o watchdog de silêncio nunca disparava e a placa ficava assim até um refresh manual, que fecha o SSE e libera justamente esses buffers — daí só atualizar no clique. Agora o corpo do `data:` vai direto pro buffer do evento (sem linha intermediária nem cópias), os buffers crescem em blocos de 2 KB com reserva feita na abertura do stream, uma alocação que falha é logada e descarta o evento inteiro em vez de entregá-lo truncado, o socket é drenado em 4 KB por volta do `loop()` (era 512 B) e um segundo watchdog reconecta se passar o dobro do intervalo sem nenhum evento **completo**, mesmo com o socket vivo.
- Firmware: o `/usage` é deserializado com filtro (`DeserializationOption::Filter`) — `rss`, `apod`, `storage`, `github` e as séries horárias do clima nunca foram lidos pela placa e sozinhos respondiam por ~18 dos 22 KB do payload; o documento montado em RAM caiu para ~3 KB.
- Firmware: o contador segue o `interval_s` que o coletor publica em `/health`, em vez do `USAGE_POLL_MS` fixo de compilação — com um coletor configurado num intervalo maior o selo zerava e ficava parado esperando o evento seguinte.
- **Emulador (EmulatorJS) nunca conseguia foco de teclado no Mac** — `EJS_noAutoFocus` era lido da config e, na linha seguinte, sobrescrito pra `true` incondicionalmente (config sem efeito, auto-foco sempre desligado). Um segundo efeito ainda interceptava clique/mousedown/touchstart em toda a área do jogo (fase de captura) com `preventDefault()`, achando que precisava bloquear cliques vazando pro menu interno escondido — só que o menu escondido já é `display:none` (não recebe clique nenhum), então esse bloqueio só engolia toque em controles virtuais e, por causa do `preventDefault()` no `mousedown`, cancelava o foco automático do navegador ao clicar no card. Removido o efeito (a lógica de "fechar menu ao clicar fora" já existia à parte, sem depender dele) e a config `noAutoFocus` passou a ser respeitada de verdade — com toggle próprio em Configurações → Emulador. Ver `.agents/APIS_EMULATOR.md`.
- Resize do card de emulador escrevia `canvas.style.width/height` via JS a cada mudança de tamanho do tile, mas o wrapper já força o tamanho por CSS (`!w-full !h-full !object-contain`, Tailwind `!important` sempre vence sobre inline style) — o JS não tinha efeito visual, só gerava layout/repaint à toa. Removido; o `ResizeObserver` só avisa o EmulatorJS pra recalcular a resolução interna do canvas.
- **`GET /docs` (Swagger) sempre voltava 404 no coletor Node** — `@fastify/swagger`/`@fastify/swagger-ui` estavam instalados mas nunca registrados (só um placeholder estático em `/openapi.json`); o Python original tinha Swagger funcional via FastAPI. Regressão silenciosa: o README, o log de boot e um link clicável no painel (`NetworkCard.tsx`) anunciavam a URL como disponível. Registrados os dois plugins em `backend/src/main.ts`; `/openapi.json` agora devolve o spec real gerado (`fastify.swagger()`), com `paths` de verdade em vez do stub `{openapi, info}`.
- Dependência `@fastify/static` (não usada em lugar nenhum do código) removida do backend — tinha 2 CVEs (bypass de autorização + path traversal). `@fastify/swagger-ui` atualizado pra `^6.1.1`, que resolve a mesma dependência internamente (usada pra servir os assets estáticos do `/docs`).
- **Claude no Windows**: `os.uname()` não existe fora de POSIX, e a leitura de credencial quebrava com `AttributeError` antes mesmo de tentar o `~/.claude/.credentials.json`. Trocado por `sys.platform`.
- **Cursor no Linux/Windows**: os candidatos de `state.vscdb` eram testados sempre na ordem do macOS, então a mensagem de "não encontrei" mostrava um caminho do macOS em qualquer SO. Agora a ordem segue a plataforma atual.
- Mensagens de provedor que diziam "neste Mac" em caminho de código multiplataforma.
- OpenCode Go: `percent` das janelas rolling/weekly/monthly usava `as_percent()` (fração 0–1, certo pro Claude), mas a API do OpenCode já devolve 0–100 — `percent: 1.0` (1% usado) virava 100% na tela. Trocado para `as_percent_points()`, igual ao Cursor.
- Claude: no schema novo (`limits[]`), o campo `percent` também já vem 0–100, mas o parser usava `as_percent()` (a mesma função certa pro `utilization` do schema antigo). Sessão/semana com uso baixo logo após o reset (ex.: 1%) virava 100% na tela. Trocado para `as_percent_points()` quando `utilization` não está presente.
- Modo foco (`/display`) forçava tela cheia do navegador via `requestFullscreen`, e um listener de `fullscreenchange` desligava o foco sozinho ao trocar de aba (a troca de aba já sai da tela cheia do browser). Agora o foco só esconde a UI, sem mexer em tela cheia.
- Alça de arrastar dos cards do `/display` alinhada ao topo esquerdo — antes ficava centralizada verticalmente, desalinhada dos outros botões (duplicar/tamanho/remover) do card.

### Security

- **SSRF na importação de papel de parede externo** (`POST /api/wallpapers/import`): `image_url`/`thumb_url` agora precisam apontar pra um host público via `http`/`https` — `file://`, loopback, rede privada e link-local são rejeitados antes do download (redirects são revalidados a cada hop).

### Removed

- Dependência `react-emulatorjs` (npm) do frontend — nunca era importada em lugar nenhum; a integração do emulador sempre carregou o EmulatorJS direto da CDN oficial via `<script>`, e o pacote só embrulharia a mesma CDN numa API de componente.
- **Web Push** (VAPID, service worker `sw.js`, `/api/push`, `pywebpush`): notificações de alarme passam só pelo **Telegram** — ver `.agents/NOTIFICACOES.md`.
- Scripts de instalação standalone (`install-scripts/`) — usar `./dev` ou Docker Compose.

### Changed

- Chaves de API dos provedores de papel de parede (Pexels/Wallhaven/Unsplash) saíram do editor de tema e agora são cards próprios em Configurações → "Papéis de parede".
- Rota do editor de tema: `/display/theme` (inglês, como as demais slugs). `/display/tema` redireciona. Alarmes: `/display/alarms` (`/display/alarmes` redireciona).
- Tema da placa: cada ícone de provedor mostra uma **métrica de cota ao vivo** (sessão, saldo, etc.) escolhida no editor — firmware desenha ícone + valor; o painel gerencia provedor e métrica no canvas.

- Início da placa abre em **grade** por padrão.
- `.agents/REESCRITA.md` removido — o monorepo (`firmware/`, `backend/`, `frontend/`, `./dev`) é o estado vigente. Índice aponta para ARQUITETURA e CONTRIBUTING.

## [1.0.0] — 2026-08-31

### Added

- Monorepo: `firmware/`, `backend/` (FastAPI + OpenAPI/Swagger), `frontend/` (Vite + React + TypeScript).
- Single `./dev` script (replaces `dev.sh`, `dev-collector.sh`, `dev-wokwi.sh`).
- LICENSE (MIT), CONTRIBUTING, SECURITY, CI, issue templates.
- Nested `config.json` (`version: 1`) with migration from the old flat env-style file.

### Changed

- Collector is FastAPI; `GET /docs` is the Swagger UI.
- Panel and display are a real React app (no UMD, no Tailwind CDN).
- Firmware lives under `firmware/`; `MOCK_USAGE` removed (mock is a backend flag).

### Removed

- `POST /api/docker` and Docker socket mount from the panel.
- Retired `gerar_env_*.py` scripts.
