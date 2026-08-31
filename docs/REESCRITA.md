# Plano de reescrita — repositório público

Este documento é o plano para transformar o protótipo funcional atual num repositório **open source**, com estrutura de monorepo profissional, padrões de código, API documentada (OpenAPI/Swagger) e um único script de desenvolvimento.

Não é um pedido para reescrever tudo do zero. O produto já funciona. A reescrita reorganiza, padroniza e descarta o que sobrou do caminho até aqui — **sem mudar o que o usuário vê na placa**, salvo onde o plano marcar explicitamente.

Idioma da UI e da documentação continua **português (Brasil)**. Identificadores de código em inglês.

---

## 1. O que o produto é (não muda)

**Vigia AI** é um painel de mesa: ESP32 + TFT 3,5" touch mostra as cotas das assinaturas **Claude**, **Cursor**, **OpenRouter** e **DeepSeek**. A placa **nunca** guarda tokens.

Três peças, um repositório:

```
APIs das assinaturas (não oficiais)
        ▲
        │ tokens só no host
        │
   [ backend ]  ──GET /usage──►  [ firmware ESP32 / Wokwi ]
        │
        └── serve o [ frontend React ]
              /          painel de configuração
              /display   réplica das telas da placa
```

### Funcionalidades que precisam sobreviver

| Superfície | O que já existe e deve continuar |
| --- | --- |
| Firmware | Wi-Fi + poll de `/usage`; Início (lista/grade, 1 card por tipo de provedor, “pior conta”); detalhe por provedor com paginador `‹ i/N ›`; Info (tema, cor, idioma PT/EN/ES, lado da barra, calibrar); Relógio; touch XPT2046 + NVS; serial `n/p/0–5/…` |
| Simulador | Mesmo sketch, env `wokwi` (ILI9341 320×240), `diagram.json`, `wokwi.toml` + `wokwigw` falando com o backend **real** (não mock) |
| Backend | `GET /usage` (contrato v2: lista de contas por provedor); `GET /health`; config sem devolver tokens; múltiplas contas; mock; ocultar conta na placa; leitura local Claude (Keychain / credentials) e Cursor (`state.vscdb`); keys OpenRouter/DeepSeek |
| Frontend | Painel para gravar contas / baixar `secrets.h` / ver IP LAN; mostrador `/display` lendo só `/usage` |
| Segurança | Tokens só no host (`data/config.json` gitignored). JSON na LAN = percentuais e datas. Bind na LAN, sem expor na internet |

### Fora desta reescrita (não expandir escopo)

- Novos provedores (GPT, Gemini, Copilot)
- Nuvem pública, app mobile, conta compartilhada na internet
- Gráficos históricos, alertas push, MQTT
- Autenticação obrigatória no coletor (continua LAN doméstica; ver §8 se alguém quiser token estático depois)
- Reescrever o firmware em outro framework (continua Arduino + PlatformIO + TFT_eSPI)

---

## 2. Diagnóstico: por que ainda parece protótipo

O código entrega o produto. A forma do repositório não.

### Estrutura

- Firmware, coletor, simulador e docs misturados na raiz (`src/`, `platformio.ini`, `diagram.json`, `wokwi.toml`, três scripts).
- Três atalhos na raiz (`dev.sh`, `dev-collector.sh`, `dev-wokwi.sh`) + `collector/start.sh` — o mesmo fluxo partido em quatro arquivos.
- Frontend não é um app: `collector/web/index.html` (vanilla + Tailwind **CDN**) e `display.html` (~1040 linhas, React UMD **sem build**, sem JSX, vendorizado em `vendor/`).
- Backend é `http.server` da stdlib: um `Handler` com `if path ==` para HTML, ícones, JSON e Docker.

### Código

- `store.py` persiste um JSON **plano estilo `.env`** (`CLAUDE_OAUTH_TOKEN`, `CLAUDE_ACCOUNTS` como *string* JSON dentro do JSON). Contas, flags e listen host compartilham o mesmo saco de chaves.
- `server.py` importa funções privadas dos providers (`_claude_fail`, `_cursor_fail`, …).
- Configuração vaza para `os.environ` a cada request (`apply_store`).
- `POST /api/docker` + volume `/var/run/docker.sock` no Compose: o painel controla o Docker do host. Inaceitável num repo público.
- Sem testes, sem `pyproject.toml` / `package.json`, sem linter, sem CI.
- `MOCK_USAGE` no firmware não é usado por nenhum env; `gerar_env_*.py` só imprimem “aposentado”.
- README da raiz fala em Claude + Cursor (faltam OpenRouter, DeepSeek e o mostrador). `docs/PLANO.md` e `docs/README.md` também estão atrás do código.

### Pronto para o público

Falta o pacote mínimo de um projeto open source:

- LICENSE
- CONTRIBUTING, SECURITY, CODE_OF_CONDUCT
- Changelog, templates de issue/PR
- Aviso claro: endpoints **não oficiais**; LAN only; o que **não** commitar
- CI que prove que firmware compila e backend/frontend passam lint + testes
- Screenshots no README
- Suporte além do Mac documentado (Linux paths; Windows = colar token)

Nada disso é “bonito”. É o que impede alguém de clonar, entender e contribuir sem perguntar no chat.

---

## 3. Princípios da reescrita

1. **Um repo, três pastas de produto** (`firmware/`, `backend/`, `frontend/`) + um script na raiz.
2. **Contrato `GET /usage` estável.** Firmware e mostrador dependem dele. Mudança de campo = OpenAPI + parser C++ + doc juntos. Ver `docs/CONTRATO_JSON.md`.
3. **Tokens nunca no firmware, no `diagram.json`, no frontend (resposta da API) nem no git.**
4. **Providers isolados.** Falha de uma conta não derruba as outras; HTTP 200 com `ok: false` na entrada.
5. **Sem cache no coletor** (decisão vigente). Poll da placa (`USAGE_POLL_MS`, 60 s) = intervalo real das APIs. Documentar rate limit do Claude (~180 s seguro).
6. **Wokwi fala com o backend real** via `wokwigw`. Mock só como flag explícita no painel, não como “simulador falso”.
7. **Reorganizar > reinventar.** Parsers de Claude/Cursor/OpenRouter/DeepSeek, Keychain, `state.vscdb` e o desenho da TFT são o valor. A casca (HTTP stdlib, HTML monolito, scripts soltos) é o que se troca.
8. **Padrão único e visível:** OpenAPI no backend, TypeScript no frontend, PlatformIO no firmware, `./dev` para tudo.

---

## 4. Estrutura alvo do repositório

```
vigia-ai/
├── README.md                 # humano: o que é, screenshot, quick start, aviso legal
├── LICENSE                   # MIT (proposta — ver §9)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── AGENTS.md                 # ponto de entrada para agentes (substitui o papel duplo do CLAUDE.md)
├── .gitignore
├── compose.yaml              # backend + frontend estático (sem docker.sock)
├── dev                       # único script na raiz (substitui os três atuais)
│
├── .github/
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
│
├── docs/                     # humanos + agentes; índice em docs/README.md
│   ├── CONTEXTO_IA.md
│   ├── ARQUITETURA.md
│   ├── CONTRATO_JSON.md      # espelho humano do OpenAPI /usage
│   ├── APIS_*.md
│   ├── HARDWARE.md
│   ├── TOUCH.md
│   ├── BACKEND.md            # hoje COLETOR.md
│   ├── FIRMWARE.md
│   ├── FRONTEND.md           # novo
│   ├── DECISOES.md
│   └── REESCRITA.md          # este arquivo (histórico depois de executado)
│
├── firmware/
│   ├── platformio.ini
│   ├── wokwi.toml
│   ├── diagram.json
│   ├── src/                  # o sketch atual (main, ui, usage_client, …)
│   └── include/secrets.h.example
│
├── backend/
│   ├── pyproject.toml        # deps, ruff, pytest, pacote
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py           # FastAPI
│   │   ├── config.py         # settings + paths
│   │   ├── store.py          # JSON aninhado (não mais saco de env)
│   │   ├── schemas.py        # Pydantic = contrato OpenAPI
│   │   ├── routers/
│   │   │   ├── usage.py
│   │   │   ├── health.py
│   │   │   └── config.py
│   │   ├── providers/        # claude, cursor, openrouter, deepseek
│   │   └── local/            # keychain, credentials, state.vscdb
│   ├── tests/
│   └── data/                 # .gitkeep; config.json gitignored
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── api/              # cliente tipado (openapi-typescript)
        ├── pages/
        │   ├── Panel.tsx     # configuração (hoje index.html)
        │   └── Display.tsx   # réplica da placa (hoje display.html)
        ├── components/
        └── theme/            # mesmas cores do firmware (tokens)
```

Na raiz **não** ficam `src/`, `platformio.ini`, `diagram.json`, `dev-*.sh`.

`CLAUDE.md` vira um ponteiro de uma tela para `AGENTS.md` + `docs/CONTEXTO_IA.md` (Cursor/Claude Code ainda procuram esse arquivo).

---

## 5. Backend

### Troca de `http.server` por FastAPI

Motivo: OpenAPI/Swagger de graça, modelos Pydantic = contrato executável, routers em vez de um `Handler` gigante, testes com `TestClient`.

Stack:

| Peça | Escolha |
| --- | --- |
| API | FastAPI + Uvicorn |
| Modelos | Pydantic v2 |
| Lint | Ruff |
| Tipos | Pyright (ou `mypy` estrito no `app/`) |
| Testes | Pytest |
| Empacote | `pyproject.toml` (Python ≥ 3.11) |
| Docs interativa | `/docs` (Swagger UI) e `/redoc` |

A decisão antiga “só stdlib” (`docs/DECISOES.md`) vale para o *protótipo no Mac sem npm*. Para um repo público, uma dependência `fastapi` + `uvicorn` é o padrão esperado. Quem quiser zero-deps continua podendo ler o contrato e reimplementar; o projeto oficial não se prende mais a isso.

### OpenAPI / Swagger

O schema **é** a fonte da verdade do JSON. `docs/CONTRATO_JSON.md` passa a ser o texto humano; os modelos Pydantic geram o YAML.

Rotas a documentar (v1 pública):

| Método | Caminho | Quem usa | Notas |
| --- | --- | --- | --- |
| `GET` | `/health` | humano, CI, placa (opcional) | `{ ok, version, listen }` |
| `GET` | `/usage` | firmware + `/display` | contrato atual, HTTP 200 mesmo com contas `ok: false` |
| `GET` | `/api/config` | painel | status sem tokens (sufixo + origem) |
| `POST` | `/api/config` | painel | listen, mock, hidden, labels |
| `POST` | `/api/config/account` | painel | adiciona conta extra |
| `DELETE` | `/api/config/account/{provider}/{id}` | painel | hoje é POST `…/delete` — REST de verdade |
| `DELETE` | `/api/config/secret/{name}` | painel | limpa token colado |
| `GET` | `/api/secrets.h` | painel | download do `secrets.h` (hoje gerado no JS) |
| `GET` | `/docs` | humano | Swagger UI |
| `GET` | `/openapi.json` | frontend (codegen) | |

**Remover** `POST /api/docker`. Subir container é trabalho do `./dev` / Compose, não do browser.

Arquivos estáticos: o backend **não** serve React em desenvolvimento (Vite no `5173`, proxy `/usage` e `/api`). Em produção, Uvicorn (ou nginx no Compose) serve o `frontend/dist`.

### Compatibilidade com a ESP32

O `http.server` atual força HTTP/1.0 + `Connection: close` porque o `HTTPClient` da placa (e o Wokwi) às vezes reseta keep-alive 1.1. Na reescrita:

- Uvicorn com keep-alive curto ou desligado (`--timeout-keep-alive 0`)
- Middleware que manda `Connection: close` em `/usage` e `/health`
- Teste manual no Wokwi **antes** de considerar a fase 2 fechada — regressão aqui deixa a placa em `coletor HTTP -1`

### Config persistida (schema novo)

Hoje: objeto plano de strings. Alvo: JSON aninhado, versionado:

```json
{
  "version": 1,
  "listen": { "host": "0.0.0.0", "port": 8787 },
  "mock": false,
  "providers": {
    "claude": {
      "hidden": false,
      "local_label": "",
      "paste_token": null,
      "accounts": [{ "id": "…", "label": "Empresa", "token": "…" }]
    }
  }
}
```

Migração: na primeira leitura, se o arquivo antigo (chaves `CLAUDE_OAUTH_TOKEN`, `*_ACCOUNTS` stringificadas) existir, converter e gravar o formato novo. Não exigir que o usuário recadastre contas.

Permissão `0600` no arquivo, como hoje. Nunca devolver `paste_token` / `key` no `GET /api/config`.

### Providers

Interface única, um módulo por provedor:

```python
class Provider(Protocol):
    id: str  # "claude" | "cursor" | "openrouter" | "deepseek"
    def fetch_accounts(self, cfg: ProviderConfig) -> list[Account]: ...
```

Regras que já existem e ficam explícitas:

- Erro por conta, não por processo
- Funções `*_fail` **públicas** no módulo (acaba o import de `_claude_fail`)
- Fixtures de resposta das APIs (JSON sanitizado) em `backend/tests/fixtures/` — o parser é a parte que quebra quando a API interna muda
- Claude: `User-Agent: claude-code/<ver>` obrigatório (429 sem isso)
- Cursor: dashboard Connect RPC primeiro, fallback `auth/usage`
- Sem cache

Leitura local (Keychain, `~/.claude/.credentials.json`, `state.vscdb`) sai de `panel.py` / módulos soltos para `app/local/`, com paths de **macOS e Linux** documentados. Windows: só token colado, sem fingir Keychain.

### Docker

- Compose na raiz: serviço `backend` + serviço `frontend` (nginx ou volume do `dist`) **ou** um único container que serve API + estáticos
- **Sem** `/var/run/docker.sock`
- Overlay opcional `compose.credentials.yaml` (somente leitura) para `~/.claude` e o `globalStorage` do Cursor — igual hoje, só mudando o caminho
- `COLLECTOR_IN_DOCKER=1` permanece para o card “Docker não lê Keychain”

---

## 6. Frontend React

Um app Vite + React + TypeScript. Duas rotas, um build.

| Rota | Papel | Origem atual |
| --- | --- | --- |
| `/` | Painel: contas, mock, ocultar, IPs, baixar `secrets.h` | `collector/web/index.html` |
| `/display` | Réplica das telas da placa (Início, detalhe, Info, Relógio, tema/cor/idioma) | `collector/web/display.html` |

### Stack

| Peça | Escolha |
| --- | --- |
| Bundler | Vite |
| UI | React 18 + TypeScript |
| Estilo | Tailwind **buildado** (não CDN) |
| Tipos da API | `openapi-typescript` a partir de `/openapi.json` |
| i18n | PT / EN / ES (o firmware já tem; o painel hoje é só PT) |

### Regras

- `/display` continua lendo **somente** `GET /usage`. Zero tokens no browser.
- Tokens de paleta (`--bg`, `--accent`, …) extraídos para `frontend/src/theme/` — os mesmos valores de `src/ui.cpp` / `applyTheme()`. Um comentário cruzado no firmware aponta o arquivo.
- Sem React UMD vendorizado, sem `h()` no lugar de JSX, sem Tailwind runtime.
- Preferências do mostrador (tema, cor, idioma, layout) no `localStorage`, como hoje.
- Poll padrão 60 s, configurável, com o mesmo aviso de rate limit no painel.

### Verificação

Antes de fechar a fase 3: no browser, exercitar `/` (salvar conta, mock, ocultar, baixar `secrets.h`) e `/display` (todas as seções, tema, idioma, conta extra, estado de erro). Viewport desktop e estreita. Conferir que `/usage` no firmware **não** quebrou.

---

## 7. Firmware e o script único

### Pasta `firmware/`

Mover o sketch e a simulação:

- `src/` → `firmware/src/`
- `platformio.ini` → `firmware/platformio.ini`
- `diagram.json`, `wokwi.toml` → `firmware/`
- `src/secrets.h.example` → `firmware/include/secrets.h.example` (ou `src/`, desde que o `.gitignore` cubra `secrets.h`)

Ajustar `wokwi.toml` (`firmware = ".pio/build/wokwi/firmware.bin"` relativo à pasta). A extensão Wokwi precisa abrir o projeto em `firmware/` **ou** o `wokwi.toml` na raiz pode permanecer como ponte de uma linha — preferir **tudo dentro de `firmware/`** e documentar “abra essa pasta no PlatformIO / Wokwi”.

Refatorações **apropriadas** (não um rewrite C++):

- Apagar o caminho `MOCK_USAGE` se nenhum env usa; o mock fica no backend
- Manter a divisão já boa: `main` (ciclo), `usage_client` (rede/parse), `ui` / `ui_views` / `ui_format`, `input`, `i18n`
- `ui_views.cpp` (~1550 linhas) pode quebrar por view (`views/home.cpp`, `views/claude.cpp`, …) se a fase de firmware tiver folga — **não** é bloqueante para o público
- GPIO 2 = `TFT_DC` (não LED). Touch XPT2046 no hardware; FT6206 só no Wokwi

CI: `pio run -e wokwi` e `pio run -e esp32dev` (compile only) no GitHub Actions com cache do PlatformIO.

### Um script: `./dev`

Substitui `dev.sh`, `dev-collector.sh`, `dev-wokwi.sh` e `collector/start.sh`.

```text
./dev                  # ajuda
./dev up               # backend + frontend (Python venv + Vite, ou --docker)
./dev up --docker
./dev sim              # up + baixa wokwigw se faltar + sobe o gateway :9011
                       #     + pio run -e wokwi  (depois: Wokwi: Start Simulator)
./dev firmware build   # placa (esp32dev)
./dev firmware flash   # upload
./dev firmware monitor
./dev firmware wokwi   # só compila o env wokwi
./dev test             # pytest + lint frontend
./dev lint
```

Comportamento obrigatório:

- Sem TTY, `./dev` imprime a ajuda e sai 1 (não trava em `read`)
- `./dev sim` baixa o binário `wokwigw` para `.tools/` (gitignored) se não existir — hoje o `dev-wokwi.sh` só falha pedindo download manual
- `Ctrl+C` encerra backend, Vite e gateway juntos
- Atalhos atuais podem existir um release como wrappers de uma linha que imprimem “use `./dev …`” e chamam o novo — depois saem

---

## 8. Padrões de código (o “padrão” do repo)

| Área | Padrão |
| --- | --- |
| Python | Ruff (format + lint), Pyright, type hints em tudo que for público, `from __future__ import annotations` |
| HTTP | FastAPI routers; Pydantic in/out; sem `dict[str, Any]` no contrato |
| TS/React | `strict: true`; componentes por arquivo; sem `any` no cliente da API |
| C++ | Identificadores em inglês; constantes de pinos só no `platformio.ini`; não expandir globals além do snapshot atual |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`) a partir da reescrita — o histórico antigo pode ficar como está |
| Docs | `docs/` em pt-BR; `CONTRATO_JSON.md` e OpenAPI não podem divergir |
| Segredos | `backend/data/config.json`, `firmware/src/secrets.h`, dumps de `state.vscdb` / `.credentials.json` — gitignored e citados no SECURITY.md |

Interface de provider: um arquivo, um provedor, funções públicas `parse_*` + `fetch_accounts`. Teste de parser obrigatório para merge de mudança de API.

---

## 9. Deixar o repositório público

### Licença (proposta: MIT)

Hardware hobby + coletor local combina com MIT: simples, reconhecível, permite fork comercial. Confirmar na hora do primeiro commit da reescrita (é irreversível na prática). Incluir nos headers só se o CONTRIBUTING pedir; um `LICENSE` na raiz basta.

### Aviso legal (README, em destaque)

Os endpoints de cota do Claude e do Cursor **não são API pública**. São os mesmos que o CLI/IDE já usam neste computador. O projeto:

- não redistribui tokens
- não incentiva scraping de dashboard
- pode quebrar quando a Anthropic/Cursor mudar o contrato interno
- é **LAN only** — não expor a porta 8787 na internet

OpenRouter e DeepSeek usam endpoints públicos de saldo da key — documentar a diferença.

### Arquivos OSS

| Arquivo | Conteúdo |
| --- | --- |
| `README.md` | O que é, GIF/screenshot placa + `/display` + painel, requisitos, `./dev up`, `./dev sim`, `./dev firmware flash`, tabela de hardware, aviso legal, link `docs/` |
| `CONTRIBUTING.md` | Como rodar, lint, teste, contrato `/usage`, “não commitar secrets”, idioma da UI |
| `SECURITY.md` | Tokens, LAN, como reportar (GitHub Security Advisory quando o repo for público) |
| `CODE_OF_CONDUCT.md` | Contributor Covenant |
| `CHANGELOG.md` | Keep a Changelog; primeira entrada = esta reescrita (v0.x → v1.0.0 público) |
| `.github/workflows/ci.yml` | ruff + pytest; `npm test`/`tsc`; `pio run` wokwi+esp32dev |
| Issue templates | bug (placa / coletor / display), feature (com “não: GPT/nuvem” se for o caso) |

### O que apagar (não migrar)

| Item | Por quê |
| --- | --- |
| `collector/gerar_env_claude.py`, `gerar_env_cursor.py` | Aposentados; copiar Bearer para disco é o contrário da política |
| `collector/TODO_CLAUDE.md`, `TODO_CURSOR.md` | Conteúdo útil vai para `docs/BACKEND.md` / `APIS_*.md` |
| `collector/web/vendor/` | Vite empacota React |
| `dev-collector.sh`, `dev-wokwi.sh`, `collector/start.sh` | Absorvidos por `./dev` |
| Migração `.env` → JSON em `store.migrate_legacy_env` | Ninguém público tem o `.env` antigo; se precisar, um one-shot na migração do schema novo |
| `POST /api/docker` + `docker_ctl.py` + docker.sock | Superfície de ataque; Compose na CLI |
| Flag `MOCK_USAGE` no firmware | Mock só no backend |

`docs/PLANO.md` vira arquivo histórico (“v1 do protótipo, feito”) e o índice aponta para este REESCRITA.md até a publicação; depois o índice aponta para ARQUITETURA + CONTRIBUTING.

### README da raiz (conteúdo mínimo)

1. Nome + uma frase
2. Screenshot
3. Aviso: APIs não oficiais + LAN
4. Arquitetura em 8 linhas
5. Quick start: Python 3.11+, Node 20+, PlatformIO; `./dev up`; abrir `http://127.0.0.1:8787/`
6. Simulador: `./dev sim` + extensão Wokwi
7. Placa: BOM + pinos (link HARDWARE.md) + `./dev firmware flash`
8. Provedores suportados (tabela)
9. Licença + Contributing

Hoje o README ainda descreve “Claude e Cursor” e omite DeepSeek, `/display` e múltiplas contas. Isso tem que estar certo **no dia do `public`**.

### CI

Toda PR:

1. Backend: ruff, pyright, pytest (parsers + `/usage` schema + config sem vazar token)
2. Frontend: `tsc --noEmit`, lint
3. Firmware: compile `wokwi` e `esp32dev` (sem upload)

Sem secrets no Actions. Sem chamar APIs reais no CI — só fixtures.

---

## 10. Fases (ordem de execução)

Cada fase deixa o repo **compilando e usável**. Não abrir a pasta `firmware/` no meio de um backend pela metade sem um `./dev` que ainda funcione.

### Fase 0 — Higiene (1 PR)

- LICENSE, SECURITY.md (rascunho), `.gitignore` auditado (`src/secrets.h`, `backend/data/*.json`, `.tools/`, `.env`)
- Apagar `gerar_env_*.py` e os TODO
- README: corrigir provedores e `/display` **já no layout atual** (não esperar a pasta nova)
- Confirmar que não há token em histórico recente; se houver, rotacionar **antes** de tornar público

**Pronto quando:** `git grep` não acha Bearer de verdade; README não mente sobre o produto.

### Fase 1 — Mover firmware (1 PR, mecânico)

- `firmware/` com sketch + Wokwi + `platformio.ini`
- Ajustar caminhos em `dev.sh` (ainda o helper antigo) e docs
- `pio run -e wokwi` e `-e esp32dev` iguais a hoje

**Pronto quando:** Wokwi e placa compilam a partir de `firmware/`.

### Fase 2 — Backend FastAPI + OpenAPI (PR grande, o núcleo)

- Pacote `backend/` com providers portados (comportamento idêntico)
- Schema de config novo + migração do JSON plano
- Swagger em `/docs`
- Sem docker.sock; sem `/api/docker`
- Pytest com fixtures
- Keep-alive / `Connection: close` validado no Wokwi
- `GET /usage` byte-a-byte compatível com o contrato atual (mesmos campos)

**Pronto quando:** placa + `/display` antigo (ainda servido pelo FastAPI como estático temporário, se precisar) mostram as mesmas cotas; `/docs` lista as rotas; testes verdes.

### Fase 3 — Frontend Vite/React (1–2 PRs)

- App com `/` e `/display`
- Tipos gerados do OpenAPI
- Tailwind buildado; tema compartilhado
- Backend serve `dist` em produção; Vite no `./dev up`
- Apagar `collector/web/`

**Pronto quando:** painel e mostrador verificados no browser (fluxo real: conta, mock, erro, tema, idioma); firmware inalterado.

### Fase 4 — `./dev` único (1 PR)

- Implementar a interface da §7
- Remover `dev.sh`, `dev-collector.sh`, `dev-wokwi.sh`, `start.sh`
- Download automático do `wokwigw`
- Compose na raiz

**Pronto quando:** README só cita `./dev`; `./dev sim` sobe coletor + gateway; `./dev firmware flash` grava a placa.

### Fase 5 — Firmware polish (opcional na mesma janela, não bloqueia o público)

- Remover `MOCK_USAGE`
- Quebrar `ui_views.cpp` por arquivo se ainda estiver ingovernável
- CI compile

### Fase 6 — Docs + OSS pack + CI (1 PR)

- Reescrever `docs/` para os caminhos novos (`backend/`, `frontend/`, `./dev`)
- `AGENTS.md` + `CONTEXTO_IA.md` atualizados (regras 1–8 da v1 continuam válidas)
- CONTRIBUTING, CoC, issue/PR templates, CHANGELOG, workflow CI
- Screenshots no README
- `docs/PLANO.md` marcado como histórico

**Pronto quando:** um clone em Mac limpo segue só o README e chega no painel + (opcional) Wokwi.

### Fase 7 — Publicação

Checklist na hora do `public`:

- [ ] LICENSE no commit
- [ ] Nenhum `config.json` / `secrets.h` real no git (`git log --all -- '*.json' secrets.h`)
- [ ] README + aviso de API não oficial
- [ ] CI verde na default branch
- [ ] Description + topics no GitHub (`esp32`, `claude`, `cursor`, `open-source`, `platformio`)
- [ ] Security policy habilitada
- [ ] Tag `v1.0.0`
- [ ] Decidir: Issues abertas, Discussions ou só PR

Não é obrigatório anunciar no mesmo dia. O botão **public** só depois da fase 6.

---

## 11. Riscos e como não repetir o protótipo

| Risco | Mitigação |
| --- | --- |
| FastAPI quebra o HTTP da ESP32 | Critério de aceite da fase 2 = Wokwi + placa lendo `/usage` |
| OpenAPI e `CONTRATO_JSON.md` divergem | Gerar exemplos no doc a partir dos modelos, ou teste que compara campos |
| Frontend “mais bonito” que a placa, depois ninguém atualiza os dois | Tokens de cor num arquivo só; `/display` é réplica, não um dashboard novo |
| Rate limit Claude no CI / com `/display` + placa | Fixtures no CI; doc no painel; poll 60 s permanece decisão do usuário |
| Keychain só Mac | Documentar Linux; Windows = paste; não fingir suporte |
| Querer “mais um provedor” no meio da reescrita | Fora de escopo (§1). Interface `Provider` deixa o próximo *depois* do v1.0.0 |
| Histórico git com token | Auditar na fase 0; se achar, BFG/filter **antes** do público (e rotacionar o token) |

---

## 12. Mapa rápido: hoje → amanhã

| Hoje | Amanhã |
| --- | --- |
| `src/`, `platformio.ini`, `diagram.json` | `firmware/` |
| `collector/server.py` (`http.server`) | `backend/app` (FastAPI) + `/docs` |
| `collector/web/*.html` | `frontend/` (Vite + React + TS) |
| `dev.sh` + `dev-collector.sh` + `dev-wokwi.sh` | `./dev` |
| `collector/data/config.json` plano | JSON aninhado `version: 1` + migrador |
| `POST /api/docker` + docker.sock | sumiu |
| `gerar_env_*.py`, `TODO_*.md` | sumiu |
| README desatualizado, sem LICENSE | README de produto + MIT + CI |

O que **não** se joga fora: parsers, Keychain/`state.vscdb`, contrato `/usage`, layout da TFT, Wokwi com coletor real, regra de tokens.

---

## 13. Como usar este documento

1. Tratar cada fase da §10 como um PR (ou um pequeno grupo).
2. Não misturar “mover pasta” com “trocar FastAPI” no mesmo PR.
3. Atualizar `docs/CONTEXTO_IA.md` no PR que mudar o mapa de arquivos — agentes leem isso antes de gerar código.
4. Quando a fase 7 fechar, mover este arquivo para `docs/historico/REESCRITA.md` (ou deixar e marcar “executado em …”) e apontar o índice para o CONTRIBUTING.

Este plano não autoriza cache no coletor, tokens no firmware, nem novos provedores. Qualquer uma dessas coisas é decisão nova, não “parte da reescrita”.
