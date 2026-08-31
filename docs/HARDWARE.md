# Hardware

## Peças (v1)

- ESP32 Dev Module (WROOM, DevKit C)
- TFT SPI **3,5"** 320×480, controlador típico **ILI9488** (se for ILI9486, trocar a flag no `platformio.ini`)
- Fonte 5 V estável no USB da ESP32; VCC do painel em **3V3** (como no Hello World)

## Pinos

| Sinal | GPIO | Display |
| --- | --- | --- |
| MISO | 19 | MISO / SDO |
| MOSI | 23 | MOSI / SDI |
| SCLK | 18 | SCK |
| CS | 15 | CS |
| DC | 2 | DC / RS |
| RST | 4 | RST |
| VCC / LED | 3V3 | VCC e backlight |
| GND | GND | GND |

GPIO **2** = `TFT_DC` **e** LED onboard. O firmware **não** pisca o LED.

## Touch (XPT2046)

| Sinal | GPIO |
| --- | --- |
| T_CLK | 18 (SCK) |
| T_DIN | 23 (MOSI) |
| T_DO | 19 (MISO) |
| T_CS | 21 |
| T_IRQ | 22 (opcional) |

Detalhes e views: [TOUCH.md](TOUCH.md).

## Resolução

- Hardware: paisagem `setRotation(1)` → **480×320**
- Wokwi: ILI9341 → **320×240** (`setRotation(1)` + peça `rotate: 90`). O conector da peça fica à esquerda do vidro — não é área de pixels. Não existe ILI9488 no simulador.

O layout usa `tft.width()` / `tft.height()`.

## Simulação

`diagram.json`: ESP32 + `board-ili9341-cap-touch` (clique na tela). Compilar env `wokwi`. Não representa o tamanho físico da 3,5" nem o XPT2046.
