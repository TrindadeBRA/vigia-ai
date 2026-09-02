# Touch e views

A maioria das TFT SPI 3,5" com toque usa controlador **XPT2046** (resistivo) no **mesmo SPI** da tela, com um CS extra (`T_CS`).

O Wokwi usa `board-ili9341-cap-touch` (FT6206, I2C 21/22). O chip manda **retrato 240×320**. No simulador a peça está em `rotate: 90` e o firmware usa `setRotation(1)` (paisagem 320×240), então o toque vira `x = y_nativo`, `y = 239 - x_nativo`. O hardware real usa XPT2046 + calibração, não este mapeamento.

## Views

| Tela         | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio       | Lista ou grade (até 5 cards); escolhe em **Info → Início** (padrão **grade**). Um card por *tipo* de provedor (não por conta) — com mais de uma conta do mesmo provedor, mostra a que mais precisa de atenção + "+N" no título. Toque no card abre o detalhe. Na **lista**, cada card usa a altura natural; se não couberem, **setas** ↑↓. Na **grade**, 2 colunas (1/2 da largura; o ímpar não estica) e 3 linhas visíveis (6 células) sem corte |
| Claude       | Janelas 5h, semana, Sonnet/Opus se existirem; usado/resta/reset. **Setas** à direita se precisar de scroll. Com mais de uma conta configurada (`CONTRATO_JSON.md`), aparece um paginador **‹ i/N ›** logo abaixo do título pra trocar de conta                                                                                                                                                                                               |
| GPT          | Janelas sessão e semana (assinatura ChatGPT / Codex); usado/resta/reset. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                                                                |
| Cursor       | Plano, ciclo, duas barras, on-demand (usado/teto/resta/bônus). Setas de scroll. Mesmo paginador de contas do Claude                                                                                                                                                                                                                                                                                                                               |
| OpenRouter   | Créditos da conta: barra, usado, resta, teto. Setas de scroll. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                                                                          |
| DeepSeek     | Saldo da conta: barra, resta. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                                                                                                           |
| OpenCode Go  | Assinatura mensal: 3 janelas (rolling/weekLimit/monthLimit), cada uma com usado/resta/reset. Setas de scroll. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                           |
| OpenCode Zen | Saldo pré-pago: barra, resta. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                                                                                                           |
| fal.ai       | Saldo de créditos: barra, resta. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                                                                                                        |
| Bitcoin      | Saldo on-chain + valor em USD/BRL. Mesmo paginador se houver mais de um endereço                                                                                                                                                                                                                                                                                                                                                                  |
| AdSense      | Ganhos de hoje (est.) + saldo não pago. Mesmo paginador de contas                                                                                                                                                                                                                                                                                                                                                                                 |
| Moedas       | Lista de cotações (fiat + cripto) na moeda base. Toque abre o detalhe com todas as linhas. Sem paginador (não é lista de contas)                                                                                                                                                                                                                                                                                                                  |
| Info         | Rede, URL/QR do painel na LAN, layout da home (**Lista** / **Grade**), **tam. cards** (P / M / G / XG — 1×1, 1×1, 2×1, 2×2), **tema** (Escuro / Claro / Contraste), **cor** (7 tons, padrao vermelho), **idioma** (PT / EN / ES, padrão pt-BR), **Atualizar**, **Calibrar**. **Setas** à direita se precisar de scroll                                                                                                                            |
| Relogio      | Hora com segundos, data e resumo dos provedores (mesma regra de "pior conta" da Início). **Sem barra**. Toque em qualquer lugar volta ao inicio                                                                                                                                                                                                                                                                                                   |

Navegação na **barra** (lado escolhido em Info → **BARRA**; padrão **esquerda**): título **VIGIA AI** volta ao início; fora da home, uma seta **←** faz o mesmo. Ícone **i** abre Info. O **horário** e o **ícone de relógio** no meio da barra abrem a tela Relogio. O selo/área livre da barra pede refresh. Deslize horizontal (e botões Prev/Next no Wokwi) alterna Início ↔ Info.

Nas telas internas (Claude / GPT / Cursor / OpenRouter / DeepSeek / OpenCode Go / OpenCode Zen / fal.ai / Bitcoin / AdSense / Moedas / Info) e na **Início** (lista ou grade) se os cards não couberem: aparecem **setas** ↑↓ à direita. Toque nelas, deslize vertical, ou serial `u` / `d`.

Hardware: `T_CS` no GPIO 21. Serial: `n` `p` `0`–`7`.

Serial (placa e Wokwi): `n` / `p` Início↔Info, `0` início, `1` Claude, `2` Cursor, `3` OpenRouter, `4` DeepSeek, `5` GPT, `6` OpenCode Go, `7` OpenCode Zen, `8` info, `9` relogio, `l` lista, `g` grade, `t` ciclo de tema, `a` ciclo da cor, `i` ciclo de idioma, `h` ciclo da barra (esq/topo/dir/base), `u`/`d` scroll no detalhe/info/início, `r` refresh, `c` calibrar (só hardware), `s` ciclo de tamanho do card da view atual, `1`/`2`/`3`/`4`/`5` tamanho P(1×1)/L(1×2)/M(2×2)/W(2×4)/G(4×4).

A escolha Lista/Grade, o tema, a cor, o idioma, o lado da barra e o tamanho de cada card ficam na NVS (namespace `ui`, chaves `home`, `theme`, `accent`, `lang`, `edge` e `cs` — blob de `VIEW_COUNT` bytes, um `CardSize` por `View`). Início padrão: **grade**, cards **M** (normal). Idioma padrão: **pt-BR**. Barra padrão: **esquerda**. Cor padrão: **vermelho**.

## Ligação típica (XPT2046)

SPI compartilhado com a TFT. **Não** ligue `T_CS` no GPIO 15 (já é CS da tela).

| Touch | GPIO   | Notas                          |
| ----- | ------ | ------------------------------ |
| T_CLK | 18     | = SCK da TFT                   |
| T_DIN | 23     | = MOSI                         |
| T_DO  | 19     | = MISO                         |
| T_CS  | **21** | `TOUCH_CS` no `platformio.ini` |
| T_IRQ | **22** | opcional, `TOUCH_IRQ`          |

Se o silkscreen da sua placa usar outros pinos, mude `TOUCH_CS` / `TOUCH_IRQ` no env `esp32dev`.

## Calibração

Salva na NVS da ESP32 (namespace `touch`). Primeira vez: tela **Info** → **Calibrar touch** (quatro cantos). Se girar a tela (`setRotation`), calibre de novo.

Toque “fantasma” ou invertido = calibração ruim ou `T_CS` errado.

## Arquivos

- `src/ui/nav.cpp` — navegação e hit-test
- `src/ui/views/` — uma tela por arquivo (Início, detalhe, Sistema, Relógio)
- `src/input/` — XPT2046 / FT6206 / botões / serial
- `src/core/state.h` — `View` e snapshot
