# Revisão de Segurança — Vigia AI

**Data:** 2026-09-02
**Escopo:** backend (`backend/app/**`), frontend (`frontend/src/**`, `landing/index.html`), firmware ESP32 (`firmware/src/**`)
**Método:** leitura integral do código-fonte próprio do projeto (excluindo dependências de terceiros e testes), com verificação manual dos achados de maior severidade contra o código real.

> Dois achados HIGH (CORS wildcard sem autenticação e XSS refletido no callback OAuth do AdSense) foram corrigidos em 2026-09-02 e removidos deste documento. Ver histórico do git (`backend/app/main.py`, `backend/app/routers/adsense.py`) para o antes/depois.

## Contexto importante

O Vigia AI é assumido pelo próprio código (`backend/app/main.py`) como um gadget **local, "LAN only"**: a documentação da API afirma explicitamente *"Não exponha a porta 8787 na internet"* e que tokens de provedores "nunca" saem do computador do coletor. Isso reduz a severidade de vários achados que dependeriam de exposição direta à internet — mas **não elimina o risco**, porque vários achados dependem apenas de presença na mesma rede Wi-Fi/LAN (convidado, dispositivo IoT comprometido, vizinho em rede compartilhada), não de acesso físico.

Nenhuma rota do backend exige autenticação própria — isso é uma decisão de design do projeto (documentada como "LAN only"), não em si um achado desta revisão. Os itens abaixo continuam válidos independentemente do CORS, pois são exploráveis por qualquer requisição HTTP direta na LAN (não dependem de um navegador).

## Resumo ranqueado

| # | Vulnerabilidade | Severidade | Confiança | Local |
|---|---|---|---|---|
| 1 | SSRF na importação de wallpaper (sem allowlist de host) | **MEDIUM-HIGH** | 8/10 | `backend/app/routers/wallpapers.py:210-225, 809, 859` |
| 2 | Servidor HTTP local do ESP32 sem autenticação (leitura/escrita/apagar/screenshot) | **MEDIUM** | 8/10 | `firmware/src/net/theme_server.cpp:27-184` |
| 3 | Script de terceiro carregado dinamicamente da branch `@main` (sem pin/SRI) | **MEDIUM** | 8/10 | `frontend/src/hooks/useNameToColor.ts:3-45` |
| 4 | SSRF cego via endpoint de inscrição de Web Push | **LOW-MEDIUM** | 7/10 | `backend/app/push.py:52-115`, `backend/app/routers/push.py` |
| 5 | Comunicação firmware↔backend em HTTP puro, sem segredo compartilhado | **LOW** | 7/10 | `firmware/src/net/client.cpp` |

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

**Recomendação:** validar o host de `image_url`/`thumb_url` contra uma allowlist por provedor (`images.pexels.com`, `images.unsplash.com`, `w.wallhaven.cc`, etc.) antes de baixar; usar `requests` com `allow_redirects=False` e um opener customizado sem `FileHandler`.

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

**Recomendação:** fixar em uma tag/commit específico (`@v1.2.3` ou hash), e adicionar `integrity`/`crossorigin` (SRI) à tag `<script>` gerada.

---

## Finding 4 — SSRF cego via endpoint de inscrição de Web Push

**Severidade:** LOW-MEDIUM · **Confiança:** 7/10
**Local:** `backend/app/push.py:52-115`, `backend/app/routers/push.py`

**Descrição:** o campo `endpoint` da inscrição de push é armazenado sem validar que aponta para um serviço de push real (ex. `fcm.googleapis.com`). `broadcast()`/`webpush()` faz `POST` para essa URL com um JWT VAPID assinado. Como não há autenticação em nenhuma rota, um atacante na LAN pode registrar uma URL interna como "endpoint" e disparar via `POST /api/push/test` (imediato).

**Justificativa da severidade:** LOW-MEDIUM — é SSRF cego (atacante só aprende sucesso/falha, não o corpo da resposta), e o único dado potencialmente exposto é um JWT VAPID (não é um segredo de alto valor por si só), mas ainda é um primitivo real de scanning/disparo de webhook interno.

**Recomendação:** validar que `endpoint` pertence a um host de serviço de push conhecido (allowlist de domínios: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, etc.) antes de aceitar a inscrição.

---

## Finding 5 — Comunicação firmware↔backend em HTTP puro, sem segredo compartilhado

**Severidade:** LOW · **Confiança:** 7/10
**Local:** `firmware/src/net/client.cpp`

**Descrição:** toda comunicação do ESP32 com o backend (`USAGE_URL`, fetch de tema/background, SSE) é em `http://` puro, sem TLS e sem header de autenticação — apenas headers informativos (`X-Vigia-Device`, `X-Vigia-Screen`). Um atacante com posição on-path ou capaz de spoofar o endereço do coletor na LAN (ARP spoofing, rogue DHCP) pode alimentar o dispositivo com respostas JSON/tema forjadas.

**Justificativa da severidade:** LOW — o parsing de JSON/tema no firmware usa `ArduinoJson` com cópias para buffers de tamanho fixo protegidas por bounds-check (`if (count >= MAX_ACCOUNTS) break;`, `String::toCharArray(buf, sizeof(buf))`), e não foi encontrado caminho de corrupção de memória. O impacto confirmado é limitado a dados forjados sendo exibidos na tela — não RCE.

**Recomendação:** de baixa prioridade dado o modelo de ameaça "LAN only" já declarado pelo projeto; se desejado, um HMAC simples com segredo compartilhado (já existe `secrets.h`) elevaria a integridade sem custo de TLS completo em um MCU.

---

## O que foi verificado e considerado seguro (sem achados)

- **Backend:** sem SQL/command/eval/pickle/YAML injection; sem segredos hardcoded no código-fonte; logging de requisições HTTP (`http_util.py`) confirmado que não grava headers/tokens; `subprocess.run` em `local/claude_oauth.py`/`gpt_oauth.py` usa lista de argumentos (sem `shell=True`); rotas de arquivo estático e de wallpaper (`wid`) rejeitam `/`, `\`, `..` — sem path traversal.
- **Frontend:** nenhum uso de `dangerouslySetInnerHTML`/`innerHTML`/`eval`; chaves/tokens de provedores nunca são devolvidos pelo backend ao frontend (sempre mascarados); nenhum `postMessage` sem checagem de origem; nenhum segredo em `localStorage` ou querystring.
- **Firmware:** nenhum `strcpy`/`sprintf`/format-string vulnerável encontrado; `secrets.h` não está versionado no git (apenas o `.example` com placeholders); TLS não é usado em lugar nenhum (design HTTP puro consistente, não há validação de certificado desabilitada porque não há certificado).

---

## Recomendações priorizadas

1. **Adicionar allowlist de host** para downloads de imagem em `wallpapers.py` (`_download_image`/`_http_json`) e para `endpoint` de push.
2. **Adicionar um token simples** ao `theme_server.cpp` do firmware.
3. **Fixar versão + SRI** do script `NameToColor` carregado via CDN.

---
🤖 Gerado com [Claude Code](https://claude.com/claude-code) — auditoria realizada com 3 sub-agentes paralelos (backend, frontend/landing, firmware) e verificação manual dos achados de maior severidade.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
