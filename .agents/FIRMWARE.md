# Firmware (PlatformIO)

Guia operacional do firmware ESP32 do Vigia AI. Para o guia técnico completo (pinout detalhado, fluxo SSE, troubleshooting): [`firmware/README.md`](../firmware/README.md).

Código em `firmware/`. **Dois ambientes, um sketch** (`firmware/src/main.cpp`):

| Env | Quando usar | Display | Touch | Wi-Fi |
|---|---|---|---|---|
| `esp32dev` | placa física | ILI9488 320×480 (paisagem 480×320) | XPT2046 `TOUCH_CS=33` | real (`secrets.h`) |
| `wokwi` | simulador | ILI9341 240×320 (paisagem 320×240) | FT6206 I2C | simulada `Wokwi-GUEST` |

> Detalhes de pinos e BOM: [`HARDWARE.md`](HARDWARE.md). Views/gestos/serial: [`TOUCH.md`](TOUCH.md). Contrato JSON: [`CONTRATO_JSON.md`](CONTRATO_JSON.md).

## Comandos

```bash
./dev firmware build    # compila esp32dev (pio run -e esp32dev)
./dev firmware wokwi    # compila wokwi (pio run -e wokwi)
./dev firmware flash    # grava esp32dev na placa (pio run -e esp32dev -t upload); o painel /display/setup faz o mesmo
./dev firmware monitor  # serial 115200 baud
./dev wokwi             # coletor + gateway wokwigw + build wokwi (atalhos: simulador, sim)
./dev up                # coletor :8788 (dev, ver DESKTOP.md) + frontend :5173 (precisa estar na mesma LAN da placa)
```

`wokwi.toml` e `diagram.json` na **raiz** apontam para `firmware/.pio/build/wokwi/…` para a extensão Wokwi no workspace. Cópias existem em `firmware/` se você abrir só essa pasta.

## Segredos Wi-Fi (`secrets.h`)

O painel **Placa e rede** (`/display/setup`) preenche o que puder (SSID da Wi-Fi deste computador, `USAGE_URL` com o IP LAN) e grava `firmware/src/secrets.h`. A senha da rede você digita uma vez — fica em `backend/data/config.json` (gitignored) e no `secrets.h`. No **app instalado (Brew)** não vem a pasta `firmware/`: **Baixar firmware** puxa o tarball da **tag desta versão** (`vX.Y.Z`) no GitHub (se a tag não existir, cai no `main`) e instala em `COLLECTOR_DATA/firmware` (no Mac: `~/Library/Application Support/vigia-ai-desktop/data/firmware`). Depois do primeiro download o botão passa a **Atualizar firmware** — a pasta antiga não acompanha o `brew upgrade` sozinha; se a tag baixada for diferente da versão do app, o painel avisa. O `secrets.h` (Wi-Fi) é preservado. **Gravar na ESP32** chama o mesmo `pio run -e esp32dev -t upload` do comando abaixo — ainda precisa do PlatformIO (`pio`) neste computador. Continua valendo o fluxo manual:

```bash
cp firmware/src/secrets.h.example firmware/src/secrets.h
# edite WIFI_SSID, WIFI_PASSWORD e USAGE_URL
```

```cpp
#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"
#define USAGE_URL "http://192.168.1.10:8787/usage"  // IP LAN do host, nunca 127.0.0.1
```

- `USAGE_URL` sempre termina em `/usage` — o firmware deriva `/events` sozinho (SSE). `GET /health` descobre `panel_lan` para o QR da tela Sistema.
- Arquivo **gitignored** — nunca commitar com senha real.
- No Wokwi não precisa: `USAGE_URL="http://host.wokwi.internal:8787/usage"`.
- IP LAN no macOS: `ipconfig getifaddr en0`.
- `8787` aqui é de propósito: é a porta fixa (app instalado / `./dev up` com `VIGIA_DEV_PORT=8787`). Se você aponta a placa/Wokwi pro coletor de dev "solto" (`./dev up` sem essa variável, que sobe em `:8788`), troque a porta no `USAGE_URL` também.

## Ambientes e `platformio.ini`

`firmware/platformio.ini` (ver comentários no arquivo):

- `[env]` comum: `board=esp32dev`, `framework=arduino`, `monitor_speed=115200`, `board_build.partitions = huge_app.csv`.
- **Partição `huge_app.csv`**: sem OTA, ~3 MB para o app. Necessária porque a mineração (Stratum + SHA256) empurrou o binário para ~1,31 MB (97% da partição padrão). Trocar exige **Erase Flash** na próxima gravação de placa já gravada com layout antigo (offset do LittleFS muda; ver [`PLANO_MINERACAO.md`](PLANO_MINERACAO.md)).
- `lib_deps`: `TFT_eSPI` (display), `ArduinoJson` (parse), `QRCode`, `TJpg_Decoder`.
- `esp32dev`: `ILI9488_DRIVER`, `TFT_WIDTH=320/HEIGHT=480`, `MISO=12 MOSI=13 SCLK=14 CS=15 DC=2 RST=-1 BL=27`, `TOUCH_CS=33`, `SPI_FREQUENCY=27MHz`, `USAGE_POLL_MS=60000`.
- `wokwi`: `ILI9341_DRIVER`, `WOKWI_SIM=1`, `BTN_PREV=13 BTN_NEXT=5`.

## Árvore de `src/`

Camadas no estilo do backend (`providers/`): cada pasta tem um papel, includes com caminho a partir de `src/` (`"ui/ui.h"`, `"net/usage_client.h"`).

```
src/
  main.cpp                 setup()/loop() — orquestra Wi-Fi, SSE, tema, mineração, câmeras
  secrets.h(.example)      Wi-Fi (copiar para secrets.h)
  version.h                FIRMWARE_VERSION → header X-Vigia-Firmware
  core/state.h             View (18 valores), UsageSnapshot, structs (MAX_ACCOUNTS=5)
  net/
    client.cpp             Wi-Fi + SSE GET /events + GET /usage (refresh) + painel LAN
    parse.cpp/.h           parseUsageJson(), asciiFold(), markAllAccountsFailed()
    usage_client.h         API pública do cliente de rede
    theme_server.cpp/.h    HTTP :80 (/theme, /theme/background, /theme/screenshot)
    mining_client.cpp/.h   config/report da mineração (só com VIEW_MINER)
    camera_client.cpp/.h   lista + live MJPEG + PTZ ONVIF (fora do contrato /usage)
    spotify_client.cpp/.h  poll 5 s do player (fora do ciclo de cotas)
  input/
    input.cpp/.h           inputBegin(), inputPoll()
    touch.cpp              XPT2046 (hardware) / FT6206 (Wokwi) + calibração NVS
    gestures.cpp           swipe, hold
    serial.cpp             comandos via Serial (n/p/0-9/l/g/t/a/i/h/u/d/r/c/s)
  ui/
    ui.h / internal.h      API pública + estado interno
    theme.cpp              paleta (DARK/LIGHT/CONTRAST) + 7 acentos + NVS "ui"
    customtheme.cpp/.h     tema custom VIEW_THEME: LittleFS (/theme.json + theme_bg.raw)
    nav.cpp                navegação, hit-test, paginador ‹ i/N ›, scroll
    layout.cpp / chrome.cpp / splash.cpp / labels.cpp / i18n.cpp
    widgets.cpp/.h         barras, ícones, texto
    views/                 home, claude, gpt, cursor, openrouter, deepseek, opencode,
                           fal, bitcoin, adsense, currencies, weather, status, now,
                           miner, cameras (+ camera live)
  assets/icons/            ícones dos provedores
  mining/
    mining_task.cpp        orquestra Stratum + hash worker (só no core 0, com VIEW_MINER)
    stratum_client.cpp     protocolo Stratum
    nerd_sha256.cpp        SHA-256d software
```

Ver `firmware/src/main.cpp:35-118` para o `loop()` completo e `firmware/src/core/state.h` para `View`/`UsageSnapshot`.

## Rede — Wi-Fi + SSE

- `usageClientEnsureWifi()` conecta/reconecta a cada 15 s; loga `ip`/`rssi`.
- `usageEventsUrl()` troca `/usage` → `/events`. Headers: `X-Vigia-Device: esp32`, `X-Vigia-Screen: WxH`, `X-Vigia-Firmware`.
- **SSE** (`net/client.cpp:157-402`): HTTP/1.0, `Accept: text/event-stream`. Eventos:
  - `event: usage` → `parseUsageJson()` → `uiRefreshData()`.
  - `event: theme` → reload do tema se `VIEW_THEME` ativa (debounce 1,5 s).
  - `: ping` ignorado. Idle `SSE_IDLE_MS = 60 s + 30 s` reconecta; retry exponencial 2→30 s.
- `GET /usage` só no **refresh manual** (botão da UI ou `r` no Serial) — `usageClientFetch()`.
- Falha total (HTTP ≠200 / JSON inválido / sem Wi-Fi) → `markAllAccountsFailed()` — mantém `id`/`label`/`count`, só marca `ok=false` (cards continuam visíveis com erro).

## UI — views e personalização

18 views (`core/state.h:6-37`): Início (grade/lista, até 5 cards, 1 por tipo de provedor), 13 detalhes de conta (com paginador `‹ i/N ›`), Sistema (rede/QR/layout/tema/cor/idioma/barra/calibrar/atualizar), Relógio, Tema custom (`VIEW_THEME` tela cheia), Mineração, Câmeras.

Personalização em NVS `ui` (`ui/theme.cpp`): `home` (LIST/GRID, padrão GRID), `theme` (DARK/LIGHT/CONTRAST), `accent` (7 cores, padrão RED), `lang` (PT/EN/ES), `edge` (LEFT/TOP/RIGHT/BOTTOM), `cs` (blob de tamanhos `CARD_SM`…`CARD_WXL` por View).

## Tema personalizado (protótipo)

A placa escuta HTTP na **porta 80** para receber o tema montado em `/display/theme` (ver [`CONTRATO_TEMA.md`](CONTRATO_TEMA.md)):

| Rota | Método | Descrição |
|---|---|---|
| `/theme` | GET/DELETE | consulta/apaga tema |
| `/theme/meta` | POST | JSON do tema (≤8 KB) |
| `/theme/background` | POST | imagem `bg` (RAW RGB565, `w*h*2` bytes) |
| `/theme/screenshot` | GET | BMP da tela via `tft.readRectRGB()` |

Usa `WebServer.h` + `LittleFS.h` (já no core ESP32, sem `lib_deps` novo). Arquivos: `/theme.json` + `/theme_bg.raw` (~300 KB em 480×320). No Wokwi a porta 80 aparece em `127.0.0.1:8180` via `wokwi.toml:13-15` (`[[net.forward]]`).

## Mineração, câmeras e Spotify (protótipos)

- **Mineração** (`mining/`): portado de [NerdMiner_v2](https://github.com/BitMaker-hub/NerdMiner_v2) (MIT). Só minera com `VIEW_MINER` ativa — `uiSetView()` liga/desliga. Duas tasks no **core 0** (UI no core 1), cedem CPU para não desabilitar o watchdog. Config em `GET /api/mining/config`. Share de baixa dificuldade é o recibo do pool (igual ao NerdMiner), não um bloco; block height sempre `—`. Ver [`MINERACAO.md`](MINERACAO.md).
- **Câmeras** (`net/camera_client.cpp`): fora do contrato `/usage` — `GET /api/camera/cameras` + MJPEG/PTZ. Pausa o SSE na live para não estourar heap.
- **Spotify** (`net/spotify_client.cpp`): poll 5 s, fora do ciclo de cotas.

## Simulador Wokwi

```
Wokwi (Wokwi-GUEST) ──ws://localhost:9011──► wokwigw (.tools/wokwigw) ──► coletor :8787
        host.wokwi.internal:8787
```

1. `./dev wokwi` baixa `wokwigw` (v2.0.1), sobe gateway `:9011`, compila `wokwi`, sobe coletor se preciso.
2. No VS Code: `Cmd+Shift+P` → **Wokwi: Start Simulator** — deve aparecer `Client connected`.
3. Toque: clique no display (FT6206). Botões: `Prev` (13) / `Prox` (5).

O display no Wokwi é **ILI9341 320×240** (não 480×320) — mesma lógica, só menor. A tarja preta à esquerda é o conector da peça.

## Dicas e armadilhas

- **GPIO 2 = `TFT_DC`** — nunca use como LED de heartbeat (corrompe SPI).
- **Touch fantasma/invertido** → recalibre em Sistema → Calibrar (4 cantos) ou confira `TOUCH_CS` vs fiação.
- **Heap**: não mantenha SSE + MJPEG juntos — firmware já pausa SSE em `VIEW_CAMERA(S)`.
- **Cards somem** → array `[]`/`null` no JSON = conta oculta no painel (interruptor “Mostrar na placa”).
- **Antes do primeiro SSE OK** `g_snap.*Count == 0` — Início vazia por alguns segundos é normal.
- Logs no Serial 115200: `tft WxH`, `Wi-Fi conectado ip=...`, `coletor SSE: conectando .../events`, `usage sse-ok`.
