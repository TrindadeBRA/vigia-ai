# Decisões

## Coletor no Mac, não na nuvem

Cotas são da conta pessoal. Evita hospedar JWT/OAuth. LAN é suficiente para um painel na mesa.

## FastAPI no host, não stdlib pura

O protótipo usava `http.server`. O coletor oficial é **FastAPI + Uvicorn**: OpenAPI em `/docs`, modelos Pydantic = contrato, pytest. Tokens continuam só no host.

## Um app React, duas rotas

Painel (`/display/config`) e mostrador (`/display`) são Vite + React + TypeScript. Em desenvolvimento o Vite roda em `:5173` e faz proxy da API. Em produção o backend serve o `frontend/dist`. `/display` lê **somente** `GET /events` / `GET /usage` — zero tokens no browser. `/` redireciona para as configs.

## Docker opcional

`./dev up --docker`. O container não lê Keychain. Cursor/Codex: overlay `compose.credentials.yaml` (bind-mount somente leitura). Claude no Mac Docker: Python local ou token colado. No Mac da mesa, `./dev up` (Python + Vite) continua o caminho mais simples.

## Endpoints internos, não scraping HTML

Mesma fonte do CLI/IDE. HTML do dashboard quebra mais. Risco: contrato não oficial (documentado em `APIS_*.md`).

## Um JSON, um GET, um parse — mas cada provedor é uma lista de contas

Continua um único `GET /usage` por ciclo (decisão original: firmware pequeno, provedor com `ok: false` não derruba o HTTP). O que mudou: cada provedor deixou de ser um objeto único e virou uma **lista de contas** (`CONTRATO_JSON.md`), pra suportar múltiplas assinaturas do mesmo provedor (ex.: Claude pessoal + Claude da empresa), cada uma com apelido opcional. Quem tem uma conta só (o caso comum) não vê diferença nenhuma — lista com 1 item. O firmware guarda no máximo `MAX_ACCOUNTS` (5) por provedor; excedentes são ignorados (log serial, nunca trava) — o coletor e o `/display` não têm esse teto.

Decisão de UI física: a Início cabe até **5 cards**, um por *tipo* de provedor (não por conta) — lista empilha; grade sempre **2 colunas × 3 linhas visíveis** (1/2 da largura, o ímpar não estica). Layout padrão: **grade**. Com mais de uma conta, o card mostra a que mais precisa de atenção (maior percentual) e o detalhe ganha um paginador `‹ i/N ›` pra ver as outras. O mostrador web (`/display`) não tem esse limite de tela — lá cada conta é um card próprio.

## Wokwi fala com o coletor de verdade (via `wokwigw`)

Resolvido com o [Wokwi IoT Gateway](https://github.com/wokwi/wokwigw) local (`wokwi.toml` → `ws://localhost:9011`). O simulador usa a mesma Wi-Fi simulada do hardware e fala com o backend FastAPI. Mock de dados é uma flag no painel (`mock`), não um firmware separado.

## GPIO 2 sem blink

Compartilhar DC da TFT com LED corrompe SPI se ficar togglando no `loop`.

## Sem NTP na v1

Datas vêm ISO no JSON; a tela mostra trecho curto (`MM-DD HH:MM` UTC) para não depender de relógio na ESP32.

## Touch XPT2046 no SPI da TFT

Um CS extra (GPIO 21) evita biblioteca à parte. Calibração na NVS, não no sketch.

## Wokwi com toque capacitivo (não é o hardware)

A placa real é XPT2046 (SPI, `T_CS` 21). O Wokwi não tem XPT2046; usa `board-ili9341-cap-touch` (FT6206 I2C) só para clicar no simulador. O caminho de código é `WOKWI_SIM` (`firmware/src/input/touch.cpp`). Os dados vêm do coletor de verdade.

## Painel sem devolver tokens

`GET /api/config` devolve status (sufixo, origem), nunca `paste_token` / key. Gravar contas é `POST /api/config`.

## Login local, sem copiar token

Claude, GPT e Cursor: Keychain / `~/.codex/auth.json` / `state.vscdb` primeiro; paste no painel só se o app não estiver neste PC. Não usar `gerar_env_*.py` para gravar Bearer em `config.json`. O coletor **não** faz refresh OAuth/JWT desses três — abra o app oficial para renovar. **AdSense é a exceção**: o coletor é o cliente OAuth (Client ID tipo Web + `refresh_token` em `config.json`); ver [`APIS_ADSENSE.md`](APIS_ADSENSE.md).

## Sem autenticação no coletor (v1)

Rede doméstica. Quem pedir rede hostil pode acrescentar um token estático no header depois, no coletor **e** no firmware.

## SSE a 60 s, cada API no próprio ritmo

Firmware e `/display` continuam recebendo o JSON a cada `USAGE_INTERVAL_S`. O coletor é quem diferencia o intervalo real: `RefreshCache` por provedor + cliente CoinGecko compartilhado (Bitcoin e `currencies` no mesmo bucket IP). A API *keyless* da CoinGecko (~10–30/min, dado já cacheado 1–5 min do lado deles) 429a se pollada a cada 60 s — por isso a cotação vive num TTL de 5 min, com last-good. `GET /usage` só força as cotas de assinatura; martelar o endpoint não aumenta a cota da CoinGecko.

## Telegram em vez de Web Push nos alarmes

Web Push exigia HTTPS, service worker e chaves VAPID — frágil em LAN (`127.0.0.1`) e em iOS. **Telegram** funciona em qualquer aparelho com o app, token do bot configurado no painel (`/display/alarms`), long-polling sem webhook público. Um bot por instalação; chats registrados via `/start`. Detalhes: [`NOTIFICACOES.md`](NOTIFICACOES.md).

## App desktop com o coletor embarcado — reescrito em Node (reverte decisão anterior)

**Reverte** a decisão anterior documentada acima e em `PLANO_ELECTRON.md` Opção B.

O Electron continua subindo o coletor como processo filho na mesma porta, mas o coletor deixou de ser Python/FastAPI e virou **Node 22 + Fastify** (`backend/src/`, ver `PLANO_NODE.md`). Motivo: o app já é 100% Node — eliminar o PyInstaller remove binário de ~54 MB por SO, falso-positivo de antivírus e compilação por plataforma, e o hub SSE simplifica para `Promise.all` (ver `PLANO_NODE.md §1.5`).

O risco de divergir do JSON que `firmware/src/net/parse.cpp` espera foi mitigado com testes Vitest 1:1 (`backend/src/*.test.ts` vs `backend-python-legacy/tests/*.py`, 83 testes), harness de diff byte-a-byte (`scripts/diff-contract.mjs`) e gates SSE (§6). `sharp` foi evitado em favor de `jimp` puro JS para não reintroduzir módulo nativo por ABI do Electron (§2.3). Escolha original (Python) preservada em `backend-python-legacy/` até Fase 6.

## A porta do app não é sorteada

A ESP32 guarda `USAGE_URL` no `secrets.h`. Se o app escolhesse uma porta livre
qualquer no boot, toda placa já gravada pararia de achar o coletor. Porta
ocupada vira decisão explícita do usuário — e quando quem está na porta é outro
Vigia (o `./dev up`, por exemplo), o app se conecta a ele em vez de subir um
segundo coletor.

## O coletor morre quando a stdin fecha

Windows não entrega `SIGTERM`. Sem um segundo caminho de encerramento, fechar o
app deixaria o coletor rodando e segurando a porta. O sidecar vigia a stdin: o
EOF significa que o Electron morreu. Só quando ela é de fato um pipe do pai —
num terminal é TTY e em background é `/dev/null`, e vigiar esses dois faria o
coletor encerrar assim que subisse.

## Um build do frontend para web e desktop

O painel não sabe se está num navegador ou no app: ele testa `window.vigia` em
runtime. Assim o `/display` servido na LAN e o app são literalmente o mesmo
bundle, e nada de desktop pode quebrar a versão web.
