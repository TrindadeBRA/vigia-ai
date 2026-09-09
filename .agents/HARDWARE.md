# Hardware

Guia de peças, pinos e display do Vigia AI. Para o fluxo completo (firmware ↔ coletor): [`ARQUITETURA.md`](ARQUITETURA.md). Para views/gestos: [`TOUCH.md`](TOUCH.md). Guia técnico do firmware: [`../firmware/README.md`](../firmware/README.md).

## Peças (v1)

### Caminho recomendado — placa integrada (menos solda)

- **ESP32-2432** (Shenzhen Changcai Intelligent, compatível `ESP32-3248S035`) — **ESP32-WROOM + TFT SPI 3,5" 320×480 ILI9488 já integrada**, com touch resistivo 4 fios e backlight via MOSFET. É o hardware para o qual as `build_flags` atuais de `firmware/platformio.ini:24-58` foram validadas no esquemático do fornecedor.
- Se o seu painel for **ILI9486** em vez de ILI9488: troque `ILI9488_DRIVER` por `ILI9486_DRIVER` em `platformio.ini:33`.
- Fonte **5 V estável** no USB da ESP32; VCC do painel em **3V3** (como no Hello World da placa integrada).

### Caminho alternativo — kit avulso (ainda suportado)

- ESP32 Dev Module (WROOM / DevKit C) + TFT SPI **3,5" 320×480** avulsa (ILI9488/ILI9486) + touch XPT2046.
- Requer fiação manual (ver §2.2). Se for seu caso, ajuste `TFT_*` e `TOUCH_CS` em `platformio.ini` antes de gravar.

## Pinos

### 2.1 Placa integrada ESP32-2432 — env `esp32dev` (atual)

É o que o firmware compila por padrão. Valores em `firmware/platformio.ini:32-58`:

| Sinal | GPIO | Display / Função | Notas |
|---|---|---|---|
| `TFT_MISO` | **12** | MISO / SDO | usado por `tft.readRectRGB()` no screenshot `/theme/screenshot` |
| `TFT_MOSI` | **13** | MOSI / SDI | |
| `TFT_SCLK` | **14** | SCK | `SPI_FREQUENCY=27MHz` |
| `TFT_CS` | **15** | CS | |
| `TFT_DC` | **2** | DC / RS | **Compartilha o LED onboard — firmware nunca pisca o LED** |
| `TFT_RST` | **-1** | RST | sem GPIO dedicado — reset geral da placa |
| `TFT_BL` | **27** | Backlight | via MOSFET, `TFT_BACKLIGHT_ON=HIGH` |
| `TFT_WIDTH/HEIGHT` | — | 320×480 | `setRotation(1)` → **480×320 em paisagem** |
| `TOUCH_CS` | **33** | XPT2046 CS | touch resistivo 4 fios (X+/Y-/X-/Y+) |
| `TOUCH_IRQ` | — | — | não usado nesta placa (polling) |
| `SPI_READ_FREQUENCY` | — | 16 MHz | leitura |
| `SPI_TOUCH_FREQUENCY` | — | 2,5 MHz | touch |

> Se o silkscreen da sua placa integrada usar outros pinos, edite `TOUCH_CS`/`TFT_*` no `env:esp32dev` e recalibre (Sistema → Calibrar).

### 2.2 Kit avulso — wiring solto (legado, ainda válido)

Para quem já tem ESP32 + TFT avulsas, pinout documentado originalmente e ainda suportado:

| Sinal | GPIO | Display |
|---|---|---|
| MISO / T_DO | 19 | MISO / SDO |
| MOSI / T_DIN | 23 | MOSI / SDI |
| SCLK / T_CLK | 18 | SCK |
| TFT CS | 15 | CS |
| TFT DC | **2** | DC / RS |
| TFT RST | 4 | RST |
| VCC / LED | 3V3 | VCC e backlight |
| GND | GND | GND |

Touch XPT2046 (SPI compartilhado):

| Sinal | GPIO | Notas |
|---|---|---|
| T_CLK | 18 | = SCK da TFT |
| T_DIN | 23 | = MOSI |
| T_DO | 19 | = MISO |
| T_CS | **21** | `TOUCH_CS` no legado (na integrada é **33**) |
| T_IRQ | **22** | opcional |

> Não ligue `T_CS` no GPIO 15 (já é CS da tela).

### 2.3 Wokwi — simulador (env `wokwi`)

Não há ILI9488 no simulador. A peça é `board-ili9341-cap-touch` (ILI9341 240×320 + FT6206 capacitivo):

| Sinal | GPIO |
|---|---|
| MOSI | 23 |
| MISO | 19 |
| SCK | 18 |
| CS | 15 |
| DC | 2 |
| RST | 4 |
| SDA / SCL (touch) | 21 / 22 |
| BTN_PREV / NEXT | 13 / 5 |

`board-ili9341-cap-touch` tem FT6206 I2C (21/22), não XPT2046. Ver [`TOUCH.md`](TOUCH.md) para o mapeamento de coordenadas.

## Resolução e rotação

- **Hardware (ILI9488):** `setRotation(1)` → **480×320** em paisagem. Definição em `platformio.ini:57` (`TFT_ROTATION=1`).
- **Wokwi (ILI9341):** `setRotation(1)` + `rotate: 90` da peça → **320×240** em paisagem. Mesma orientação, só menor.
- **Layout:** todo o código de UI usa `tft.width()` / `tft.height()` — não há coordenadas hardcoded. A tarja preta à esquerda no Wokwi é o conector da `board-ili9341-cap-touch`, não pixel da UI.
- **Leitura de tela:** `tft.readRectRGB()` depende de `TFT_MISO` conectado (GPIO 12 na integrada, 19 no kit avulso/Wokwi) — sem ele o `/theme/screenshot` retorna BMP preto.

## Alimentação

- USB 5 V estável na ESP32 é suficiente para a DevKit + TFT 3,5".
- **VCC do painel em 3V3**, não 5 V (como no Hello World da placa integrada). Backlight em 3V3 via `TFT_BL=27`.
- Consumo típico: TFT sempre ligada na mesa; backlight é o maior consumidor.

## Simulação

- `diagram.json` (raiz e `firmware/`): ESP32 `board-esp32-devkit-c-v4` + `board-ili9341-cap-touch` + 2 botões. Conexões em `diagram.json:36-54`.
- Compilar `wokwi`: `pio run -e wokwi` ou `./dev firmware wokwi`.
- Não representa o tamanho físico da 3,5" nem o XPT2046 — é um substituto clicável para testar a lógica de rede/UI.
- Gateway: `wokwi.toml:7` → `ws://127.0.0.1:9011` (ver [`FIRMWARE.md`](FIRMWARE.md)).

## Checklist de fiação (placa integrada)

1. Nenhum jumper extra — a TFT já vem soldada.
2. Confirme `TOUCH_CS=33` no `platformio.ini` se for ESP32-2432; se o toque não responde, tente `TOUCH_CS=21` (lotes antigos) e recalibre.
3. Grave com `./dev firmware flash` e abra `pio device monitor -b 115200` — deve aparecer `tft 480x320 rot=1`.

## Checklist de fiação (kit avulso)

1. Compartilhe o barramento SPI: `MOSI 23`, `MISO 19`, `SCK 18` para TFT **e** touch.
2. Separe os CS: `TFT_CS 15` vs `TOUCH_CS 21` (nunca o mesmo).
3. `TFT_DC 2` e `TFT_RST 4` cada um no seu GPIO.
4. Alimente a TFT em 3V3, não 5 V.
