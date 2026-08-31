# TODO — env Claude

O coletor **não** usa `ANTHROPIC_API_KEY` / `sk-ant-...`. A cota da assinatura é OAuth do Claude Code.

## Caminho fácil (Mac)

1. Login no Claude Code (`claude` no terminal).
2. `./dev-collector.sh` e abra http://127.0.0.1:8787/ — deixe o token **vazio**.
3. `curl` em `/usage` e confira `claude.ok`.

Se o OAuth expirar, abra o Claude Code de novo. Não copie o token do Keychain para `config.json`.

## Headless / Docker

O Keychain do macOS **não** entra no container. Prefira o Python local neste Mac.

`claude setup-token` **não** serve (escopo `user:inference` → 403). Overlay `compose.credentials.yaml` só ajuda se existir `~/.claude/.credentials.json`. Senão, cole o `accessToken` do login completo no painel (plano B).

## Script `gerar_env_claude.py`

Aposentado. Só imprime o aviso acima e sai com código 1.
