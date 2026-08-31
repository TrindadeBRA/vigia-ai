# Contrato JSON — `GET /usage`

O firmware **depende** deste formato. Mudança = atualizar este doc **e** o parser em `src/usage_client.cpp`.

`Content-Type: application/json; charset=utf-8`

Percentuais: **0–100** (float). Se a API nativa mandar 0–1, o coletor converte.

Datas: string ISO-8601 UTC (`…Z`) ou `null`.

## Exemplo

```json
{
  "updated_at": "2026-08-31T00:10:00Z",
  "claude": {
    "ok": true,
    "error": null,
    "configured": true,
    "session_percent": 42.0,
    "session_resets_at": "2026-08-31T04:00:00Z",
    "weekly_percent": 18.5,
    "weekly_resets_at": "2026-09-04T03:00:00Z",
    "sonnet_percent": 55.0,
    "sonnet_resets_at": "2026-09-04T03:00:00Z",
    "opus_percent": 12.0,
    "opus_resets_at": "2026-09-04T03:00:00Z"
  },
  "cursor": {
    "ok": true,
    "error": null,
    "configured": true,
    "percent": 35.0,
    "other_percent": 12.0,
    "used_cents": 700,
    "limit_cents": 2000,
    "remaining_cents": 1300,
    "bonus_cents": 0,
    "cycle_end": "2026-09-15T00:00:00Z",
    "plan": "pro",
    "requests_used": null,
    "requests_limit": null
  },
  "openrouter": {
    "ok": true,
    "error": null,
    "configured": true,
    "percent": 66.6,
    "limit_cents": 1000,
    "used_cents": 666,
    "remaining_cents": 334
  },
  "deepseek": {
    "ok": true,
    "error": null,
    "configured": true,
    "percent": 25.0,
    "limit_cents": 1000,
    "used_cents": 250,
    "remaining_cents": 750
  }
}
```

## Campos

### Raiz

| Campo | Tipo | Obrigatório |
| --- | --- | --- |
| `updated_at` | string | sim |
| `claude` | objeto | sim |
| `cursor` | objeto | sim |
| `openrouter` | objeto | sim |
| `deepseek` | objeto | sim |

### `claude`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `ok` | bool | `false` se não deu para obter cota |
| `error` | string ou `null` | Mensagem curta para a tela / curl |
| `configured` | bool | `false` se o firmware não deve desenhar o card: usuário nunca preencheu o provedor (sem credencial local nem key no painel) **ou** ocultou Claude/Cursor no painel. Distinto de `ok`: um provedor `configured=true` pode falhar (`ok=false`) e o card continua aparecendo, com erro |
| `session_percent` | number ou `null` | Janela ~5 h |
| `session_resets_at` | string ou `null` | |
| `weekly_percent` | number ou `null` | Janela ~7 d (todos os modelos) |
| `weekly_resets_at` | string ou `null` | |
| `sonnet_percent` | number ou `null` | Limite semanal só Sonnet, se o plano tiver |
| `sonnet_resets_at` | string ou `null` | |
| `opus_percent` | number ou `null` | Limite semanal só Opus, se o plano tiver |
| `opus_resets_at` | string ou `null` | |

### `cursor`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `ok` | bool | |
| `error` | string ou `null` | |
| `configured` | bool | ver descrição em `claude.configured` acima |
| `percent` | number ou `null` | "Cursor Models" no dashboard (auto), uso do plano no ciclo (0–100) |
| `other_percent` | number ou `null` | "Other Models" no dashboard (api), segunda barra na tela |
| `used_cents` | number ou `null` | Gasto on-demand em centavos de USD |
| `limit_cents` | number ou `null` | Teto on-demand incluso em centavos de USD |
| `remaining_cents` | number ou `null` | On-demand ainda disponível |
| `bonus_cents` | number ou `null` | Crédito extra, se houver |
| `cycle_end` | string ou `null` | Fim do ciclo de fatura |
| `plan` | string ou `null` | Ex.: `pro`, `ultra` |
| `requests_used` | number ou `null` | Só no fallback legado `auth/usage` |
| `requests_limit` | number ou `null` | Só no fallback legado `auth/usage` |

### `openrouter`

Vem de `/api/v1/credits` — saldo da **conta**, não da key individual (uma key
recém-criada pode nunca ter sido usada diretamente e ainda assim a conta ter
gasto real feito por outra key/app; ver `docs/APIS_OPENROUTER.md`).

| Campo | Tipo | Notas |
| --- | --- | --- |
| `ok` | bool | |
| `error` | string ou `null` | |
| `configured` | bool | ver descrição em `claude.configured` acima |
| `percent` | number ou `null` | `used_cents / limit_cents`; `null` se a conta não tem créditos comprados (`limit_cents` também `null`) |
| `limit_cents` | number ou `null` | `total_credits` da conta em centavos de USD; `null` = nunca comprou crédito |
| `used_cents` | number ou `null` | `total_usage` da conta (gasto total histórico), em centavos de USD |
| `remaining_cents` | number ou `null` | `limit_cents - used_cents`, em centavos de USD |

### `deepseek`

Vem de `GET /user/balance` — saldo da conta; ver `docs/APIS_DEEPSEEK.md`.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `ok` | bool | |
| `error` | string ou `null` | |
| `configured` | bool | ver descrição em `claude.configured` acima |
| `percent` | number ou `null` | `used_cents / limit_cents`; `null` se a conta nunca recebeu crédito (`limit_cents` também `null`) |
| `limit_cents` | number ou `null` | `granted_balance + topped_up_balance` da conta em centavos de USD |
| `used_cents` | number ou `null` | `limit_cents - remaining_cents` |
| `remaining_cents` | number ou `null` | `total_balance` da conta em centavos de USD |

## Outros endpoints

| Método | Caminho | Corpo |
| --- | --- | --- |
| GET | `/health` | `{"ok":true}` |
| GET | `/usage` | contrato acima |

## Erro parcial

Se só o Claude falhar: `claude.ok=false`, `cursor` preenchido. HTTP **200**. A tela mostra erro só no card que falhou.

HTTP 5xx só se o processo do coletor quebrar de fato.

## Provedor não configurado (ou oculto)

`configured=false` significa que o firmware **não desenha o card** em nenhuma
tela (Início lista/grade, Agora). Duas origens:

1. **Nunca preenchido** — nenhuma credencial local e nenhuma key colada no
   painel (`collector/data/config.json`). OpenRouter e DeepSeek somem ao
   apagar a API key.
2. **Oculto no painel** — Claude e Cursor pegam o login local do Mac
   sozinhos; o interruptor **Mostrar na placa** grava `CLAUDE_HIDDEN` /
   `CURSOR_HIDDEN` em `config.json` e o coletor passa `configured=false`
   (sem chamar a API). O login local continua; só o card some na ESP32.

Isso é diferente de `ok=false`: um provedor `configured=true` que falha
(rede fora do ar, token expirado, rate limit) continua com o card visível,
mostrando o erro — só o `configured=false` remove o card.
