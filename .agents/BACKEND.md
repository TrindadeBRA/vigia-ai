# Backend (coletor)

Node 22 + Fastify em `backend/` (port do Python/FastAPI). Sobe em `0.0.0.0:8787` por padrão (produção/instalado — fixo por causa do `secrets.h` da ESP32, ver [DESKTOP.md](DESKTOP.md)); `./dev up` usa `:8788` pra não colidir com um app instalado já rodando em `:8787`.

```bash
./dev up                 # + frontend Vite
./dev up --docker
```

- Painel: http://127.0.0.1:5173/display/config (dev) ou http://127.0.0.1:8787/display/config (produção / Compose)
- Mostrador: `/display`
- Configs: `/display/config` (`/` redireciona para cá)
- Alarmes e Telegram: `/display/alarms` (painel) + `GET/POST /api/alarms`, `PATCH/DELETE /api/alarms/{id}`, `GET/POST /api/telegram/*` — ver [NOTIFICACOES.md](NOTIFICACOES.md)
- Papéis de parede: `/display/config` (chaves dos provedores) + `/display/theme` (biblioteca/busca/import) + `/api/wallpapers/*` — ver [CONTRATO_TEMA.md](CONTRATO_TEMA.md#papel-de-parede)
- Board (`/display`): layout (posição/tamanho dos cards) espelhado em `/api/board` — `backend/data/board.json`, sem `localStorage` (cache local removido, ver [FRONTEND.md](FRONTEND.md))
- Notas (post-its do `/display`): `GET/POST /api/notes`, `PATCH/DELETE /api/notes/{id}` — `backend/data/notes.json` (`backend/src/notes.ts`); criadas pelo painel ou pelo Telegram (`/note {texto}`, `backend/src/telegram/bot.ts`)
- Imagens (cards de imagem do `/display`): `GET/POST /api/images`, `PATCH/DELETE /api/images/{id}` — `backend/data/images.json` (`backend/src/images.ts`); `src` aceita `data:image/...` base64 (até ~8MB de arquivo) ou URL http(s), corpo com `bodyLimit` próprio de 16MB
- Preferências de exibição, rascunho do editor de tema e o easter egg retrô: `GET/PUT /api/prefs`, `/api/theme-draft`, `/api/retro` — blobs JSON simples (`backend/src/routers/clientState.ts`), sem CRUD por item, cada um seu próprio arquivo em `backend/data/`
- Swagger: http://127.0.0.1:8788/docs em dev (`/docs` via 5173 também funciona, é proxy) ou http://127.0.0.1:8787/docs em produção/instalado — OpenAPI vivo (`/openapi.json`), incluindo SSE (`GET /events`). Rotas agrupadas por tag (uma por área/router — `Clima`, `GitHub`, `Câmeras`, etc.), não vêm mais tudo junto sem categoria. **Toda rota nova precisa de `{ schema: { tags: ["X"] } }`** como segundo argumento do `app.get/post/put/patch/delete(...)` — se `X` for uma área nova, também adiciona em `OPENAPI_TAGS` (`backend/src/main.ts`, controla a ordem de exibição) e no array hardcoded de `tagsSorter` (duplicado de propósito: roda só no browser, ver comentário ali). Rotas que servem o SPA do frontend (`/`, `/assets/*`, etc., não é "API") usam `{ schema: { hide: true } }` em vez de tag.
- Firmware da ESP32 pelo painel: `GET/PUT /api/firmware`, `POST /api/firmware/file` (download do `secrets.h` com senha), `POST /api/firmware/source` (baixa `firmware/` da tag GitHub desta versão, fallback `main`, grava em `COLLECTOR_DATA/firmware`), `POST /api/firmware/flash` (stream do `pio upload`). `GET /api/firmware` devolve SSID e senha da Wi-Fi para o painel **Placa e rede**; `GET /api/config` continua sem a senha.
- Contrato JSON: `GET /usage` — consulta as APIs na hora e avisa o SSE
- Stream: `GET /events` — `text/event-stream`, snapshot a cada `USAGE_INTERVAL_S` (padrão 60 s) para todos os clientes

Config: `backend/data/config.json` (gitignored, `version: 1`). Tokens nunca voltam no `GET /api/config`.

Claude/GPT/Cursor: Keychain / `~/.codex/auth.json` / `state.vscdb` primeiro; paste no painel só como plano B. OpenRouter/DeepSeek/OpenCode Go/OpenCode Zen/fal.ai: key no painel. Bitcoin: endereço público. AdSense: OAuth Google (Client ID tipo Web) — o coletor faz o refresh; ver [APIS_ADSENSE.md](APIS_ADSENSE.md).

Rate limit: o hub **não** martela todo terceiro a cada 60 s. Cotas de assinatura acompanham o ciclo; CoinGecko (~5 min, cliente compartilhado), câmbio (~1 h), AdSense (5 min) e clima (10 min) têm TTL próprio — ver `src/refreshCache.ts` (port de `app/refresh_cache.py`). 429 devolve last-good e entra em backoff. Claude ainda pode 429 se o UA não for `claude-code/<ver>`; intervalo seguro da comunidade ~180 s (`USAGE_INTERVAL_S=180`).

Linux: Claude em `~/.claude/.credentials.json`; GPT em `~/.codex/auth.json`; Cursor em `~/.config/Cursor/User/globalStorage/state.vscdb`. Windows: cole o token (sem Keychain).

Ver também [CONTRATO_JSON.md](CONTRATO_JSON.md) e [COLETOR.md](COLETOR.md) (histórico do protótipo).
