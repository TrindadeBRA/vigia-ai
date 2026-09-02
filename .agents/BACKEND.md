# Backend (coletor)

FastAPI em `backend/`. Sobe em `0.0.0.0:8787`.

```bash
./dev up                 # + frontend Vite
./dev up --docker
```

- Painel: http://127.0.0.1:5173/display/config (dev) ou http://127.0.0.1:8787/display/config (produção / Compose)
- Mostrador: `/display`
- Configs: `/display/config` (`/` redireciona para cá)
- Alarmes e push: `/display/alarms` (painel) + `GET/POST /api/alarms`, `PATCH/DELETE /api/alarms/{id}`, `GET/POST /api/push/*` — ver [NOTIFICACOES.md](NOTIFICACOES.md)
- Swagger: http://127.0.0.1:8787/docs — OpenAPI vivo (`/openapi.json`), incluindo SSE (`GET /events`)
- Contrato JSON: `GET /usage` — consulta as APIs na hora e avisa o SSE
- Stream: `GET /events` — `text/event-stream`, snapshot a cada `USAGE_INTERVAL_S` (padrão 60 s) para todos os clientes

Config: `backend/data/config.json` (gitignored, `version: 1`). Tokens nunca voltam no `GET /api/config`.

Claude/GPT/Cursor: Keychain / `~/.codex/auth.json` / `state.vscdb` primeiro; paste no painel só como plano B. OpenRouter/DeepSeek/OpenCode Go/OpenCode Zen/fal.ai: key no painel. Bitcoin: endereço público. AdSense: OAuth Google (Client ID tipo Web) — o coletor faz o refresh; ver [APIS_ADSENSE.md](APIS_ADSENSE.md).

Rate limit: o hub **não** martela todo terceiro a cada 60 s. Cotas de assinatura acompanham o ciclo; CoinGecko (~5 min, cliente compartilhado), câmbio (~1 h), AdSense (5 min) e clima (10 min) têm TTL próprio — ver `app/refresh_cache.py`. 429 devolve last-good e entra em backoff. Claude ainda pode 429 se o UA não for `claude-code/<ver>`; intervalo seguro da comunidade ~180 s (`USAGE_INTERVAL_S=180`).

Linux: Claude em `~/.claude/.credentials.json`; GPT em `~/.codex/auth.json`; Cursor em `~/.config/Cursor/User/globalStorage/state.vscdb`. Windows: cole o token (sem Keychain).

Ver também [CONTRATO_JSON.md](CONTRATO_JSON.md) e [COLETOR.md](COLETOR.md) (histórico do protótipo).
