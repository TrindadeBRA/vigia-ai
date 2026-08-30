# Contrato JSON — `GET /usage`

O firmware **depende** deste formato. Mudança = atualizar este doc e `src/main.cpp`.

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
    "session_percent": 42.0,
    "session_resets_at": "2026-08-31T04:00:00Z",
    "weekly_percent": 18.5,
    "weekly_resets_at": "2026-09-04T03:00:00Z"
  },
  "cursor": {
    "ok": true,
    "error": null,
    "percent": 35.0,
    "used_cents": 700,
    "limit_cents": 2000,
    "cycle_end": "2026-09-15T00:00:00Z",
    "plan": "pro"
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

### `claude`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `ok` | bool | `false` se não deu para obter cota |
| `error` | string ou `null` | Mensagem curta para a tela / curl |
| `session_percent` | number ou `null` | Janela ~5 h |
| `session_resets_at` | string ou `null` | |
| `weekly_percent` | number ou `null` | Janela ~7 d |
| `weekly_resets_at` | string ou `null` | |

### `cursor`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `ok` | bool | |
| `error` | string ou `null` | |
| `percent` | number ou `null` | Uso do plano no ciclo (0–100) |
| `used_cents` | number ou `null` | Gasto em centavos de USD |
| `limit_cents` | number ou `null` | Teto incluso em centavos |
| `cycle_end` | string ou `null` | Fim do ciclo de fatura |
| `plan` | string ou `null` | Ex.: `pro`, `ultra` |

## Outros endpoints

| Método | Caminho | Corpo |
| --- | --- | --- |
| GET | `/health` | `{"ok":true}` |
| GET | `/usage` | contrato acima |

## Erro parcial

Se só o Claude falhar: `claude.ok=false`, `cursor` preenchido. HTTP **200**. A tela mostra erro só no card que falhou.

HTTP 5xx só se o processo do coletor quebrar de fato.
