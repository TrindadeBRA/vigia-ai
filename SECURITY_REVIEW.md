# Revisão de Segurança — Vigia AI

**Data:** 2026-09-02
**Escopo:** backend (`backend/app/**`), frontend (`frontend/src/**`, `landing/index.html`), firmware ESP32 (`firmware/src/**`), infra (`compose.yaml`, `Dockerfile`, `dev`)
**Método:** leitura integral do código-fonte próprio do projeto (excluindo dependências de terceiros e testes), com verificação manual dos achados de maior severidade contra o código real. Segunda rodada incluiu auditoria paralela aprofundada (OWASP Top 10) e verificação linha-a-linha de toda a superfície `routers/*`, `hub.py`, `store.py`, `http_util.py` e infra Docker.

> Dois achados HIGH (CORS wildcard sem autenticação e XSS refletido no callback OAuth do AdSense) foram corrigidos em 2026-09-02 e removidos deste documento. Ver histórico do git (`backend/app/main.py`, `backend/app/routers/adsense.py`) para o antes/depois.

## Contexto importante

O Vigia AI é assumido pelo próprio código (`backend/app/main.py:70-78`) como um gadget **local, "LAN only"**: a documentação da API afirma explicitamente *"Não exponha a porta 8787 na internet"* e que tokens de provedores "nunca" saem do computador do coletor. Isso reduz a severidade de vários achados que dependeriam de exposição direta à internet — mas **não elimina o risco**, porque vários achados dependem apenas de presença na mesma rede Wi-Fi/LAN (convidado, dispositivo IoT comprometido, vizinho em rede compartilhada), não de acesso físico.

Nenhuma rota do backend exige autenticação própria — isso é uma decisão de design do projeto (documentada como "LAN only"), não em si um achado isolado desta revisão. Os itens abaixo continuam válidos independentemente do CORS, pois são exploráveis por qualquer requisição HTTP direta na LAN (não dependem de um navegador). Essa ausência total de autenticação **é o multiplicador de todos os demais achados**: sem ela, qualquer host na LAN pode explorar SSRF, gravar secrets, encher disco e desfigurar o firmware com um `curl` direto — ver Finding 6.

## Resumo ranqueado

| # | Vulnerabilidade | Severidade | Confiança | Local |
|---|---|---|---|---|
| 1 | SSRF na importação de wallpaper (sem allowlist de host) | **MEDIUM-HIGH** | 8/10 | `backend/app/routers/wallpapers.py:210-225, 809, 859` |
| 2 | Servidor HTTP local do ESP32 sem autenticação (leitura/escrita/apagar/screenshot) | **MEDIUM** | 8/10 | `firmware/src/net/theme_server.cpp:27-184` |
| 3 | Script de terceiro carregado dinamicamente da branch `@main` (sem pin/SRI) | **MEDIUM** | 8/10 | `frontend/src/hooks/useNameToColor.ts:3-45` |
| 4 | Ausência de rate-limiting / DoS por IP (cotas externas + CPU Pillow) | **MEDIUM** | 8/10 | `backend/app/routers/usage.py:80-85`, `backend/app/hub.py:20-25`, `backend/app/routers/wallpapers.py:315-432` |
| 5 | Storage exhaustion ilimitado via wallpapers (enchimento de disco) | **MEDIUM-LOW** | 8/10 | `backend/app/routers/wallpapers.py:59-64,315-520` |
| 6 | Ausência total de autenticação em rotas mutantes do backend (multiplicador) | **MEDIUM** | 9/10 | `backend/app/main.py:103-112`, todos `routers/*.py` |
| 7 | SSRF cego via endpoint de inscrição de Web Push | **LOW-MEDIUM** | 7/10 | `backend/app/push.py:52-115`, `backend/app/routers/push.py:32` |
| 8 | Vazamento de informação em mensagens de erro (corpo de API terceira ecoado) | **LOW** | 7/10 | `backend/app/http_util.py:169`, `backend/app/routers/wallpapers.py:237-239` |
| 9 | Comunicação firmware↔backend em HTTP puro, sem segredo compartilhado | **LOW** | 7/10 | `firmware/src/net/client.cpp` |
| 10 | Supply-chain `dev` baixa `wokwigw` sem checksum/assinatura | **LOW** | 7/10 | `dev:38,118-136`, `Dockerfile:13` |
| 11 | Headers de segurança ausentes (CSP, X-Frame-Options, nosniff) | **INFO** | 9/10 | `backend/app/main.py:32-45`, `frontend/vite.config.ts:1-23` |
| 12 | Container Docker roda como root sem hardening | **INFO** | 7/10 | `Dockerfile:10-22`, `compose.yaml:5-11` |

---

## Finding 1 — SSRF na importação de wallpaper (sem allowlist de host)

**Severidade:** MEDIUM-HIGH · **Confiança:** 8/10
**Local:** `backend/app/routers/wallpapers.py:210-225` (`_download_image`), `:788, 809, 857-859` (`import_wallpaper`)

**Descrição:** `POST /api/wallpapers/import` recebe `image_url`/`thumb_url` diretamente do corpo JSON do cliente (linha 788: `image_url = str(body.get("image_url") or body.get("full") or body.get("url") or "").strip()`). O único controle é que `provider` seja uma das strings `"pexels"`, `"wallhaven"` ou `"unsplash"` — **a URL em si não é validada contra o domínio esperado do provedor**. `_download_image()` passa essa URL direto para `urllib.request.urlopen()`, que por padrão também registra um `FileHandler` (URLs `file://` funcionam).

**Cenário de exploração verificado:**
```json
POST /api/wallpapers/import
{"provider": "pexels", "id": "x", "image_url": "http://169.254.169.254/latest/meta-data/"}
```
ou qualquer host interno da LAN (câmera IP, painel de roteador, outro serviço interno). Confirmei no código (linhas 823-829) que os bytes baixados são gravados em disco (`{wid}.orig`) **antes** da tentativa de conversão para imagem. Se o conteúdo baixado tiver assinatura JPEG/PNG válida, ele fica disponível sem autenticação em `GET /api/wallpapers/{wid}/preview` (linhas 578-587 servem `.orig` diretamente se começar com os magic bytes de JPEG/PNG) — ou seja, o atacante pode exfiltrar/visualizar imagens de hosts internos inacessíveis publicamente. Como não há autenticação em nenhuma rota, isso é disparável por qualquer host na mesma LAN com uma requisição HTTP direta.

**Justificativa da severidade:** MEDIUM-HIGH porque, mesmo em cenário LAN-only, permite a um atacante já na rede usar o backend como proxy para acessar/fotografar recursos internos que ele não alcançaria diretamente (varredura de porta com base em erro HTTP vs timeout, leitura de imagens de câmeras/painéis internos).

**Recomendação:** validar o host de `image_url`/`thumb_url` contra uma allowlist por provedor (`images.pexels.com`, `images.unsplash.com`, `w.wallhaven.cc`, etc.) antes de baixar; bloquear `file://` e faixas privadas (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`); usar opener customizado sem `FileHandler` e `allow_redirects=False`.

---

## Finding 2 — Servidor HTTP local do ESP32 sem autenticação

**Severidade:** MEDIUM · **Confiança:** 8/10
**Local:** `firmware/src/net/theme_server.cpp:27-184`

**Descrição:** `themeServerBegin()` sobe um `WebServer` na porta 80 do próprio dispositivo ESP32, com rotas `GET/POST/DELETE /theme`, `POST /theme/meta`, `POST /theme/background` e `GET /theme/screenshot`, todas sem qualquer token/autenticação, e CORS totalmente aberto (`Access-Control-Allow-Origin: *`). O código já tem um comentário reconhecendo o design ("LAN only... não exponha essa porta na internet"), mas isso não protege contra outro dispositivo na mesma rede.

**Cenário de exploração:** qualquer dispositivo na mesma Wi-Fi (convidado, IoT comprometido, vizinho em rede compartilhada) pode:
- `GET /theme/screenshot` → captura em BMP da tela do display, revelando dados de uso de IA, saldos, clima etc. (vazamento de informação);
- `DELETE /theme` ou `POST /theme/meta` com payload malicioso → apaga/desfigura o tema exibido.

**Justificativa da severidade:** MEDIUM — não há execução de código (a análise de parsing JSON/tema é feita com buffers limitados por tamanho e cópias seguras via `String::toCharArray`, sem overflow encontrado), mas é leitura/escrita/apagar não autenticados de um dispositivo físico, incluindo vazamento de dados financeiros/de uso exibidos na tela.

**Recomendação:** exigir um token compartilhado simples (header ou query param) configurado junto com o Wi-Fi, e restringir o CORS do `theme_server` à origem do backend em vez de `*`.

---

## Finding 3 — Script de terceiro carregado dinamicamente sem pin de versão nem SRI

**Severidade:** MEDIUM · **Confiança:** 8/10
**Local:** `frontend/src/hooks/useNameToColor.ts:3-4, 35-45`

```js
const CDN_CORE = "https://cdn.jsdelivr.net/gh/zonaro/NameToColor@main/NameToColor.js";
const CDN_PTBR = "https://cdn.jsdelivr.net/gh/zonaro/NameToColor@main/NameToColor.ptBR.js";
```

**Descrição:** ao abrir o seletor de cor "NameToColor" no editor de tema (`ThemeEditorPage.tsx` → `NameToColorPicker.tsx`), o app injeta dinamicamente uma tag `<script>` apontando para a branch `@main` de um repositório GitHub de terceiro via jsDelivr — sem pin de commit/tag e sem hash SRI.

**Cenário de exploração:** um comprometimento (conta ou token) do repositório `zonaro/NameToColor` permite que qualquer commit futuro na branch `main` seja executado com plena confiança no contexto da página do Vigia AI, na próxima vez que qualquer usuário abrir o seletor de cor. Como o painel roda na mesma origem que a API (sem auth própria), o script malicioso teria acesso irrestrito a todas as rotas de config/wallpaper/tema.

**Justificativa da severidade:** MEDIUM — depende de um comprometimento de terceiro (não é diretamente explorável por um atacante web comum), mas o raio de impacto é total (comprometimento completo do painel) e o vetor de entrada é evitável.

**Recomendação:** fixar em uma tag/commit específico (`@v1.2.3` ou hash), e adicionar `integrity`/`crossorigin` (SRI) à tag `<script>` gerada. Alternativa de custo zero: vendorizar o arquivo em `frontend/public/`.

---

## Finding 4 — Ausência de rate-limiting / DoS por IP

**Severidade:** MEDIUM · **Confiança:** 8/10
**Local:** `backend/app/routers/usage.py:80-85` (`GET /usage` → `hub.refresh(force_quota=True)`), `backend/app/hub.py:20-25` (`USAGE_INTERVAL_S`), `backend/app/routers/wallpapers.py:315-432` (Pillow), `backend/app/routers/push.py:50-58` (`POST /api/push/test`)

**Descrição:** nenhuma rota mutante ou de leitura cara tem limite por IP. `GET /usage` dispara um ciclo extra de cotas de assinatura (`force_quota=True`) que paraleliza chamadas via `ThreadPoolExecutor` (10 workers, `timeout=20s`) para todos os provedores externos. `GET /events` (SSE) também não limita número de conexões simultâneas. `POST /api/wallpapers/upload` e `POST /api/wallpapers/import` executam `Pillow` `Image.resize(LANCZOS)` + loops pixel-a-pixel RGB565 (`wallpapers.py:169-176, 437-504`) de forma síncrona na thread do request, sem throttle. `POST /api/push/test` dispara `broadcast()` para todas as subscriptions sem debounce.

**Cenário de exploração:** atacante na LAN executa `while true; do curl http://coletor:8787/usage & done` — queima cota 429 das APIs não-oficiais (Claude OAuth usage rate-limits se martelado, CoinGecko/Blockstream) e consome CPU do coletor com conversões de imagem. `USAGE_INTERVAL_S` mínimo de 15s não impede o abuso, pois `GET /usage` ignora o cache de cotas.

**Justificativa da severidade:** MEDIUM — não há RCE, mas é DoS prático e degradação de serviço de baixo custo para atacante LAN, com impacto financeiro indireto (cotas bloqueadas) e travamento do coletor.

**Recomendação:** aplicar `slowapi`/`RateLimiter` por IP: `GET /usage` 1 req/15s por IP, `GET /events` limite global de conexões (ex.: 10), `POST /api/wallpapers/upload|import` 5/h por IP, `POST /api/push/test` 1/min. Manter o TTL já existente em `app/refresh_cache.py:19-31` e garantir que `force_quota=True` respeite um janela mínima por IP.

---

## Finding 5 — Storage exhaustion ilimitado via wallpapers

**Severidade:** MEDIUM-LOW · **Confiança:** 8/10
**Local:** `backend/app/routers/wallpapers.py:59-64` (`_MAX_BG_BYTES`), `:210-225` (`_download_image` 10MB), `:315-520` (`upload_wallpaper`), `backend/app/config.py:18` (`data_dir()`)

**Descrição:** não há cota total de wallpapers. `_MAX_BG_BYTES = 400_000` só limita o ramo `raw bytes direto` (`:421`); o ramo multipart e a importação via URL aceitam até `10_000_000` bytes por imagem (`:215`). Cada `wid = secrets.token_hex(4)` grava até 4 arquivos em `data_dir()/wallpapers/` — `{wid}.raw` (76800 B), `{wid}_wokwi.raw` (38400 B), `{wid}.jpg` (preview ~50-100KB) e `{wid}.orig` (original até 10MB). Não há limite de quantidade, tamanho total nem expiração LRU. `data_dir()` não tem quota e `.gitignore:22-24` ignora, mas o disco do host enche.

**Cenário de exploração:** host na LAN faz loop `POST /api/wallpapers/upload` ou `POST /api/wallpapers/import` com imagens válidas — 10k uploads ≈ 5–10 GB. Path-traversal está corretamente mitigado (`:529, 558, 591` rejeitam `/`, `\`, `..`), mas o enchimento de disco é o vetor.

**Justificativa da severidade:** MEDIUM-LOW — requer várias requisições, mas é DoS de armazenamento silencioso e persistente, sem autenticação.

**Recomendação:** impor quota (ex.: 50 wallpapers ou 100 MB totais) com evicção LRU no `_save_meta`; limitar `_wallpapers_dir` via `du` periódico ou checagem antes de `write_bytes`; opcionalmente exigir autenticação (ver Finding 6).

---

## Finding 6 — Ausência total de autenticação em rotas mutantes do backend

**Severidade:** MEDIUM · **Confiança:** 9/10
**Local:** `backend/app/main.py:103-112` (todos `include_router` sem `Depends`), `backend/app/routers/config.py:454,531,577,597`, `backend/app/routers/wallpapers.py:282,315,780`, `backend/app/routers/theme.py:81,97,130`, `backend/app/routers/push.py:32`, `backend/app/routers/alarms.py`, `backend/app/routers/currencies.py`, `backend/app/routers/weather.py`

**Descrição:** nenhuma rota do backend exige autenticação — leitura e escrita são abertas a qualquer host na LAN. Isso é documentado como decisão "LAN only", mas na prática funciona como multiplicador de todos os demais achados: um atacante de rede não precisa de navegador nem de bypass de CORS, basta `curl`.

**Cenário de exploração (sem auth, só LAN):**
- `GET /api/config` → suffix de 4 chars das keys coladas (auxilia brute-force);
- `POST /api/config` / `POST /api/config/account` → injeta chave/API key falsa;
- `DELETE /api/config/secret/claude` → apaga token e causa DoS de provedor;
- `POST /api/theme/meta` / `DELETE /api/theme` / `POST /api/wallpapers/upload` → desfigura tema ou enche disco;
- `POST /api/push/subscribe` + `POST /api/push/test` → SSRF cego (Finding 7).

**Justificativa da severidade:** MEDIUM (e não LOW) porque, embora "LAN only" reduza exposição à internet, a rede Wi-Fi é tipicamente compartilhada e o custo de exploração é zero. Sem este controle, os Findings 1, 4, 5 e 7 são maximizados.

**Recomendação:** sem quebrar UX local, gerar um token compartilhado aleatório em `backend/data/config.json` na primeira inicialização (`store.py:429-435` já faz `chmod 0o600`) e exigi-lo em rotas mutantes via header `X-Vigia-Token` (ou `Authorization: Bearer`). O frontend lê o token do próprio coletor (mesma origem) e o firmware o recebe via `secrets.h` junto com `USAGE_URL`.

---

## Finding 7 — SSRF cego via endpoint de inscrição de Web Push

**Severidade:** LOW-MEDIUM · **Confiança:** 7/10
**Local:** `backend/app/push.py:52-115`, `backend/app/routers/push.py:32`

**Descrição:** o campo `endpoint` da inscrição de push é armazenado sem validar que aponta para um serviço de push real (ex. `fcm.googleapis.com`). `broadcast()`/`webpush()` faz `POST` para essa URL com um JWT VAPID assinado. Como não há autenticação em nenhuma rota, um atacante na LAN pode registrar uma URL interna como "endpoint" e disparar via `POST /api/push/test` (imediato).

**Justificativa da severidade:** LOW-MEDIUM — é SSRF cego (atacante só aprende sucesso/falha, não o corpo da resposta), e o único dado potencialmente exposto é um JWT VAPID (não é um segredo de alto valor por si só), mas ainda é um primitivo real de scanning/disparo de webhook interno.

**Recomendação:** validar que `endpoint` pertence a um host de serviço de push conhecido (allowlist de domínios: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `api.push.apple.com`) antes de aceitar a inscrição. Bloquear também faixas privadas e `file://`.

---

## Finding 8 — Vazamento de informação em mensagens de erro

**Severidade:** LOW · **Confiança:** 7/10
**Local:** `backend/app/http_util.py:169-176`, `backend/app/routers/wallpapers.py:237-239`

**Descrição:** `http_util.py:169-176` inclui até 300 chars do corpo de resposta de APIs terceiras (`CoinGecko`, `Blockstream`, provedores de wallpaper) na mensagem de `HttpError`, que é propagada até o payload `UsagePayload.ok=false` e exposta em `GET /usage` e `GET /events` (SSE) para qualquer cliente LAN. `wallpapers.py:237-239` repassa até 500 chars do corpo de erro de `api.pexels.com`/`wallhaven.cc`/`api.unsplash.com` ao chamante via `HTTPException`.

**Cenário:** HTML de erro de provedor interno ou mensagem detalhada de API ajuda atacante a fingerprintar versões/serviços.

**Justificativa da severidade:** LOW — não expõe secrets (logging em `http_util.py:68-70` já omite `Authorization`), mas amplia superfície de reconhecimento.

**Recomendação:** trocar o corpo ecoado por código de status + mensagem genérica ("falha ao consultar provedor X") e logar o corpo detalhado apenas no servidor.

---

## Finding 9 — Comunicação firmware↔backend em HTTP puro, sem segredo compartilhado

**Severidade:** LOW · **Confiança:** 7/10
**Local:** `firmware/src/net/client.cpp:9-18,243`, `firmware/src/secrets.h:8`, `platformio.ini:1-72`

**Descrição:** toda comunicação do ESP32 com o backend (`USAGE_URL`, fetch de tema/background, SSE) é em `http://` puro, sem TLS e sem header de autenticação — apenas headers informativos (`X-Vigia-Device`, `X-Vigia-Screen`). Um atacante com posição on-path ou capaz de spoofar o endereço do coletor na LAN (ARP spoofing, rogue DHCP) pode alimentar o dispositivo com respostas JSON/tema forjadas.

**Justificativa da severidade:** LOW — o parsing de JSON/tema no firmware usa `ArduinoJson` com cópias para buffers de tamanho fixo protegidas por bounds-check (`if (count >= MAX_ACCOUNTS) break;`, `String::toCharArray(buf, sizeof(buf))`), e não foi encontrado caminho de corrupção de memória. O impacto confirmado é limitado a dados forjados sendo exibidos na tela — não RCE.

**Recomendação:** de baixa prioridade dado o modelo de ameaça "LAN only" já declarado pelo projeto; se desejado, um HMAC simples com segredo compartilhado (já existe `secrets.h`) elevaria a integridade sem custo de TLS completo em um MCU.

---

## Finding 10 — Supply-chain `dev` baixa `wokwigw` sem checksum/assinatura

**Severidade:** LOW · **Confiança:** 7/10
**Local:** `dev:38` (`WOKWIGW_URL`), `:118-136` (`curl -fsSL -o "$tmpzip" "$WOKWIGW_URL"` + `unzip`), `Dockerfile:13` (`pip install --no-cache-dir -e .` sem `--require-hashes`)

**Descrição:** o script `dev` baixa o binário `wokwigw` de `github.com/wokwi/wokwigw/releases` sem verificar `sha256` ou assinatura `cosign`. Um comprometimento da release ou MITM no download (sem pin de hash) permite execução de binário arbitrário no host do desenvolvedor. O mesmo vale para `pip install -e .` sem hashes no `Dockerfile`.

**Justificativa da severidade:** LOW — requer comprometimento de terceiro ou posição on-path no momento do `dev up`/`dev wokwi`, não é explorável por atacante LAN comum.

**Recomendação:** fixar `sha256` por plataforma em `dev` (ex.: `WOKWIGW_SHA256_DARWIN_ARM64=...` e `echo "$sha256  $tmpzip" | shasum -a 256 -c`) e/ou verificar assinatura `cosign`; no `Dockerfile`, usar `pip install --require-hashes` com `requirements.txt` pinado.

---

## Finding 11 — Headers de segurança ausentes

**Severidade:** INFO · **Confiança:** 9/10
**Local:** `backend/app/main.py:32-45` (`CloseConnectionMiddleware`), `frontend/vite.config.ts:1-23`

**Descrição:** o middleware `CloseConnectionMiddleware` só define `Cache-Control: no-store` / `keep-alive` / `no-cache` para SSE. Não são enviados `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` nem `Referrer-Policy`. O `vite.config.ts` também não define headers de dev.

**Impacto:** agrava o Finding 3 (script de terceiro via CDN) — sem CSP `script-src` restritivo, qualquer injeção futura tem execução irrestrita; sem `X-Frame-Options`, o painel pode ser embedado em clickjacking na LAN.

**Recomendação:** adicionar no backend (via middleware ou `StaticFiles` headers): `Content-Security-Policy: default-src 'self'; script-src 'self' cdn.jsdelivr.net; connect-src 'self' api.pexels.com api.unsplash.com wallhaven.cc; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

---

## Finding 12 — Container Docker roda como root sem hardening

**Severidade:** INFO · **Confiança:** 7/10
**Local:** `Dockerfile:10-22`, `compose.yaml:5-17`

**Descrição:** `Dockerfile` parte de `python:3.12-slim` e executa `pip install` e `CMD ["python3", "-m", "app.main"]` como `root`, sem `USER` dedicado, sem `readOnlyRootFilesystem` nem `cap_drop`. `compose.yaml` expõe `0.0.0.0:8787` por padrão e monta `./backend/data:/app/data` gravável. `store.py:434` faz `os.chmod(path, 0o600)` corretamente, mas o isolamento do container é nulo — um RCE futuro no backend (ex.: via Pillow) teria privilégio root no container.

**Recomendação:** adicionar `RUN useradd -m vigia && chown -R vigia:vigia /app /frontend` e `USER vigia` no `Dockerfile`; em `compose.yaml`, `read_only: true` com `tmpfs` para `/tmp` e `cap_drop: [ALL]` + `cap_add: [CHOWN, SETUID, SETGID]` mínimo; restringir `ports` a `127.0.0.1:${PORT:-8787}:8787` quando não for necessário acesso LAN.

---

## O que foi verificado e considerado seguro (sem achados)

- **Backend:** sem SQL/command/eval/pickle/YAML injection; sem segredos hardcoded no código-fonte; logging de requisições HTTP (`http_util.py:68-70`) confirmado que não grava headers/tokens; `subprocess.run` em `local/claude_oauth.py`/`gpt_oauth.py` usa lista de argumentos (sem `shell=True`); rotas de arquivo estático e de wallpaper (`wid`) rejeitam `/`, `\`, `..` — sem path traversal.
- **Frontend:** nenhum uso de `dangerouslySetInnerHTML`/`innerHTML`/`eval`; chaves/tokens de provedores nunca são devolvidos pelo backend ao frontend (sempre mascarados); nenhum `postMessage` sem checagem de origem; nenhum segredo em `localStorage` ou querystring (só `vigia_theme_draft_v2` com layout).
- **Firmware:** nenhum `strcpy`/`sprintf`/format-string vulnerável encontrado; `secrets.h` não está versionado no git (apenas o `.example` com placeholders); TLS não é usado em lugar nenhum (design HTTP puro consistente, não há validação de certificado desabilitada porque não há certificado).
- **Infra/compose:** `.gitignore:17,20,22` correto (`firmware/src/secrets.h`, `backend/data/*.json`, `wallpapers/`); `frontend/vite.config.ts:6-21` proxy dev restrito a `127.0.0.1:8787` com `strictPort`.

---

## Recomendações priorizadas

1. **Adicionar allowlist de host** para downloads de imagem em `wallpapers.py` (`_download_image`/`_http_json`) e para `endpoint` de push (Findings 1 e 7) — maior ROI, bloqueia `file://` e varredura interna.
2. **Rate-limit por IP** (`slowapi`) em `/usage`, `/events`, `/upload`, `/import`, `/push/test` (Finding 4) — 2h.
3. **Token simples para rotas mutantes** do backend + para `theme_server.cpp` do firmware (Finding 6 e 2) — `X-Vigia-Token` em `data/config.json`/`secrets.h`, troca `Access-Control-Allow-Origin: *` por origem do coletor — 3h.
4. **Fixar versão + SRI** do script `NameToColor` (Finding 3) — `@v1.2.3` + `integrity` ou vendorizar — 30 min.
5. **Headers CSP/frame/no-sniff** no backend (Finding 11) e `Dockerfile` `USER vigia` + `read_only` + `cap_drop` (Finding 12) — 1h.
6. **Checksum `wokwigw` em `dev`** (`sha256` fixo por plataforma) (Finding 10) — 15 min.
7. **Quota total de wallpapers** (ex.: 50 itens ou 100 MB, LRU eviction) (Finding 5) — 1h.
8. **Sanitizar corpos de erro** (Finding 8) — trocar echo de 300-500 chars por mensagem genérica — 15 min.

---
🤖 Gerado com [Claude Code](https://claude.com/claude-code) — auditoria realizada com 3 sub-agentes paralelos (backend, frontend/landing, firmware) e verificação manual dos achados de maior severidade.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Atualizado em 2026-09-02 com auditoria Muse Spark — 6 novos achados (Findings 4-6, 8, 10-12) e ampliação de recomendações.
