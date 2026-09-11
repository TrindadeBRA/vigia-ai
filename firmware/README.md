# Firmware — ESP32 + TFT 3,5" touch

Guia técnico completo da placa do **Vigia AI**. O mesmo sketch roda no hardware real e no simulador Wokwi — muda só o ambiente do PlatformIO.

> Leitura complementar: [`.agents/FIRMWARE.md`](../.agents/FIRMWARE.md) (resumo rápido), [`.agents/HARDWARE.md`](../.agents/HARDWARE.md) (pinos e BOM), [`.agents/TOUCH.md`](../.agents/TOUCH.md) (views e gestos), [`.agents/CONTRATO_JSON.md`](../.agents/CONTRATO_JSON.md) (formato de `/usage`/`/events`) e [`.agents/ARQUITETURA.md`](../.agents/ARQUITETURA.md) (fluxo coletor ↔ placa).

## Resumo em 30 s

- **Placa real:** ESP32 Dev Module + TFT SPI **ILI9488 320×480** integrada (modelo `ESP32-2432` / `ESP32-3248S035`-compatível), touch **XPT2046** (`TOUCH_CS=33`).
- **Simulador:** mesma lógica, display **ILI9341 240×320** (`board-ili9341-cap-touch`, FT6206 I2C) + Wi-Fi virtual até o **coletor real** via `wokwigw`.
- **Rede:** Wi-Fi → `GET /events` (SSE) a cada ~60 s. Tokens **nunca** vão para a placa — só percentuais/datas já normalizadas pelo coletor (`backend/src/hub.ts`).
- **UI:** Início (grade/lista), 13 detalhes de conta, Sistema, Relógio, Tema custom, Mineração e Câmeras.

---

## 1. Pré-requisitos

| Ferramenta | Versão | Notas |
|---|---|---|
| [PlatformIO Core](https://platformio.org/install/cli) (`pio`) | ≥ 6 | `pip install platformio` ou instalador oficial. O repo usa `platform = espressif32` + `framework = arduino`. |
| Coletor local | Node 22 LTS | Precisa estar na **mesma LAN** que a placa. Sobe com `./dev up` (`:8787`). |
| Driver USB-serial | CH340 / CP210x | Conforme sua DevKit. No macOS costuma ser plug-and-play. |

Verifique:

```bash
pio --version
node --version  # v22.x
```

---

## 2. Hardware — o que comprar

**BOM v1 (placa integrada recomendada):**

- **ESP32-2432** (Shenzhen Changcai Intelligent) — ESP32-WROOM + TFT SPI **3,5" 320×480 ILI9488** já soldada, com touch resistivo 4 fios. É o modelo usado nas `build_flags` atuais. Alternativa com ILI9486: troque `ILI9488_DRIVER` por `ILI9486_DRIVER` em `platformio.ini`.
- Fonte 5 V estável no USB da ESP32; VCC do painel em **3V3** (como no Hello World da placa integrada).
- Cabo USB de dados (não só de carga).

> Se você já tem um conjunto **avulso** (ESP32 DevKit C + TFT 3,5" SPI solta), ele ainda funciona — só muda o pinout (ver §3.1). A placa integrada é o caminho com menos solda.

---

## 3. Pinout e definição de display

### 3.1 Placa integrada ESP32-2432 (env `esp32dev` atual)

É o que está em `firmware/platformio.ini:31-58` — confirmado no esquemático do fornecedor:

| Sinal | GPIO | Notas |
|---|---|---|
| `TFT_MISO` | **12** | leitura de screenshot via `tft.readRectRGB()` |
| `TFT_MOSI` | **13** | |
| `TFT_SCLK` | **14** | |
| `TFT_CS` | **15** | |
| `TFT_DC` | **2** | **Compartilha o LED onboard — firmware não pisca o LED** |
| `TFT_RST` | **-1** | sem GPIO dedicado — reset geral da placa |
| `TFT_BL` | **27** | backlight via MOSFET, `TFT_BACKLIGHT_ON=HIGH` |
| `TOUCH_CS` | **33** | XPT2046 CS |
| `TOUCH_IRQ` | — | não usado nesta placa (touch por polling) |

Resolução: `TFT_WIDTH=320`, `TFT_HEIGHT=480`, `setRotation(1)` → **480×320 em paisagem**. SPI a 27 MHz.

### 3.2 Wiring “solto” legado (ESP32 + TFT avulsa)

Documentado em [`.agents/HARDWARE.md`](../.agents/HARDWARE.md) para quem já tem o kit avulso:

| Sinal | GPIO | Display |
|---|---|---|
| MISO / T_DO | 19 | MISO / SDO |
| MOSI / T_DIN | 23 | MOSI / SDI |
| SCLK / T_CLK | 18 | SCK |
| TFT CS | 15 | CS |
| TFT DC | 2 | DC / RS |
| TFT RST | 4 | RST |
| T_CS | 21 | touch CS |
| T_IRQ | 22 | opcional |

> Se sua placa física usa outros pinos, edite `TOUCH_CS`/`TOUCH_IRQ` e os `TFT_*` no `env:esp32dev`. Recalibre o touch em seguida (Sistema → Calibrar).

### 3.3 Wokwi (env `wokwi`)

O simulador não tem ILI9488 — usa `board-ili9341-cap-touch` (FT6206 I2C, toque capacitivo) + ILI9341 240×320:

| Sinal | GPIO |
|---|---|
| MOSI | 23 |
| MISO | 19 |
| SCK | 18 |
| CS | 15 |
| DC | 2 |
| RST | 4 |
| SDA/SCL (touch) | 21 / 22 |
| BTN_PREV / NEXT | 13 / 5 |

`rotate: 90` na peça + `setRotation(1)` → **320×240 em paisagem** (mesma orientação do hardware, só menor).

---

## 4. Ambientes PlatformIO

`firmware/platformio.ini:1-87` define dois ambientes a partir de um único `src/main.cpp`:

| Env | `board` | Display | Touch | Wi-Fi | Partição |
|---|---|---|---|---|---|
| `esp32dev` | `esp32dev` | ILI9488 320×480 | XPT2046 (`TOUCH_CS=33`) | real (`secrets.h`) | `huge_app.csv` (~3 MB app, sem OTA) |
| `wokwi` | `esp32dev` | ILI9341 240×320 | FT6206 I2C | simulada (`Wokwi-GUEST`) | `huge_app.csv` |

**Dependências** (`lib_deps`):

- `bodmer/TFT_eSPI` — driver da TFT
- `bblanchon/ArduinoJson` — parser do contrato JSON
- `ricmoo/QRCode` — QR do painel na tela Sistema
- `bodmer/TJpg_Decoder` — JPEG de wallpapers/câmera

**Por que `huge_app.csv`?** A mineração (Stratum + SHA256 + STL) empurrou o binário para ~1,31 MB — 97% da partição padrão. Sem OTA (não usado aqui) sobra ~3 MB para o app. Trocar de esquema exige **Erase Flash** na próxima gravação de uma placa já gravada com o layout antigo (o offset do LittleFS muda; ver `platformio.ini:9-16` e [`.agents/PLANO_MINERACAO.md`](../.agents/PLANO_MINERACAO.md)).

---

## 5. Configuração de Wi-Fi — `secrets.h`

```bash
cp firmware/src/secrets.h.example firmware/src/secrets.h
# edite:
#   WIFI_SSID, WIFI_PASSWORD
#   USAGE_URL = http://IP-DA-SUA-MAQUINA:8787/usage
```

```cpp
// firmware/src/secrets.h
#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"
#define USAGE_URL "http://192.168.1.10:8787/usage"
```

Regras:

- `USAGE_URL` **deve ser o IP LAN do computador que roda o coletor**, nunca `127.0.0.1`/`localhost` — a ESP32 não alcança o loopback do host.
- Descubra o IP: `ipconfig getifaddr en0` (macOS) ou `hostname -I` (Linux).
- O firmware deriva `GET /events` trocando o sufixo `/usage` → `/events` (ver `firmware/src/net/client.cpp:135-154`). Você sempre grava `/usage`.
- O arquivo é **gitignored** — nunca commitar com senha real.
- No **Wokwi** você não precisa de `secrets.h`: o env define `WIFI_SSID="Wokwi-GUEST"` e `USAGE_URL="http://host.wokwi.internal:8787/usage"` (resolve via `wokwigw`).

> Na tela **Sistema** a placa mostra `g_netLine` (SSID + IP) e um **QR code** com `panel_lan` (obtido em `GET /health` → `http://IP:8787/`). Qualquer aparelho na mesma Wi-Fi escaneia e abre o painel. No Wokwi o IP da placa (`10.13.37.2`) não é a URL do painel.

---

## 6. Compilar, gravar e monitorar

Via `pio` direto:

```bash
pio run -e esp32dev          # compila hardware
pio run -e esp32dev -t upload  # grava
pio device monitor -b 115200  # log serial
```

Via script `dev` (atalhos):

```bash
./dev firmware build    # = pio run -e esp32dev
./dev firmware wokwi    # = pio run -e wokwi (só compila)
./dev firmware flash    # = pio run -e esp32dev -t upload (+ aviso se secrets.h faltar)
./dev firmware monitor  # monitor 115200 baud
./dev wokwi             # coletor + gateway + build wokwi (ver §7)
```

Checklist de primeira gravação:

1. `cp firmware/src/secrets.h.example firmware/src/secrets.h` e preencha.
2. Conecte a placa via USB, selecione a porta (PlatformIO detecta; se não, `pio device list`).
3. Se a placa já tinha firmware com partição padrão, faça **Erase Flash** uma vez (PlatformIO → Erase, ou `esptool.py erase_flash`).
4. `./dev firmware flash` — aguarde `SUCCESS`.
5. `pio device monitor -b 115200` — deve aparecer `=== VIGIA AI hardware (SSE) ===` + `Wi-Fi conectado ip=...`.

---

## 7. Simulador Wokwi

Mesmo sketch, Wi-Fi simulada, **coletor real** (mesmo JSON do hardware).

### 7.1 Como funciona

```
Wokwi (Wi-Fi Wokwi-GUEST) ──ws://localhost:9011──► wokwigw (binário .tools/wokwigw)
        │  host.wokwi.internal:8787                     │
        └──────────────────────────────────────────────► coletor Fastify :8787 (./dev up)
```

- `wokwi.toml:7` → `[net] gateway = "ws://127.0.0.1:9011"`.
- `diagram.json` na raiz e em `firmware/` precisam apontar para `firmware/.pio/build/wokwi/firmware.bin` (já configurado).
- O forward `[[net.forward]] from="localhost:8180" to="target:80"` expõe a porta 80 da placa (servidor de tema) em `127.0.0.1:8180` no host — o editor `/display/theme` consegue falar com a placa simulada.

### 7.2 Passo a passo

```bash
./dev wokwi
# 1) baixa .tools/wokwigw se faltar (v2.0.1)
# 2) sobe gateway :9011
# 3) compila env wokwi
# 4) reusa ou sobe o coletor :8787 + build do frontend
```

No VS Code: `Cmd+Shift+P` → **Wokwi: Start Simulator** (ou clique no play da extensão). No terminal deve aparecer `Client connected` — se não, o Wokwi não está usando o gateway (verifique `wokwi.toml` no workspace aberto).

Toque no simulador: clique no display (FT6206). Botões físicos: `Prev` (GPIO 13) e `Prox` (GPIO 5) — mapeados em `platformio.ini:86-87`.

Dicas:

- O display no Wokwi é **ILI9341 320×240** — menor que a 3,5" física. A tarja preta à esquerda é o conector da peça, não pixel da UI.
- Para testar upload de tema no simulador, no campo “IP da placa” do editor use `127.0.0.1:8180`.

---

## 8. Arquitetura do firmware (`firmware/src/`)

```
src/
  main.cpp                 setup()/loop() — orquestra Wi-Fi, SSE, tema, mineração, câmera, UI
  secrets.h(.example)      Wi-Fi + USAGE_URL (gitignored)
  version.h                FIRMWARE_VERSION (enviado em X-Vigia-Firmware)
  core/state.h             View, UsageSnapshot, structs de conta (MAX_ACCOUNTS=5)
  net/
    client.cpp             Wi-Fi + SSE GET /events + GET /usage (refresh) + painel LAN + tema
    parse.cpp/.h           parseUsageJson(), asciiFold(), markAllAccountsFailed()
    usage_client.h         API pública do cliente de rede
    theme_server.cpp/.h    HTTP :80 da placa (/theme, /theme/background, /theme/screenshot)
    mining_client.cpp/.h   busca config do coletor + report (só com VIEW_MINER)
    camera_client.cpp/.h   lista/câmera live MJPEG + PTZ ONVIF (fora do contrato /usage)
    spotify_client.cpp/.h  estado do player Spotify (poll 5 s, fora do contrato)
  input/
    input.cpp/.h           orquestra touch/serial/gestos
    touch.cpp              XPT2046 (hardware) / FT6206 (Wokwi) + calibração NVS
    gestures.cpp           swipe horizontal/vertical, hold
    serial.cpp             comandos de teclado via Serial (debug)
  ui/
    ui.h / internal.h      API pública + estado interno
    theme.cpp              paleta (Escuro/Claro/Contraste) + acentos (7 cores) + NVS
    customtheme.cpp/.h     tema custom: LittleFS + render VIEW_THEME
    nav.cpp                navegação, hit-test, scroll, paginador de contas
    layout.cpp             header, geometria, chrome
    widgets.cpp/.h         barras, ícones, texto, countdown
    chrome.cpp / splash.cpp / labels.cpp / i18n.cpp
    views/                 uma tela por arquivo: home, claude, gpt, cursor, openrouter,
                           deepseek, opencode, fal, bitcoin, adsense, currencies,
                           weather, status (Sistema), now (Relógio), miner, cameras
    assets/icons/          ícones dos provedores
  mining/
    mining_task.cpp/.h     orquestra Stratum + hash worker (só no core 0)
    stratum_client.cpp/.h  protocolo Stratum
    nerd_sha256.cpp/.h     SHA-256d (software, sem acelerador)
    mining_math.cpp/.h     dificuldade, hash utils
    mining_log.cpp/.h      log circular
```

### 8.1 Fluxo de `main.cpp:35-118`

`setup()`: `tft.init()` → `uiInit()` (carrega NVS + tema custom) → `uiShowSplash()` → `inputBegin()` → `usageClientEnsureWifi()` → `themeServerBegin()` → `uiPaint()`.

`loop()` a cada ~20 ms:

1. Views especiais de câmera têm early-return (`VIEW_CAMERA`/`VIEW_CAMERAS`) — dispensam SSE para não estourar heap (SSE + MJPEG simultâneos = reset).
2. `inputPoll()` → `uiTickClock/ Eye/ Miner/ Camera` → `themeServerHandle()` → `miningTaskTick()` → `cameraClientPoll()` / `spotifyClientTick()`.
3. `usageClientEnsureWifi()` — conecta/reconecta a cada 15 s.
4. Se `g_requestRefresh` (botão da UI ou `r` no serial): `usageClientFetch()` (`GET /usage`).
5. `usageClientPoll()` (SSE) + `themeClientTick()` — exceto em `VIEW_CAMERAS`.

Variáveis globais (ver `state.h:260-271`): `g_snap` (snapshot), `g_view`, `g_netLine`, `g_panelUrl`, `g_lastFetchMs`, `g_hasFetchedOk`.

### 8.2 Rede — Wi-Fi + SSE

- `usageClientEnsureWifi()` (`net/client.cpp:471-512`): `WiFi.begin()` no SSID de `secrets.h` (ou `Wokwi-GUEST`), retry 15 s, loga `ip`/`rssi`, chama `refreshPanelUrl()`.
- `usageEventsUrl()` troca `/usage` → `/events`. Headers por requisição: `X-Vigia-Device: esp32`, `X-Vigia-Screen: WxH`, `X-Vigia-Firmware: 1.0.0`.
- **SSE** (`net/client.cpp:157-402`): `HTTPClient` em HTTP/1.0, `Accept: text/event-stream`, parser linha-a-linha. Eventos:
  - `event: usage` + `data: {json}` → `parseUsageJson()` → `usageClientLogSnapshot()` → `uiRefreshData()`.
  - `event: theme` → `g_pendingThemeReload = true` → `themeClientTick()` recarrega se `g_view == VIEW_THEME` (debounce 1,5 s).
  - `: ping` (comentário) ignorado; keep-alive.
- Idle: `SSE_IDLE_MS = USAGE_POLL_MS (60 s) + 30 s` → reconecta. Retry exponencial 2 s → 30 s.
- `GET /health` → descobre `panel_lan` para o QR (valida que é host LAN, não `localhost`/`.internal`).

Resiliência:

- HTTP ≠ 200 ou JSON inválido → `markAllAccountsFailed()` (mantém `id`/`label`/`count`, só marca `ok=false` — cards continuam visíveis com erro, em vez de sumirem).
- No boot, antes do primeiro `/events` OK, `g_snap.*Count == 0` — Início vazia por alguns segundos (normal).

### 8.3 Parser JSON (`net/parse.cpp`)

- `ArduinoJson` + `parseUsageJson(String body)`: preenche `g_snap` a partir de `CONTRATO_JSON.md`.
- Limites: `MAX_ACCOUNTS = 5` por provedor, `MAX_CURRENCY_ITEMS = 8`. Excedentes: `Serial.println("... mais contas do que MAX_ACCOUNTS, ignorando")`.
- `jsonFloatOrNeg()` devolve `-1` quando `null` (campo ausente = não desenha).
- `asciiFold()` converte UTF-8 (ex.: nome de música do Spotify) para ASCII aproximado — a fonte `2` da `TFT_eSPI` só cobre ASCII.
- `markAllAccountsFailed(msg)` propaga erro para todas as contas já conhecidas.

### 8.4 Servidor de tema na placa (`net/theme_server.cpp:1-184`)

HTTP **:80** (só LAN, `WebServer.h`):

| Rota | Método | Descrição |
|---|---|---|
| `/theme` | GET | `{width,height,active,fs_ok,theme}` — dimensões reais da tela |
| `/theme` | DELETE | `customThemeClearAll()` |
| `/theme/meta` | POST | JSON do tema (`≤ 8 KB`) → `customThemeApplyMeta()` |
| `/theme/background` | POST | multipart `bg` → LittleFS `theme_bg.raw` (stream 1 KB, sem buffer gigante) |
| `/theme/screenshot` | GET | BMP 24 bits lido via `tft.readRectRGB()` (debug) |

No host real o painel fala direto em `http://IP-DA-PLACA/theme/*`. No Wokwi, via `127.0.0.1:8180`.

### 8.5 Tema custom (`ui/customtheme.cpp`)

Persistido em **LittleFS** (`/theme.json` + `/theme_bg.raw`, ~300 KB em 480×320). `VIEW_THEME` é tela cheia sem header, com fundo + relógio + ícones com cota ao vivo. Recarregado por:

- botão “Recarregar” no header (`themeClientReload()` → `GET <coletor>/api/theme` + `GET /api/theme/background?w=&h=&...`),
- evento SSE `theme` (auto-reload só com `VIEW_THEME` ativa).

### 8.6 Mineração (`mining/`)

Portado de [NerdMiner_v2](https://github.com/BitMaker-hub/NerdMiner_v2) (MIT), só **VIEW_MINER** minera de fato:

- `uiSetView()` liga/desliga ao entrar/sair de `VIEW_MINER` (`net/mining_client.cpp`).
- Duas tasks no **core 0** (o `loopTask` roda no core 1): `MiningStratum` (12 KB stack, prio 2) + `MiningHash` (5 KB, prio 1). Cedem CPU (`vTaskDelay`) para não desabilitar o watchdog — diferente do NerdMiner original.
- Config remota via `GET /api/mining/config` no coletor; status em `POST /api/mining/report`. UI em `ui/views/miner.cpp` (`uiTickMiner()` a 1 Hz).
- Share de baixa dificuldade (`suggest_difficulty` 0.00015) é válido — recibo do pool, igual ao NerdMiner, não um bloco. Se o pool impuser dificuldade 1, shares quase não aparecem (~30 h a ~40 kH/s). Block height sempre `—`. Ver [`.agents/MINERACAO.md`](../.agents/MINERACAO.md).

### 8.7 Câmeras e Spotify

- **Câmeras** (`net/camera_client.cpp`): fora do contrato `/usage` — `GET /api/camera/cameras` + MJPEG/PTZ. Pausa o SSE enquanto a live está ativa (`usageClientPauseSse()`) para não estourar heap.
- **Spotify** (`net/spotify_client.cpp`): poll 5 s em `spotifyClientTick()`, também fora do ciclo de cotas.

---

## 9. UI — views, navegação e personalização

### 9.1 Views (`core/state.h:6-37`, `ui/nav.cpp`)

| View | Conteúdo | Scroll | Paginador |
|---|---|---|---|
| `VIEW_HOME` (0) | Início — até 5 cards, um por *tipo* de provedor (pior conta se houver N) | setas ↑↓ se não couber | — |
| `VIEW_CLAUDE` (1) | 5 h + semana + Sonnet/Opus | ↑↓ | `‹ i/N ›` |
| `VIEW_GPT` (5) | sessão + semana | ↑↓ | `‹ i/N ›` |
| `VIEW_CURSOR` (2) | plano, ciclo, barras, on-demand | ↑↓ | `‹ i/N ›` |
| `VIEW_OPENROUTER` (3) | barra + usado/resta/teto | ↑↓ | `‹ i/N ›` |
| `VIEW_DEEPSEEK` (4) | saldo | ↑↓ | `‹ i/N ›` |
| `VIEW_OPENCODE` (8) | rolling/week/month | ↑↓ | `‹ i/N ›` |
| `VIEW_FAL` (9) | saldo | ↑↓ | `‹ i/N ›` |
| `VIEW_BITCOIN` (10) | saldo + valor USD/BRL | ↑↓ | `‹ i/N ›` pix de carteira |
| `VIEW_ADSENSE` (12) | hoje + não pago | ↑↓ | `‹ i/N ›` |
| `VIEW_CURRENCIES` (13) | lista de moedas na moeda base | ↑↓ | — |
| `VIEW_WEATHER` (14) | clima Open-Meteo | ↑↓ | — |
| `VIEW_STATUS` (6) | Sistema — rede, QR, layout, tema, cor, idioma, barra, calibrar, atualizar | ↑↓ | — |
| `VIEW_NOW` (7) | Relógio + resumo | — | toque volta |
| `VIEW_THEME` (11) | Tema custom tela cheia | — | gatilho explícito |
| `VIEW_MINER` (15) | Mineração BTC | auto 1 Hz | swipe normal |
| `VIEW_CAMERAS` (16) | Lista de câmeras | — | card abre live |
| `VIEW_CAMERA` (17) | Live MJPEG + PTZ | — | — |

Navegação na **barra** (lado configurável: esq/topo/dir/base): título **VIGIA AI** → Início, **i** → Sistema, relógio → Agora. Swipe horizontal alterna Início ↔ Sistema; botões `Prev`/`Next` no Wokwi fazem o mesmo.

### 9.2 Personalização (NVS `ui`)

Persistida em `Preferences` (namespace `ui`), ver `ui/theme.cpp:159-335`:

| Chave | Valores | Padrão | Onde muda |
|---|---|---|---|
| `home` | `LIST` (0) / `GRID` (1) | `GRID` | Sistema → Início |
| `theme` | `DARK`/`LIGHT`/`CONTRAST` | `DARK` | Sistema → Tema |
| `accent` | 7 cores (0=vermelho) | `RED` | Sistema → Cor |
| `lang` | `PT`/`EN`/`ES` (0/1/2) | `PT` | Sistema → Idioma |
| `edge` | `LEFT`/`TOP`/`RIGHT`/`BOTTOM` | `LEFT` | Sistema → Barra |
| `cs` | blob `VIEW_COUNT` bytes | `CARD_MD` | gesto `s` / serial `1`-`5` |

Tamanhos: `CARD_SM(1×1)`, `CARD_MD(1×1)`, `CARD_LG(2×1)`, `CARD_XL(2×2)`, `CARD_WL(2×4)`, `CARD_WXL(4×4)` — `cardRectFor()` adapta a `cols`.

Paleta: `COL_BG`, `COL_CARD`, `COL_ACCENT` etc. em `ui/ui.h:6-18` (RGB565). `uiAccentColor()` por tema.

---

## 10. Entrada — touch, gestos e Serial

### 10.1 Touch

- **Hardware:** XPT2046 no mesmo SPI da TFT (`TOUCH_CS=33`), leitura por `TFT_eSPI`. Calibração em NVS `touch` — faça em Sistema → **Calibrar touch** (4 cantos). Se tocar fantasma/invertido, recalibre ou confira `TOUCH_CS`.
- **Wokwi:** FT6206 I2C (`board-ili9341-cap-touch`, 21=SDA/22=SCL). O chip entrega retrato 240×320; mapeamento `x = y_nativo`, `y = 239 - x_nativo` por causa de `rotate:90 + setRotation(1)`.

Arquivos: `input/touch.cpp`, `input/gestures.cpp`, `input/input.cpp` (`inputBegin()`, `inputPoll()`).

### 10.2 Gestos

- **Tap** num card da Início → detalhe; paginador `‹ ›` troca de conta.
- **Swipe horizontal** → Início ↔ Sistema; **vertical** → scroll.
- **Setas ↑↓** aparecem quando o conteúdo não cabe.
- **Hold** sobre o “olho” da marca dilata a pupila (só efeito visual, `uiHandlePointerHold`).

### 10.3 Serial (115200 baud)

Útil no Wokwi e no hardware (ver [`.agents/TOUCH.md`](../.agents/TOUCH.md) para lista completa):

```
n/p        Início ↔ Sistema
0          Início
1 Claude  2 Cursor  3 OpenRouter  4 DeepSeek
5 GPT     6 OpenCode 7 (reservado) 8 Sistema  9 Relógio
l/g        lista / grade
t          ciclo de tema (DARK→LIGHT→CONTRAST)
a          ciclo de cor de destaque
i          ciclo de idioma
h          ciclo da barra (esq→topo→dir→base)
u/d        scroll cima/baixo
r          refresh (GET /usage)
c          calibrar (só hardware)
s          ciclo de tamanho do card da view atual
1/2/3/4/5  tamanho P/L/M/W/G (1×1 ... 4×4)
```

---

## 11. Contrato JSON

`GET /usage` e `GET /events` entregam o mesmo payload (ver [`.agents/CONTRATO_JSON.md`](../.agents/CONTRATO_JSON.md)):

- Cada provedor é **lista de contas** (`claude[]`, `gpt[]`, … `adsense[]`) — `MAX_ACCOUNTS=5` na placa.
- `weather` e `currencies` são **objetos únicos** (não lista).
- Percentuais 0–100, datas ISO-8601, `ok/error` por conta.
- Array vazio `[]` ou `null` = card oculto; `ok:false` = card visível com erro.
- HTTP sempre **200** (mesmo com falhas parciais).

Ao adicionar/renomear campo, atualize **três lugares**: `.agents/CONTRATO_JSON.md` + `backend/src/schemas/*.ts` + `firmware/src/net/parse.cpp`.

---

## 12. Troubleshooting

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `Wi-Fi` no status, sem IP | SSID/senha errados | Confira `secrets.h`; veja `Serial` → `Wi-Fi conectando SSID=...` |
| `HTTP 404/500` ou `JSON` | `USAGE_URL` errado ou coletor fora do ar | `curl http://IP:8787/usage` no host; confira IP LAN (não `127.0.0.1` na placa); `./dev up` de pé? |
| `aguardando Wi-Fi (status=...)` em loop | sem Wi-Fi | `g_lastFetchMs` 5 s; `markAllAccountsFailed("aguardando Wi-Fi")` |
| Cards somem | provedor sem conta visível (`[]`) | No painel, desoculte em `/display/config` (interruptor “Mostrar na placa”) |
| `mais contas do que MAX_ACCOUNTS` no Serial | >5 contas do mesmo provedor | Limite da placa; excedentes só no `/display` web |
| Tela preta após flash | partição antiga sem `huge_app` | Faça **Erase Flash** e regrave |
| Touch fantasma/invertido | calibração ruim ou `TOUCH_CS` errado | Sistema → Calibrar; valide GPIO em `platformio.ini` vs fiação real |
| `Wokwi: Start Simulator` sem `Client connected` | gateway não está em `:9011` | `./dev wokwi` sobe o gateway; confira `wokwi.toml:7` |
| Heap estoura / reset ao abrir câmera | SSE + MJPEG juntos | Firmware pausa SSE em `VIEW_CAMERA(S)` automaticamente |
| Tema não aplica / `tema grande demais` | JSON > 8 KB ou imagem com tamanho errado | `customThemeCanvasWidth/Height` deve bater com `w*h*2`; veja Serial |
| `GPIO 2` piscando corrompe display | LED onboard conflita com `TFT_DC` | Firmware não usa GPIO 2 como LED — não adicione blink |

Logs úteis no Serial (115200):

```
tft 480x320 rot=1
=== VIGIA AI hardware (SSE) ===
Wi-Fi conectado ip=192.168.x.x rssi=-42 dBm
painel LAN=http://192.168.x.x:8787/
coletor SSE: conectando http://192.168.x.x:8787/events
coletor SSE: 1234 bytes
usage sse-ok
  claude contas=1
    [0] id=local label=- ok=1 sessao=42 semana=18 err=-
```

---

## 13. Comandos rápidos

```bash
# do zero
cp firmware/src/secrets.h.example firmware/src/secrets.h  # edite
./dev up &                      # coletor :8787 (outro terminal)
./dev firmware flash            # grava
pio device monitor -b 115200    # acompanhe

# só simulador
./dev wokwi                     # coletor + gateway + build
# → Wokwi: Start Simulator no VS Code

# desenvolvimento
pio run -e esp32dev             # só compila
./dev firmware build            # alias
./dev test                      # vitest + tsc (backend/frontend)
```

---

## 14. Referências

- [`.agents/FIRMWARE.md`](../.agents/FIRMWARE.md) — resumo operacional
- [`.agents/HARDWARE.md`](../.agents/HARDWARE.md) — BOM e pinos
- [`.agents/TOUCH.md`](../.agents/TOUCH.md) — views, gestos e calibração
- [`.agents/ARQUITETURA.md`](../.agents/ARQUITETURA.md) — diagrama coletor ↔ placa
- [`.agents/CONTRATO_JSON.md`](../.agents/CONTRATO_JSON.md) — payload exato
- [`firmware/platformio.ini`](platformio.ini) — `build_flags`, partições, libs
- [`firmware/src/main.cpp`](src/main.cpp) — `setup`/`loop`
- [`firmware/src/core/state.h`](src/core/state.h) — `View` e `UsageSnapshot`
