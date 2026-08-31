# TODO — env Cursor

Não existe API key oficial de “% do Pro”. O coletor lê o JWT que o Cursor já salvou neste computador.

## Caminho fácil (Mac)

1. Cursor instalado e logado.
2. `./dev-collector.sh` — deixe `CURSOR_ACCESS_TOKEN` vazio no painel.
3. Confira `cursor.ok` em `/usage`.

## Headless / Docker

Cole o token no painel (o container não vê o `state.vscdb` do host, a menos que você monte o arquivo).

## Script opcional

`python3 gerar_env_cursor.py` grava o JWT em `data/config.json`. No Mac com o app aberto isso **não** é necessário.
