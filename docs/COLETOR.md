# Coletor (Mac)

## O que é

Script `collector/server.py` (Python 3, só biblioteca padrão). Sobe HTTP em `0.0.0.0:8787`.

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
| `.env` | `HOST`, `PORT`, cache |
| `.env.claude` | `CLAUDE_OAUTH_TOKEN` (gitignored) — [TODO_CLAUDE.md](../collector/TODO_CLAUDE.md) |
| `.env.cursor` | `CURSOR_ACCESS_TOKEN` (gitignored) — [TODO_CURSOR.md](../collector/TODO_CURSOR.md) |

`COLLECTOR_MOCK=1`: JSON falso (útil sem login).

## Pré-requisitos de conta

- Claude: ter usado **Claude Code** (ou app que grave OAuth nesse JSON) neste Mac.
- Cursor: ter aberto o **Cursor** logado neste Mac pelo menos uma vez.

## Cache

Primeiro GET a `/usage` busca as duas APIs. Pedidos seguintes dentro do TTL devolvem a mesma resposta. Forçar refresh: reiniciar o processo (v1 não tem `?refresh=1`).
