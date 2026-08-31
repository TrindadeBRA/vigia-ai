# TODO — env Cursor

Não existe API key oficial de “% do Pro”. O coletor lê o JWT que o Cursor já salvou neste computador.

## Caminho fácil (Mac)

1. Cursor instalado e logado.
2. `./dev-collector.sh` — deixe `CURSOR_ACCESS_TOKEN` vazio no painel.
3. Confira `cursor.ok` em `/usage`.

O JWT do app tem prioridade sobre token colado. Se expirar, abra o Cursor.

## Headless / Docker

Monte o `state.vscdb` com `compose.credentials.yaml` (ver `docs/COLETOR.md`). Cole JWT no painel só se não puder montar o arquivo.

## Script `gerar_env_cursor.py`

Aposentado. Só imprime o aviso acima e sai com código 1.
