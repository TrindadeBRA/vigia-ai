# Backend (coletor)

FastAPI em `backend/`. Sobe em `0.0.0.0:8787`.

```bash
./dev up                 # + frontend Vite
./dev up --docker
```

- Painel: http://127.0.0.1:5173/display/config (dev) ou http://127.0.0.1:8787/display/config (produção / Compose)
- Mostrador: `/display`
- Configs: `/display/config` (`/` redireciona para cá)
- Swagger: http://127.0.0.1:8787/docs — OpenAPI vivo (`/openapi.json`), incluindo SSE (`GET /events`)
- Contrato JSON: `GET /usage` — consulta as APIs na hora e avisa o SSE
- Stream: `GET /events` — `text/event-stream`, um ciclo de APIs para todos os clientes (padrão 60 s, `USAGE_INTERVAL_S`)

Config: `backend/data/config.json` (gitignored, `version: 1`). Tokens nunca voltam no `GET /api/config`.

Claude/GPT/Cursor: Keychain / `~/.codex/auth.json` / `state.vscdb` primeiro; paste no painel só como plano B. OpenRouter/DeepSeek: key no painel.

Rate limit: o 429 quase sempre é Claude. User-Agent `claude-code/<ver>` é obrigatório. Intervalo seguro da comunidade ~180 s; o ciclo do hub é 60 s.

Linux: Claude em `~/.claude/.credentials.json`; GPT em `~/.codex/auth.json`; Cursor em `~/.config/Cursor/User/globalStorage/state.vscdb`. Windows: cole o token (sem Keychain).

Ver também [CONTRATO_JSON.md](CONTRATO_JSON.md) e [COLETOR.md](COLETOR.md) (histórico do protótipo).
