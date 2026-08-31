# Contexto para agentes de IA

Leia este arquivo **antes** de alterar o repositório. Complementos:

| Arquivo | Quando usar |
| --- | --- |
| [PLANO.md](PLANO.md) | Escopo, fases, o que já está feito |
| [ARQUITETURA.md](ARQUITETURA.md) | Coletor ↔ ESP32 ↔ APIs |
| [CONTRATO_JSON.md](CONTRATO_JSON.md) | Formato de `/usage` (não quebrar o firmware) |
| [APIS_CLAUDE.md](APIS_CLAUDE.md) | OAuth usage da Anthropic |
| [APIS_CURSOR.md](APIS_CURSOR.md) | Dashboard Connect RPC do Cursor |
| [HARDWARE.md](HARDWARE.md) | Placa, pinos, drivers TFT |
| [TOUCH.md](TOUCH.md) | Views, XPT2046, calibração, Wokwi |
| [COLETOR.md](COLETOR.md) | Como rodar e autenticar o servidor local |
| [FIRMWARE.md](FIRMWARE.md) | PlatformIO, Wokwi, `secrets.h` |
| [DECISOES.md](DECISOES.md) | Por que as escolhas atuais |

## O que é este projeto

Painel de mesa: **ESP32 + TFT 3,5" touch** mostra cotas das assinaturas **Claude** e **Cursor**, com **várias telas**. A placa **não** guarda tokens. Um **coletor Python no Mac** lê credenciais locais (ou `.env`), chama as APIs autenticadas e serve JSON na LAN. O firmware faz HTTP GET nesse JSON e desenha a UI.

Idioma da UI e da documentação: **português (Brasil)**. Código (identificadores) em inglês.

## Regras para quem gera código

1. **Tokens nunca vão no firmware**, no `diagram.json`, nem em commit. Só `collector/.env` (gitignored) ou arquivos locais do Claude/Cursor.
2. **Não altere o contrato JSON** sem atualizar `docs/CONTRATO_JSON.md` **e** o parser em `src/main.cpp`.
3. Endpoints de cota são **não oficiais**. Trate 401/429/HTML como falha de um provedor; o outro deve continuar `ok` se possível.
4. Cache **≥ 5 minutos** no coletor para Claude (`/api/oauth/usage` rate-limita).
5. Ambiente **Wokwi**: Wi-Fi simulada + coletor real via `wokwigw` (`docs/ARQUITETURA.md#fluxo-wokwi`), igual ao **esp32dev** (Wi-Fi + HTTP real). `MOCK_USAGE` existe no código mas nenhum env compila com ele hoje — não presumir dados fictícios no simulador.
6. GPIO **2** é `TFT_DC`. Não usar como LED de heartbeat.
7. Não commitar `.env`, `src/secrets.h` com senha real, nem dumps de `state.vscdb` / `.credentials.json`.
8. Touch: XPT2046 no hardware (`TOUCH_CS`); Wokwi usa FT6206 no `board-ili9341-cap-touch` (I2C 21/22) e botões GPIO 13/5. Não trocar o controlador da placa real.
9. Não expandir escopo (GPT, MQTT) sem o usuário pedir.

## Mapa de arquivos que importam

```
collector/server.py      # HTTP :8787, Claude + Cursor, cache
src/main.cpp             # Wi-Fi, JSON, loop
src/ui.cpp               # 4 views + abas
src/input.cpp            # touch / botões / serial
src/secrets.h.example
platformio.ini
diagram.json
```

## Como validar

- Coletor: `python3 collector/server.py` e `curl -s http://127.0.0.1:8787/usage`
- Firmware simulado: `./dev-wokwi.sh` (sobe coletor + `wokwigw`), `pio run -e wokwi`, depois Wokwi Simulator
- Hardware: `src/secrets.h` preenchido, `pio run -e esp32dev -t upload`

## Tom

Explicar de forma direta. Usuário pode não conhecer embedded; não assumir jargão sem uma linha de contexto.
