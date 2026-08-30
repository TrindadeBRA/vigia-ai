# Firmware (PlatformIO)

## Ambientes

| Env | Driver | Rede | Uso |
| --- | --- | --- | --- |
| `esp32dev` | ILI9488 | Wi-Fi + GET | Placa real |
| `wokwi` | ILI9341 + `MOCK_USAGE` | Não | Layout no simulador |

## Segredos Wi-Fi

Copiar e editar (arquivo **não** versionado se você criar `src/secrets.h`):

```bash
cp src/secrets.h.example src/secrets.h
```

```cpp
#define WIFI_SSID "nome-da-rede"
#define WIFI_PASSWORD "senha"
#define USAGE_URL "http://192.168.0.10:8787/usage"
```

Sem `secrets.h`, o build usa placeholders (`SUA_REDE`…) e o Wi-Fi falha até você criar o arquivo certo.

Não commitar senha real. Ver `.gitignore`.

## Comandos

```bash
pio run -e wokwi
pio run -e esp32dev
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

Serial: SSID (não a senha), URL, HTTP status, erros de parse.

## Touch

No env `esp32dev`: `TOUCH_CS=21`, `SPI_TOUCH_FREQUENCY`. Ver [TOUCH.md](TOUCH.md).

No Wokwi: `MOCK_USAGE`, botões GPIO 5 (próxima) e 13 (anterior). Serial: `n` `p` `0-3` `r`.

## Bibliotecas

- `TFT_eSPI` — tela e XPT2046 (quando `TOUCH_CS` está definido)
- `ArduinoJson` — parse do `/usage`
- `WiFi` / `HTTPClient` — core ESP32 Arduino
- `Preferences` — calibração do toque (NVS)

## Poll

`USAGE_POLL_MS` (padrão 300000). Primeira busca logo após o Wi-Fi associar.
