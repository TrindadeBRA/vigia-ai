# TODO — env Cursor

Não existe API key oficial de “% do Pro”. O coletor lê o JWT que o Cursor já salvou neste computador.

## Caminho fácil (Mac)

1. Cursor instalado e logado.
2. `./dev-collector.sh` — deixe `CURSOR_ACCESS_TOKEN` vazio no painel.
3. Confira `cursor.ok` em `/usage`.

O JWT do app tem prioridade sobre token colado. Se expirar, abra o Cursor.

Se o painel disser "cursorAuth/accessToken ausente" mesmo com o Cursor aberto e logado (comum em contas SSO/Team, ou depois de um update): Cursor → Settings → Account → sair e entrar de novo na conta costuma regravar a chave em `state.vscdb`. Não é falta do Cursor estar aberto — o coletor já confere isso.

## Headless / Docker

Monte o `state.vscdb` com `compose.credentials.yaml` (ver `docs/COLETOR.md`). Cole JWT no painel só se não puder montar o arquivo.

## Script `gerar_env_cursor.py`

Aposentado. Só imprime o aviso acima e sai com código 1.
