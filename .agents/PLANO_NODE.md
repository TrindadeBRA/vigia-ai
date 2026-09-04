# Plano — Port do coletor para Node.js (fim do Python no projeto)

> Status: **proposto**, branch `feature/python-to-node`.
> Objetivo: reescrever `backend/app` (FastAPI/Python, ~8.3k linhas) em **Node.js + TypeScript**, preservando byte a byte o contrato JSON (`CONTRATO_JSON.md`), o stream SSE (`GET /events`) e o comportamento observável de cada provedor — e então **remover o Python do repositório** (`.venv`, `pyproject.toml`, `pytest`, `ruff`, `PyInstaller`).
>
> Isto **reverte** a decisão registrada em [`DECISOES.md`](DECISOES.md#app-desktop-com-o-coletor-embarcado-não-reescrito) e na Opção B de [`PLANO_ELECTRON.md §2`](PLANO_ELECTRON.md), que rejeitava essa reescrita pelo risco de divergir do JSON que `firmware/src/net/parse.cpp` espera. O risco continua real — este plano existe para geri-lo (§5, §6), não para negá-lo.

Leia antes: [`ARQUITETURA.md`](ARQUITETURA.md), [`CONTRATO_JSON.md`](CONTRATO_JSON.md), [`BACKEND.md`](BACKEND.md), [`DESKTOP.md`](DESKTOP.md), [`PLANO_ELECTRON.md`](PLANO_ELECTRON.md), [`CONTEXTO_IA.md`](CONTEXTO_IA.md).

---

## 1. Ponto de partida

| Peça | Hoje | Depois deste plano |
| --- | --- | --- |
| Coletor | Python 3.11+ / FastAPI + Uvicorn, ~8.3k linhas (`backend/app`) | Node.js 22 LTS + TypeScript, mesma árvore de responsabilidades |
| Testes do coletor | pytest, ~1.1k linhas, 12 arquivos | Vitest, portados 1:1 por arquivo |
| Empacotamento desktop | PyInstaller `--onedir` (`scripts/build-sidecar.sh`) → binário de ~54 MB por SO | bundle esbuild (`.js` + `node_modules` de produção) — **sem binário nativo compilado por SO** (ver §7) |
| Frontend | React 18 + TS + Vite (`frontend/`) | **inalterado** — só consome `/usage` e `/events` |
| Firmware | C++ / PlatformIO / ESP32 | **inalterado** — só fala HTTP/SSE, não sabe que o coletor mudou de linguagem |
| Docker | `Dockerfile` multi-stage `node:20-alpine` (build do frontend) → `python:3.12-slim` (runtime) | single-stage `node:20-alpine` (build do frontend **e** runtime do backend) |

Fatos que condicionam o plano:

1. **O contrato é o firmware, não o código.** `firmware/src/net/parse.cpp` foi escrito contra o JSON de `schemas.py`, não contra o Python que o gera. Qualquer runtime que produza o mesmo JSON, nos mesmos endpoints, com o mesmo framing SSE, é invisível para a placa.
2. **12 "provedores" são clientes HTTP com parsing específico**, não lógica de negócio complexa — cada um em `backend/app/providers/*.py` é: montar headers/URL → `GET`/`POST` → extrair campos do JSON de resposta → normalizar percentual/data/centavos. Isso porta quase mecanicamente para `fetch`/TypeScript.
3. **Três provedores dependem de leitura de estado local do SO** (`backend/app/local/*.py`): Keychain do macOS (subprocesso `security`), `~/.codex/auth.json` (JSON puro) e `state.vscdb` do Cursor (SQLite ~1 GB, copiado antes de ler). São a parte mais delicada de portar (§4.2).
4. **`app/routers/wallpapers.py` usa Pillow** para crop+resize+conversão RGB565 (tela da ESP32) — é o único ponto com processamento de imagem pesado, e tem uma proteção SSRF documentada em `SECURITY_REVIEW.md` (Finding 1) que **precisa** sobreviver ao port linha por linha (§4.9).
5. **A concorrência interna simplifica no Node.** Hoje `app/usage.py` roda 9 chamadas HTTP bloqueantes num `ThreadPoolExecutor` porque `httpx.Client` é síncrono e o hub roda em asyncio. Em Node, `fetch` já é assíncrono nativamente — o equivalente vira um `Promise.all`, sem thread pool.
6. **O app Electron já é 100% Node.** `desktop/src/*.ts` roda no mesmo runtime que o coletor vai passar a usar. Isso elimina a necessidade de compilar um binário Python por SO (PyInstaller) — o maior ponto de atrito documentado em `PLANO_ELECTRON.md §8` e `§11` some (ver §7).

---

## 2. Decisões de arquitetura

### 2.1 Framework HTTP

| Opção | Prós | Contras |
| --- | --- | --- |
| **Fastify + Zod ✅ recomendado** | Schemas Zod = equivalente direto dos modelos Pydantic (`schemas.py`); `@fastify/swagger` gera `/docs` e `/openapi.json` a partir dos mesmos schemas (paridade com o Swagger atual); `.inject()` embutido cobre o papel do `TestClient` do FastAPI nos testes; controle fino de streaming (necessário pro SSE, §6) | Menos onipresente que Express |
| Express + Zod | Mais familiar | Sem equivalente de `TestClient`/`.inject()`; SSE e OpenAPI exigem plugins extras costurados à mão |
| `node:http` puro | Controle total (como o `uvicorn.Server` explícito em `app/desktop.py`) | Reescreve roteamento, parsing de body e validação que o Fastify já resolve |

**Decisão:** Fastify. `docs_url`/`redoc_url`/`openapi_url` de `app/main.py` viram `@fastify/swagger` + `@fastify/swagger-ui`, mantendo `/docs`, `/redoc` (ou removendo Redoc se o plugin não cobrir — avaliar na Fase 1) e `/openapi.json`.

### 2.2 SQLite do Cursor (`state.vscdb`)

| Opção | Prós | Contras |
| --- | --- | --- |
| **`node:sqlite` (builtin, Node ≥ 22.5) ✅ recomendado** | Vem embutido no runtime — **sem módulo nativo para recompilar contra o ABI do Electron** (ver §7.2); Electron 33+ já embarca Node 22 | API mais nova, menos madura em produção |
| `better-sqlite3` | API mais madura, mais exemplos | Módulo nativo (binário `.node`) — precisa de prebuild por SO/arch **e** por ABI do Electron (`electron-rebuild`), reintroduzindo parte do problema de empacotamento por plataforma que o PyInstaller tinha |

**Decisão:** `node:sqlite`. Confirmar na Fase 0 a versão mínima do Electron usada em `desktop/package.json` embarca Node ≥ 22.5; se não, avaliar upgrade do Electron antes de prosseguir (bloqueio, não contorno).

### 2.3 Processamento de imagem (wallpapers → RGB565)

| Opção | Prós | Contras |
| --- | --- | --- |
| **`sharp` ✅ recomendado** | libvips: crop/resize rápidos, acesso a buffer RGB cru (`.raw()`) pronto pra empacotar RGB565 manualmente igual hoje | Módulo nativo — mesma ressalva do `better-sqlite3` sobre ABI do Electron; precisa de `electron-rebuild` ou dos prebuilds oficiais do `sharp` para a plataforma-alvo do Electron |
| `jimp` (puro JS) | Zero binário nativo — sem dor de ABI em lugar nenhum (Electron, CI, cross-compile) | Mais lento; irrelevante aqui (imagens de 240×160/160×120, poucos KB) |

**Decisão:** **`jimp`**. A imagem final é minúscula (240×160 = 38.400 px) e o upload de wallpaper não é hot-path (usuário troca o papel de parede ocasionalmente) — o custo de CPU do puro-JS é irrelevante, e evita reintroduzir exatamente o tipo de dor (binário nativo por SO/ABI) que motivou a Opção B ser rejeitada no port do Electron. Reavaliar `sharp` só se o `jimp` se mostrar tempo-limite em algum SO durante a Fase 3.

### 2.4 Cliente HTTP de saída (Claude, GPT, Cursor, OpenRouter, …)

`fetch` nativo do Node (undici) substitui `httpx.Client`. Precisa de um wrapper equivalente a `app/http_util.py`:
- client único reaproveitado (undici já faz pool de conexões por host, como o `httpx.Client` global);
- log colorido de saída (`UPDATE - CLAUDE:` etc.) — porta direto, é só formatação de string;
- `HttpError` com `status` e `retry_after_s` — vira uma classe TS equivalente lançada quando `res.ok` é falso;
- timeout de 20 s por request — `AbortSignal.timeout(20_000)`.

### 2.5 Scheduler do hub (ciclo de 60 s + fan-out SSE)

`asyncio.Queue` por assinante + `asyncio.sleep` em loop (`app/hub.py`) → `EventEmitter`/array de streams Node + `setInterval`. Sem armadilha nova: é o mesmo padrão pub-sub, só troca a primitiva de fila assíncrona por callbacks.

---

## 3. O que muda no repositório

```
backend/                        ← Node substitui Python NO MESMO CAMINHO
  package.json                  fastify, zod, undici (nativo), jimp, node:sqlite
  tsconfig.json
  src/
    main.ts                     equivalente a app/main.py (create_app + listen)
    desktop.ts                  equivalente a app/desktop.py (handshake VIGIA_READY)
    config.ts                   equivalente a app/config.py
    store.ts                    equivalente a app/store.py
    hub.ts                      equivalente a app/hub.py
    usage.ts                    equivalente a app/usage.py
    schemas.ts                  equivalente a app/schemas.py (Zod)
    formatting.ts                equivalente a app/formatting.py
    httpClient.ts                equivalente a app/http_util.py
    refreshCache.ts              equivalente a app/refresh_cache.py
    alarms.ts                    equivalente a app/alarms.py
    telegramBot.ts / telegramPoller.ts
    netutil.ts
    providers/
      claude.ts gpt.ts cursor.ts openrouter.ts deepseek.ts
      opencode.ts fal.ts bitcoin.ts adsense.ts coingecko.ts
      currencies.ts weather.ts
    local/
      claudeOauth.ts gptOauth.ts cursorState.ts
    routers/
      usage.ts config.ts adsense.ts theme.ts board.ts alarms.ts
      telegram.ts wallpapers.ts weather.ts currencies.ts
  data/                          inalterado (gitignored) — mesmo config.json
  tests/                        Vitest, 1:1 com backend/tests/*.py
backend-python-legacy/          ← REMOVIDO só no fim (§11, Fase 6) — não criado à toa

scripts/
  build-sidecar.sh              REMOVIDO (não há mais binário nativo por SO, ver §7)
  build-collector.sh            NOVO: esbuild bundle do backend Node p/ desktop/resources
desktop/src/sidecar.ts          ajustado: spawna `node dist/desktop.js` em vez do binário PyInstaller
Dockerfile                      single-stage node:20-alpine
compose.yaml                    inalterado (só a imagem muda por baixo)
dev                              ensure_python() removido; ensure_backend_node() novo; cmd_test troca pytest/ruff por vitest/eslint
```

`frontend/`, `firmware/`, `desktop/` (exceto `sidecar.ts`/`paths.ts`) **não mudam de linguagem** — só apontam para o novo processo do coletor.

---

## 4. Port por módulo

### 4.1 Contrato e formatação (`schemas.py` → `schemas.ts`, `formatting.py` → `formatting.ts`)

Prioridade **máxima** — todo o resto depende de acertar isso primeiro, e é onde bugs sutis de porte de linguagem mais se escondem:

| Função Python | Armadilha ao portar | Como validar |
| --- | --- | --- |
| `as_percent` | `0 <= n <= 1.5` vira fração ×100 — **não** é o mesmo corte que `as_percent_points` (`0–100` direto) nem que `claude_utilization_percent` (`0 < n < 1` estrito) | teste por tabela: mesmos inputs/outputs dos `tests/test_parsers.py` atuais, copiados linha a linha |
| `iso_brt` / `tela_brt` | Timezone fixo `America/Sao_Paulo`, formato `%z` fatiado manualmente (`-0300` → `-03:00`) | Node: `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` não devolve o mesmo formato do `strftime`; construir a string ISO à mão como o Python faz, não confiar em `toISOString()` (que é sempre UTC) |
| `parse_when` | Aceita Timestamp protobuf (`{seconds, nanos}`), string numérica, ISO, epoch ms **e** epoch s (heurística `n > 1e11`) — usado no parsing do Cursor (Connect RPC) | portar a heurística exatamente; é a função mais "seca" do módulo, sem teste ela quebra silenciosamente o `cycle_end` do Cursor |
| `cycle_end_label` / `fmt_reset_when` | Fast-path por regex quando a string **já** está no formato de tela (evita reparsear e perder timezone) | manter os `re.fullmatch` equivalentes em Node antes de cair no parse genérico |

**Critério de pronto da Fase 1:** um script que roda os dois módulos (Python ainda vivo na mesma branch, antes de apagar) contra uma bateria de \~50 inputs gravados de `test_parsers.py` e compara byte a byte a saída. Só depois disso os providers começam a ser portados.

### 4.2 Credenciais locais (`app/local/*.py`)

| Arquivo | O que faz | Porte |
| --- | --- | --- |
| `claude_oauth.py` | `security find-generic-password -s "Claude Code-credentials" -w` via `subprocess.run` (macOS) + fallback `~/.claude/.credentials.json`; cache de 30 s | `child_process.execFileSync("security", [...])` — **mesmo binário do SO**, zero lógica para reescrever, só a chamada muda de `subprocess` para `child_process`. Cache com `Map` + timestamp |
| `gpt_oauth.py` | Lê `~/.codex/auth.json`, extrai `access_token`/`account_id`, decodifica exp do JWT (`base64url` manual) | JSON.parse trivial; decodificação de JWT: `Buffer.from(payload, "base64url")` substitui o `base64.urlsafe_b64decode` + padding manual do Python |
| `cursor_state.py` | Copia `state.vscdb` (SQLite, pode ter ~1 GB) para um temp file, abre com `sqlite3`, `SELECT key, value FROM ItemTable WHERE key IN (...)`, apaga o temp | `fs.copyFileSync` + `node:sqlite` (`DatabaseSync`) com a mesma query; cache de 30 s por path (`Map` chaveado pelo path resolvido) |

Nenhum destes precisa de OAuth refresh (a decisão em `DECISOES.md` — "o coletor não faz refresh OAuth/JWT desses três" — continua valendo) nem de dependência nova além do `node:sqlite` (§2.2).

### 4.3–4.11 Provedores de API (`app/providers/*.py`)

Todos seguem o mesmo esqueleto — `clean_*_key` (regex de validação) → `fetch_*_one` (uma chamada) → `fetch_*_accounts` (itera contas + legado). Porta mecânica; a tabela documenta só o que **não** é óbvio:

| Provedor | Peculiaridade a preservar |
| --- | --- |
| `claude.py` | `SCOPE_HINT` (mensagem especial quando o token não tem escopo `user:profile`); `parse_claude_payload` lê tanto `five_hour`/`seven_day` quanto uma lista `limits[]` alternativa — **duas formas de resposta da mesma API** |
| `gpt.py` | Heurística `_is_session` (`0 < secs <= 8h`) para decidir qual janela é "sessão" vs "semana" quando a API não rotula — comportamento fica **incorreto silenciosamente** se a ordem de atribuição mudar no port |
| `cursor.py` | Dois endpoints em cascata (`GetCurrentPeriodUsage` Connect RPC → fallback `auth/usage`); proto3 omite campo escalar `0` — `percent is None` só vira `0.0` **depois** de checar que não é "ciclo sem dado nenhum" (`cycle_end` também ausente) |
| `openrouter.py` / `deepseek.py` / `opencode.py` / `fal.py` | Regex de limpeza de chave (`sk-or-...`, `sk-...`) e checagem de caracteres invisíveis (BOM, zero-width) coladas do painel — copiar as regexes **exatamente**, incluindo a lista de `_INVISIBLE` |
| `bitcoin.py` | Regex de endereço (`legacy`/`P2SH`/`bech32`); saldo = `funded - spent` (confirmado + mempool) via Blockstream; preço via CoinGecko compartilhado |
| `adsense.py` | Único provedor com OAuth refresh feito pelo próprio coletor (`refresh_access_token`); `parse_payment_amount` faz parsing de moeda **localizado** (`R$1.234,57` vs `$1,234.57` vs `¥1,235 JPY`) — a lógica de decidir separador decimal por posição de vírgula/ponto é o trecho mais "regex-frágil" do backend inteiro, merece teste dedicado com os \~10 formatos de `test_adsense.py` |
| `coingecko.py` | Client compartilhado entre Bitcoin e currencies (mesmo bucket de rate-limit); TTL 300 s + coalescência de chamada concorrente (`_inflight` + `Condition.wait`) + backoff de 429 com last-good — em Node isso é uma Promise única compartilhada (`inflightPromise: Promise<...> \| null`) em vez de `threading.Condition` |
| `currencies.py` | Câmbio fiat via `open.er-api.com` (TTL 1 h) + cripto via CoinGecko; inverte a taxa (`1/rate`) pra "1 código vale quantos base" |
| `weather.py` | Sem API key; monta querystring dinâmica a partir de listas de variáveis validadas contra `VALID_CURRENT/HOURLY/DAILY` (\~80 valores) — copiar os `Set`s inteiros, não resumir |

### 4.4 `refresh_cache.py` → `refreshCache.ts`

TTL por fonte + fingerprint (JSON da config da fonte — muda TTL vira miss) + backoff em 429 com last-good. Estrutura de dados: `Map<string, {value, freshAt, fingerprint, backoffUntil}>` protegido por... nada — Node é single-threaded, o `threading.Lock` do Python vira desnecessário (simplificação real, não gambiarra).

### 4.5 `hub.py` → `hub.ts`

Fan-out SSE — tratado com destaque em §6 por ser o ponto que você pediu atenção explícita.

### 4.6 `alarms.py` → `alarms.ts`

Motor edge-triggered puro (sem I/O) — `evaluate()` cruza payload + regras + estado "armado" em memória. Porta quase copy-paste; `format_alarm_notification` monta HTML pro Telegram com `html.escape` → `he.escape` (pacote) ou uma função de 4 substituições (`&<>"'`) escrita à mão.

### 4.7 `telegram_bot.py` / `telegram_poller.py`

Bot API HTTP simples (`sendMessage`, `getUpdates` long-polling). Único cuidado: `getUpdates` usa `timeout=25` (long poll) — `AbortSignal.timeout` precisa ser **maior** que o timeout do parâmetro da API (o Python usa `httpx.AsyncClient(timeout=35)` justamente por isso — 35 > 25).

### 4.8 `store.py` → `store.ts`

Persistência JSON com migração de formato legado (`version: 1`, migração de env-plano antigo, migração `opencode_go`/`opencode_zen` → `opencode`). Escrita atômica (`tmp` + `rename` + `chmod 0600`) — `fs.writeFileSync` + `fs.renameSync` + `fs.chmodSync`, mesmo padrão. `threading.Lock` em `update()` → uma fila de promises simples (Node não tem race de thread aqui, mas duas chamadas concorrentes a `update()` ainda podem interlear `load()`+`write()` — usar um mutex assíncrono leve, ex. `p-queue` ou um mutex escrito à mão de \~10 linhas).

### 4.9 `routers/wallpapers.py` (Pillow + SSRF guard)

**Ponto de maior atenção de segurança do port.** A proteção documentada em `SECURITY_REVIEW.md` Finding 1 tem três camadas que **todas** precisam sobreviver:

1. `_is_blocked_host`: resolve o hostname (`dns.lookup`/`dns.promises.lookup` com `{all: true}` em Node) e rejeita IP privado/loopback/link-local/reservado/multicast — Node tem `net.isIP` mas **não** tem `ip.is_private` embutido; usar o pacote `ip-address` ou portar a lista de faixas CIDR do `ipaddress` do Python à mão (RFC 1918, 127.0.0.0/8, 169.254.0.0/16, etc.).
2. `_SafeRedirectHandler`: valida a URL de **cada redirect**, não só a inicial — em Node, `fetch` segue redirect automaticamente por padrão; usar `redirect: "manual"` e revalidar host a cada hop manualmente, senão a proteção via redirect (a parte mais fácil de esquecer) desaparece silenciosamente.
3. Limite de 10 MB no download (`len(data) > 10_000_000`) — replicar com truncamento no stream, não só checagem pós-download completo (evita um vetor de exaustão de memória que o port poderia introduzir sem querer).

RGB565: `_image_to_raw` (crop-cover + resize LANCZOS + loop de pixel `((r&0xF8)<<8)|((g&0xFC)<<3)|(b>>3)`) e `_raw_to_preview` (inverso) portam para Jimp (§2.3) mantendo o mesmo loop de bits — é aritmética, não API, então o comportamento é idêntico independente da lib de imagem escolhida.

### 4.10 `routers/theme.py`, `routers/board.py`

Os dois são "blobs opacos" (o coletor só guarda bytes que o painel manda). Porte trivial — só troca `Path.read_bytes()`/`write_bytes()` por `fs.readFileSync`/`writeFileSync`.

### 4.11 `routers/adsense.py` (fluxo OAuth com HTML de callback)

Atenção ao `_js_string_literal`: escapa `<`, `>`, `&` como `\uXXXX` especificamente para evitar que o token de estado feche a tag `<script>` prematuramente (era uma correção de XSS documentada em `SECURITY_REVIEW.md` antes de "dois achados HIGH corrigidos"). Portar a função de escape **exatamente**, não só o "espírito" dela — é sanitização de saída, testável byte a byte.

---

## 5. Estratégia de paridade (evitar quebrar o firmware)

1. **Fase 1 cria `backend/` em Node ao lado do Python ainda funcionando** (Python fica em `backend-python-legacy/` temporariamente, renomeado, não apagado) — os dois sobem em portas diferentes (`8787` Node, `8788` Python) durante o desenvolvimento.
2. **Harness de diff de contrato**: um script (`scripts/diff-contract.mjs`, descartável ao final) chama `GET /usage` nos dois processos com a mesma `config.json` de teste (`mock: true` primeiro, depois com chaves reais de sandbox) e faz diff estrutural do JSON — falha se qualquer campo divergir além de `updated_at`.
3. **Os 12 arquivos de teste Python (`backend/tests/*.py`, 1.1k linhas) viram a lista de casos de teste do Vitest** — não reescritos do zero, traduzidos 1:1 (mesmos fixtures de resposta de API gravados, mesmos asserts).
4. **Só depois da Fase 4 (abaixo) o Python é apagado de fato** (`backend-python-legacy/`, `pyproject.toml`, `.venv`, `.ruff_cache`, `.pytest_cache`, `vigia_ai.egg-info`) — nunca antes do handshake do device (§6) ter sido validado contra hardware real ou Wokwi.

---

## 6. SSE — device (ESP32) e `/display` (o ponto que você pediu atenção)

Isto é o que mais pode quebrar silenciosamente: o firmware **não vai dar erro claro** se o framing mudar sutilmente, só vai parecer "travado" ou reconectar em loop.

### 6.1 O que precisa ser byte-a-byte idêntico

| Elemento | Hoje (`app/hub.py` + `app/routers/usage.py`) | Risco no port |
| --- | --- | --- |
| Headers | `Content-Type: text/event-stream`, `Connection: keep-alive`, `Cache-Control: no-cache`, `X-Accel-Buffering: no` | Fastify por padrão pode adicionar `Content-Length` ou bufferizar antes do primeiro `.raw.write()` se a rota não for tratada como stream explícito — usar `reply.raw` diretamente (bypassa serialização do Fastify) |
| Prólogo | `: connected\n\n` antes de qualquer coisa | Fácil de esquecer a linha em branco dupla (`\n\n` é o fim de evento em SSE) |
| Snapshot inicial | Se já existe um `hub.snapshot()`, manda imediatamente `event: usage\ndata: <json>\n\n` antes de entrar no loop | Cliente que conecta entre dois ciclos de 60 s não pode ficar sem dado por até 60 s |
| Heartbeat | `: ping\n\n` a cada 15 s (`HEARTBEAT_S`) quando não há payload novo | Sem isso, NAT/roteador doméstico e o `SSE_IDLE_MS` do firmware (`USAGE_POLL_MS + 30000`) derrubam a conexão por inatividade — **é o firmware quem desconecta**, não um erro do servidor |
| Frame de dado | `event: usage\ndata: <JSON UsagePayload>\n\n` — o JSON é o **mesmo** de `GET /usage`, validado pelo mesmo schema | Reusar a mesma função de serialização entre `/usage` e `/events`, nunca duas implementações que podem divergir |
| Middleware de conexão não-SSE | `CloseConnectionMiddleware`: toda resposta que **não** é `/events` ganha `Connection: close` + `Cache-Control: no-store` | Existe porque o `HTTPClient` do ESP32 (biblioteca Arduino) tem histórico de problemas com keep-alive HTTP/1.1 mal gerenciado — replicar via hook `onSend` do Fastify aplicado a toda rota exceto `/events` |
| Encerramento gracioso | `uvicorn.Server(timeout_graceful_shutdown=3)` — sem isso o processo trava esperando os streams SSE fecharem sozinhos (eles nunca fecham) — achado real documentado em `PLANO_ELECTRON.md §14.1` | `http.Server` do Node **tem o mesmo problema**: `server.close()` espera conexões keep-alive fecharem. Precisa rastrear os sockets SSE abertos manualmente (`Set<Socket>`) e `socket.destroy()` neles no shutdown, com um timeout curto — não existe um `timeout_graceful_shutdown` de uma linha no `node:http` puro; com Fastify, usar `@fastify/under-pressure` não resolve isso, é preciso um `server.on("connection", ...)` manual |
| Identificação do device | Header `X-Vigia-Device: esp32` (+ `X-Vigia-Screen: WxH`) — usado só para telemetria (`hub.note_device`), não faz parte do contrato JSON | Portar como está; não é lido pelo firmware, é o coletor que lê do request |

### 6.2 Por que o `/display` (browser) é o teste mais barato, e o device é o que decide

`frontend/src/api/client.ts:openUsageEvents` usa `EventSource` nativo do browser — se o framing SSE estiver certo, o `/display` já funciona (o browser é tolerante a variações pequenas de espaçamento que o parser do firmware **não é**: `firmware/src/net/client.cpp` lê linha a linha e monta o JSON manualmente char a char, checando `SSE_IDLE_MS` e limite de linha (`"coletor SSE: linha enorme, descarta"`)). Portanto:

1. **Gate 1 (barato, quase toda fase):** abrir `/display` no browser, checar no DevTools → Network → `/events` que o stream chega, os `: ping` aparecem a cada 15 s, e o card atualiza a cada ciclo.
2. **Gate 2 (obrigatório antes de apagar o Python):** rodar `./dev wokwi` com o coletor **Node** no lugar do Python e confirmar no serial monitor do simulador: `"Client connected"`, sem `"coletor SSE: caiu, reconecta"` em loop, sem `"coletor SSE: silêncio demais, reconecta"`.
3. **Gate 3 (se houver placa física disponível):** gravar `secrets.h` apontando pro coletor Node e deixar rodando \~30 min observando reconexões no serial — é o teste que teria pego a diferença de `timeout_graceful_shutdown` se ela existisse silenciosamente.

Nenhuma fase deste plano encerra sem passar pelo Gate 1; a Fase que remove o Python (§11) não pode fechar sem o Gate 2, e o Gate 3 é fortemente recomendado antes de fazer merge para `main` se houver hardware disponível.

---

## 7. Impacto no app Electron (simplificação real)

Com o coletor em Node, o app desktop ganha uma simplificação que **não** estava no escopo original — vale nomear porque muda o cálculo de risco do `PLANO_ELECTRON.md`:

### 7.1 O que desaparece

- `scripts/build-sidecar.sh` (PyInstaller) inteiro — não há mais "compilar em cada SO, sem cross-compile" nem "antivírus Windows marca falso-positivo" (`PLANO_ELECTRON.md §11`, risco "Antivírus marca o binário PyInstaller").
- O binário `--onedir` de ~54 MB por SO — o coletor Node empacotado (código + `node_modules` de produção, sem devDependencies) deve ficar bem menor, ainda que `node:sqlite` e `jimp` tragam algum peso.

### 7.2 O que precisa de atenção nova

- Se **qualquer** dependência de produção acabar sendo um módulo nativo (ex.: se `sharp` for adotado no lugar de `jimp` — §2.3 — ou se `node:sqlite` não estiver disponível na versão do Electron embarcada), o app volta a precisar de `electron-rebuild` contra o ABI do Electron, que é justamente a dor que o PyInstaller *não* tinha (Python não tem ABI de V8). Isto é o motivo da decisão em §2.2/§2.3 de evitar módulos nativos deliberadamente.
- `desktop/src/sidecar.ts:resolveCommand()` troca de spawnar o binário PyInstaller para spawnar `node dist/desktop.js` (ou o binário do Electron em modo Node puro, `ELECTRON_RUN_AS_NODE=1`, para não precisar depender de um Node do sistema em produção — decisão a validar na Fase 5). O handshake `VIGIA_READY`/`VIGIA_ERROR` na stdout e o encerramento por fechamento de stdin (`app/desktop.py` → `desktop.ts`) portam sem mudança de protocolo — `desktop/src/sidecar.ts` não muda a lógica, só o comando executado.
- `desktop/src/paths.ts:sidecarBinary()` passa a apontar para o bundle `.js`, não mais para um executável nativo.

### 7.3 Fora de escopo deste plano

Fundir o coletor **dentro** do processo principal do Electron (eliminar o child process por completo, já que agora os dois são JS) é uma simplificação **possível mas não incluída aqui** — mudaria o modelo de restart/crash-isolamento (`Sidecar` em `desktop/src/sidecar.ts`) e o comportamento de "reaproveitar coletor já rodando na porta" (`PLANO_ELECTRON.md §5.1`). Manter o modelo de processo filho atual (só trocando o que é spawnado) é a opção de menor risco para este port; revisitar como proposta separada depois que o port estiver estável em produção.

---

## 8. Docker e `./dev`

| Arquivo | Mudança |
| --- | --- |
| `Dockerfile` | Vira single-stage `node:20-alpine`: `npm ci` do frontend → `npm run build` → `npm ci --omit=dev` do backend → `CMD ["node", "dist/main.js"]`. `ENV COLLECTOR_IN_DOCKER=1` etc. inalterados (só quem lê essas envs muda de `os.environ.get` para `process.env`) |
| `compose.yaml` | Inalterado — só a imagem por baixo muda |
| `dev` | `ensure_python()` → `ensure_backend_node()` (equivalente ao `ensure_node()` do frontend, `npm install` em `backend/`); `run_backend()` troca `.venv/bin/python -m app.main` por `npm run start` (ou `node dist/main.js` após build); `cmd_test` troca `pytest` + `tsc --noEmit` do frontend por **dois** `vitest`/`tsc` (backend e frontend) + o `tsc` do desktop que já existe; `cmd_lint` troca `ruff check` por `eslint`/`biome check` no backend |
| `scripts/build-sidecar.sh` | Removido — substituído por `scripts/build-collector.sh` (esbuild, §7) |

---

## 9. Testes e ferramentas

| Hoje (Python) | Depois (Node) |
| --- | --- |
| `pytest` (12 arquivos, 1.1k linhas) via `backend/.venv/bin/pytest -q` | `vitest` — os mesmos 12 arquivos, portados 1:1 (mesmos nomes: `test_adsense` → `adsense.test.ts`, etc.) |
| `ruff check app tests` | `eslint` (ou `biome check`, mais rápido e já usado por parte do ecossistema Node moderno — decidir na Fase 0 junto com a config de lint do `desktop/`, que já é TS) |
| `TestClient(app)` do FastAPI (`conftest.py`) | `app.inject({method, url})` do Fastify — troca direta, mesma ergonomia (não precisa subir socket real) |
| `backend/tests/test_desktop_sidecar.py` (marcado `slow`, sobe o coletor de verdade pro handshake) | Idem em Vitest, spawnando `node dist/desktop.js` |

---

## 10. Segurança — o que não pode regredir

Tudo que está em `SECURITY_REVIEW.md` como já corrigido continua exigido no port, não é "bônus":

1. **SSRF em wallpapers** (Finding 1) — allowlist de host + bloqueio de IP privado/loopback + validação em **cada redirect**, não só na URL inicial (§4.9).
2. **XSS no callback OAuth do AdSense** (corrigido, mencionado no topo do `SECURITY_REVIEW.md`) — `_js_string_literal`/escape de `<>&` no HTML de retorno (§4.11).
3. **Sem CORS wildcard** — o achado já corrigido não deve voltar por causa de um middleware padrão do Fastify configurado sem pensar (`@fastify/cors` teria que ser explicitamente restrito, ou nem instalado — hoje o Python não usa CORS nenhum, o painel é servido pelo mesmo processo).
4. **Permissão `0600` em `config.json`** (`store.py:_write`) — `fs.chmodSync(path, 0o600)` depois de cada escrita.
5. **Escrita atômica** (`tmp` + `rename`) em `config.json`, `theme.json`, `board.json`, `wallpapers.json` — `fs.renameSync` é atômico no mesmo filesystem, igual ao `Path.replace()` do Python.
6. Achados já **documentados como aceitos** (MEDIUM/LOW/INFO — ausência de autenticação por design "LAN only", headers de segurança ausentes, etc.) não precisam de correção nova só por causa do port — não é escopo deste plano mudar o modelo de ameaça do produto, só a linguagem de implementação.

---

## 11. Fases

| Fase | Entrega | Critério de pronto |
| --- | --- | --- |
| **0. Base** | `backend/` Python renomeado para `backend-python-legacy/` (não apagado); `backend/` novo com Fastify "hello world" + `/health`; decisão confirmada de versão do Electron ≥ Node 22.5 (§2.2) | `npm run dev` sobe em `:8788` (porta alternativa durante a migração), `/health` responde |
| **1. Contrato e formatação** | `schemas.ts` (Zod) + `formatting.ts`, testados byte a byte contra `test_parsers.py` (§4.1) | Harness de diff (§5) mostra zero divergência nos \~50 casos herdados |
| **2. Credenciais locais + providers** | `local/*.ts` + os 9 providers + CoinGecko/currencies/weather (§4.2–4.3) | Todos os testes portados de `test_adsense.py` + os fixtures de provider (hoje cobertos majoritariamente por `test_parsers.py`) verdes |
| **3. Hub, SSE, cache, alarmes, Telegram** | `hub.ts`, `refreshCache.ts`, `alarms.ts`, `telegram*.ts`, roteador `/usage` + `/events` (§4.4–4.7, §6) | Gate 1 do §6.2 (browser `/display` funcionando); `test_alarms.py`, `test_refresh_cache.py`, `test_third_party_ttl.py` portados e verdes |
| **4. Config, wallpapers, theme, board, AdSense OAuth** | `store.ts` + todos os routers restantes (§4.8–4.11) | `test_store.py`, `test_board.py`, `test_platform_paths.py`, `test_api.py` portados e verdes; harness de diff (§5) rodando com config real (não só mock) |
| **5. Desktop + empacotamento** | `desktop.ts` (handshake), `scripts/build-collector.sh`, `desktop/src/sidecar.ts`/`paths.ts` ajustados (§7) | `./dev app` sobe o app Electron com o coletor Node; `test_desktop_sidecar.py` portado (`slow`) verde nos 3 SOs disponíveis para teste |
| **6. Corte + limpeza** | Docker e `./dev` migrados (§8); Gate 2 do §6.2 (Wokwi) passado; Python removido (`backend-python-legacy/`, `.venv`, `pyproject.toml`, `.ruff_cache`, `.pytest_cache`, `vigia_ai.egg-info`) | `./dev up`, `./dev wokwi`, `./dev app`, `./dev test`, `docker compose up --build` todos verdes sem nenhum arquivo `.py` no repo (fora de `firmware/` — que é C++, não se aplica) |
| **7. Documentação** | `BACKEND.md`, `DECISOES.md` (registrar a reversão da decisão anterior e por quê), `CONTEXTO_IA.md` (mapa de arquivos), `CHANGELOG.md`, README | Alguém lendo `CONTEXTO_IA.md` do zero entende que o coletor é Node, não Python |

---

## 12. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Framing SSE sutilmente diferente quebra o firmware sem erro claro | **Alto** — placas em campo param de atualizar | §6 inteiro: gates obrigatórios antes de apagar o Python, nunca confiar só no `/display` do browser (tolerante demais) |
| Encerramento gracioso do Node trava em socket SSE aberto (mesmo bug que já apareceu no Electron, `PLANO_ELECTRON.md §14.1`) | Médio — app "não fecha", ou o coletor do Docker não reinicia limpo | Rastrear sockets SSE manualmente e `destroy()` no shutdown com timeout curto (§6.1); testar `docker compose restart` explicitamente na Fase 6 |
| Divergência numérica sutil em `formatting.ts` (percentual, timezone) | Alto silencioso — cota mostrada errada na tela, sem crash | Fase 1 não avança sem o harness de diff byte-a-byte (§5) |
| `node:sqlite` menos maduro que `sqlite3` do Python ou indisponível na versão do Electron embarcada | Médio — quebra o provedor Cursor | Validar a versão do Electron **na Fase 0**, antes de qualquer código; fallback documentado é `better-sqlite3` aceitando a dor de rebuild (§2.2) |
| Parsing de moeda do AdSense (`parse_payment_amount`) é o trecho mais regex-frágil do backend | Médio | Testar contra os \~10 formatos reais de `test_adsense.py`, não só os felizes |
| SSRF guard do wallpapers reintroduzido incompleto (ex.: `fetch` seguindo redirect automaticamente) | Alto (achado de segurança já corrigido uma vez) | §4.9 é explícito sobre `redirect: "manual"` + revalidação por hop; incluir teste de regressão com URL que redireciona para `169.254.169.254` |
| Módulo nativo (`sharp`, `better-sqlite3`) reintroduz a dor de build por SO/ABI que motivou rejeitar a reescrita da primeira vez | Médio | §2.2/§2.3 escolhem deliberadamente as opções sem binário nativo; qualquer desvio dessas decisões deve ser revisado explicitamente, não decidido ad-hoc no meio do port |
| Janela longa com dois runtimes (Python + Node) coexistindo na mesma branch | Baixo, mas real (confusão de qual está "vivo") | `backend-python-legacy/` só existe entre Fase 0 e Fase 6; nomear explicitamente evita alguém rodar o antigo por engano |

---

## 13. Fora de escopo

- Fundir o sidecar do coletor dentro do processo principal do Electron (§7.3) — possível depois, não faz parte deste port.
- Mudar o modelo de ameaça "LAN only, sem autenticação" — os achados aceitos do `SECURITY_REVIEW.md` continuam aceitos; este plano só garante que os achados **corrigidos** não regridam.
- Qualquer mudança em `CONTRATO_JSON.md`, nos nomes de campos do JSON, ou em `firmware/src/net/parse.cpp` — o objetivo inteiro é o firmware não perceber a troca.
- Adicionar provedores novos (Gemini, Copilot, etc.) — regra 9 de `CONTEXTO_IA.md` continua valendo.
- Reescrever o frontend React ou o firmware C++ — ambos já são independentes da linguagem do coletor.
- Migrar para HTTP/2 ou WebSocket no lugar de SSE — fora de escopo, o firmware não pede isso.

---

## 14. Primeiros passos concretos

1. Confirmar a versão do Electron em `desktop/package.json` embarca Node ≥ 22.5 (pré-requisito de `node:sqlite`, §2.2) — se não, decidir upgrade do Electron **antes** de escrever qualquer TypeScript.
2. `git mv backend backend-python-legacy` nesta branch (`feature/python-to-node`) e ajustar temporariamente `./dev` para apontar pro caminho novo, mantendo tudo funcional durante a Fase 0–5.
3. Criar `backend/package.json` + `tsconfig.json` + Fastify "hello world" respondendo `/health` na porta `8788`.
4. Portar `formatting.py` → `formatting.ts` primeiro, com os \~50 casos de `test_parsers.py` como teste de aceitação (Fase 1, §4.1) — é a fundação de tudo o resto.
5. Escrever o harness de diff de contrato (`scripts/diff-contract.mjs`, §5) contra o Python ainda rodando em `backend-python-legacy/`, mesmo antes de portar os providers — ele vai ficar útil da Fase 1 até a Fase 6.

---

## 15. Pontos em aberto (preciso da sua decisão)

Tudo acima já traz uma recomendação com justificativa (como no `PLANO_ELECTRON.md`), mas há três escolhas que valem sua confirmação explícita antes de eu começar a Fase 0:

1. **Lint**: ESLint (mais comum, mais plugins) ou Biome (mais rápido, config única) para o `backend/` Node? O `desktop/` hoje não parece ter linter configurado além do `tsc` — vale padronizar os dois junto?
2. **Módulo nativo do Cursor**: confirmar que está OK depender de `node:sqlite` (experimental, mas builtin) em vez de `better-sqlite3` (maduro, mas nativo) — isso trava a versão mínima do Electron/Node aceitável para o app desktop.
3. **Onde o binário `node` roda dentro do Electron empacotado**: `ELECTRON_RUN_AS_NODE=1` (usa o próprio Electron como runtime Node, sem exigir Node do sistema) ou embutir um Node standalone no bundle? Isso só é decidido de fato na Fase 5, mas influencia se `scripts/build-collector.sh` precisa baixar um runtime ou só empacotar `.js`.
