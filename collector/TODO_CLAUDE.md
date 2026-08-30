# TODO — env Claude

O coletor **não** usa `ANTHROPIC_API_KEY` nem chave `sk-ant-...`.
A cota da **assinatura** vem do **OAuth do Claude Code**.

## Checklist

- [ ] Ter plano Claude **Pro / Max / Team** neste Mac
- [ ] Claude Code instalado (`claude --version` — neste Mac já existe)
- [ ] Login no Claude Code (`claude` no terminal)
- [ ] Na pasta `collector/`: `python3 gerar_env_claude.py`
  - No **macOS** o token está no **Keychain** (`Claude Code-credentials`), não em `.credentials.json`. O script lê o Keychain; o Mac pode pedir senha — permita.
- [ ] Conferir que nasceu `collector/.env.claude` (gitignored)
- [ ] Subir o coletor e testar só o Claude:

```bash
cd collector
python3 server.py
# outro terminal:
curl -s http://127.0.0.1:8787/usage | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['claude'])"
```

- [ ] `claude.ok` = `true`. Se `false`, ler `error` (token expirado → rode `claude` de novo e o script de novo)

## O que o script faz

Lê o OAuth do **Keychain** (macOS) ou de `~/.claude/.credentials.json` (Linux) e grava:

```
CLAUDE_OAUTH_TOKEN=...
CLAUDE_CREDENTIALS_PATH=...
```

em `.env.claude`. **Não imprime o token.**

## Se o script não achar o token

No macOS isso é **normal**: o Claude Code 2.x **não cria** `.credentials.json`. O login fica no Keychain.

1. Rode `python3 gerar_env_claude.py` de novo e **Allow** no diálogo do Keychain.
2. Se recusar: Abra **Acesso às Chaves** → busque `Claude Code-credentials` e confira se o item existe.
3. Ainda falhou: no Claude Code rode `/login` e tente o script outra vez.

## Renovar

O OAuth expira. Abra o Claude Code neste Mac e rode `python3 gerar_env_claude.py` de novo.
