# Coletor (Mac)

## O que é

Script `collector/server.py` (Python 3, só biblioteca padrão). Sobe HTTP em `0.0.0.0:8787`.

`server.py` cuida só do HTTP; a busca/parse de cada assinatura fica em `collector/providers/claude.py` e `collector/providers/cursor.py`. Datas (BRT) e percentuais/centavos compartilhados estão em `collector/formatting.py`; a leitura do `state.vscdb` do Cursor está em `collector/cursor_state.py` (usada também por `gerar_env_cursor.py`, para não duplicar essa lógica).

Cada `GET /usage` busca as duas APIs na hora — **sem cache**. Ver aviso de rate limit abaixo.

## Subir

```bash
cd collector
cp .env.example .env    # HOST/PORT; tokens vão em .env.claude e .env.cursor
python3 gerar_env_claude.py    # ver TODO_CLAUDE.md
python3 gerar_env_cursor.py    # ver TODO_CURSOR.md
python3 server.py
```

Teste:

```bash
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8787/usage | python3 -m json.tool
```

No Wokwi, `./dev-wokwi.sh` (raiz do repo) já sobe o coletor **e** o gateway de rede (`wokwigw`) juntos — ver [FIRMWARE.md](FIRMWARE.md#rede-no-wokwi-wokwigw).

Na ESP32 física, `USAGE_URL` deve ser o **IP LAN do Mac**, não `127.0.0.1`.

```bash
# macOS: IP na interface ativa (exemplo)
ipconfig getifaddr en0
```

Firewall: permitir Python na porta **8787** para a rede local.

## Autenticação

| Arquivo | Uso |
| --- | --- |
| `.env` | `HOST`, `PORT` |
| `.env.claude` | `CLAUDE_OAUTH_TOKEN` (gitignored) — [TODO_CLAUDE.md](../collector/TODO_CLAUDE.md) |
| `.env.cursor` | `CURSOR_ACCESS_TOKEN` (gitignored) — [TODO_CURSOR.md](../collector/TODO_CURSOR.md) |

`COLLECTOR_MOCK=1`: JSON falso (útil sem login).

## Pré-requisitos de conta

- Claude: ter usado **Claude Code** (ou app que grave OAuth nesse JSON) neste Mac.
- Cursor: ter aberto o **Cursor** logado neste Mac pelo menos uma vez.

## Sem cache — cuidado com rate limit

Todo `GET /usage` chama as duas APIs na hora (a pedido do usuário; v1 tinha cache de 5 min pra não martelar o endpoint do Claude). Cada GET no coletor = uma chamada real em `/api/oauth/usage`. Como a placa faz poll a cada `USAGE_POLL_MS` (padrão 60 s, ver [FIRMWARE.md](FIRMWARE.md)), isso significa uma chamada ao Claude a cada 60 s enquanto a placa estiver ligada.

O 429 quase sempre é o Claude, não o Cursor. Endpoint sem número oficial; com `User-Agent: claude-code/<ver>` a comunidade trata **~180 s** como intervalo seguro — 60 s ainda pode estourar. Sem esse UA, o `Python-urllib` cai num bucket de ~5 requests e o 429 fica persistente. Provedor com `ok: false` (incluindo `HTTP 429`) agora imprime `ERRO claude:` / `ERRO cursor:` no terminal do coletor. Se continuar 429, aumente `USAGE_POLL_MS` em `platformio.ini`.
