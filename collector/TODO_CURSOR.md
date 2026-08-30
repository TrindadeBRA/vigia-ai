# TODO — env Cursor

Não existe API key oficial de “% do Pro”. O coletor usa o **JWT que o Cursor já salvou** neste Mac.

## Checklist

- [ ] Cursor instalado e **logado** neste Mac (mesma conta da assinatura)
- [ ] Abrir o Cursor pelo menos uma vez depois do login
- [ ] Na pasta `collector/`: `python3 gerar_env_cursor.py`
- [ ] Conferir que nasceu `collector/.env.cursor` (gitignored)
- [ ] Subir o coletor e testar só o Cursor:

```bash
cd collector
python3 server.py
# outro terminal:
curl -s http://127.0.0.1:8787/usage | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['cursor'])"
```

- [ ] `cursor.ok` = `true`. Se `false`, ler `error` (abra o Cursor logado e gere de novo)

## O que o script faz

Lê `cursorAuth/accessToken` em `state.vscdb` e grava:

```
CURSOR_ACCESS_TOKEN=...
CURSOR_STATE_DB=...
```

em `.env.cursor`. **Não imprime o token.**

macOS (caminho padrão):

`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

## Se o script falhar

1. Faça logout/login no Cursor e feche o app.
2. Preenchimento manual: `.env.cursor.example` → `.env.cursor`.
3. Extração manual (não cole o resultado no chat):

```bash
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT length(value) FROM ItemTable WHERE key = 'cursorAuth/accessToken'"
```

(o `length` só confirma que a chave existe)

## Renovar

O JWT muda quando a sessão do Cursor renova. Abra o Cursor e rode `python3 gerar_env_cursor.py` de novo.
