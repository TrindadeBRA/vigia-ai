# Backend (coletor)

FastAPI em `backend/`. Sobe em `0.0.0.0:8787`.

```bash
./dev up                 # + frontend Vite
./dev up --docker
```

- Painel: http://127.0.0.1:5173/ (dev) ou http://127.0.0.1:8787/ (produção / Compose)
- Mostrador: `/display`
- Swagger: http://127.0.0.1:8787/docs
- Contrato da placa: `GET /usage` — sem cache, uma chamada real por request

Config: `backend/data/config.json` (gitignored, `version: 1`). Tokens nunca voltam no `GET /api/config`.

Claude/Cursor: Keychain / `state.vscdb` primeiro; paste no painel só como plano B. OpenRouter/DeepSeek: key no painel.

Rate limit: o 429 quase sempre é Claude. User-Agent `claude-code/<ver>` é obrigatório. Intervalo seguro da comunidade ~180 s; o poll padrão da placa é 60 s.

Linux: Claude em `~/.claude/.credentials.json`; Cursor em `~/.config/Cursor/User/globalStorage/state.vscdb`. Windows: cole o token (sem Keychain).

Ver também [CONTRATO_JSON.md](CONTRATO_JSON.md) e [COLETOR.md](COLETOR.md) (histórico do protótipo).
