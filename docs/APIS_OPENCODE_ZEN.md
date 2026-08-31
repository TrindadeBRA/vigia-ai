# API OpenCode Zen (saldo pré-pago)

Créditos pré-pagos da OpenCode — pay-as-you-go, sem assinatura fixa.

## Token

API key gerada em https://opencode.ai/auth, na seção "OpenCode Zen".

Vai no painel web (persistido em `backend/data/config.json`, gitignored). A mesma key Go também funciona no Zen — ambos usam a mesma autenticação `Bearer`.

## Endpoint de saldo

O saldo é lido de um endpoint de uso/balance. O URL exato pode variar:

```
GET https://opencode.ai/zen/v1/usage
Authorization: Bearer <OPENCODE_API_KEY>
Accept: application/json
```

> **Nota**: este endpoint pode retornar "sem dados" se a conta não tiver uso registrado. O coletor trata isso como `ok=false` com mensagem de erro.

## O que a tela mostra

Na home: barra de créditos (como OpenRouter/DeepSeek — saldo restante, sem percentual se não houver limite definido). Na tela interna: barra, saldo restante em USD.

## Semelhança com DeepSeek

Este provedor segue o mesmo modelo de DeepSeek: a API expõe o saldo restante, mas não o limite total nem o gasto acumulado. Por isso `percent`/`limit_cents`/`used_cents` ficam `null` quando a API não fornece esses dados — só `remaining_cents` é confiável.
