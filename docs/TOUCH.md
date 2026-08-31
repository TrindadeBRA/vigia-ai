# Touch e views

A maioria das TFT SPI 3,5" com toque usa controlador **XPT2046** (resistivo) no **mesmo SPI** da tela, com um CS extra (`T_CS`).

O Wokwi usa `board-ili9341-cap-touch` (FT6206, I2C 21/22). O chip manda **retrato 240×320**. No simulador a peça está em `rotate: 90` e o firmware usa `setRotation(1)` (paisagem 320×240), então o toque vira `x = y_nativo`, `y = 239 - x_nativo`. O hardware real usa XPT2046 + calibração, não este mapeamento.

## Views

| Tela | Conteúdo |
| --- | --- |
| Inicio | Lista (3 cards) ou grade 2×2; escolhe em **Info → Início**. Toque no card abre o detalhe |
| Claude | Janelas 5h, semana, Sonnet/Opus se existirem; usado/resta/reset. **Setas** à direita se precisar de scroll |
| Cursor | Plano, ciclo, duas barras, on-demand (usado/teto/resta/bônus). Setas de scroll |
| OpenRouter | Créditos da conta: barra, usado, resta, teto. Setas de scroll |
| Info | Rede, layout da home (**Lista** / **Grade**), **tema** (Escuro / Claro / Contraste), **cor** (7 tons, padrao vermelho), **idioma** (PT / EN / ES, padrão pt-BR), **Atualizar**, **Calibrar**. **Setas** à direita se precisar de scroll |
| Relogio | Hora com segundos, data e resumo das 3 IAs. **Sem barra**. Toque em qualquer lugar volta ao inicio |

Navegação na **barra** (lado escolhido em Info → **BARRA**; padrão **esquerda**): título **VIGIA AI** volta ao início; fora da home, uma seta **←** faz o mesmo. Ícone **i** abre Info. O **horario** da barra abre a tela Relogio. O selo/área livre da barra pede refresh. Deslize horizontal (e botões Prev/Next no Wokwi) alterna Início ↔ Info.

Nas telas internas (Claude / Cursor / OpenRouter / Info): se o conteúdo não couber, aparecem **setas** ↑↓ à direita. Toque nelas, deslize vertical, ou serial `u` / `d`.

Hardware: `T_CS` no GPIO 21. Serial: `n` `p` `0`–`5`.

Serial (placa e Wokwi): `n` / `p` Início↔Info, `0` início, `1`–`3` detalhe, `4` info, `5` relogio, `l` lista, `g` grade, `t` ciclo de tema, `a` ciclo da cor, `i` ciclo de idioma, `h` ciclo da barra (esq/topo/dir/base), `u`/`d` scroll no detalhe/info, `r` refresh, `c` calibrar (só hardware).

A escolha Lista/Grade, o tema, a cor, o idioma e o lado da barra ficam na NVS (namespace `ui`, chaves `home`, `theme`, `accent`, `lang` e `edge`). Idioma padrão: **pt-BR**. Barra padrão: **esquerda**. Cor padrão: **vermelho**.

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

Salva na NVS da ESP32 (namespace `touch`). Primeira vez: tela **Info** → **Calibrar touch** (quatro cantos). Se girar a tela (`setRotation`), calibre de novo.

Toque “fantasma” ou invertido = calibração ruim ou `T_CS` errado.

## Arquivos

- `src/ui.cpp` — desenho e hit-test
- `src/input.cpp` — XPT2046 / botões / serial
- `src/app_state.h` — `View` e snapshot
