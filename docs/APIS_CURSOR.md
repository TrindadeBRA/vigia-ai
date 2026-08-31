# API Cursor (assinatura)

Não há API pública documentada de “% do Pro restante”. O coletor imita o que o IDE já faz. Endpoints e nomes de campo **podem mudar** sem aviso.

Tokens **nunca** vão para a ESP32 nem para o JSON de `GET /usage`. Quem renova o JWT é o próprio Cursor: se expirou, abra o IDE neste Mac. O coletor só lê o `exp` do payload (sem verificar assinatura) para a mensagem de erro.

## Token (app local primeiro)

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

Ordem: **`state.vscdb` primeiro**, depois `CURSOR_ACCESS_TOKEN` colado no painel. Se o JWT local estiver expirado ou a API devolver 401, o coletor tenta o token colado. No Mac com o app aberto, deixe o campo vazio.

**`cursorAuth/accessToken` pode não existir mesmo com o Cursor aberto e logado** — visto em contas SSO/Team e após updates do app; a linha some de `ItemTable` inteira (nem `cursorAuth/stripeMembershipType` aparece). Não é bug do coletor. Primeiro passo: no Cursor, Settings → Account → sair e entrar de novo na conta, o que costuma regravar a chave local; depois teste `/usage` de novo. Só use o token colado no painel se isso não resolver.

Plano B: `CURSOR_ACCESS_TOKEN` no painel — Docker / outro PC. Não rode `gerar_env_cursor.py` para copiar o JWT para JSON.

Docker: monte o `globalStorage` (somente leitura) com `compose.credentials.yaml` — ver [COLETOR.md](COLETOR.md#docker-e-credenciais-do-host). Colar JWT continua sendo fallback.

## Endpoint principal (Pro / Ultra / Team)

```
POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage
Authorization: Bearer <accessToken>
Content-Type: application/json
Connect-Protocol-Version: 1

{}
```

Campos úteis (nomes podem mudar; ver `parse_cursor_dashboard` em `collector/providers/cursor.py`):

- `planUsage.autoPercentUsed` (ou `totalPercentUsed`) → "Cursor Models" no dashboard, vira `percent` no `/usage`
- `planUsage.apiPercentUsed` → "Other Models" no dashboard, vira `other_percent` no `/usage`
- `spendLimitUsage.individualLimit` / `individualRemaining` (centavos, USD) → `limit_cents` / `remaining_cents` (`used_cents` = limite − restante)
- `billingCycleEnd` (ou `planUsage.endDate`) → `cycle_end`

## Fallback

```
GET https://api2.cursor.sh/auth/usage
Authorization: Bearer <accessToken>
```

Contadores por modelo (`numRequests` / `maxRequestUsage`) — mais comum em Enterprise. O coletor usa se `planUsage` vier vazio; nesse caso manda `requests_used` / `requests_limit` no JSON.

## Alternativa (não usada no v1)

Dashboard web: cookie `WorkosCursorSessionToken` + `Origin: https://cursor.com`. Mais chato de renovar. O JWT do `state.vscdb` basta enquanto o Cursor no Mac estiver logado.

## O que a tela mostra

Na home: barras de Cursor Models e Other Models. Na tela **interna**: plano, ciclo, as duas barras (usado/resta), on-demand (usado / teto / resta / bônus) e, no fallback legado, pedidos. Scroll com setas se não couber.
