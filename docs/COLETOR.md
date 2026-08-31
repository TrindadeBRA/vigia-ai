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

No Mac com Claude Code e Cursor logados, **não cole token**. OpenRouter e DeepSeek: cole a key de cada um no painel (`data/config.json`, gitignored). Claude e Cursor aparecem na placa automaticamente se o app local estiver logado; no painel, desmarque **Mostrar na placa** para ocultar o card na ESP32 sem apagar o login.

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
| `data/config.json` | Gitignored; painel; volume `./data` no Docker (OpenRouter, DeepSeek, plano B, `CLAUDE_HIDDEN` / `CURSOR_HIDDEN`) |
| Painel `http://IP:8787/` | HOST, PORT, status da fonte real, interruptor **Mostrar na placa** (Claude/Cursor) |
| `./start.sh` / `./dev-collector.sh` | Sobe o coletor; `docker` usa `compose.yaml` |

No painel, **Modo mock** grava JSON falso (útil sem login).

## Múltiplas contas por provedor

Cada provedor aceita mais de uma conta — ex.: Claude pessoal + Claude da empresa — cada uma com um apelido opcional, na seção **Contas adicionais** de cada card no painel `/`. Claude e Cursor sempre têm a conta **local** (Keychain/`state.vscdb`, com apelido opcional próprio) mais quantas contas extras coladas você quiser; OpenRouter e DeepSeek são só uma lista de keys coladas (sem conta "local"). Guardado em `CLAUDE_ACCOUNTS`/`CURSOR_ACCOUNTS`/`OPENROUTER_ACCOUNTS`/`DEEPSEEK_ACCOUNTS` (`data/config.json`, JSON com `id`/`label`/token ou key por conta — gitignored, igual ao resto).

`GET /usage` reflete isso: cada provedor vira uma **lista** de contas (ver `docs/CONTRATO_JSON.md`), uma chamada real por conta. O `/display` mostra um card por conta; o firmware físico (tela pequena) continua com um card por *tipo* de provedor na Início, mostrando a que mais precisa de atenção — o detalhe ganha um paginador **‹ i/N ›** pra ver as outras (`docs/TOUCH.md`).

Apelido só ASCII no firmware — a fonte da TFT_eSPI não cobre acentos/Latin-1 (mesma limitação dos textos do próprio app, ver `src/i18n.h`); no `/display` acentos aparecem normalmente.

Rate limit: N contas Claude = N chamadas reais por `GET /usage`, não uma só — ver aviso abaixo antes de cadastrar várias.

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

## Mostrador web (`/display`)

Réplica em React (sem build — React/ReactDOM UMD vendorizados em `collector/web/vendor/`, `collector/web/display.html` sem JSX/Babel) das telas do firmware: Início (lista/grade), detalhe de cada provedor, e Info com tema/cor/idioma/layout — tudo lendo só `GET /usage`, sem token no navegador. Abra **http://IP:8787/display** (link também no painel `/`).

Cada aba aberta em `/display` faz o próprio poll de `/usage` (padrão 60 s, `POLL_MS` no topo do script, igual ao `USAGE_POLL_MS` do ESP32) **além** do poll da placa — ver aviso de rate limit abaixo: com a placa ligada e uma aba aberta, já são duas chamadas reais ao Claude a cada 60 s (não simultâneas, mas dividem a mesma janela seguindo o aviso de ~180 s abaixo).

## Sem cache — cuidado com rate limit

Todo `GET /usage` chama as duas APIs na hora (a pedido do usuário; v1 tinha cache de 5 min pra não martelar o endpoint do Claude). Cada GET no coletor = uma chamada real em `/api/oauth/usage`. Como a placa faz poll a cada `USAGE_POLL_MS` (padrão 60 s, ver [FIRMWARE.md](FIRMWARE.md)), isso significa uma chamada ao Claude a cada 60 s enquanto a placa estiver ligada.

O 429 quase sempre é o Claude, não o Cursor. Endpoint sem número oficial; com `User-Agent: claude-code/<ver>` a comunidade trata **~180 s** como intervalo seguro — 60 s ainda pode estourar. Sem esse UA, o `Python-urllib` cai num bucket de ~5 requests e o 429 fica persistente. Conta com `ok: false` (incluindo `HTTP 429`) agora imprime `ERRO claude (<apelido ou id>):` / `ERRO cursor (...):` no terminal do coletor. Se continuar 429, aumente `USAGE_POLL_MS` em `platformio.ini`.

**Múltiplas contas multiplicam a chamada**, não dividem o intervalo: 2 contas Claude configuradas = 2 chamadas reais em `/api/oauth/usage` a cada `GET /usage`, cada uma contra sua própria conta (buckets de rate limit separados, então uma conta tomando 429 normalmente não afeta a outra) — mas se forem contas diferentes por trás do mesmo IP/rede, ainda vale ficar de olho.
