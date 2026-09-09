# Vigia AI — Nintendo 3DS (.cia / .3dsx)

Port do firmware ESP32 (`firmware/`) para **Nintendo 3DS** usando **devkitARM + libctru + citro2d**.

Funciona como o firmware: o 3DS **não guarda tokens** — o coletor `backend/` na mesma LAN expõe `GET /usage` (e `GET /events` SSE) sem Bearer, e o 3DS faz polling a cada 60s igual a `firmware/src/net/usage_client.h:1-7` e `frontend/src/pages/Display.tsx:231-244`.

```
[Credenciais no host] -> [Coletor Fastify :8787 /usage] --HTTP LAN--> [3DS Top/Bottom]
                            ^ docs/CONTRATO_JSON.md  +  backend/src/schemas/usage.ts
```

## Requisitos

* devkitPro com `3ds-dev` (devkitARM, libctru, citro3d, citro2d): https://devkitpro.org/wiki/Getting_Started
* Para `.cia`: `makerom` (3dstool) + `bannertool`
* Coletor rodando na LAN: `./dev up` -> `http://<IP>:8787/usage` (ver `AGENTS.md`)

## Build

```sh
cd 3ds
make              # -> vigia-ai.3dsx + vigia-ai.elf
make cia          # -> vigia-ai.cia (precisa resources/icon.png + banner.png/wav)
make clean
```

Coloque `vigia-ai.3dsx` em `sdmc:/3ds/vigia-ai/` e rode pelo Homebrew Launcher. Para `.cia` instale via `FBI` (precisa Luma3DS).

## Uso no 3DS

1. Ligue o WiFi do 3DS (mesma rede do coletor).
2. Na primeira execução: `Config` (X) -> digite `IP:PORTA` do coletor (ex. `192.168.1.10:8787`). Salvo em `sdmc:/3ds/vigia-ai/config.json` (igual `firmware/src/secrets.h`).
3. Home mostra grade 2x3 (Touch bottom) + detalhe (Top). Mesma navegação do firmware `firmware/src/ui/nav.cpp:112-201`.

### Controles

| Entrada | Ação |
|---|---|
| Touch bottom na card | Abre detalhe no top (`VIEW_*`) |
| D-Pad / C-Stick | Navega grade, scroll lista |
| A | Entra no detalhe focado |
| B | Volta para Home |
| X | Config (IP do coletor) |
| Y | Refresh manual (`GET /usage` forcado, igual badge no firmware) |
| L/R | Paginador de contas (`< i/N >`, `MAX_ACCOUNTS=5` igual `firmware/src/core/state.h:44`) |
| Start | Status / Sistema (`VIEW_STATUS`) |
| Select | Alterna tema (dark/light/contrast) |

Dual-screen fiel: bottom = `VIEW_HOME` touch; top = header + detalhe (Claude/Gpt/Cursor/Wallet/etc). O bottom também mostra scroll arrows quando `uiCanScroll()` (`firmware/src/ui/nav.cpp:203`).

## Arquitetura

```
3ds/src/
  main.cpp              # gfxInit / aptMainLoop (equiv. firmware/src/main.cpp:35-118)
  core/state.h/.cpp     # UsageSnapshot + View (port de firmware/src/core/state.h:6-258)
  core/config.h/.cpp    # SD config sdmc:/3ds/vigia-ai/config.json (+ secrets.h)
  net/http_client.h/.cpp# httpc GET /usage poll 60s (port de net/client.cpp + usage_client.h)
  net/parse.h/.cpp      # jsmn parse -> g_snap (port de net/parse.cpp:352-721)
  ui/ui.h/.cpp          # uiInit/uiPaint/uiTickClock (citro2d, port de ui/*.cpp)
  ui/theme.h/.cpp       # PALETTES dark/light/contrast (port de ui/theme.cpp)
  ui/views/*.cpp        # home/claude/gpt/cursor/... (port de ui/views/*.cpp)
  input/input.h/.cpp    # hidTouch/circle/pad (port de input/input.cpp)
```

Sem SSE no 3DS (heap + httpc bloqueante): usa só `GET /usage` polling 60s, com `GET /health` para descobrir `interval_s` (`backend/src/schemas/usage.ts:265-277`). O web faz SSE (`Display.tsx:232`); o 3DS equivale ao fallback do firmware quando `usageClientPauseSse()` não é chamado.

Limitações: câmeras MJPEG (`VIEW_CAMERA`) e mineração (`VIEW_MINER`) desabilitadas no MVP 3DS (ver `.agents/PLANO_MINERACAO.md`).

## Licença

MIT — igual ao repo raiz `LICENSE`.
