# Contexto para agentes de IA

Leia este arquivo **antes** de alterar o repositório. Complementos:

| Arquivo | Quando usar |
| --- | --- |
| [ARQUITETURA.md](ARQUITETURA.md) | Coletor ↔ ESP32 ↔ APIs |
| [CONTRATO_JSON.md](CONTRATO_JSON.md) | Formato de `/usage` (não quebrar o firmware) |
| [APIS_CLAUDE.md](APIS_CLAUDE.md) | OAuth usage da Anthropic |
| [APIS_GPT.md](APIS_GPT.md) | OAuth usage do Codex / ChatGPT |
| [APIS_CURSOR.md](APIS_CURSOR.md) | Dashboard Connect RPC do Cursor |
| [APIS_OPENROUTER.md](APIS_OPENROUTER.md) | Créditos da key OpenRouter |
| [APIS_DEEPSEEK.md](APIS_DEEPSEEK.md) | Saldo da key DeepSeek |
| [HARDWARE.md](HARDWARE.md) | Placa, pinos, drivers TFT |
| [TOUCH.md](TOUCH.md) | Views, XPT2046, calibração, Wokwi |
| [BACKEND.md](BACKEND.md) | Como rodar o FastAPI |
| [FRONTEND.md](FRONTEND.md) | Painel e mostrador React |
| [FIRMWARE.md](FIRMWARE.md) | PlatformIO, Wokwi, `secrets.h` |
| [DECISOES.md](DECISOES.md) | Por que as escolhas atuais |
| [PLANO.md](PLANO.md) | Escopo do protótipo (histórico) |

## O que é este projeto

**Vigia AI**: painel de mesa — **ESP32 + TFT 3,5" touch** mostra cotas das assinaturas **Claude**, **GPT** (ChatGPT / Codex), **Cursor**, **OpenRouter** e **DeepSeek**. A placa **não** guarda tokens. Um **coletor FastAPI** no host lê credenciais locais (ou `backend/data/config.json`), chama as APIs e serve JSON na LAN. Firmware e `/display` escutam `GET /events` (SSE). `GET /usage` é o mesmo JSON, na hora. O frontend React é o painel (`/`) e o mostrador (`/display`).

Idioma da UI e da documentação: **português (Brasil)**. Código (identificadores) em inglês.

## Regras para quem gera código

1. **Tokens nunca vão no firmware**, no `diagram.json`, nem em commit. Só `backend/data/config.json` (gitignored) ou arquivos locais do Claude/Cursor.
2. **Não altere o contrato JSON** sem atualizar `docs/CONTRATO_JSON.md`, os modelos Pydantic em `backend/app/schemas.py` **e** o parser em `firmware/src/net/parse.cpp`.
3. Endpoints de cota são **não oficiais**. Trate 401/429/HTML como falha de um provedor; o outro deve continuar `ok` se possível.
4. **Um ciclo de APIs no coletor**: o hub consulta os provedores a cada `USAGE_INTERVAL_S` (padrão 60 s) e empurra o JSON por `GET /events` (SSE). `GET /usage` força um ciclo extra e avisa os inscritos. Não volte ao poll por cliente (placa + cada aba de `/display`).
5. Ambiente **Wokwi**: Wi-Fi simulada + coletor real via `wokwigw`. Mock só como flag no painel.
6. GPIO **2** é `TFT_DC`. Não usar como LED de heartbeat.
7. Não commitar `backend/data/config.json`, `firmware/src/secrets.h` com senha real, nem dumps de `state.vscdb` / `.credentials.json`.
8. Touch: XPT2046 no hardware (`TOUCH_CS`); Wokwi usa FT6206. Não trocar o controlador da placa real.
9. Não expandir escopo (Gemini, Copilot, MQTT) sem o usuário pedir.

## Mapa de arquivos

```
backend/app/main.py           FastAPI, Swagger /docs
backend/app/schemas.py        contrato OpenAPI
backend/app/providers/        claude, gpt, cursor, openrouter, deepseek
backend/app/local/            Keychain, credentials, state.vscdb, auth.json (Codex)
frontend/src/pages/Panel.tsx   configuração
frontend/src/pages/Display.tsx mostrador (SSE GET /events)
firmware/src/                  sketch ESP32 (`core/` `net/` `input/` `ui/`)
firmware/platformio.ini
./dev                          único script
```

## Como validar

- `./dev up` — painel em http://127.0.0.1:5173/ ; Swagger em http://127.0.0.1:8787/docs
- `./dev test`
- `./dev wokwi` e Wokwi: Start Simulator
- Hardware: `firmware/src/secrets.h` + `./dev firmware flash`
