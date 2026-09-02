# API OpenCode Go (assinatura mensal)

Assinatura recorrente da OpenCode — $10/mês com limite mensal de $60.

## Token

API key gerada em https://opencode.ai/auth, na seção "OpenCode Go".

Vai no painel web (persistido em `backend/data/config.json`, gitignored). A mesma key Zen também funciona no Go — ambos usam a mesma autenticação `Bearer`.

## `GET /zen/go/v1/usage`

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <OPENCODE_API_KEY>
Accept: application/json
```

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 42.5, "resetsAt": "2026-08-31T04:00:00Z" },
    "weekly": { "status": "ok", "percent": 18.0, "resetsAt": "2026-09-04T03:00:00Z" },
    "monthly": { "status": "ok", "percent": 10.5, "resetsAt": "2026-09-01T00:00:00Z" }
  }
}
```

### Janelas

| Janela      | Limite | Reset               |
| ----------- | ------ | ------------------- |
| **rolling** | $12    | ~5 h (janela curta) |
| **weekly**  | $30    | ~7 d (semana civil) |
| **monthly** | $60    | 1º do mês           |

`percent` já vem em 0–100 da API. `status` pode ser `"ok"`, `"warning"` ou `"error"` — o coletor ignora e usa só `percent`/`resetsAt`.

## O que a tela mostra

Na home: pior percentual entre rolling/weekly/monthly como barra do card. Na tela interna: 3 barras separadas (rolling/weekLimit/monthLimit), cada uma com usado/resta/reset.
