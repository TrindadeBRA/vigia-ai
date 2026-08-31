# TODO — env Claude

O coletor **não** usa `ANTHROPIC_API_KEY` / `sk-ant-...`. A cota da assinatura é OAuth do Claude Code.

## Caminho fácil (Mac)

1. Login no Claude Code (`claude` no terminal).
2. `./dev-collector.sh` e abra http://127.0.0.1:8787/ — deixe o token **vazio**.
3. `curl` em `/usage` e confira `claude.ok`.

## Headless / Docker

`claude setup-token` **não** serve para cota (escopo `user:inference`, o endpoint exige `user:profile` → 403). Cole o `accessToken` do login completo do Claude Code no painel, ou rode o coletor no Mac com o `claude` logado e sem token gravado.

## Script opcional

`python3 gerar_env_claude.py` grava o token do Keychain em `data/config.json`. No uso diário no Mac isso **não** é necessário.
