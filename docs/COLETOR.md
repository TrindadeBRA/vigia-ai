# Coletor (Mac)

## O que é

Script `collector/server.py` (Python 3, só biblioteca padrão). Sobe HTTP em `0.0.0.0:8787`.

`server.py` cuida só do HTTP; a busca/parse de cada assinatura fica em `collector/providers/claude.py` e `collector/providers/cursor.py`. Datas (BRT) e percentuais/centavos compartilhados estão em `collector/formatting.py`; a leitura do `state.vscdb` do Cursor está em `collector/cursor_state.py`.

Cada `GET /usage` busca as duas APIs na hora — **sem cache**. Ver aviso de rate limit abaixo.

## Subir

```bash
./dev-collector.sh                 # Python local (lê Claude/Cursor deste Mac)
# ./dev-collector.sh docker        # opcional; ver bind-mount abaixo
```

Ou:

```bash
cd collector
./start.sh
```

Abra **http://127.0.0.1:8787/** — painel para portas, URL da ESP32 e status do login. `GET /usage` continua sendo o contrato da placa.

No Mac com Claude Code e Cursor logados, **não cole token**. OpenRouter e DeepSeek: cole a key de cada um no painel (`data/config.json`, gitignored).

O container **não** lê o Keychain do macOS. Prefira Python local neste Mac; no Docker, monte arquivos do host (abaixo) ou cole token só como plano B (`claude setup-token` **não** serve).

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

Caminho feliz: **app oficial neste computador**. O coletor relê Keychain / `state.vscdb` a cada `GET /usage`. Quem renova o login é o Claude Code ou o Cursor — se expirou, abra o app. A placa nunca recebe Bearer.

| Fonte | Claude | Cursor |
| --- | --- | --- |
| 1 (local) | Keychain `Claude Code-credentials`, senão `~/.claude/.credentials.json` | `state.vscdb` → `cursorAuth/accessToken` |
| 2 (plano B) | `CLAUDE_OAUTH_TOKEN` no painel | `CURSOR_ACCESS_TOKEN` no painel |

Token colado **não** ganha do app local. Se o JWT/OAuth local falhar (expirado ou 401), tenta o colado.

Não use `python3 gerar_env_claude.py` / `gerar_env_cursor.py` — copiam segredo para JSON; os scripts só imprimem este aviso.

| Arquivo | Uso |
| --- | --- |
| `data/config.json` | Gitignored; painel; volume `./data` no Docker (OpenRouter, DeepSeek e plano B) |
| Painel `http://IP:8787/` | HOST, PORT, status da fonte real (keychain / arquivo / vscdb / paste) |
| `./start.sh` / `./dev-collector.sh` | Sobe o coletor; `docker` usa `compose.yaml` |

No painel, **Modo mock** grava JSON falso (útil sem login).

## Docker e credenciais do host

`./dev-collector.sh docker` sobe só `compose.yaml` (`./data` para config). O Keychain **não** entra no container.

Cursor (e Claude se existir `~/.claude/.credentials.json`): overlay somente leitura — **só se os caminhos já existirem** (senão o Docker cria pasta vazia no host):

```bash
cd collector
docker compose -f compose.yaml -f compose.credentials.yaml up --build
```

Isso monta `~/.claude` e o `globalStorage` do Cursor no Mac. No Linux, edite o volume do Cursor em `compose.credentials.yaml` (`~/.config/Cursor/User/globalStorage`).

Claude no **Mac + Docker**: o OAuth está no Keychain, não no arquivo. Use Python local, ou cole o accessToken no painel (não `setup-token`).

## Pré-requisitos de conta

- Claude: ter usado **Claude Code** neste Mac (`claude` + login). O coletor lê o Keychain; não copie o token para disco.
- Cursor: ter aberto o **Cursor** logado neste Mac pelo menos uma vez.

## Sem cache — cuidado com rate limit

Todo `GET /usage` chama as duas APIs na hora (a pedido do usuário; v1 tinha cache de 5 min pra não martelar o endpoint do Claude). Cada GET no coletor = uma chamada real em `/api/oauth/usage`. Como a placa faz poll a cada `USAGE_POLL_MS` (padrão 60 s, ver [FIRMWARE.md](FIRMWARE.md)), isso significa uma chamada ao Claude a cada 60 s enquanto a placa estiver ligada.

O 429 quase sempre é o Claude, não o Cursor. Endpoint sem número oficial; com `User-Agent: claude-code/<ver>` a comunidade trata **~180 s** como intervalo seguro — 60 s ainda pode estourar. Sem esse UA, o `Python-urllib` cai num bucket de ~5 requests e o 429 fica persistente. Provedor com `ok: false` (incluindo `HTTP 429`) agora imprime `ERRO claude:` / `ERRO cursor:` no terminal do coletor. Se continuar 429, aumente `USAGE_POLL_MS` em `platformio.ini`.
