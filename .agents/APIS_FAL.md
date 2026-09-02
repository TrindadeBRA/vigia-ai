# API fal.ai (saldo de créditos)

Créditos pré-pagos da fal.ai — plataforma de inferência (imagem/vídeo/áudio), pay-as-you-go, sem assinatura fixa.

## Token

API key gerada em https://fal.ai/dashboard/keys. **Precisa ser uma key com escopo "Admin"** — uma key "API" comum (a usada pra rodar modelos) recebe 401/403 no endpoint de billing.

Vai no painel web (persistido em `backend/data/config.json`, gitignored). Formato: `id:secret` (não é `sk-...` como os demais provedores).

## Endpoint de saldo

```
GET https://api.fal.ai/v1/account/billing?expand=credits
Authorization: Key <FAL_API_KEY>
Accept: application/json
```

Resposta:

```json
{
  "username": "my-team",
  "credits": { "current_balance": 24.5, "currency": "USD" }
}
```

`current_balance` vem em dólares (não centavos) — o coletor converte pra `remaining_cents` multiplicando por 100.

## O que a tela mostra

Na home: barra de créditos (como OpenRouter/DeepSeek/OpenCode Zen — saldo restante, sem percentual, já que a API não expõe limite/teto). Na tela interna: saldo restante em USD.

## Semelhança com OpenCode Zen / DeepSeek

Mesmo modelo: a API expõe só o saldo restante, sem limite total nem gasto acumulado. Por isso `percent`/`limit_cents`/`used_cents` ficam `null` — só `remaining_cents` é confiável.
