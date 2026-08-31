# Contexto para agentes de IA

Leia este arquivo **antes** de alterar o repositório. Complementos:

| Arquivo | Quando usar |
| --- | --- |
| [PLANO.md](PLANO.md) | Escopo, fases, o que já está feito (protótipo) |
| [REESCRITA.md](REESCRITA.md) | Plano de monorepo público: firmware + backend + frontend React |
| [ARQUITETURA.md](ARQUITETURA.md) | Coletor ↔ ESP32 ↔ APIs |
| [CONTRATO_JSON.md](CONTRATO_JSON.md) | Formato de `/usage` (não quebrar o firmware) |
| [APIS_CLAUDE.md](APIS_CLAUDE.md) | OAuth usage da Anthropic |
| [APIS_CURSOR.md](APIS_CURSOR.md) | Dashboard Connect RPC do Cursor |
| [APIS_OPENROUTER.md](APIS_OPENROUTER.md) | Endpoint público de créditos da key OpenRouter |
| [APIS_DEEPSEEK.md](APIS_DEEPSEEK.md) | Endpoint público de saldo da key DeepSeek |
| [HARDWARE.md](HARDWARE.md) | Placa, pinos, drivers TFT |
| [TOUCH.md](TOUCH.md) | Views, XPT2046, calibração, Wokwi |
| [COLETOR.md](COLETOR.md) | Como rodar e autenticar o servidor local |
| [FIRMWARE.md](FIRMWARE.md) | PlatformIO, Wokwi, `secrets.h` |
| [DECISOES.md](DECISOES.md) | Por que as escolhas atuais |

## O que é este projeto

**Vigia AI**: painel de mesa — **ESP32 + TFT 3,5" touch** mostra cotas das assinaturas **Claude**, **Cursor**, **OpenRouter** e **DeepSeek**, com **várias telas**. A placa **não** guarda tokens. Um **coletor Python no Mac** lê credenciais locais (ou `collector/data/config.json` gravado pelo painel), chama as APIs autenticadas e serve JSON na LAN. O firmware faz HTTP GET nesse JSON e desenha a UI.

Idioma da UI e da documentação: **português (Brasil)**. Código (identificadores) em inglês.

## Regras para quem gera código

1. **Tokens nunca vão no firmware**, no `diagram.json`, nem em commit. Só `collector/data/config.json` (gitignored) ou arquivos locais do Claude/Cursor.
2. **Não altere o contrato JSON** sem atualizar `docs/CONTRATO_JSON.md` **e** o parser em `src/usage_client.cpp`.
3. Endpoints de cota são **não oficiais**. Trate 401/429/HTML como falha de um provedor; o outro deve continuar `ok` se possível.
4. **Coletor sem cache** (a pedido do usuário — dado sempre em tempo real): todo `GET /usage` chama as duas APIs na hora. Isso deixa o poll da placa (`USAGE_POLL_MS`, padrão 60 s) como o intervalo real de chamada ao Claude — o endpoint rate-limita se martelado; ver `docs/COLETOR.md#sem-cache--cuidado-com-rate-limit`. Não reintroduza cache sem o usuário pedir.
5. Ambiente **Wokwi**: Wi-Fi simulada + coletor real via `wokwigw` (`docs/ARQUITETURA.md#fluxo-wokwi`), igual ao **esp32dev** (Wi-Fi + HTTP real). `MOCK_USAGE` existe no código mas nenhum env compila com ele hoje — não presumir dados fictícios no simulador.
6. GPIO **2** é `TFT_DC`. Não usar como LED de heartbeat.
7. Não commitar `collector/data/config.json`, `src/secrets.h` com senha real, nem dumps de `state.vscdb` / `.credentials.json`.
8. Touch: XPT2046 no hardware (`TOUCH_CS`); Wokwi usa FT6206 no `board-ili9341-cap-touch` (I2C 21/22) e botões GPIO 13/5. Não trocar o controlador da placa real.
9. Não expandir escopo (GPT, MQTT) sem o usuário pedir.

## Mapa de arquivos que importam

```
collector/server.py        # HTTP :8787, /usage + painel /
collector/panel.py         # GET/POST /api/config (grava data/config.json, sem devolver tokens)
collector/store.py         # persistência JSON (volume Docker em /app/data)
collector/web/index.html   # UI do painel
collector/web/display.html # Réplica web do firmware (React sem build, GET /usage), rota /display
collector/web/vendor/      # React/ReactDOM UMD vendorizados (sem CDN externo)
collector/start.sh         # python local ou `docker`
collector/providers/       # busca + parse: claude.py, cursor.py, openrouter.py, deepseek.py
collector/formatting.py    # datas (BRT) e percentuais/centavos compartilhados
collector/cursor_state.py  # leitura do state.vscdb + JWT exp (painel e provedor)
src/main.cpp              # setup()/loop(), mock de boot
src/usage_client.cpp       # Wi-Fi, GET, parse do JSON de /usage
src/ui.cpp                # controlador: navegação, toque, redesenho
src/ui_views.cpp           # pintura das views (home, detalhes, info)
src/ui_format.cpp          # widgets: barra, botão, formatação de texto
src/input.cpp              # touch / botões / serial
src/secrets.h.example
platformio.ini
diagram.json
```

## Como validar

- Coletor: `./dev-collector.sh` e abra `http://127.0.0.1:8787/` ; `curl -s http://127.0.0.1:8787/usage`
- Firmware simulado: `./dev.sh` (Wokwi: compila + sobe coletor/`wokwigw`), depois Wokwi Simulator
- Hardware: `src/secrets.h` preenchido, `./dev.sh` e escolha placa → gravar

## Tom

Explicar de forma direta. Usuário pode não conhecer embedded; não assumir jargão sem uma linha de contexto.
