# Vigia AI

Painel de mesa: **ESP32 + TFT 3,5" com touch** mostra os **limites de uso** das assinaturas **Claude** e **Cursor**, em **várias telas** (início, detalhe Claude, detalhe Cursor, info).

A placa não guarda senha nem token. Um **coletor Python no Mac** lê o login que você já tem no Claude Code / Cursor (ou um `.env` interno), chama as APIs autenticadas e publica um JSON na rede local. A ESP32 só faz GET e desenha barras.

Documentação completa para humanos e para agentes de IA: pasta **[`docs/`](docs/README.md)** — comece por [`docs/CONTEXTO_IA.md`](docs/CONTEXTO_IA.md) e [`docs/PLANO.md`](docs/PLANO.md).

## Como funciona

```
Mac (collector/server.py :8787)
    lê OAuth Claude + JWT Cursor
    GET/POST nas APIs das assinaturas
    GET /usage  →  JSON (percentuais, reset)

ESP32 + ILI9488 + touch
    Wi-Fi  →  GET /usage  →  Inicio (cards) / detalhe / Info
```

No simulador **Wokwi** a placa fala com o **mesmo coletor** do Mac, via Wi-Fi simulada + um gateway de rede local (`wokwigw`) — não é mock.

## O que você precisa

1. ESP32 Dev Module + TFT SPI 3,5" (ILI9488 na maioria das 3,5")
2. Mac na **mesma Wi-Fi**, com Claude Code e Cursor já logados (ou tokens no `.env`)
3. [PlatformIO Core](https://platformio.org/) (`brew install platformio`)
4. Python 3 (já vem no macOS)
5. Extensão Wokwi no Cursor/VS Code — só se for simular

## Subir o coletor (Mac)

```bash
cd collector
cp .env.example .env    # opcional
python3 server.py
```

Confira:

```bash
curl -s http://127.0.0.1:8787/usage | python3 -m json.tool
```

Anote o IP do Mac na LAN (`ipconfig getifaddr en0`). A ESP32 **não** pode usar `127.0.0.1`.

Libere a porta **8787** no firewall para a rede local. Detalhes: [`docs/COLETOR.md`](docs/COLETOR.md).

Tokens (não vão para a placa):

| Serviço | Padrão |
| --- | --- |
| Claude | `~/.claude/.credentials.json` |
| Cursor | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |

Override no `collector/.env`: `CLAUDE_OAUTH_TOKEN`, `CURSOR_ACCESS_TOKEN`, `OPENROUTER_API_KEY`.

## Firmware na placa

```bash
cp src/secrets.h.example src/secrets.h
```

Edite SSID, senha e `USAGE_URL` (`http://SEU_IP:8787/usage`). `src/secrets.h` está no `.gitignore`.

```bash
./dev.sh                # helper: pergunta Wokwi ou placa
```

Equivalente: `pio run -e esp32dev -t upload` e `pio device monitor -b 115200`.

Pinos da TFT, **touch** e ILI9486 vs 9488: [`docs/HARDWARE.md`](docs/HARDWARE.md) e [`docs/TOUCH.md`](docs/TOUCH.md).

Ligue o XPT2046: `T_CS` no GPIO **21**, `T_IRQ` no **22**, CLK/MOSI/MISO iguais aos da tela. Na tela **Info**, use **Calibrar touch**.

## Simular (Wokwi)

O simulador precisa do coletor **e** de um gateway de rede local rodando (senão os cards mostram `coletor HTTP -1`):

```bash
./dev-wokwi.sh
```

Sobe os dois juntos (`Ctrl+C` encerra). Depois:

```bash
./dev.sh                # escolha Wokwi no helper
```

`Cmd+Shift+P` → **Wokwi: Start Simulator**. Tela 240×320 (ILI9341); a 3,5" física é 480×320. Detalhes do gateway: [`docs/FIRMWARE.md`](docs/FIRMWARE.md#rede-no-wokwi-wokwigw).

O Wokwi não simula o painel resistivo: use os botões **Prev** / **Prox** (Início ↔ Info) ou, no serial, `n` `p` `0` `1` `2` `3` `4`.

## Ambientes PlatformIO

| Ambiente | Uso | Driver | Rede |
| --- | --- | --- | --- |
| `esp32dev` | Placa real 3,5" | ILI9488 320×480 | Wi-Fi + coletor |
| `wokwi` | Simulador | ILI9341 240×320 | Wi-Fi simulada + coletor via `wokwigw` |

`pio run` gera os dois. TFT_eSPI só via `build_flags` (`USER_SETUP_LOADED=1`).

## Arquivos

| Caminho | Função |
| --- | --- |
| `collector/server.py` | Servidor HTTP das cotas (sem cache, sempre em tempo real) |
| `collector/providers/` | Busca + parse por provedor (`claude.py`, `cursor.py`) |
| `collector/formatting.py` | Datas (BRT) e percentuais/centavos |
| `collector/cursor_state.py` | Leitura do `state.vscdb` do Cursor |
| `src/main.cpp` | `setup()`/`loop()`, mock de boot |
| `src/usage_client.cpp` | Wi-Fi, GET e parse do JSON de `/usage` |
| `src/ui.cpp` | Controlador: navegação, toque, redesenho |
| `src/ui_views.cpp` | Pintura das views (sem barra inferior) |
| `src/ui_format.cpp` | Widgets: barra, botão, formatação de texto |
| `src/input.cpp` | Touch, botões, serial |
| `src/secrets.h.example` | Wi-Fi e URL |
| `docs/` | Plano, APIs, touch, contexto de IA |
| `diagram.json` | Circuito Wokwi (+ botões) |
| `dev.sh` | Helper: pergunta Wokwi ou placa e dispara o fluxo |
| `dev-wokwi.sh` | Sobe coletor + `wokwigw` juntos pro simulador |

## Tela (touch)

- **Inicio:** três cards; Claude e Cursor com as duas barras principais; toque abre o detalhe
- **Claude:** sessão 5h, semana, Sonnet/Opus se o plano tiver; detalhe com scroll
- **Cursor:** plano, ciclo, duas barras, on-demand; detalhe com scroll
- **OpenRouter:** créditos da conta; detalhe com scroll
- **Info:** rede, atualizar agora, calibrar touch (ícone **i** no header)
- Header: **VIGIA AI** volta ao início; **i** abre Info; toque no meio/selo atualiza. Sem abas embaixo.
- Deslize horizontal alterna Início ↔ Info; verde &lt; 70%, laranja &lt; 90%, vermelho no resto
- Falha de um serviço aparece só naquele card

Contrato do JSON: [`docs/CONTRATO_JSON.md`](docs/CONTRATO_JSON.md).

## APIs

São as **mesmas da assinatura** (OAuth / JWT local), não a API paga por token. Não são estáveis como produto oficial; o coletor isola a quebra. Ver [`docs/APIS_CLAUDE.md`](docs/APIS_CLAUDE.md) e [`docs/APIS_CURSOR.md`](docs/APIS_CURSOR.md).

Coletor sem cache: cada `GET /usage` busca dado em tempo real. O endpoint do Claude rate-limita se martelado — reduza o poll (`USAGE_POLL_MS`) se aparecer `HTTP 429` no card do Claude. Detalhes: [`docs/COLETOR.md`](docs/COLETOR.md#sem-cache--cuidado-com-rate-limit).
