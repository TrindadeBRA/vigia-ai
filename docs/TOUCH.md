# Touch e views

A maioria das TFT SPI 3,5" com toque usa controlador **XPT2046** (resistivo) no **mesmo SPI** da tela, com um CS extra (`T_CS`).

O Wokwi usa `board-ili9341-cap-touch` (FT6206, I2C 21/22). O chip manda **retrato 240×320**. No simulador a peça está em `rotate: 90` e o firmware usa `setRotation(1)` (paisagem 320×240), então o toque vira `x = y_nativo`, `y = 239 - x_nativo`. O hardware real usa XPT2046 + calibração, não este mapeamento.

## Views

| Aba | Conteúdo |
| --- | --- |
| Inicio | Claude + Cursor; toque no card abre o detalhe |
| Claude | Sessão 5h e semana, % usado e restante |
| Cursor | Ciclo do plano, dólares se existirem |
| Info | Rede, última atualização, **Atualizar**, **Calibrar** |

Gestos: o toque **já na descida** troca a tela (clique curto no Wokwi não era registrado). Faixa de baixo (~20%) conta como abas. Hardware: `T_CS` no GPIO 21. Serial: `n` `p` `0`–`3`.

Serial (placa e Wokwi): `n` / `p` próxima/anterior, `0`–`3` aba, `r` refresh, `c` calibrar (só hardware).

## Ligação típica (XPT2046)

SPI compartilhado com a TFT. **Não** ligue `T_CS` no GPIO 15 (já é CS da tela).

| Touch | GPIO | Notas |
| --- | --- | --- |
| T_CLK | 18 | = SCK da TFT |
| T_DIN | 23 | = MOSI |
| T_DO | 19 | = MISO |
| T_CS | **21** | `TOUCH_CS` no `platformio.ini` |
| T_IRQ | **22** | opcional, `TOUCH_IRQ` |

Se o silkscreen da sua placa usar outros pinos, mude `TOUCH_CS` / `TOUCH_IRQ` no env `esp32dev`.

## Calibração

Salva na NVS da ESP32 (namespace `touch`). Primeira vez: aba **Info** → **Calibrar touch** (quatro cantos). Se girar a tela (`setRotation`), calibre de novo.

Toque “fantasma” ou invertido = calibração ruim ou `T_CS` errado.

## Arquivos

- `src/ui.cpp` — desenho e hit-test
- `src/input.cpp` — XPT2046 / botões / serial
- `src/app_state.h` — `View` e snapshot
