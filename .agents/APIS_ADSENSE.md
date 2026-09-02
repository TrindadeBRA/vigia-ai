# API Google AdSense (ganhos de hoje + carteira)

Ganhos **estimados de hoje** e o **saldo não pago** da conta AdSense. Diferente de Claude/GPT/Cursor: o coletor **é** um cliente OAuth (guarda `client_id`, `client_secret` e `refresh_token` em `backend/data/config.json`, gitignored) e renova o access token sozinho.

Não há API key. Escopo: `https://www.googleapis.com/auth/adsense.readonly`.

## Setup no Google Cloud

1. No [Google Cloud Console](https://console.cloud.google.com/), ligue a **AdSense Management API**.
2. Crie um cliente OAuth **tipo Web**.
3. Cadastre a URI de redirecionamento:
   `http://127.0.0.1:8787/api/oauth/adsense/callback`
   (a porta segue a do coletor; o painel mostra a URI exata).
4. Cole o Client ID e o Client Secret no fold **Credenciais do Google Cloud** da seção Financeiro.
5. **Entrar com Google** — o coletor grava o `refresh_token`. O callback **não** pode ser o Vite (`:5173`) nem `/display/alarmes`.

Se o Google não devolver `refresh_token`, revogue o acesso em [myaccount.google.com/permissions](https://myaccount.google.com/permissions) e entre de novo (`prompt=consent` + `access_type=offline`).

## Endpoints

Lista a primeira conta AdSense da conta Google:

```
GET https://adsense.googleapis.com/v2/accounts
Authorization: Bearer <access>
```

Saldo não pago (`payments/unpaid` — não é uma carteira gastável; o pagamento sai quando passa do limiar mensal):

```
GET https://adsense.googleapis.com/v2/{account}/payments
```

Ganhos de hoje (estimativa; ontem é mais estável na API, mas o card mostra **hoje**):

```
GET https://adsense.googleapis.com/v2/{account}/reports:generate?dateRange=TODAY&metrics=ESTIMATED_EARNINGS
```

O coletor converte os valores para centavos na moeda da conta (`currency`: BRL, USD, …).

## OAuth no coletor

| Rota | Papel |
| --- | --- |
| `GET /api/oauth/adsense/start?return_to=` | Devolve `{ url }` do login Google. `return_to` só `http://127.0.0.1\|localhost` + path `/display…`. |
| `GET /api/oauth/adsense/callback` | Troca o `code` pelo `refresh_token` e redireciona para o painel com `?adsense=ok\|denied\|error`. |
| `POST /api/oauth/adsense/disconnect` | Apaga o `refresh_token` (mantém Client ID/Secret). |

State OAuth vive em memória (TTL 10 min). Reiniciar o coletor no meio do login invalida o callback.

## O que a tela mostra

Duas linhas, sem barra de percentual (igual Bitcoin): **Hoje (est.)** e **Carteira** (saldo não pago). Alarme só em `unpaid_cents` — `today_cents` é estimativa e o motor de cents dispara em valor *baixo*.
