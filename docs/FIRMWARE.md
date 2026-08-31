# Firmware (PlatformIO)

## Ambientes

| Env | Driver | Rede | Uso |
| --- | --- | --- | --- |
| `esp32dev` | ILI9488 | Wi-Fi + GET | Placa real |
| `wokwi` | ILI9341 | Wi-Fi simulada (`WOKWI_SIM`) + GET via `wokwigw` | Simulador |

`MOCK_USAGE` existe no código (`src/main.cpp`) mas nenhum dos dois envs define essa flag hoje — os dois falam com um coletor de verdade.

## Rede no Wokwi (`wokwigw`)

O simulador só alcança `collector/server.py` no Mac com um gateway de rede local rodando — sem ele, `host.wokwi.internal` (o `USAGE_URL` do env `wokwi`) não resolve pra lugar nenhum e o card mostra `coletor HTTP -1`.

```bash
./dev-wokwi.sh
```

Sobe o coletor **e** o `.tools/wokwigw` juntos (`Ctrl+C` encerra os dois). Pra rodar na mão:

```bash
cd collector && python3 server.py &
.tools/wokwigw    # ou so `wokwigw` se ~/bin estiver no PATH
```

`wokwi.toml` já aponta pro gateway (`[net] gateway = "ws://localhost:9011"`) — não mexer nisso sem trocar o binário/porta junto. Detalhes de por que o Wokwi precisa disso: [ARQUITETURA.md](ARQUITETURA.md#fluxo-wokwi).

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

Helper na raiz do repo (`./dev.sh` pergunta Wokwi ou placa). O `./dev-wokwi.sh` continua sendo só coletor + gateway:

```bash
./dev.sh                # helper: pergunta o fluxo
./dev.sh wokwi          # pio run -e wokwi
./dev.sh placa          # pio run -e esp32dev
./dev.sh upload         # pio run -e esp32dev -t upload
./dev.sh monitor        # pio device monitor -b 115200
./dev.sh flash          # upload + monitor
```

Equivalente na mão:

```bash
pio run -e wokwi
pio run -e esp32dev
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

Serial: SSID (não a senha), URL, HTTP status, erros de parse.

## Touch

No env `esp32dev`: `TOUCH_CS=21`, `SPI_TOUCH_FREQUENCY`. Ver [TOUCH.md](TOUCH.md).

No Wokwi: sem painel resistivo — botões GPIO 5 (Info/Início) e 13 (Início/Info), ou FT6206 capacitivo da peça `board-ili9341-cap-touch`. Serial: `n` `p` `0-4` `l` `g` `u` `d` `r`.

## Bibliotecas

- `TFT_eSPI` — tela e XPT2046 (quando `TOUCH_CS` está definido)
- `ArduinoJson` — parse do `/usage`
- `WiFi` / `HTTPClient` — core ESP32 Arduino
- `Preferences` — calibração do toque e layout da home (NVS)

## Poll

`USAGE_POLL_MS` (padrão 60000 nos dois envs). Primeira busca logo após o Wi-Fi associar (`src/usage_client.cpp`). O header mostra um selo amarelo com a contagem regressiva até o próximo poll, e um check verde por ~1,5 s quando um refresh dá certo (`src/ui_views.cpp`).

O coletor não cacheia mais: cada poll da placa dispara uma chamada real às APIs de Claude e Cursor. Ver aviso de rate limit em [COLETOR.md](COLETOR.md#sem-cache--cuidado-com-rate-limit) antes de baixar `USAGE_POLL_MS`.
