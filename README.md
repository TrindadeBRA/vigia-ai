<div align="center">
<img src="frontend/public/favicon.svg" alt="Vigia AI" width="72" height="72" />

# Vigia AI

### Painel de mesa para cotas de IA — sem nunca expor um token

**Claude** · **GPT** (ChatGPT / Codex) · **Cursor** · **OpenRouter** · **DeepSeek**
rodando em **ESP32 + TFT 3,5" touch**

[![License: MIT](https://img.shields.io/badge/license-MIT-e63931?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white)](backend)
[![Node](https://img.shields.io/badge/node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](frontend)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](backend)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TS-61DAFB?style=flat-square&logo=react&logoColor=0b1220)](frontend)
[![PlatformIO](https://img.shields.io/badge/firmware-PlatformIO-FF7F00?style=flat-square&logo=platformio&logoColor=white)](firmware)
[![ESP32](https://img.shields.io/badge/board-ESP32%20%2B%20TFT%203.5%22-e63931?style=flat-square&logo=espressif&logoColor=white)](docs/HARDWARE.md)

<br>

<table>
<tr>
<td><img src="docs/assets/firmware/display-home-list.png" width="260" alt="Início — lista de contas"></td>
<td><img src="docs/assets/firmware/display-detail-claude.png" width="260" alt="Detalhe da conta Claude"></td>
<td><img src="docs/assets/firmware/display-settings-theme.png" width="260" alt="Temas e cores do mostrador"></td>
</tr>
</table>
</div>

A placa **não** guarda tokens. O coletor roda no seu computador, lê o login local (ou o que você colar no painel), chama as APIs e publica JSON na LAN. A ESP32 e o mostrador web (`/display`) escutam `GET /events` (SSE). `GET /usage` continua o contrato JSON e força uma consulta na hora.

> [!WARNING]
> **LAN only.** Os endpoints de cota do Claude, do GPT e do Cursor **não são API pública** — são os mesmos que o CLI/IDE já usam neste computador. O projeto pode quebrar se esses contratos internos mudarem. **Não exponha a porta 8787 na internet.** OpenRouter e DeepSeek usam o saldo público da API key.

Licença [MIT](LICENSE).

## Como funciona

```
Assinaturas (Claude / GPT / Cursor / OpenRouter / DeepSeek)
        │  tokens só no host
        ▼
  backend FastAPI  :8787     GET /events  (SSE, JSON sem Bearer)
        │                    GET /usage   (consulta na hora)
        │                    GET /docs    (Swagger)
        ├──────────────────► ESP32 / Wokwi   (escuta o stream)
        └──────────────────► React            /display          réplica da placa
                                              /display/config   contas e placa
```

<div align="center">
<img src="docs/assets/firmware/display-home-grid.png" width="380" alt="Visão geral em grade no mostrador">
</div>

1. Tokens ficam no Mac (`Keychain`, `~/.codex/auth.json`, `state.vscdb`, ou `backend/data/config.json` gitignored).
2. O coletor consulta as APIs **uma vez por ciclo** (padrão 60 s) e empurra o mesmo JSON a todos os clientes SSE. `GET /usage` força um ciclo extra.
3. O JSON na LAN tem percentuais e datas, **nunca** o Bearer.
4. Falha de uma conta (`ok: false`) não derruba as outras. HTTP 200.

Arquitetura completa: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). Contrato da placa: [`docs/CONTRATO_JSON.md`](docs/CONTRATO_JSON.md).

## Como o Vigia sabe os limites (Claude, GPT, Cursor)

Não é mágica e **não é chave de API** (`sk-ant-…`, `sk-…`). Também **não é a placa** que liga para a Anthropic, a OpenAI ou o Cursor.

Pense assim: o Claude Code, o Codex e o Cursor **já perguntam isso o tempo todo** para desenhar a barra de uso no próprio app. O Vigia só pede **a mesma informação**, neste computador, com o **mesmo login** que você já fez.

```
Você já entrou no app  →  o app guarda um “crachá” neste Mac
        →  o coletor (Vigia) lê esse crachá  →  pergunta ao servidor da assinatura
        →  recebe “usou X% da sessão / da semana”
        →  manda só esses números para a placa e o /display
```

O crachá (token) **nunca sai deste computador**. A placa e o navegador só veem porcentagens e datas.

| App | Onde o login já está neste Mac | O que o Vigia pergunta |
| --- | --- | --- |
| **Claude** (Claude Code) | Chaveiro do macOS (Keychain), o mesmo lugar das senhas do sistema. No Linux, um arquivo em `~/.claude/`. | “Quanto da assinatura Claude já foi usado nesta sessão de 5 h e nesta semana?” |
| **GPT** (ChatGPT / Codex) | Arquivo `~/.codex/auth.json`, gravado quando você roda `codex login`. | “Quanto da cota ChatGPT/Codex já foi usado na janela curta e na longa?” |
| **Cursor** | Um arquivo interno do app (`state.vscdb`). O coletor **copia e lê**, não altera o Cursor. | “Quanto do plano (modelos Cursor / outros) já foi usado neste ciclo?” |

> [!TIP]
> Se o app não estiver neste PC (Docker, outro computador), aí sim você cola o token no painel — plano B. Enquanto o Claude Code, o Codex ou o Cursor estiverem logados **aqui**, não precisa colar nada.

O coletor **não renova** o login. Se a sessão expirou, abra o app oficial e entre de novo; na próxima volta o Vigia volta a enxergar a cota.

OpenRouter e DeepSeek são outro caso: não há app local. Você cria uma chave no site e cola no painel — o Vigia consulta o **saldo público** dessa chave.

### O que acontece de verdade (técnico)

Há **três camadas**. Só a do meio fala com Anthropic / OpenAI / Cursor.

```
app oficial (Claude Code / Codex / Cursor)
    grava access token neste host
        ↓
coletor FastAPI  :8787   (backend/app/providers/* + local/*)
    1. lê o token  2. GET/POST no endpoint de cota  3. normaliza
        ↓  JSON sem token  (docs/CONTRATO_JSON.md)
GET /usage  (na hora)   ·   GET /events  (SSE a cada USAGE_INTERVAL_S)
        ↓
firmware ESP32  ·  /display  ·  /display/config
```

O coletor **não** é um OAuth client. Não tem `client_id`, não faz authorization code, **não faz refresh**. Quem emite e renova o access token é o app oficial. O Vigia só **reusa** o token já gravado e dispara HTTP (`http_json`) com `Authorization: Bearer …`. Token expirado → `ok: false` naquela conta; as outras seguem.

`UsageHub` (`backend/app/hub.py`) faz **um** ciclo de APIs e espalha o snapshot. Placa e abas de `/display` só escutam SSE. `GET /usage` força um ciclo extra (botão «Atualizar consumo», Swagger). Falha de um provedor **não** derruba o HTTP 200 nem os outros cards.

Esses endpoints **não são produto público**. Path, header e envelope podem mudar; a quebra fica em `ok: false` naquela conta.

#### Claude

| | |
| --- | --- |
| Credencial | macOS: `security find-generic-password -s "Claude Code-credentials" -w` → JSON `claudeAiOauth.accessToken` + `expiresAt` (ms). Linux: `~/.claude/.credentials.json`. |
| HTTP | `GET https://api.anthropic.com/api/oauth/usage` |
| Headers | `Authorization: Bearer`, `anthropic-beta: oauth-2025-04-20`, `User-Agent: claude-code/2.1` |
| Mapeamento | `five_hour` / `kind=session` → `session_percent`; `seven_day` → `weekly_percent`; sonnet/opus se vierem |
| Não serve | `sk-ant-…` (API paga); `claude setup-token` / `sk-ant-oat01-…` (escopo `user:inference` → 403; precisa `user:profile`) |

Sem `anthropic-beta` → 401. Sem o User-Agent do CLI → 429 persistente. Rate limit é **por access token**. Código: `backend/app/local/claude_oauth.py`, `providers/claude.py`. Doc: [`docs/APIS_CLAUDE.md`](docs/APIS_CLAUDE.md).

#### GPT (ChatGPT / Codex)

| | |
| --- | --- |
| Credencial | `~/.codex/auth.json` (`CODEX_HOME` / `CODEX_AUTH_PATH`) → `tokens.access_token` + `tokens.account_id`. Gravado por `codex login`. |
| HTTP | `GET https://chatgpt.com/backend-api/wham/usage` |
| Headers | `Authorization: Bearer`, `User-Agent: codex-cli`, `ChatGPT-Account-Id` se existir |
| Mapeamento | `rate_limit.primary_window` (≤ 8 h) → sessão; `secondary_window` → semana; `plan_type` → `plan`. `used_percent` já vem 0–100. |
| Não serve | `OPENAI_API_KEY` / `sk-…` (ledger da API de plataforma, outro produto) |

Código: `backend/app/local/gpt_oauth.py`, `providers/gpt.py`. Doc: [`docs/APIS_GPT.md`](docs/APIS_GPT.md).

#### Cursor

| | |
| --- | --- |
| Credencial | Cópia do SQLite `state.vscdb` (evita lock) → `SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'`. Plano em `cursorAuth/stripeMembershipType`. `exp` do JWT só para mensagem de erro (sem verificar assinatura). |
| HTTP principal | `POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage` body `{}`, `Connect-Protocol-Version: 1` |
| Fallback | `GET https://api2.cursor.sh/auth/usage` (Enterprise: `numRequests` / `maxRequestUsage`) |
| Mapeamento | `planUsage.autoPercentUsed` → `percent` (Cursor Models); `apiPercentUsed` → `other_percent`; `spendLimitUsage` em centavos; `billingCycleEnd` → `cycle_end` |

Contas SSO/Team às vezes **não gravam** `cursorAuth/accessToken` — o coletor não inventa o JWT. Código: `backend/app/local/cursor_state.py`, `providers/cursor.py`. Doc: [`docs/APIS_CURSOR.md`](docs/APIS_CURSOR.md).

#### Ordem de credencial e o que nunca sai do host

Local **ganha** do token colado em `backend/data/config.json` (gitignored). Colado é plano B (Docker / outro PC). Extra accounts são contas **além** da local.

O JSON público (`claude[]`, `gpt[]`, `cursor[]`, …) tem `ok`, percentuais, resets, `plan` — **nunca** Bearer, Keychain, path do `auth.json` ou dump do SQLite. Firmware e browser só consomem esse contrato.

## Quick start

Precisa de **Python ≥ 3.11**, **Node 20+** e, para firmware, [PlatformIO Core](https://platformio.org/).

```bash
./dev up
```

| O quê | URL |
| --- | --- |
| Painel (contas, mock, `secrets.h`) | http://127.0.0.1:5173/display/config |
| Mostrador web | http://127.0.0.1:5173/display |
| Swagger | http://127.0.0.1:8787/docs |
| Contrato JSON | `GET http://127.0.0.1:8787/usage` |
| Stream SSE | `GET http://127.0.0.1:8787/events` |

`Ctrl+C` encerra. Se as portas ficarem ocupadas: `./dev down`.

Docker (backend serve o `frontend/dist` em `:8787`):

```bash
./dev up --docker
```

## Comandos

| Comando | Faz |
| --- | --- |
| `./dev up` | Backend + Vite; rebuilda `frontend/dist` (coletor em `:8787`) |
| `./dev down` | Encerra o que ficou em `:8787` / `:5173` |
| `./dev test` | pytest + `tsc` |
| `./dev lint` | ruff |
| `./dev wokwi` | Coletor + gateway Wokwi + firmware simulado; rebuilda o dist |
| `./dev firmware flash` | Grava a ESP32 |

## Provedores

Várias contas por serviço. O coletor consulta as APIs a cada 60 s (`USAGE_INTERVAL_S`) e espalha o resultado por SSE — placa e abas de `/display` **não** multiplicam as chamadas. Cuidado com **429** no Claude; a comunidade sugere ~180 s se bater rate limit (`USAGE_INTERVAL_S=180`).

| Serviço | Padrão neste computador | Plano B (painel) |
| --- | --- | --- |
| Claude | Keychain / `~/.claude/.credentials.json` | token OAuth colado |
| GPT | `~/.codex/auth.json` (`codex login`) | token OAuth colado |
| Cursor | `state.vscdb` (macOS / Linux / Windows) | JWT colado |
| OpenRouter | — | API key |
| DeepSeek | — | API key |

Detalhes: [`docs/APIS_CLAUDE.md`](docs/APIS_CLAUDE.md), [`APIS_GPT.md`](docs/APIS_GPT.md), [`APIS_CURSOR.md`](docs/APIS_CURSOR.md), [`APIS_OPENROUTER.md`](docs/APIS_OPENROUTER.md), [`APIS_DEEPSEEK.md`](docs/APIS_DEEPSEEK.md).

## Placa

**BOM:** ESP32 Dev Module (WROOM / DevKit C) + TFT SPI **3,5"** 320×480 (**ILI9488**; ILI9486 = flag no `platformio.ini`). Touch **XPT2046**. GPIO **2** é `TFT_DC` — não usar como LED.

| Sinal | GPIO |
| --- | --- |
| MOSI / T_DIN | 23 |
| MISO / T_DO | 19 |
| SCLK / T_CLK | 18 |
| TFT CS | 15 |
| TFT DC | **2** |
| TFT RST | 4 |
| Touch CS | 21 |

Pinos, backlight e rotação: [`docs/HARDWARE.md`](docs/HARDWARE.md). Views e calibração: [`docs/TOUCH.md`](docs/TOUCH.md).

```bash
cp firmware/src/secrets.h.example firmware/src/secrets.h
# SSID, senha Wi-Fi, USAGE_URL = http://IP-DO-MAC:8787/usage
./dev firmware flash
```

> [!NOTE]
> A ESP32 **não** alcança `127.0.0.1`. No macOS: `ipconfig getifaddr en0`. O painel imprime o `USAGE_URL` de LAN e gera o `secrets.h`.

## Capturas de tela

Telas reais do firmware (touch XPT2046, tema **Escuro** com destaque vermelho). Toque em qualquer card para abrir o detalhe da conta; deslize para ver mais.

<table>
<tr>
<th align="center">Início — grade</th>
<th align="center">Início — lista</th>
<th align="center">Início — lista expandida</th>
</tr>
<tr>
<td><img src="docs/assets/firmware/display-home-grid.png" width="240" alt="Início em grade com as 5 contas"></td>
<td><img src="docs/assets/firmware/display-home-list.png" width="240" alt="Início em lista com as 5 contas"></td>
<td><img src="docs/assets/firmware/display-home-list-expanded.png" width="240" alt="Início em lista expandida com percentuais restantes"></td>
</tr>
<tr>
<th align="center">Detalhe — Claude</th>
<th align="center">Detalhe — Cursor</th>
</tr>
<tr>
<td><img src="docs/assets/firmware/display-detail-claude.png" width="240" alt="Detalhe da sessão e limite semanal do Claude"></td>
<td><img src="docs/assets/firmware/display-detail-cursor.png" width="240" alt="Detalhe do plano Cursor com modelos e outros modelos"></td>
</tr>
<tr>
<th align="center">Detalhe — OpenRouter</th>
<th align="center">Detalhes empilhados</th>
</tr>
<tr>
<td><img src="docs/assets/firmware/display-detail-openrouter.png" width="240" alt="Créditos restantes na OpenRouter"></td>
<td><img src="docs/assets/firmware/display-detail-claude-cursor.png" width="240" alt="Rolagem mostrando Claude e Cursor em sequência"></td>
</tr>
<tr>
<th align="center">Sistema — rede e QR</th>
<th align="center">Sistema — tema e cor</th>
</tr>
<tr>
<td><img src="docs/assets/firmware/display-settings-network.png" width="240" alt="Tela de sistema com IP, painel e QR code"></td>
<td><img src="docs/assets/firmware/display-settings-theme.png" width="240" alt="Seleção de layout, tema claro/escuro/contraste e cor de destaque"></td>
</tr>
</table>

<div align="center">
<img src="docs/assets/firmware/display-settings-language.png" width="240" alt="Idioma PT/EN/ES, posição da barra e botão de atualizar consumo">
<br><sub>Sistema — idioma, posição da barra e atualização manual</sub>
</div>

## Simulador (Wokwi)

Mesmo sketch, Wi-Fi simulada, coletor **real** via [`wokwigw`](https://github.com/wokwi/wokwigw).

```bash
./dev wokwi
```

Depois, no editor: `Cmd+Shift+P` → **Wokwi: Start Simulator**. O display no Wokwi é ILI9341 320×240 — não é o tamanho físico da 3,5". Guia: [`docs/FIRMWARE.md`](docs/FIRMWARE.md).

## Layout

| Pasta | Papel |
| --- | --- |
| [`firmware/`](firmware/) | PlatformIO (`esp32dev` + `wokwi`) |
| [`backend/`](backend/) | FastAPI, OpenAPI, provedores |
| [`frontend/`](frontend/) | Vite + React + TypeScript |
| [`docs/`](docs/) | Contrato, APIs, hardware |
| [`./dev`](dev) | Único script de desenvolvimento |

Para agentes de IA: [`AGENTS.md`](AGENTS.md) e [`docs/CONTEXTO_IA.md`](docs/CONTEXTO_IA.md).

## Contribuir

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [CHANGELOG.md](CHANGELOG.md)
