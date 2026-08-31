# API Claude (assinatura / Claude Code)

Não é a API paga por token (`ANTHROPIC_API_KEY`). É o **OAuth da assinatura**, o mesmo do Claude Code.

O endpoint **não é um produto público**. Path, headers e o valor de `anthropic-beta` podem mudar sem aviso. O coletor isola a quebra (`ok: false` só no card Claude).

## Endpoint

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <accessToken>
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/2.1
```

Sem o header `anthropic-beta`, costuma vir **401**. Sem `User-Agent: claude-code/<versão>`, o endpoint costuma devolver **429** persistente (bucket agressivo do `Python-urllib` / `curl`). O coletor usa esse User-Agent porque é o que o próprio CLI envia — não é uma API documentada para terceiros.

## Token (app local primeiro)

O coletor **não** implementa refresh OAuth próprio. Quem renova é o Claude Code. Se `expiresAt` passou, abra o app (`claude`) neste Mac.

Ordem:

1. **macOS (Claude Code 2.x):** Keychain, serviço `Claude Code-credentials` — `security find-generic-password -s … -w`. Sem dump da Keychain. Se o nome do serviço mudar, `CLAUDE_KEYCHAIN_SERVICE`.
2. **Linux / fallback:** `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`
3. Plano B no painel (`data/config.json`): `CLAUDE_OAUTH_TOKEN` (`CLAUDE_CODE_OAUTH_TOKEN` ainda é alias). Só Docker / outro PC. Token colado **não** ganha do Keychain se os dois existirem.

**Não** use `claude setup-token` / `sk-ant-oat01-…`: escopo `user:inference`; o endpoint de cota exige `user:profile` → HTTP 403.

**Não** use API key `sk-ant-...` neste endpoint.

**Não** rode `gerar_env_claude.py` no Mac — ele só avisa para não copiar o Bearer do Keychain para JSON.

Tokens **nunca** vão para a ESP32 nem para o JSON de `GET /usage`.

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

O coletor faz **um ciclo** de APIs (`USAGE_INTERVAL_S`, padrão 60 s) e empurra o JSON por SSE. `GET /usage` força um ciclo extra. Se aparecer `HTTP 429` no card, aumente o intervalo (`USAGE_INTERVAL_S=180`).

## O que a tela mostra

- **Sessão** ← `five_hour` / `kind=session`
- **Semana** ← `seven_day` / weekly all-models
- **Sonnet / Opus (semana)** ← `seven_day_sonnet` / `seven_day_opus` (ou `limits[].kind` contendo sonnet/opus), se o plano mandar

A tela **interna** lista usado, restante e reset de cada janela. Se o conteúdo passar da altura, setas à direita (e deslize vertical / serial `u` `d`) fazem scroll.
