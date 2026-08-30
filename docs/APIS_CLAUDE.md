# API Claude (assinatura / Claude Code)

Não é a API paga por token (`ANTHROPIC_API_KEY`). É o **OAuth da assinatura**, o mesmo do Claude Code.

## Endpoint

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <accessToken>
anthropic-beta: oauth-2025-04-20
```

Sem o header `anthropic-beta`, costuma vir **401**.

Não documentado no docs oficial. Pode mudar o path ou o valor do beta.

## Token

1. **macOS (Claude Code 2.x):** Keychain, serviço `Claude Code-credentials` — o coletor lê com `security find-generic-password`.
2. **Linux / fallback:** `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`
3. Override: `CLAUDE_OAUTH_TOKEN` em `collector/.env.claude`

`expiresAt` (ms): se no passado, abra o Claude Code para renovar.

**Não** usar API key `sk-ant-...` neste endpoint.

## Formato da resposta (varia)

Forma antiga (objeto por janela):

```json
{
  "five_hour": { "utilization": 0.42, "resets_at": "2026-08-31T04:00:00Z" },
  "seven_day": { "utilization": 0.18, "resets_at": "2026-09-04T03:00:00Z" }
}
```

`utilization` pode vir **0–1** ou **0–100**. O coletor normaliza para 0–100.

Forma com `limits[]` (mais nova em alguns clientes): itens com `kind` (`session` / `weekly_all` / etc.), `percent`, `resets_at`.

## Rate limit

Chamadas frequentes geram **429** e bloqueio temporário. Cache do coletor: **300 s** por padrão.

## O que a tela mostra

- **Sessão** ← `five_hour` / `kind=session`
- **Semana** ← `seven_day` / weekly all-models

Janelas extra (Sonnet/Opus) existem em alguns planos; v1 não desenha barras separadas.
