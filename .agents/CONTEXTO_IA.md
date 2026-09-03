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
| [HARDWARE.md](HARDWARE.md)                   | Placa, pinos, drivers TFT                                         |
| [TOUCH.md](TOUCH.md)                         | Views, XPT2046, calibração, Wokwi                                 |
| [BACKEND.md](BACKEND.md)                     | Como rodar o FastAPI                                              |
| [FRONTEND.md](FRONTEND.md)                   | Painel e mostrador React                                          |
| [FIRMWARE.md](FIRMWARE.md)                   | PlatformIO, Wokwi, `secrets.h`                                    |
| [DECISOES.md](DECISOES.md)                   | Por que as escolhas atuais                                        |
| [MCPS.md](MCPS.md)                           | MCPs recomendados (Playwright, dnd-kit)                           |
| [PLANO.md](PLANO.md)                         | Escopo do protótipo (histórico)                                   |

## O que é este projeto

**Vigia AI**: painel de mesa — **ESP32 + TFT 3,5" touch** mostra cotas das assinaturas **Claude**, **GPT** (ChatGPT / Codex), **Cursor**, **OpenRouter**, **DeepSeek**, **OpenCode Go**, **OpenCode Zen**, **fal.ai**, carteira **Bitcoin**, ganhos **AdSense** e cotação de **moedas**. A placa **não** guarda tokens. Um **coletor FastAPI** no host lê credenciais locais (ou `backend/data/config.json`), chama as APIs e serve JSON na LAN. Firmware e `/display` escutam `GET /events` (SSE). `GET /usage` é o mesmo JSON, na hora. O frontend React é o mostrador (`/display`) e as configurações (`/display/config`). `/` redireciona para as configs.

Idioma da UI e da documentação: **português (Brasil)**. Código (identificadores) em inglês.

## Regras para quem gera código

1. **Tokens nunca vão no firmware**, no `diagram.json`, nem em commit. Só `backend/data/config.json` (gitignored) ou arquivos locais do Claude/Cursor.
2. **Não altere o contrato JSON** sem atualizar `CONTRATO_JSON.md`, os modelos Pydantic em `backend/app/schemas.py` **e** o parser em `firmware/src/net/parse.cpp`.
3. Endpoints de cota são **não oficiais**. Trate 401/429/HTML como falha de um provedor; o outro deve continuar `ok` se possível.
4. **Um ciclo de APIs no coletor**: o hub monta o JSON a cada `USAGE_INTERVAL_S` (padrão 60 s) e empurra por `GET /events` (SSE). Cada fonte de terceiro tem o próprio TTL (`app/refresh_cache.py` + cliente CoinGecko); o SSE continua a 60 s com last-good. `GET /usage` força um ciclo extra **só das cotas de assinatura** (Claude/GPT/…). Não volte ao poll por cliente (placa + cada aba de `/display`).
5. Ambiente **Wokwi**: Wi-Fi simulada + coletor real via `wokwigw`. Mock só como flag no painel.
6. GPIO **2** é `TFT_DC`. Não usar como LED de heartbeat.
7. Não commitar `backend/data/config.json`, `firmware/src/secrets.h` com senha real, nem dumps de `state.vscdb` / `.credentials.json`.
8. Touch: XPT2046 no hardware (`TOUCH_CS`); Wokwi usa FT6206. Não trocar o controlador da placa real.
9. Não expandir escopo (Gemini, Copilot, MQTT) sem o usuário pedir.

## Mapa de arquivos

```
backend/app/main.py           FastAPI, Swagger /docs
backend/app/schemas.py        contrato OpenAPI
backend/app/providers/        claude, gpt, cursor, openrouter, deepseek, opencode_go, opencode_zen, fal, bitcoin, adsense, currencies, weather
backend/app/local/            Keychain, credentials, state.vscdb, auth.json (Codex)
frontend/src/pages/Display.tsx         mostrador (SSE GET /events)
frontend/src/pages/config/ConfigPage.tsx  contas, placa, rede
firmware/src/                  sketch ESP32 (`core/` `net/` `input/` `ui/`)
frontend/src/pages/config/ThemeEditorPage.tsx  editor de tema (protótipo, ver CONTRATO_TEMA.md)
backend/app/routers/theme.py       coletor guarda o tema salvo pelo painel (protótipo)
firmware/src/net/theme_server.cpp  servidor HTTP :80 do tema, direto/debug (protótipo)
firmware/src/net/client.cpp        themeClientReload(): placa busca o tema do coletor
backend/app/alarms.py              catálogo de métricas + motor de disparo dos alarmes (protótipo)
backend/app/telegram_bot.py        token Telegram + envio + polling unitário (protótipo)
backend/app/telegram_poller.py     long-polling do Telegram (protótipo)
backend/app/routers/alarms.py      rotas /api/alarms/*
backend/app/routers/telegram.py    rotas /api/telegram/*
frontend/src/pages/config/AlarmsPage.tsx  painel de alarmes + notificações (/display/alarms), com exportar/importar
frontend/src/pages/config/useTelegram.ts  hook do Telegram
firmware/src/ui/customtheme.cpp    persistência (LittleFS/RAM) + render do tema (VIEW_THEME)
backend/app/routers/wallpapers.py  rotas /api/wallpapers/* — papéis de parede + busca/import Pexels/Wallhaven/Unsplash (SSRF-guarded)
frontend/src/pages/config/WallpaperManager.tsx  biblioteca/busca/import de papel de parede (usado em /display/theme)
frontend/src/pages/config/WallpaperProvidersConfigCard.tsx  chaves de API dos provedores de papel de parede (/display/config)
backend/app/routers/board.py       rotas /api/board — layout do board (posição/tamanho dos cards) espelhado do localStorage
frontend/src/hooks/useGridBoards.ts  hook do layout do board (localStorage + backend)
firmware/platformio.ini
./dev                          único script
```

## Como validar

- `./dev up` — mostrador em http://127.0.0.1:5173/display ; configs em http://127.0.0.1:5173/display/config ; Swagger em http://127.0.0.1:8787/docs
- `./dev test`
- `./dev wokwi` e Wokwi: Start Simulator
- Hardware: `firmware/src/secrets.h` + `./dev firmware flash`
