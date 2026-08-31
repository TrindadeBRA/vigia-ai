# Vigia AI

Painel de mesa: **ESP32 + TFT 3,5" touch** mostra as cotas das assinaturas **Claude**, **Cursor**, **OpenRouter** e **DeepSeek**. A placa **não** guarda tokens.

Um coletor no seu computador lê o login local (ou o que você colar no painel), chama as APIs e publica JSON na LAN. A ESP32 só faz GET e desenha a UI. Há também um mostrador web em `/display`.

```
APIs das assinaturas  →  backend (FastAPI :8787)  →  firmware ESP32 / Wokwi
                              ↓
                         frontend React  (/  painel,  /display  réplica)
```

## Aviso

Os endpoints de cota do Claude e do Cursor **não são API pública**. São os mesmos que o CLI/IDE já usam neste computador. O projeto pode quebrar se esses contratos internos mudarem. **Não exponha a porta 8787 na internet.** OpenRouter e DeepSeek usam endpoints públicos de saldo da key.

Licença: [MIT](LICENSE).

## Quick start

Python ≥ 3.11, Node 20+, [PlatformIO Core](https://platformio.org/).

```bash
./dev up
```

- Painel (Vite): http://127.0.0.1:5173/
- Mostrador: http://127.0.0.1:5173/display
- Swagger: http://127.0.0.1:8787/docs
- Contrato da placa: `GET http://127.0.0.1:8787/usage`

Docker: `./dev up --docker`.

## Simulador (Wokwi)

```bash
./dev sim
```

Depois: `Cmd+Shift+P` → **Wokwi: Start Simulator**. O firmware fala com o coletor **real** via `wokwigw`.

## Placa

ESP32 Dev Module + TFT SPI 3,5" (ILI9488). Pinos: [`docs/HARDWARE.md`](docs/HARDWARE.md).

```bash
cp firmware/src/secrets.h.example firmware/src/secrets.h   # SSID, senha, USAGE_URL = IP LAN
./dev firmware flash
```

A ESP32 **não** pode usar `127.0.0.1`. Anote o IP (`ipconfig getifaddr en0` no macOS).

## Provedores

| Serviço | Padrão | Plano B |
| --- | --- | --- |
| Claude | Keychain / `~/.claude/.credentials.json` | token colado no painel |
| Cursor | `state.vscdb` (macOS/Linux/Windows) | JWT colado |
| OpenRouter | — | API key no painel |
| DeepSeek | — | API key no painel |

Múltiplas contas por provedor. Sem cache: cada `GET /usage` chama as APIs (cuidado com 429 no Claude; poll padrão 60 s).

## Layout do repo

| Pasta | Papel |
| --- | --- |
| [`firmware/`](firmware/) | Sketch PlatformIO + Wokwi |
| [`backend/`](backend/) | FastAPI, OpenAPI |
| [`frontend/`](frontend/) | Vite + React + TypeScript |
| [`docs/`](docs/) | Arquitetura, contrato JSON, hardware |
| [`./dev`](dev) | Único script de desenvolvimento |

## Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md) e [SECURITY.md](SECURITY.md).
