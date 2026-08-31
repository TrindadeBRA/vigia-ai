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

GPIO 2 = `TFT_DC`. Touch XPT2046: `T_CS` 21. Detalhes: [HARDWARE.md](HARDWARE.md), [TOUCH.md](TOUCH.md).
