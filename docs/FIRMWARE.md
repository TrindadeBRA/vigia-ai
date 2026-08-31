# Firmware (PlatformIO)

Código em `firmware/`. Ambientes: `esp32dev` (ILI9488, placa real) e `wokwi` (ILI9341, simulador).

```bash
./dev firmware wokwi
./dev firmware build
./dev firmware flash
./dev wokwi               # coletor + wokwigw + compile (atalhos: simulador, sim)
```

`wokwi.toml` e `diagram.json` na **raiz** apontam para `firmware/.pio/build/wokwi/…` para a extensão Wokwi no workspace. Cópias iguais existem em `firmware/` se você abrir só essa pasta.

## Segredos Wi-Fi

```bash
cp firmware/src/secrets.h.example firmware/src/secrets.h
```

`USAGE_URL` = IP LAN do host (`http://IP:8787/usage`), nunca `127.0.0.1` na ESP32. O firmware escuta SSE em `/events` (deriva o path). Arquivo gitignored.

Na tela **Sistema**, abaixo de rede/atualizado, um QR aponta para o painel (`GET /health` → `panel_lan`, ex. `http://192.168.x.x:8787/`) — qualquer aparelho na mesma Wi-Fi abre as configs. No Wokwi o IP da placa (`10.13.37.2`) **não** é essa URL.

GPIO 2 = `TFT_DC`. Touch XPT2046: `T_CS` 21. Detalhes: [HARDWARE.md](HARDWARE.md), [TOUCH.md](TOUCH.md).

## Árvore de `src/`

Camadas no estilo do backend (`providers/`): cada pasta tem um papel, includes com caminho a partir de `src/` (`"ui/ui.h"`, `"net/usage_client.h"`).

```
src/
  main.cpp              setup/loop
  secrets.h.example     Wi-Fi (copiar para secrets.h)
  core/state.h          View, snapshot, globais
  net/                  Wi-Fi, SSE, GET /usage, parse JSON
  input/                gestos, serial, XPT2046 / FT6206
  ui/
    ui.h                API pública da tela
    theme.cpp           paleta + NVS
    nav.cpp             views, toque, scroll
    layout.cpp          header e geometria
    widgets.cpp         barras, ícones, texto
    views/              Início, Claude, GPT, Cursor, …
  assets/icons/
```
