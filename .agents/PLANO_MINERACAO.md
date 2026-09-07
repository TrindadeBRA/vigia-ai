# Plano — Mineração de Bitcoin (MVP)

Decisões já tomadas com o usuário (2026-09-06):

- **Branch**: implementação inteira em branch separada (ex.: `feature/mineracao-btc`), criada a partir de `develop`. Não commitar direto na `develop` — merge só quando validado em hardware real (ver "Como validar").
- Hashing roda **na mesma placa** que já mostra o painel TFT (ILI9488, `env:esp32dev`) — não numa segunda placa dedicada.
- **Mineração só roda numa rota/tela específica do ESP32** (`VIEW_MINER`, nova, seguindo o padrão de `View`/`uiSetView()` que já existe em `firmware/src/core/state.h` + `firmware/src/ui/views/*.cpp`). Não é um serviço de fundo que minera sempre — entrar na tela liga o hashing, sair desliga. A própria tela mostra dados e erros localmente (não só via web).
- MVP: sem estilo/front — só texto e dados, tanto na tela do ESP32 quanto no painel web. No painel, é **uma página dedicada** `/display/mining` (status + config remota juntos), no mesmo padrão de `/display/alarms` (`AlarmsPage.tsx`) — não um card solto no board arrastável nem espalhado em `/display/config`, pra não ter que integrar no sistema de tiles/drag-and-drop (`TileCards.tsx`/`ProviderMeta`) por algo que é só leitura+um formulário.
- Fonte de referência: `NerdMiner_v2` (`/Users/trindadebra/Documents/TrindadeBRA/NerdMiner_v2`), MIT license (Bitmaker, com trabalho anterior de Valerio Vaccaro/HAN) — dá pra portar código com atribuição no header dos arquivos novos.

## O que é, de fato

NerdMiner minera via **Stratum** num pool de solo mining (ex: `public-pool.io:3333`), fazendo duplo SHA256 do block header no ESP32. Hashrate típico: 30–90 kH/s — é loteria/educacional, não um miner lucrativo. O MVP aqui é: rodar esse motor de mineração na placa do vigia-ai e expor status/controle no painel web, do mesmo jeito que hoje o vigia expõe cotas de API.

## Risco principal — ler antes de implementar

O firmware atual do vigia-ai (`firmware/src/main.cpp`) é um `loop()` Arduino simples: sem FreeRTOS tasks próprias, UI (TFT+touch) e rede (SSE, tema) tudo cooperativo no mesmo core. O NerdMiner, ao contrário, roda o hashing como **task FreeRTOS dedicada, pinada num core**, justamente para não travar o resto. Colocar as duas coisas na mesma placa significa:

1. **Introduzir FreeRTOS tasks pela primeira vez** no firmware do vigia — a task de hashing não pode ser um loop bloqueante dentro de `loop()`, senão trava touch/TFT/SSE.
2. **Contenção de core**: o Arduino core do ESP32 já usa um core pra Wi-Fi/eventos por padrão. Pinar a task de mineração no core "livre" ainda compete com o `loopTask` (UI+rede) se não houver prioridade/yield bem calibrados. Mal configurado, isso gera watchdog reset ou UI travando.
3. **RAM/stack**: `TFT_eSPI` + `ArduinoJson` (tema, SSE) + buffers de mineração (merkle tree, coinbase, JSON do stratum) competindo no mesmo heap ~320KB do ESP32 clássico. NerdMiner já teve bugs históricos de memory leak (ver changelog do projeto) — revisar com atenção ao portar.
4. Mitigação proposta pro MVP: task de mineração com **prioridade baixa**, **enable/disable por config** (default **desligado**), e um "watchdog" simples (se a task de mineração não ceder tempo, ela é a única suspeita óbvia — dá pra desligá-la remotamente via o próprio endpoint de config sem reflash).
5. **Atenuante**: como a mineração fica presa a uma rota específica (`VIEW_MINER`, ver decisão acima), ela não compete com as outras telas/SSE o tempo todo — só enquanto o usuário está deliberadamente naquela tela. Isso reduz a superfície do risco (não é mais "24/7 em paralelo com tudo"), mas **não elimina**: enquanto a tela de mineração está ativa, ela ainda compete com o próprio touch/refresh dessa tela e com o `loop()` (Wi-Fi, watchdog do sistema). Validar em hardware continua obrigatório (ver "Como validar").

Se depois de testar em hardware real isso se mostrar instável mesmo restrito à rota, a alternativa é migrar pra placa dedicada (opção que o usuário já descartou pra esse MVP, mas vale deixar registrado).

## Escopo do MVP

**Dentro:**
- Motor de mineração (Stratum + duplo SHA256) portado do NerdMiner, **sem** as telas próprias dele (`ClockMiner`, `GlobalStats`) — só a lógica de mineração.
- **Uma rota nova no TFT** (`VIEW_MINER`), no padrão das views existentes (`firmware/src/ui/views/*.cpp` + `View` enum em `core/state.h`) — texto simples: status, hashrate, shares, melhor dificuldade, erros. Entrar nessa tela liga o hashing; sair desliga.
- Task FreeRTOS de baixa prioridade na placa, criada/destruída (ou pausada) junto com entrar/sair da `VIEW_MINER`, e controlável remotamente via config (liga/desliga geral, pool, wallet, worker).
- Placa reporta stats pro coletor periodicamente **enquanto estiver minerando** (hashrate, shares aceitas/rejeitadas, melhor dificuldade, block height, uptime, erros).
- Coletor guarda o último estado + config (`backend/data/mining.json`), expõe API pro painel.
- Painel web: página dedicada `/display/mining` com os dados em texto simples (sem estilização) — reflete o último report e deixa claro quando a placa não está na rota de mineração (dado parado, não "ao vivo") — e, na mesma página, a config remota (pool/porta/wallet/worker/liga-desliga).

**Fora do MVP (não implementar sem pedido explícito):**
- Telas de estilo do NerdMiner (`ClockMiner`, relógio, `GlobalStats` de rede) — a `VIEW_MINER` do vigia é só texto/dados, sem esse polimento.
- WifiManager/portal cativo do NerdMiner — a placa já resolve Wi-Fi via `secrets.h` (padrão do vigia), não precisa duplicar.
- SD card config, múltiplos boards, daisy-chain hashboards, ataque a BM1397 — tudo isso é fora de escopo do NerdMiner "in process"/hardware avançado, não se aplica aqui.
- Otimizações de hashrate (hardware SHA via `HARDWARE_SHA265`, midstate) — usar o que o NerdMiner já traz pronto, sem tunar além disso no MVP.

## Arquitetura

```
firmware/src/core/state.h        # + VIEW_MINER no enum View (View... = 15, VIEW_COUNT = 16)
firmware/src/ui/views/miner.cpp  # nova view, no padrão de bitcoin.cpp/status.cpp:
                                    # renderiza status/hashrate/shares/melhor dificuldade/
                                    # block height/erros em texto puro
                                    # entrar aqui -> chama mining_task start
                                    # sair daqui -> chama mining_task stop/pause
                                    # (mesmo padrão de tela dedicada que VIEW_THEME já usa
                                    # hoje: entra deliberadamente, não no ciclo normal de swipe)

firmware/src/mining/
  stratum_client.cpp/.h    # port ~quase literal de NerdMiner_v2/src/stratum.cpp/.h
                            # (JSON Stratum: subscribe/authorize/notify/submit/set_difficulty)
  sha256_miner.cpp/.h       # port de NerdMiner_v2/src/ShaTests/nerdSHA256plus.cpp/.h
                            # (duplo SHA256 otimizado, sem dependência de display)
  mining_task.cpp/.h        # port de NerdMiner_v2/src/mining.cpp/.h, tirando toda
                            # chamada a monitor.cpp/telas — só contadores em memória
                            # (hashrate, shares, best difficulty, job atual, último erro)
                            # roda como xTaskCreatePinnedToCore, prioridade baixa
                            # start()/stop() chamados por ui/views/miner.cpp ao
                            # entrar/sair da VIEW_MINER — nunca roda fora dela

firmware/src/net/mining_client.cpp/.h   # novo, no padrão de net/client.cpp e
                                          # net/theme_server.cpp:
  - GET  <coletor>/api/mining/config   # busca pool/porta/wallet/worker/enabled (remoto)
  - POST <coletor>/api/mining/report   # empurra stats a cada N segundos (ex: 30s),
                                          # só enquanto mining_task estiver rodando

backend/src/schemas/mining.ts   # Zod: MiningConfig, MiningReport, MiningStatus
                                  # reexportado em schemas/index.ts
backend/src/routers/mining.ts   # GET/PUT /api/mining/config (config.json-like)
                                  # POST /api/mining/report (placa -> coletor)
                                  # GET  /api/mining/status (painel -> coletor, snapshot em memória)
backend/data/mining.json         # persistência simples (gitignored, como config.json)

frontend/src/pages/config/MiningPage.tsx    # página dedicada /display/mining (status + config
                                               # juntos, padrão AlarmsPage.tsx), poll próprio de
                                               # /api/mining/status a cada 5s — não usa o hub de
                                               # usage (regra 4 do CLAUDE.md é só pro ciclo de
                                               # cotas de assinatura)
frontend/src/pages/config/miningCopy.ts     # i18n pt/en/es da página, padrão alarmsCopy.ts
frontend/src/api/client.ts                  # fetchMiningConfig/saveMiningConfig/fetchMiningStatus
frontend/src/api/types.ts                   # MiningConfig/MiningStatus (espelham o Zod do backend)
frontend/src/components/icons.tsx           # PickaxeIcon (ícone da rota no sidebar)
frontend/src/pages/display/Sidebar.tsx      # link "Mineração" (mesmo grupo de Alarmes/Tema)
frontend/src/pages/Display.tsx, App.tsx     # rota /display/mining (+ redirect /display/mineracao)
```

### Dados mostrados (texto puro, sem estilo) — na `VIEW_MINER` do device E em `/display/mining`

- Status: `parado (fora da rota)` / `sem wi-fi` / `conectando pool` / `minerando` / `pool offline` / erro específico (ex.: "wallet não configurada", "stratum: auth falhou")
- Hashrate atual e média (kH/s)
- Shares aceitas / rejeitadas
- Melhor dificuldade encontrada (recorde — o "placar" do NerdMiner)
- Block height atual (via stratum notify)
- Pool + worker configurados
- Uptime da sessão de mineração atual (zera ao sair da rota)
- Último erro (texto curto, ex.: motivo da última desconexão do pool)
- No painel web, além disso: timestamp do último report recebido — se estiver velho (`stale`, calculado pelo backend), deixa claro que a placa não está na rota de mineração agora.

### Config remota (via `/display/mining`, guardada em `backend/data/mining.json`, nunca no firmware)

- `enabled` (bool, default **false**) — **switch mestre remoto**: se falso, a `VIEW_MINER` mostra "mineração desativada nas configurações" e não liga o hashing mesmo que o usuário entre na tela. Serve como trava de segurança sem precisar reflash.
- `poolUrl` / `poolPort` (default sugerido: `public-pool.io` / `3333` — pool recomendado p/ low-difficulty shares)
- `btcWallet` (endereço de payout — não é segredo, mas não vai pro firmware compilado nem pro git; sem wallet preenchida, `VIEW_MINER` recusa minerar, mesma regra do NerdMiner)
- `workerName` (opcional, sufixo `.nome` no wallet, como o NerdMiner faz)

Quem decide **se pode** minerar é a config remota (`enabled` + `btcWallet`); quem decide **quando de fato está minerando neste momento** é estar ou não na `VIEW_MINER` no device.

## Passos de implementação (ordem sugerida)

1. **Backend primeiro** (sem tocar em firmware): schema `mining.ts`, router `mining.ts`, `mining.json`, testes. Dá pra validar contrato JSON isolado. ✅ feito.
2. **Frontend**: `MiningPage.tsx` (`/display/mining`) + `miningCopy.ts`, apontando pro backend já pronto (mock manual via `curl -X POST` no `/api/mining/report` pra testar a página sem firmware). ✅ feito.
3. **Firmware — port do motor**: `stratum_client`, `sha256_miner` (`nerd_sha256.*`), `mining_math` (target/merkle/header) e `mining_task` com `Start()`/`Stop()` explícitos. ✅ feito — só o worker de software (sem `HARDWARE_SHA265`, ver "Decisões de implementação" abaixo).
4. **Firmware — nova rota**: `VIEW_MINER` em `core/state.h` + `ui/views/miner.cpp` (renderiza texto/erros). Entrada: faz parte do carrossel de swipe Início→Sistema→Mineração (não um item na grade da Home) — `uiSetView()` em `ui/nav.cpp` chama `miningClientEnterView()`/`ExitView()` ao entrar/sair. ✅ feito.
5. **Firmware — cliente de rede**: `net/mining_client.cpp` (busca config remota ao entrar na view + a cada 20s, só reinicia a task se a config mudou de verdade; envia report a cada 10s), plugado no `loop()` (não bloqueante). ✅ feito.
6. **Validar em hardware real, na rota**: entrar na `VIEW_MINER` e checar — touch da própria tela responde? Sair da tela realmente para o hashing? SSE do usage em outras telas continua chegando normalmente? Sem watchdog reset depois de um tempo minerando? **Ainda não feito — só validado em compilação (`./dev firmware build`/`wokwi`), não em placa física.**
7. Atualizar `AGENTS.md`/`.agents/CONTEXTO_IA.md` (tabela de arquivos) e `CONTRATO_JSON.md` só se o `/usage` mudar — mineração é contrato **novo**, não mexe no existente. ✅ feito (`.agents/CONTEXTO_IA.md`; `/usage` não mudou).

## Decisões de implementação (não previstas no plano original)

- **Sem `HARDWARE_SHA265`**: só o worker de software (`minerWorkerSw` do NerdMiner) foi portado. O caminho de hardware do NerdMiner mexe direto em registrador SHA do ESP32 (endereços `SHA_TEXT_BASE`/`SHA_H_BASE`, hacks por variante S2/S3/C3/clássico) — é a parte mais frágil e menos portável do projeto original, e o ganho de hashrate não compensa o risco numa "loteria" de baixo hashrate.
- **Watchdog nunca é tocado**: o NerdMiner original chama `disableCore0WDT()` porque satura um core de propósito. Como isso rodaria ao lado do `loopTask`/touch/TFT do vigia, optei por manter o watchdog padrão ativo e fazer a task de hashing ceder a CPU periodicamente (`vTaskDelay(1)` a cada ~1024 nonces) — o watchdog continua sendo uma rede de segurança de verdade em vez de ser desligado.
- **Tasks paráveis**: diferente do NerdMiner (que nunca para), as duas tasks (`Stratum` + `MiningHash`) rodam `while (!stopRequested)` e se auto-destroem — necessário porque aqui minerar é atado à `VIEW_MINER`, não um serviço permanente. Cuidado de implementação: `vTaskDelete(NULL)` não desenrola a pilha C++, então a lógica de verdade fica em funções separadas (`stratumTaskBody`/`hashWorkerTaskBody`) que retornam normalmente antes da trampolina chamar `vTaskDelete` — senão vazava a última alocação de cada `shared_ptr`/`std::map`/`String` a cada ciclo de entrar/sair da tela.
- **Dois bugs do NerdMiner original corrigidos ao portar** (`checkValid`, nunca notados na prática por só rodarem quando uma hash já bate 32 bits de zero): `memcpy(diff_target, &target, 32)` copiava o endereço do ponteiro, não os bytes; e o loop de comparação usava `uint8_t i` decrescente com `i >= 0` (nunca falso — wraparound). Ver comentário em `firmware/src/mining/mining_math.cpp`.
- **`board_build.partitions = huge_app.csv`**: a mineração empurrou o firmware pra 97% da partição padrão (~1,31MB de app). NerdMiner_v2 documenta a mesma exigência. Com `huge_app.csv` (~3MB de app, sem OTA) o uso caiu pra ~40%. **Atenção**: trocar o esquema de partição pede "Erase Flash" (apagar tudo) no próximo flash de uma placa que já tinha o firmware antigo — senão o offset da SPIFFS/LittleFS do tema muda e o papel de parede salvo fica ilegível. Nenhuma placa foi flashada ainda nesta sessão.
- **Block height fora do MVP**: o NerdMiner busca isso numa API HTTP externa (block explorer), não vem do job do Stratum. Pra não adicionar mais uma dependência de rede externa no firmware sem o usuário pedir, o campo existe no contrato (`blockHeight`) mas a placa sempre manda `0` — o painel web já trata isso (mostra "—").

## Como validar

- `./dev test` — schemas/router do backend. ✅ passou (6 testes novos de mining, suíte completa sem regressão — 1 teste pré-existente e não relacionado, `GET /api/config não vaza token`, é flaky por timeout sob carga, confirmado antes desta feature).
- Página `/display/mining` com dados mockados via `curl` antes de tocar em firmware. ✅ feito (backend isolado em porta separada, sem mexer no app Electron real do usuário que já estava rodando).
- `./dev firmware build` e `./dev firmware wokwi` — ambos compilam e linkam limpo (zero warnings), Flash em ~40%/41% com `huge_app.csv`. ✅ feito.
- `./dev wokwi` (simulador completo, não só compilar): o Stratum *pode* funcionar via `wokwigw` (tem internet real, mesmo caminho já usado pro SSE do `/usage`) — dá pra validar handshake com o pool, JSON do report e a página no painel. **Não** valida o risco principal do plano: o Wokwi simula touch via **FT6206**, não o **XPT2046** real (regra 8 do `CLAUDE.md`), e o timing do simulador não é ciclo-a-ciclo igual ao silício. **Ainda não rodado** nesta sessão.
- Hardware real: único jeito de validar de fato a estabilidade (sem watchdog reset, touch responsivo) — obrigatório antes de considerar o MVP pronto, não é opcional. **Ainda não feito.**

## Em aberto (usuário decide depois, não é bloqueio pro plano)

- ~~Endereço BTC de payout~~ — **definido**: o usuário já passou a wallet (endereço bech32, formato `bc1q...`, mainnet, P2WPKH) na conversa. Seguindo a própria regra deste plano ("não vai pro firmware nem pro git"), o endereço **não fica escrito neste arquivo versionado** — ele entra direto em `backend/data/mining.json` (gitignored) no passo 1/2 da implementação, informado pelo usuário no momento de configurar.
- Nome do worker: opcional, sufixo `.nome` no wallet — decidir na hora de configurar.
- Qual pool usar (sugestão: `public-pool.io`, é o recomendado pelo próprio NerdMiner pra low-difficulty shares).

---

Este arquivo é só o **plano**. Implementação começa com um pedido explícito (ex.: "implementa o passo 1").
