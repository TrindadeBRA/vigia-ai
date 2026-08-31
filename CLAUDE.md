# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## O que é isto

**Vigia AI**: um painel de mesa — ESP32 + tela touch TFT 3,5" mostra as cotas de uso das assinaturas Claude, Cursor e OpenRouter, em várias telas (início, detalhe Claude, detalhe Cursor, detalhe OpenRouter, info). A placa nunca guarda tokens. Um coletor Python rodando no Mac lê credenciais locais (ou um `.env`), chama as APIs autenticadas das assinaturas, e serve um resumo em JSON na LAN. O firmware só faz um HTTP GET nesse JSON e desenha a UI.

Idioma da UI e da documentação: **português (Brasil)**. Identificadores de código são em inglês.

## Comece por aqui: `docs/`

A documentação de verdade deste repo vive em `docs/`, escrita para humanos e para agentes de IA. **Leia `docs/CONTEXTO_IA.md` primeiro** — é o ponto de entrada para agentes e lista as regras obrigatórias para gerar código aqui (tratamento de tokens, contrato JSON, risco de rate limit sem cache, restrições de GPIO, limites de escopo). Depois vá para o doc específico da área que você está mexendo:

| Doc | Cobre |
| --- | --- |
| [docs/CONTEXTO_IA.md](docs/CONTEXTO_IA.md) | Ponto de entrada para agentes + regras para código gerado — ler antes de editar qualquer coisa |
| [docs/PLANO.md](docs/PLANO.md) | Escopo, fases, o que já está feito |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Fluxo de dados Coletor ↔ ESP32 ↔ APIs e limites de confiança |
| [docs/CONTRATO_JSON.md](docs/CONTRATO_JSON.md) | Formato do `GET /usage` — não quebrar sem atualizar este doc **e** o parser do firmware |
| [docs/APIS_CLAUDE.md](docs/APIS_CLAUDE.md) | Endpoint de uso OAuth da Anthropic (não oficial) |
| [docs/APIS_CURSOR.md](docs/APIS_CURSOR.md) | Dashboard Connect RPC do Cursor (não oficial) |
| [docs/APIS_OPENROUTER.md](docs/APIS_OPENROUTER.md) | Endpoint público de créditos da key OpenRouter |
| [docs/HARDWARE.md](docs/HARDWARE.md) | Placa, pinagem, drivers de TFT |
| [docs/TOUCH.md](docs/TOUCH.md) | Views, touch XPT2046, calibração, emulação de touch no Wokwi |
| [docs/COLETOR.md](docs/COLETOR.md) | Rodar/autenticar o servidor coletor local |
| [docs/FIRMWARE.md](docs/FIRMWARE.md) | Ambientes PlatformIO, Wokwi, `secrets.h` |
| [docs/DECISOES.md](docs/DECISOES.md) | Por que as escolhas atuais foram feitas (ler antes de propor mudança de arquitetura) |

## Comandos

Coletor (Mac, só stdlib do Python 3):
```bash
cd collector
cp .env.example .env    # opcional, para sobrescrever tokens
python3 server.py
curl -s http://127.0.0.1:8787/usage | python3 -m json.tool   # conferir
```

Firmware (PlatformIO):
```bash
cp src/secrets.h.example src/secrets.h   # preencher Wi-Fi + USAGE_URL; gitignored
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

Simulador Wokwi (coletor de verdade sobre Wi-Fi simulada, não é mock):
```bash
./dev-wokwi.sh          # sobe o coletor + wokwigw (gateway de rede local) juntos
pio run -e wokwi
# depois Cmd+Shift+P -> "Wokwi: Start Simulator"
# sem painel resistivo no Wokwi: use os botões Prev/Next ou as teclas seriais n/p/0/1/2/3
```
Sem o `wokwigw` rodando, `host.wokwi.internal` (o `USAGE_URL` do simulador) não alcança o coletor e os cards mostram `coletor HTTP -1`. Ver `docs/FIRMWARE.md#rede-no-wokwi-wokwigw`.

`pio run` sem `-e` builda os dois ambientes (`esp32dev` e `wokwi`).

## Arquitetura

Três peças, um único sketch de firmware:

- **`collector/server.py`** — só o servidor HTTP na porta `:8787`: `Handler`/`CollectorServer` e `main()`. **Sem cache** — cada `GET /usage` chama as três APIs na hora (a pedido do usuário; risco de rate limit no Claude, ver `docs/COLETOR.md`). Lê `.env`/`.env.claude`/`.env.cursor`/`.env.openrouter` via `http_util.load_dotenv`. A lógica de cada provedor mora em `collector/providers/claude.py`, `collector/providers/cursor.py` e `collector/providers/openrouter.py` (busca + parse do payload); datas/percentuais compartilhados ficam em `collector/formatting.py`; a leitura do `state.vscdb` do Cursor (usada pelo coletor **e** por `gerar_env_cursor.py`) mora em `collector/cursor_state.py`. Falha em um provedor não pode derrubar os outros; `ok: false` no objeto daquele provedor é o contrato.
- **`src/main.cpp`** — só `setup()`/`loop()` (ciclo de vida Arduino) + o caminho mock de boot. Wi-Fi e o GET/parse de `/usage` (ArduinoJson) estão em `src/usage_client.cpp`.
- **`src/ui.cpp`** — controlador das views (Início, detalhe Claude/Cursor/OpenRouter, Info): navegação, toque, redesenho. A pintura de cada view mora em `src/ui_views.cpp`; helpers de formatação/desenho reutilizáveis (barra, botão, texto de data) em `src/ui_format.cpp`.
- **`src/input.cpp`** — touch (XPT2046 no hardware), botões Prev/Next (Wokwi), entrada por tecla serial.

O `platformio.ini` builda o *mesmo* sketch `src/main.cpp` em dois ambientes, diferenciados só por `build_flags`:

- `esp32dev` — placa real 3,5", ILI9488 320×480, Wi-Fi real + HTTP pro coletor.
- `wokwi` — ILI9341 240×320, Wi-Fi simulada (`WOKWI_SIM`) que alcança o mesmo coletor real através do `wokwigw`, um gateway de rede local (`wokwi.toml` → `ws://localhost:9011`; binário em `.tools/wokwigw`). `MOCK_USAGE` ainda existe em `src/main.cpp` como caminho de fallback, mas nenhum env compila com ele hoje — não presuma que o simulador mostra dados falsos.

Tokens existem só no Mac (arquivos oficiais dos apps ou `collector/.env`, ambos gitignored). A placa e o JSON na LAN nunca carregam um Bearer token — só percentuais e datas calculados. Não adicione autenticação ao coletor nem exponha a porta 8787 fora da LAN sem que peçam; é uma decisão deliberada da v1 (ver `docs/DECISOES.md`).

Os endpoints de uso das assinaturas usados aqui são os mesmos que o Claude Code CLI e a IDE do Cursor usam internamente — **não** são a API paga por token e não são um contrato público estável. Trate respostas 401/429/HTML como falha específica de um provedor, não como um crash.
