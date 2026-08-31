# API OpenRouter (créditos da conta)

Endpoint público e documentado da OpenRouter — não precisa imitar nenhum app.

## Token

API key gerada manualmente pelo usuário em https://openrouter.ai/settings/keys.

Vai em `OPENROUTER_API_KEY` no `collector/.env.openrouter` (gitignored; sem gerador automático — é colar e salvar). Sem fallback de app local, porque o OpenRouter não roda nada instalado neste Mac.

## Por que `/credits` e não `/auth/key`

`GET /api/v1/auth/key` devolve uso **por key** (`usage`, `usage_monthly`, `limit`). Parece o endpoint óbvio, mas se a key usada aqui for nova/dedicada a este painel e o gasto real da conta tiver sido feito com outra key (outro app, outra integração), esse endpoint mostra tudo zerado mesmo a conta tendo histórico real — foi o que aconteceu no v1 deste provedor: a tela sempre em branco.

`GET /api/v1/credits` devolve o saldo da **conta inteira**, não importa qual key fez as chamadas:

```
GET https://openrouter.ai/api/v1/credits
Authorization: Bearer <OPENROUTER_API_KEY>
```

```json
{ "data": { "total_credits": 10, "total_usage": 6.655077294 } }
```

- `total_credits` (USD, float) → total de crédito já comprado na conta → `limit_cents` (×100) no `/usage`; `null`/ausente se a conta nunca comprou crédito (pay-as-you-go sem pacote)
- `total_usage` (USD, float) → gasto total histórico da conta → `used_cents`

`percent` e `remaining_cents` são calculados no coletor (`parse_openrouter_payload` em `collector/providers/openrouter.py`) a partir desses dois números. Conta sem `total_credits` mostra `percent: null` e a tela cai pro texto "sem créditos comprados".

## O que a tela mostra

Uma barra com o percentual de crédito da conta já gasto, e abaixo o valor absoluto (`usado $X / $Y`).
