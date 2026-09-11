# Contexto para agentes de IA

Leia este arquivo **antes** de alterar o repositório. Complementos:

| Arquivo                                      | Quando usar                                                       |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [SETUP.md](SETUP.md)                         | Instalar e rodar: quick start, comandos, placa, Wokwi, provedores |
| [ARQUITETURA.md](ARQUITETURA.md)             | Coletor ↔ ESP32 ↔ APIs                                            |
| [CONTRATO_JSON.md](CONTRATO_JSON.md)         | Formato de `/usage` (não quebrar o firmware)                      |
| [CONTRATO_TEMA.md](CONTRATO_TEMA.md)         | Protótipo: tema custom + papéis de parede (`porta 80` da placa, `/display/theme`) |
| [NOTIFICACOES.md](NOTIFICACOES.md)           | Protótipo: alarmes + Telegram (`/display/alarms`)                     |
| [APIS_CLAUDE.md](APIS_CLAUDE.md)             | OAuth usage da Anthropic                                          |
| [APIS_GPT.md](APIS_GPT.md)                   | OAuth usage do Codex / ChatGPT                                    |
| [APIS_CURSOR.md](APIS_CURSOR.md)             | Dashboard Connect RPC do Cursor                                   |
| [APIS_OPENROUTER.md](APIS_OPENROUTER.md)     | Créditos da key OpenRouter                                        |
| [APIS_DEEPSEEK.md](APIS_DEEPSEEK.md)         | Saldo da key DeepSeek                                             |
| [APIS_OPENCODE_GO.md](APIS_OPENCODE_GO.md)   | Assinatura mensal OpenCode Go                                     |
| [APIS_OPENCODE_ZEN.md](APIS_OPENCODE_ZEN.md) | Saldo pré-pago OpenCode Zen                                       |
| [APIS_FAL.md](APIS_FAL.md)                   | Saldo de créditos fal.ai                                          |
| [APIS_BITCOIN.md](APIS_BITCOIN.md)           | Saldo de carteira Bitcoin + cotação                               |
| [APIS_ADSENSE.md](APIS_ADSENSE.md)           | Ganhos AdSense (OAuth Google)                                     |
| [APIS_SPOTIFY.md](APIS_SPOTIFY.md)           | Player Spotify: tocar/pausar/avançar/retroceder (OAuth)           |
| [HARDWARE.md](HARDWARE.md)                   | Placa, pinos, drivers TFT                                         |
| [TOUCH.md](TOUCH.md)                         | Views, XPT2046, calibração, Wokwi                                 |
| [BACKEND.md](BACKEND.md)                     | Como rodar o coletor Fastify (Node 22)                            |
| [DESKTOP.md](DESKTOP.md)                     | App Electron: instalar, pastas, porta, assinatura                 |
| [RELEASE.md](RELEASE.md)                     | Checklist de versão + tag: quais arquivos mudar, por que desktop manda |
| [FRONTEND.md](FRONTEND.md)                   | Painel e mostrador React                                          |
| [FIRMWARE.md](FIRMWARE.md)                   | PlatformIO, Wokwi, `secrets.h`                                    |
| [DECISOES.md](DECISOES.md)                   | Por que as escolhas atuais                                        |
| [MCPS.md](MCPS.md)                           | MCPs recomendados (Playwright, dnd-kit)                           |
| [PLANO.md](PLANO.md)                         | Escopo do protótipo (histórico)                                   |
| [MINERACAO.md](MINERACAO.md)                 | Protótipo: mineração na placa (shares, pools, o que o painel mostra) |
| [PLANO_MINERACAO.md](PLANO_MINERACAO.md)     | Histórico da implementação da mineração (riscos, passos, decisões de port) |

## O que é este projeto

**Vigia AI**: painel de mesa — **ESP32 + TFT 3,5" touch** mostra cotas das assinaturas **Claude**, **GPT** (ChatGPT / Codex), **Cursor**, **OpenRouter**, **DeepSeek**, **OpenCode Go**, **OpenCode Zen**, **fal.ai**, carteira **Bitcoin**, ganhos **AdSense** e cotação de **moedas**. A placa **não** guarda tokens. Um **coletor Node.js 22 + Fastify** no host (port do Python/FastAPI) lê credenciais locais (ou `backend/data/config.json`), chama as APIs e serve JSON na LAN. Firmware e `/display` escutam `GET /events` (SSE). `GET /usage` é o mesmo JSON, na hora. O frontend React é o mostrador (`/display`) e as configurações (`/display/config`). `/` redireciona para as configs.

Idioma da UI e da documentação: **português (Brasil)**. Código (identificadores) em inglês.

## Regras para quem gera código

1. **Tokens nunca vão no firmware**, no `diagram.json`, nem em commit. Só `backend/data/config.json` (gitignored) ou arquivos locais do Claude/Cursor.
2. **Não altere o contrato JSON** sem atualizar `CONTRATO_JSON.md`, os schemas Zod em `backend/src/schemas/` (dividido por domínio — usage, weather, currencies, config, alarms, telegram — reexportados por `schemas/index.ts`; port de `backend/app/schemas.py`) **e** o parser em `firmware/src/net/parse.cpp`.
3. Endpoints de cota são **não oficiais**. Trate 401/429/HTML como falha de um provedor; o outro deve continuar `ok` se possível.
4. **Um ciclo de APIs no coletor**: o hub monta o JSON a cada `USAGE_INTERVAL_S` (padrão 60 s) e empurra por `GET /events` (SSE). Cada fonte de terceiro tem o próprio TTL (`src/refreshCache.ts` + cliente CoinGecko); o SSE continua a 60 s com last-good. `GET /usage` força um ciclo extra **só das cotas de assinatura** (Claude/GPT/…). Não volte ao poll por cliente (placa + cada aba de `/display`).
5. Ambiente **Wokwi**: Wi-Fi simulada + coletor real via `wokwigw`. Mock só como flag no painel.
6. GPIO **2** é `TFT_DC`. Não usar como LED de heartbeat.
7. Não commitar `backend/data/config.json`, `firmware/src/secrets.h` com senha real, nem dumps de `state.vscdb` / `.credentials.json`.
8. Touch: XPT2046 no hardware (`TOUCH_CS`); Wokwi usa FT6206. Não trocar o controlador da placa real.
9. Não expandir escopo (Gemini, Copilot, MQTT) sem o usuário pedir.

## Mapa de arquivos

```
backend/src/main.ts           Fastify, Swagger /docs (port de app/main.py)
backend/src/schemas/          contrato OpenAPI (Zod, port de app/schemas.py), dividido por domínio + index.ts barrel
backend/src/providers/        claude, gpt, cursor, openrouter, deepseek, opencode, fal, bitcoin, adsense, currencies, weather
backend/src/local/            Keychain, credentials, state.vscdb, auth.json (Codex) — port de app/local/
(Python removido do repo — não há mais backend-python-legacy/)
frontend/src/pages/Display.tsx         mostrador (SSE GET /events) — orquestrador; grid/tiles/sidebar/etc. em pages/display/
frontend/src/pages/config/ConfigPage.tsx  contas, placa, rede
firmware/src/                  sketch ESP32 (`core/` `net/` `input/` `ui/`)
frontend/src/pages/config/ThemeEditorPage.tsx  editor de tema (protótipo, ver CONTRATO_TEMA.md) — canvas/toolbar/campos em pages/config/themeEditor/
backend/src/routers/theme.ts       coletor guarda o tema salvo pelo painel (protótipo)
firmware/src/net/theme_server.cpp  servidor HTTP :80 do tema, direto/debug (protótipo)
firmware/src/net/client.cpp        themeClientReload(): placa busca o tema do coletor
backend/src/alarms/engine.ts       catálogo de métricas + motor de disparo dos alarmes (protótipo)
backend/src/alarms/router.ts       rotas /api/alarms/*
backend/src/telegram/bot.ts        token Telegram + envio + polling unitário (protótipo)
backend/src/telegram/poller.ts     long-polling do Telegram (protótipo)
backend/src/telegram/router.ts     rotas /api/telegram/*
frontend/src/pages/config/AlarmsPage.tsx  painel de alarmes + notificações (/display/alarms), com exportar/importar
frontend/src/pages/config/useTelegram.ts  hook do Telegram
firmware/src/ui/customtheme.cpp    persistência (LittleFS/RAM) + render do tema (VIEW_THEME)
backend/src/routers/wallpapers/router.ts     rotas /api/wallpapers/* — papéis de parede + busca/import Pexels/Wallhaven/Unsplash/Giphy
backend/src/routers/wallpapers/gif.ts        extração de frames de GIF animado (gifuct-js) → RAW RGB565 concatenado
backend/src/routers/wallpapers/ssrfGuard.ts  guard SSRF (SECURITY_REVIEW.md Finding 1) — isolado por ser o trecho mais sensível
backend/src/routers/wallpapers/rgb565.ts     conversão imagem <-> RAW RGB565 (Jimp)
frontend/src/pages/config/wallpaperManager/context.tsx  estado + chamadas de API de papel de parede (usado em /display/theme)
frontend/src/pages/config/wallpaperManager/Library.tsx   UI de biblioteca/busca/import de papel de parede
frontend/src/pages/config/WallpaperProvidersConfigCard.tsx  chaves de API dos provedores de papel de parede (/display/config)
backend/src/routers/board.ts       rotas /api/board — layout do board (posição/tamanho dos cards), backend/data/board.json
frontend/src/hooks/useGridBoards.ts  hook do layout do board (só backend, sem localStorage)
backend/src/notes.ts               CRUD de notas (post-its do board) — backend/data/notes.json
backend/src/routers/notes.ts       rotas /api/notes — GET/POST + PATCH/DELETE por id
frontend/src/hooks/useServerNotes.ts  hook das notas (só backend, migra localStorage antigo uma vez)
backend/src/images.ts              CRUD de imagens (cards de imagem do board) — backend/data/images.json, src em base64 ou URL
backend/src/routers/images.ts      rotas /api/images — GET/POST + PATCH/DELETE por id, bodyLimit maior (base64)
frontend/src/hooks/useImageWidgets.ts  hook das imagens (só backend, migra localStorage antigo uma vez)
backend/src/routers/firmware.ts      secrets.h da ESP32 + baixar firmware do GitHub + flash PlatformIO pelo painel (/display/setup)
frontend/src/pages/display/usePrefs.ts  hook das preferências de exibição (tema/cor/idioma/foco/widgets) — só backend (/api/prefs)
backend/src/providers/spotify.ts   OAuth Spotify + chamadas ao player (play/pause/next/previous) — ver APIS_SPOTIFY.md
backend/src/routers/spotify.ts     rotas /api/oauth/spotify/* + /api/spotify* (estado + comandos do player) — protótipo, fora do contrato JSON
frontend/src/components/cards/SpotifyCard.tsx  widget "Spotify" do board (/display) — poll próprio de 5s, não usa o hub de usage
frontend/src/pages/config/SpotifyConfigCard.tsx  credenciais + login/logout OAuth do Spotify (/display/config)
firmware/platformio.ini            board_build.partitions = huge_app.csv (mineração empurrou o app pra perto do limite da partição padrão)
backend/src/schemas/mining.ts      contrato de /api/mining/* (config remota + report/status) — protótipo, ver MINERACAO.md
backend/src/routers/mining.ts      rotas /api/mining/config (GET/PUT), /api/mining/report (POST, placa->coletor), /api/mining/status (GET, painel)
frontend/src/pages/config/MiningPage.tsx  página dedicada /display/mining (status + config remota), padrão AlarmsPage.tsx
frontend/src/pages/config/miningCopy.ts   i18n pt/en/es da página de mineração
firmware/src/core/state.h          + VIEW_MINER — só minera de fato enquanto essa view está ativa (nunca em segundo plano)
firmware/src/ui/views/miner.cpp    renderiza a VIEW_MINER (texto puro) + uiTickMiner() (repaint 1x/s)
firmware/src/ui/nav.cpp            uiSetView() liga/desliga a mineração ao entrar/sair da VIEW_MINER (miningClientEnterView/ExitView)
firmware/src/mining/               motor de mineração (Stratum + SHA256), portado de NerdMiner_v2 (MIT) — mining_task.cpp orquestra, roda só no core 0 (nunca no core do loopTask/touch)
firmware/src/net/mining_client.cpp cliente HTTP da mineração: busca config do coletor, envia report periódico — só ativo com VIEW_MINER
.agents/MINERACAO.md               como a mineração funciona (shares, pools NerdMiner, o que o painel mostra)
.agents/PLANO_MINERACAO.md         plano do MVP de mineração de Bitcoin (histórico da decisão + riscos)
backend/src/desktop.ts             entrypoint do coletor como sidecar do Electron (port de app/desktop.py)
desktop/src/main.ts                processo principal do app (janela, bandeja, menu)
desktop/src/sidecar.ts             spawn/handshake/restart do coletor (usa ELECTRON_RUN_AS_NODE para o bundle Node)
desktop/src/preload.ts             ponte window.vigia (allowlist)
frontend/src/desktop.ts            acesso à ponte, com feature-detection
frontend/src/pages/config/DesktopCard.tsx  card «Aplicativo» (só no app)
scripts/build-collector.sh         bundle Node do coletor (esbuild) — substitui build-sidecar.sh (PyInstaller legado)
scripts/build-desktop.sh           build completo do instalador
./dev                          único script
```

## Como validar

- `./dev up` — mostrador em http://127.0.0.1:5173/display ; configs em http://127.0.0.1:5173/display/config ; Swagger em http://127.0.0.1:8788/docs (coletor de dev sobe em `:8788`, não `:8787` — essa é fixa pro app instalado, ver [DESKTOP.md](DESKTOP.md))
- `./dev app` — o mesmo painel dentro do app Electron (ver [DESKTOP.md](DESKTOP.md))
- `./dev test`
- `./dev wokwi` e Wokwi: Start Simulator
- Hardware: `firmware/src/secrets.h` + `./dev firmware flash` (ou o botão **Gravar na ESP32** em `/display/setup`)
