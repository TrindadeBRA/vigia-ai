# Backend (coletor)

FastAPI. Suba com `./dev up` na raiz do repositório.

- Swagger: http://127.0.0.1:8787/docs
- Stream SSE: `GET /events`
- Contrato JSON: `GET /usage`
- Config: `GET /api/config` (nunca devolve tokens)
- Alarmes: `GET/POST /api/alarms`, `PATCH/DELETE /api/alarms/{id}`
- Telegram: `GET/POST /api/telegram/*` (token, chats, teste) — ver [`.agents/NOTIFICACOES.md`](../.agents/NOTIFICACOES.md)
