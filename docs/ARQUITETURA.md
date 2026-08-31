# Arquitetura

## Papéis

| Peça | Onde roda | Função |
| --- | --- | --- |
| Coletor | Mac (Python 3, stdlib) ou Docker | Tokens, APIs, JSON `/usage` + painel `/` |
| Firmware | ESP32 | Wi-Fi, GET, desenho TFT |
| Wokwi | Simulador | Mesmo sketch, Wi-Fi simulada real (`WOKWI_SIM`) até o coletor no Mac |
| wokwigw | Gateway local (Mac) | Ponte entre a rede Wi-Fi simulada do Wokwi e a LAN real, porta 9011 |

## Fluxo (hardware)

1. Usuário inicia `./dev-collector.sh` no Mac (mesma LAN da ESP32) e, se quiser, abre o painel em `http://IP:8787/`.
2. Coletor consulta as APIs a cada ciclo do hub (`USAGE_INTERVAL_S`, padrão 60 s) e empurra o JSON por `GET /events`. `GET /usage` força um ciclo.
3. ESP32 conecta no Wi-Fi, abre SSE em `/events` (a partir de `USAGE_URL`), parseia JSON, redesenha.
4. O intervalo real das APIs é o ciclo do coletor, não o poll de cada cliente. Falha de um provedor não apaga o outro se o JSON ainda trouxer o campo.

## Fluxo (Wokwi)

O simulador roda a **mesma** lógica de rede do hardware (`WOKWI_SIM`). Para o ESP32 simulado alcançar o coletor:

1. `wokwi.toml` aponta `[net] gateway = "ws://localhost:9011"` — sem isso o simulador usaria a rede simulada padrão da Wokwi (sem saída pra LAN local).
2. `.tools/wokwigw` (binário do [Wokwi IoT Gateway](https://github.com/wokwi/wokwigw)) precisa estar rodando, escutando em `ws://localhost:9011`.
3. Com o gateway de pé, `host.wokwi.internal` dentro do simulador resolve para o `localhost` do Mac — por isso `USAGE_URL` do env `wokwi` é `http://host.wokwi.internal:8787/usage`.

`./dev-wokwi.sh` na raiz do repo sobe o coletor **e** o `wokwigw` juntos (ver [FIRMWARE.md](FIRMWARE.md)).

## Confiança e rede

- Tokens **só no Mac** (arquivos oficiais do app ou `collector/data/config.json`).
- JSON na LAN contém percentuais e datas, **não** o Bearer.
- Bind padrão `0.0.0.0:8787` para a ESP32 alcançar. Não expor a porta na internet (sem túnel, sem port forward).
- Coletor não autenticado na LAN de casa: aceitável para v1. Quem estiver no Wi-Fi vê as cotas.

## Por que não chamar as APIs na ESP32

- TLS + JWT grandes + SQLite + OAuth no ESP32 é frágil.
- Tokens no flash da placa são extraíveis.
- Trocar parser quando a API muda é mais fácil em Python.

## Dois firmwares, um sketch

`platformio.ini` define flags. `src/main.cpp` é único:

- `esp32dev`: ILI9488 320×480, Wi-Fi real
- `wokwi`: ILI9341 240×320, Wi-Fi simulada + coletor real via `wokwigw`
