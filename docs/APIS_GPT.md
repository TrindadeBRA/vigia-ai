# API GPT (assinatura ChatGPT / Codex CLI)

Não é a API paga por token (`OPENAI_API_KEY` / `sk-…`). É o **OAuth da assinatura ChatGPT**, o mesmo do Codex CLI (`codex login`).

O endpoint **não é um produto público**. Path, headers e o formato da resposta podem mudar sem aviso. O coletor isola a quebra (`ok: false` só no card GPT).

## Endpoint

```
GET https://chatgpt.com/backend-api/wham/usage
Authorization: Bearer <access_token>
Accept: application/json
User-Agent: codex-cli
ChatGPT-Account-Id: <account_id>   # quando o auth.json tiver
```

Sem o Bearer do login ChatGPT, costuma vir **401**. A API key de plataforma (`sk-…`) **não** serve neste path — é outro ledger (pago conforme o uso).

## Token (app local primeiro)

O coletor **não** implementa refresh OAuth próprio. Quem renova é o Codex CLI. Se o JWT expirou, rode `codex login` neste Mac.

Ordem:

1. **`~/.codex/auth.json`** (ou `$CODEX_HOME/auth.json`, ou `CODEX_AUTH_PATH`) → `tokens.access_token` e, se existir, `tokens.account_id`.
2. Plano B no painel (`data/config.json`): token colado. Só Docker / outro PC. Token colado **não** ganha do `auth.json` se os dois existirem na conta local.

**Não** use `OPENAI_API_KEY` neste endpoint.

Tokens **nunca** vão para a ESP32 nem para o JSON de `GET /usage`.

## Formato da resposta (varia)

O Codex mostra duas barras (5 h e semana) a partir de `rate_limit`:

```json
{
  "plan_type": "plus",
  "rate_limit": {
    "primary_window": {
      "used_percent": 42.0,
      "limit_window_seconds": 18000,
      "reset_at": 1780000000
    },
    "secondary_window": {
      "used_percent": 8.5,
      "limit_window_seconds": 604800,
      "reset_at": 1780500000
    }
  }
}
```

`used_percent` vem **0–100** (não 0–1). `reset_at` é epoch Unix em segundos.

O coletor classifica pela duração da janela: ≤ 8 h → **sessão**; maior → **semana** (no plano free às vezes só existe uma janela de ~30 dias — ela cai em `weekly_percent`).

Aliases (`five_hour`, `weekly`, …) também são lidos se a API mudar o envelope.

## O que a tela mostra

- **Sessão** ← janela curta (`primary_window` ~5 h)
- **Semana** ← janela longa (`secondary_window`, ou a janela mensal se for a única)
- **plano** ← `plan_type` (`plus`, `pro`, `free`, …)

A tela **interna** lista usado, restante e reset de cada janela.
