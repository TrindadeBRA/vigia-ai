# API DeepSeek (saldo da conta)

Endpoint público e documentado da DeepSeek — não precisa imitar nenhum app.

## Token

API key gerada manualmente pelo usuário em https://platform.deepseek.com/api_keys.

Vai em `DEEPSEEK_API_KEY` no painel web (persistido em `collector/data/config.json`, gitignored). Sem fallback de app local, porque a DeepSeek não roda nada instalado neste Mac.

## `GET /user/balance`

```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <DEEPSEEK_API_KEY>
```

```json
{
  "is_available": true,
  "balance_infos": [
    { "currency": "USD", "total_balance": "9.98", "granted_balance": "10.00", "topped_up_balance": "0.00" }
  ]
}
```

`balance_infos` pode trazer mais de uma moeda; o coletor usa a entrada `"currency": "USD"` (cai para a primeira do array se não houver USD).

## `granted_balance` / `topped_up_balance` / `total_balance` são saldo atual, não histórico

Os três campos são o saldo que **resta agora** em cada balde (`total_balance = granted_balance + topped_up_balance`) — a API não guarda quanto já foi depositado no total nem quanto já foi gasto. Confirmado comparando com a página de faturamento da DeepSeek: um depósito de US$ 2 apareceu ali no histórico, mas `topped_up_balance` já mostrava só US$ 1,29 (o que sobrou depois do uso) — se fosse total histórico teria continuado em US$ 2.

Por isso o coletor (`parse_deepseek_payload` em `collector/providers/deepseek.py`) só extrai:

- `remaining_cents` = `total_balance` × 100 → saldo atual, é o único número real
- `percent`, `limit_cents`, `used_cents` ficam sempre `null` — não tem como calcular "quanto já foi gasto" sem saber o total histórico, e a API não expõe isso. Diferente do OpenRouter, que tem `/credits` com `total_credits`/`total_usage` (acumulado desde sempre).

## O que a tela mostra

Sem percentual (barra vazia, "--"). Só o saldo restante, tipo carteira pré-paga: quanto mais você gasta, menor o número — sem meta/teto pra comparar.
