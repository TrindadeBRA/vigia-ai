# API Cursor (assinatura)

Não há API pública documentada de “% do Pro restante”. O coletor imita o que o IDE já faz.

## Token

SQLite do Cursor (somente leitura; copia o arquivo para evitar lock):

| SO | `state.vscdb` |
| --- | --- |
| macOS | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |
| Windows | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |

```sql
SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken';
```

Outras chaves úteis: `cursorAuth/cachedEmail`, `cursorAuth/stripeMembershipType`.

Override: `CURSOR_ACCESS_TOKEN` no `.env`.

## Endpoint principal (Pro / Ultra / Team)

```
POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage
Authorization: Bearer <accessToken>
Content-Type: application/json
Connect-Protocol-Version: 1

{}
```

Campos úteis (nomes podem mudar; ver `parse_cursor_dashboard` em `collector/server.py`):

- `planUsage.autoPercentUsed` (ou `totalPercentUsed`) → "Cursor Models" no dashboard, vira `percent` no `/usage`
- `planUsage.apiPercentUsed` → "Other Models" no dashboard, vira `other_percent` no `/usage`
- `spendLimitUsage.individualLimit` / `individualRemaining` (centavos, USD) → `limit_cents` / `used_cents`
- `billingCycleEnd` (ou `planUsage.endDate`) → `cycle_end`

## Fallback

```
GET https://api2.cursor.sh/auth/usage
Authorization: Bearer <accessToken>
```

Contadores por modelo (`numRequests` / `maxRequestUsage`) — mais comum em Enterprise. O coletor usa se `planUsage` vier vazio.

## Alternativa (não usada no v1)

Dashboard web: cookie `WorkosCursorSessionToken` + `Origin: https://cursor.com`. Mais chato de renovar. O JWT do `state.vscdb` basta enquanto o Cursor no Mac estiver logado.

## O que a tela mostra

Uma barra: **percentual do plano no ciclo**, e se existir, `US$ usado / limite` a partir dos centavos.
