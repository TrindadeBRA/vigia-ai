# Vigia AI

Painel de mesa para cotas de **Claude**, **GPT** (ChatGPT / Codex), **Cursor**, **OpenRouter** e **DeepSeek**: **ESP32 + TFT 3,5" touch**. A placa **não** guarda tokens.

O coletor roda no seu computador, lê o login local (ou o que você colar no painel), chama as APIs e publica JSON na LAN. A ESP32 e o mostrador web (`/display`) escutam `GET /events` (SSE). `GET /usage` continua o contrato JSON e força uma consulta na hora.

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
        └──────────────────► React            /  painel
                                              /display  réplica da placa
```

1. Tokens ficam no Mac (`Keychain`, `~/.codex/auth.json`, `state.vscdb`, ou `backend/data/config.json` gitignored).
2. O coletor consulta as APIs **uma vez por ciclo** (padrão 60 s) e empurra o mesmo JSON a todos os clientes SSE. `GET /usage` força um ciclo extra.
3. O JSON na LAN tem percentuais e datas, **nunca** o Bearer.
4. Falha de uma conta (`ok: false`) não derruba as outras. HTTP 200.

Arquitetura completa: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). Contrato da placa: [`docs/CONTRATO_JSON.md`](docs/CONTRATO_JSON.md).

## Quick start

Precisa de **Python ≥ 3.11**, **Node 20+** e, para firmware, [PlatformIO Core](https://platformio.org/).

```bash
./dev up
```

| O quê | URL |
| --- | --- |
| Painel (contas, mock, `secrets.h`) | http://127.0.0.1:5173/ |
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
| `./dev up` | Backend + Vite |
| `./dev down` | Encerra o que ficou em `:8787` / `:5173` |
| `./dev test` | pytest + `tsc` |
| `./dev lint` | ruff |
| `./dev wokwi` | Coletor + gateway Wokwi + firmware simulado |
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

A ESP32 **não** alcança `127.0.0.1`. No macOS: `ipconfig getifaddr en0`. O painel imprime o `USAGE_URL` de LAN e gera o `secrets.h`.

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
