# Touch e views

Guia de interação da TFT touch do Vigia AI — hardware real e simulador. Para pinos/BOM: [`HARDWARE.md`](HARDWARE.md). Para rede/tema/SSE: [`FIRMWARE.md`](FIRMWARE.md) e [`../firmware/README.md`](../firmware/README.md).

## Controladores

| Ambiente | Controlador | Barramento | Resolução nativa |
|---|---|---|---|
| **Hardware (placa integrada ESP32-2432)** | **XPT2046** resistivo | mesmo SPI da TFT (`T_CLK 18 / T_DIN 23 / T_DO 19`, `T_CS 33`) | 480×320 em paisagem (`setRotation(1)`) |
| **Hardware (kit avulso legado)** | XPT2046 resistivo | mesmo SPI, `T_CS 21`, `T_IRQ 22` opcional | 480×320 |
| **Wokwi** | **FT6206** capacitivo (`board-ili9341-cap-touch`) | I2C `SDA 21 / SCL 22` | 240×320 retrato → 320×240 paisagem |

O Wokwi não tem XPT2046; usa `board-ili9341-cap-touch` (FT6206) só para clicar no simulador. O chip manda **retrato 240×320**. No simulador a peça está em `rotate: 90` e o firmware usa `setRotation(1)` (paisagem 320×240), então o toque vira `x = y_nativo`, `y = 239 - x_nativo` (`firmware/src/input/touch.cpp`, bloco `WOKWI_SIM`). O hardware real usa XPT2046 + calibração NVS, não este mapeamento.

Arquivos: `src/input/touch.cpp` (XPT2046/FT6206 + calibração), `src/input/gestures.cpp` (swipe/hold), `src/input/input.cpp` (`inputBegin`/`inputPoll`), `src/ui/nav.cpp` (hit-test/navegação).

## Views (18 no total — `firmware/src/core/state.h:6-37`)

| View | Enum | Conteúdo | Scroll | Paginador |
|---|---|---|---|---|
| Início | `VIEW_HOME` 0 | Lista ou grade (até 5 cards); escolhe em **Sistema → Início** (padrão **grade**). Um card por *tipo* de provedor (não por conta) — com N contas do mesmo provedor, mostra a que mais precisa de atenção + “+N” no título. Toque no card abre o detalhe. Na **lista**, altura natural; se não couber, **setas** ↑↓. Na **grade**, 2 colunas (1/2 da largura; o ímpar não estica) e 3 linhas visíveis (6 células) sem corte | ↑↓ se não couber | — |
| Claude | `VIEW_CLAUDE` 1 | Janelas 5 h, semana, Sonnet/Opus se existirem; usado/resta/reset. | ↑↓ | `‹ i/N ›` |
| Cursor | `VIEW_CURSOR` 2 | Plano, ciclo, duas barras, on-demand (usado/teto/resta/bônus). | ↑↓ | `‹ i/N ›` |
| OpenRouter | `VIEW_OPENROUTER` 3 | Créditos: barra, usado, resta, teto. | ↑↓ | `‹ i/N ›` |
| DeepSeek | `VIEW_DEEPSEEK` 4 | Saldo: barra, resta. | ↑↓ | `‹ i/N ›` |
| GPT | `VIEW_GPT` 5 | Janelas sessão e semana (ChatGPT/Codex); usado/resta/reset. | ↑↓ | `‹ i/N ›` |
| Sistema | `VIEW_STATUS` 6 | Rede, URL/QR do painel na LAN, layout da home (**Lista**/**Grade**), **tam. cards** (P/M/G/XG… — 1×1 a 4×4), **tema** (Escuro/Claro/Contraste), **cor** (7 tons, padrão vermelho), **idioma** (PT/EN/ES, padrão pt-BR), **barra** (esq/topo/dir/base), **Atualizar**, **Calibrar**. | ↑↓ | — |
| Relógio | `VIEW_NOW` 7 | Hora com segundos, data e resumo dos provedores (mesma regra “pior conta” da Início). **Sem barra**. Toque em qualquer lugar volta ao início | — | — |
| OpenCode | `VIEW_OPENCODE` 8 | Assinatura mensal: 3 janelas (rolling/weekLimit/monthLimit), cada uma com usado/resta/reset. | ↑↓ | `‹ i/N ›` |
| fal.ai | `VIEW_FAL` 9 | Saldo de créditos: barra, resta. | ↑↓ | `‹ i/N ›` |
| Bitcoin | `VIEW_BITCOIN` 10 | Saldo on-chain + valor em USD/BRL. | ↑↓ | `‹ i/N ›` (cada carteira) |
| Tema custom | `VIEW_THEME` 11 | Tela cheia sem header — fundo + relógio + ícones com cota (protótipo, ver [`CONTRATO_TEMA.md`](CONTRATO_TEMA.md)). Só entra por gatilho explícito (botão Recarregar ou evento SSE `theme`), nunca por swipe. | — | — |
| AdSense | `VIEW_ADSENSE` 12 | Ganhos de hoje (est.) + saldo não pago. | ↑↓ | `‹ i/N ›` |
| Moedas | `VIEW_CURRENCIES` 13 | Lista de cotações (fiat+cripto) na moeda base. Toque abre detalhe. | ↑↓ | — (não é lista de contas) |
| Clima | `VIEW_WEATHER` 14 | Open-Meteo: atual + máx/mín do dia. | ↑↓ | — |
| Mineração | `VIEW_MINER` 15 | Motor Stratum+SHA256 (só minera com esta view ativa, ver [`PLANO_MINERACAO.md`](PLANO_MINERACAO.md)). | auto 1 Hz | swipe normal |
| Câmeras | `VIEW_CAMERAS` 16 | Lista de câmeras IP (card por câmera) — toque abre live. | — | — |
| Câmera live | `VIEW_CAMERA` 17 | MJPEG em tela cheia + PTZ ONVIF. | — | — |

> Contagem visível: `VIEW_COUNT = 18` (`state.h:37`). `VIEW_THEME` nunca entra no ciclo de swipe normal (`uiNext`/`uiPrev` em `ui/nav.cpp`).

Navegação na **barra** (lado escolhido em Sistema → **BARRA**; padrão **esquerda**): título **VIGIA AI** volta ao início; fora da home, seta **←** faz o mesmo. Ícone **i** abre Sistema. O **horário** e o **ícone de relógio** no meio da barra abrem Relógio. O selo/área livre da barra pede refresh. Deslize horizontal (e botões **Prev/Next** no Wokwi, GPIO 13/5) alterna Início ↔ Sistema.

Nas telas internas e na **Início** (lista ou grade) quando o conteúdo não cabe: aparecem **setas** ↑↓ à direita. Toque nelas, deslize vertical, ou serial `u`/`d` (ver abaixo).

## Gestos

- **Tap** num card da Início → detalhe da conta. Tap no paginador `‹ ›` troca de conta (`g_snap` tem até `MAX_ACCOUNTS=5` por provedor).
- **Swipe horizontal** → Início ↔ Sistema. **Swipe vertical** → scroll (quando `uiCanScroll()`).
- **Setas ↑↓** (hit-test em `ui/nav.cpp`) → `uiDetailScrollBy(dy)`.
- **Hold** sobre o “olho” da marca → dilata a pupila (`uiHandlePointerHold`, só efeito visual, igual ao hover do logo web).

## Serial (115200 baud) — debug no hardware e no Wokwi

Mesma lista em [`../firmware/README.md`](../firmware/README.md) §10.3. Útil quando o touch não está calibrado ou para automação:

```
n / p        Início ↔ Sistema (next/prev)
0            Início
1 Claude   2 Cursor  3 OpenRouter  4 DeepSeek
5 GPT      6 OpenCode (Go/Zen)  7 (reservado)  8 Sistema  9 Relógio
l / g        lista / grade (HomeLayout)
t            ciclo de tema (DARK → LIGHT → CONTRAST)
a            ciclo da cor de destaque (7 tons, ACCENT_RED…VIOLET)
i            ciclo de idioma (PT → EN → ES)
h            ciclo da barra (LEFT → TOP → RIGHT → BOTTOM)
u / d        scroll cima/baixo no detalhe/Sistema/Início
r            refresh (GET /usage)
c            calibrar touch (só hardware, 4 cantos)
s            ciclo de tamanho do card da view atual (CARD_SM…CARD_WXL)
1/2/3/4/5    tamanho direto: P(1×1)/L(1×2)/M(2×2)/W(2×4)/G(4×4)
```

O firmware ecoa no Serial: `tft WxH`, `usage sse-ok` + dump de contas (`usageClientLogSnapshot`), `coletor SSE: ...` etc. — ver `firmware/src/net/parse.cpp:7-106`.

## Persistência (NVS)

A escolha Lista/Grade, tema, cor, idioma, lado da barra e tamanho de cada card ficam na NVS (namespace `ui`, chaves `home`, `theme`, `accent`, `lang`, `edge` e `cs` — blob de `VIEW_COUNT` bytes, um `CardSize` por `View`; ver `firmware/src/ui/theme.cpp:128-335`). Padrões: **grade**, cards **M** (normal), tema **Escuro**, cor **vermelho**, idioma **pt-BR**, barra **esquerda**.

A calibração do touch fica em NVS separada (namespace `touch`, `firmware/src/input/touch.cpp`). Primeira vez: **Sistema → Calibrar touch** (quatro cantos). Se mudar `setRotation`, recalibre.

## Ligação típica (XPT2046)

SPI compartilhado com a TFT. **Não** ligue `T_CS` no GPIO 15 (já é CS da tela).

| Touch | GPIO | Notas |
|---|---|---|
| T_CLK | 18 | = SCK da TFT |
| T_DIN | 23 | = MOSI |
| T_DO | 19 | = MISO |
| T_CS | **33** (integrada) / **21** (kit avulso legado) | `TOUCH_CS` em `platformio.ini` |
| T_IRQ | **22** | opcional (`TOUCH_IRQ`) |

Se o silkscreen da sua placa usar outros pinos, mude `TOUCH_CS` / `TOUCH_IRQ` no `env:esp32dev` de `firmware/platformio.ini`.

## Calibração

Salva na NVS (`touch`). Primeira vez: **Sistema → Calibrar touch** (quatro cantos). Se girar a tela (`setRotation`), calibre de novo. Toque “fantasma” ou invertido = calibração ruim ou `T_CS` errado — confira [`HARDWARE.md`](HARDWARE.md) §2.

## Arquivos relevantes

- `src/ui/nav.cpp` — navegação, hit-test, paginador, scroll
- `src/ui/views/` — uma tela por arquivo (home, claude, gpt, cursor, … now, miner, cameras)
- `src/input/` — `input.cpp` (orquestra), `touch.cpp` (XPT2046/FT6206), `gestures.cpp`, `serial.cpp`
- `src/core/state.h` — `enum View`, `UsageSnapshot`, `MAX_ACCOUNTS`
- `src/ui/theme.cpp` — NVS de layout/tema/cor/idioma/barra/tamanhos
