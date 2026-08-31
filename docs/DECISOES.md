# Decisões

## Coletor no Mac, não na nuvem

Cotas são da conta pessoal. Evita hospedar JWT/OAuth. LAN é suficiente para um painel na mesa.

## Python stdlib, não Node

`http.server`, `urllib`, `sqlite3`, `json` já vêm no macOS. Menos setup para quem não é dev.

## Endpoints internos, não scraping HTML

Mesma fonte do CLI/IDE. HTML do dashboard quebra mais. Risco: contrato não oficial (documentado em `APIS_*.md`).

## Um JSON para os dois cards

Firmware pequeno: um GET, um parse. Provedor com `ok: false` não derruba o HTTP.

## Wokwi fala com o coletor de verdade (via `wokwigw`)

Tentativa inicial era mock (`MOCK_USAGE`) porque o Wokwi não alcançava o coletor do Mac de forma confiável. Resolvido com o [Wokwi IoT Gateway](https://github.com/wokwi/wokwigw) local (`wokwi.toml` → `ws://localhost:9011`, ver [ARQUITETURA.md](ARQUITETURA.md#fluxo-wokwi)) — o simulador usa a mesma Wi-Fi simulada do hardware e fala com `collector/server.py` de verdade. `MOCK_USAGE` ainda existe no código como fallback caso o gateway não esteja disponível, mas nenhum env compila com ele hoje.

## GPIO 2 sem blink

Compartilhar DC da TFT com LED corrompe SPI se ficar togglando no `loop`.

## Sem NTP na v1

Datas vêm ISO no JSON; a tela mostra trecho curto (`MM-DD HH:MM` UTC) para não depender de relógio na ESP32.

## Touch XPT2046 no SPI da TFT

Um CS extra (GPIO 21) evita biblioteca à parte. Calibração na NVS, não no sketch.

## Wokwi com toque capacitivo (não é o hardware)

A placa real é XPT2046 (SPI, `T_CS` 21). O Wokwi não tem XPT2046; usa `board-ili9341-cap-touch` (FT6206 I2C) só para clicar no simulador. O caminho de código é `WOKWI_SIM` (`src/input.cpp`), não `MOCK_USAGE` — os dados continuam vindo do coletor de verdade.

## Sem autenticação no coletor (v1)

Rede doméstica. Quem pedir rede hostil pode acrescentar um token estático no header depois, no coletor **e** no firmware.
