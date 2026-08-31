# API Claude (assinatura / Claude Code)

Não é a API paga por token (`ANTHROPIC_API_KEY`). É o **OAuth da assinatura**, o mesmo do Claude Code.

## Endpoint

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <accessToken>
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/2.1
```

Sem o header `anthropic-beta`, costuma vir **401**. Sem `User-Agent: claude-code/<versão>`, o endpoint costuma devolver **429** persistente (bucket agressivo do `Python-urllib` / `curl`).

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

A Anthropic **não publica** um número para este endpoint. Relatos da comunidade (não oficial):

- Sem `User-Agent: claude-code/<versão>`: bucket agressivo — ~5 requests e 429 que não solta (`Retry-After: 0`).
- Com esse User-Agent: intervalo de **~180 s** é o que as ferramentas da comunidade consideram seguro. Poll a cada 60 s ainda pode 429.
- O limite é **por access token**, não por conta. Relatos de ~5 reqs no bucket “errado” antes do 429.

O coletor **não cacheia**: cada `GET /usage` = uma chamada real. A placa polla a cada `USAGE_POLL_MS` (padrão 60 s). Se aparecer `HTTP 429` no card (e no terminal do coletor), aumente o poll em `platformio.ini`.

## O que a tela mostra

- **Sessão** ← `five_hour` / `kind=session`
- **Semana** ← `seven_day` / weekly all-models
- **Sonnet / Opus (semana)** ← `seven_day_sonnet` / `seven_day_opus` (ou `limits[].kind` contendo sonnet/opus), se o plano mandar

A tela **interna** lista usado, restante e reset de cada janela. Se o conteúdo passar da altura, setas à direita (e deslize vertical / serial `u` `d`) fazem scroll.
