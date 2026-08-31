# Coletor (Mac)

## O que é

Script `collector/server.py` (Python 3, só biblioteca padrão). Sobe HTTP em `0.0.0.0:8787`.

`server.py` cuida só do HTTP; a busca/parse de cada assinatura fica em `collector/providers/claude.py` e `collector/providers/cursor.py`. Datas (BRT) e percentuais/centavos compartilhados estão em `collector/formatting.py`; a leitura do `state.vscdb` do Cursor está em `collector/cursor_state.py` (usada também por `gerar_env_cursor.py`, para não duplicar essa lógica).

Cada `GET /usage` busca as duas APIs na hora — **sem cache**. Ver aviso de rate limit abaixo.

## Subir

```bash
./dev-collector.sh                 # Python local (lê Claude/Cursor deste Mac)
# ./dev-collector.sh docker        # opcional: Docker; tokens pelo painel
```

Ou:

```bash
cd collector
./start.sh
```

Abra **http://127.0.0.1:8787/** — painel para portas, URL da ESP32 e tokens. `GET /usage` continua sendo o contrato da placa.

Tokens ficam em `collector/data/config.json` (gitignored). No Docker o mesmo arquivo é o volume `./data`. No Mac logado, Claude e Cursor podem ficar sem token gravado. OpenRouter: cole a key no painel.

Headless / Docker: o container **não** lê o Keychain. Cole o OAuth do Claude Code (não `setup-token`) e o JWT do Cursor no painel, ou rode sem Docker.

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
| `data/config.json` | Gitignored; gravado pelo painel; volume `./data` no Docker |
| Painel `http://IP:8787/` | HOST, PORT, tokens; mostra URL LAN para `USAGE_URL` |
| `./start.sh` / `./dev-collector.sh` | Sobe o coletor; `docker` usa `compose.yaml` |

No painel, **Modo mock** grava JSON falso (útil sem login).

## Pré-requisitos de conta

- Claude: ter usado **Claude Code** (ou app que grave OAuth nesse JSON) neste Mac.
- Cursor: ter aberto o **Cursor** logado neste Mac pelo menos uma vez.

## Sem cache — cuidado com rate limit

Todo `GET /usage` chama as duas APIs na hora (a pedido do usuário; v1 tinha cache de 5 min pra não martelar o endpoint do Claude). Cada GET no coletor = uma chamada real em `/api/oauth/usage`. Como a placa faz poll a cada `USAGE_POLL_MS` (padrão 60 s, ver [FIRMWARE.md](FIRMWARE.md)), isso significa uma chamada ao Claude a cada 60 s enquanto a placa estiver ligada.

O 429 quase sempre é o Claude, não o Cursor. Endpoint sem número oficial; com `User-Agent: claude-code/<ver>` a comunidade trata **~180 s** como intervalo seguro — 60 s ainda pode estourar. Sem esse UA, o `Python-urllib` cai num bucket de ~5 requests e o 429 fica persistente. Provedor com `ok: false` (incluindo `HTTP 429`) agora imprime `ERRO claude:` / `ERRO cursor:` no terminal do coletor. Se continuar 429, aumente `USAGE_POLL_MS` em `platformio.ini`.
