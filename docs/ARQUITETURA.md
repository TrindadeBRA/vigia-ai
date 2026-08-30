# Arquitetura

## Papéis

| Peça | Onde roda | Função |
| --- | --- | --- |
| Coletor | Mac (Python 3, stdlib) | Lê tokens, chama Anthropic/Cursor, cache, HTTP JSON |
| Firmware | ESP32 | Wi-Fi, GET, desenho TFT |
| Wokwi | Simulador | Mesmo sketch com `MOCK_USAGE`, sem rede |

## Fluxo (hardware)

1. Usuário inicia `python3 collector/server.py` no Mac (mesma LAN da ESP32).
2. Coletor, no máximo a cada `CACHE_TTL_SECONDS` (padrão 300), busca cotas.
3. ESP32 conecta no Wi-Fi, faz GET em `USAGE_URL`, parseia JSON, redesenha.
4. Poll a cada `USAGE_POLL_MS` (padrão 5 min). Falha de um provedor não apaga o outro se o JSON ainda trouxer o campo.

## Confiança e rede

- Tokens **só no Mac** (arquivos oficiais do app ou `collector/.env`).
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
- `wokwi`: ILI9341 240×320, `MOCK_USAGE` (dados fixos)
