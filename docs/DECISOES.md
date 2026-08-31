# Decisões

## Coletor no Mac, não na nuvem

Cotas são da conta pessoal. Evita hospedar JWT/OAuth. LAN é suficiente para um painel na mesa.

## Python stdlib, não Node

`http.server`, `urllib`, `sqlite3`, `json` já vêm no macOS. Menos setup para quem não é dev.

## Endpoints internos, não scraping HTML

Mesma fonte do CLI/IDE. HTML do dashboard quebra mais. Risco: contrato não oficial (documentado em `APIS_*.md`).

## Um JSON, um GET, um parse — mas cada provedor é uma lista de contas

Continua um único `GET /usage` por ciclo (decisão original: firmware pequeno, provedor com `ok: false` não derruba o HTTP). O que mudou: cada provedor deixou de ser um objeto único e virou uma **lista de contas** (`docs/CONTRATO_JSON.md`), pra suportar múltiplas assinaturas do mesmo provedor (ex.: Claude pessoal + Claude da empresa), cada uma com apelido opcional. Quem tem uma conta só (o caso comum) não vê diferença nenhuma — lista com 1 item. O firmware guarda no máximo `MAX_ACCOUNTS` (5) por provedor; excedentes são ignorados (log serial, nunca trava) — o coletor e o `/display` não têm esse teto.

Decisão de UI física: a Início continua com no máximo 4 cards, um por *tipo* de provedor (não por conta) — dar scroll à Início pra caber N contas seria uma mudança bem maior, numa tela de 3,5". Com mais de uma conta, o card mostra a que mais precisa de atenção (maior percentual) e o detalhe ganha um paginador `‹ i/N ›` pra ver as outras. O mostrador web (`/display`) não tem esse limite de tela — lá cada conta é um card próprio.

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

## Painel web no mesmo processo (config)

`GET /` é o painel (portas, IPs LAN, tokens). `GET /usage` não muda. Sem Node: HTML estático + `http.server`. Segredos não voltam no `GET /api/config` (só sufixo e origem).

## Docker opcional

`./dev-collector.sh docker`. O container não lê Keychain. Cursor: overlay `compose.credentials.yaml` (bind-mount somente leitura). Claude no Mac Docker: Python local ou token colado (plano B). No Mac da mesa, Python local continua o caminho mais simples.

## Login local, sem copiar token

Claude e Cursor: Keychain / `state.vscdb` primeiro; paste no painel só se o app não estiver neste PC. Não usar `gerar_env_*.py` para gravar Bearer em `config.json`. O coletor não faz refresh OAuth/JWT próprio — abra o app oficial para renovar.

## Sem autenticação no coletor (v1)

Rede doméstica. Quem pedir rede hostil pode acrescentar um token estático no header depois, no coletor **e** no firmware.
