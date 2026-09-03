# Plano — bot do Telegram como canal de notificação

> Ainda não implementado. Ver [`NOTIFICACOES.md`](NOTIFICACOES.md) para o
> canal de push atual.

## Contexto / motivação

Hoje o Vigia AI só notifica alarmes via **Web Push**
(`backend/app/push.py` + `frontend/src/pages/config/usePush.ts`), que só
funciona em **contexto seguro** (`window.isSecureContext`) — ou seja,
`http://127.0.0.1:<porta>`. Pelo IP da LAN (o jeito normal de abrir o painel
no celular) o navegador bloqueia `pushManager.subscribe()`, e no **Safari**
o suporte a Web Push é limitado mesmo em contexto seguro. Isso deixa o
usuário sem notificação quando não está literalmente no Mac que roda o
coletor.

Objetivo: adicionar o **Telegram** como segundo canal de notificação,
disparado no mesmo ponto que o push hoje (`AlarmEngine.handle_payload`),
funcionando em qualquer dispositivo com o app do Telegram — sem depender de
contexto seguro do navegador. A ideia é **adiantar toda a configuração
possível no projeto**: a única coisa que sobra pro usuário fazer
manualmente é o que é inerentemente externo ao projeto — criar o bot no
@BotFather (pegar um token) e mandar `/start` pra ele uma vez no Telegram.
Todo o resto (validar o token, descobrir o `chat_id`, guardar, religar o
listener) é automático.

## Fluxo do usuário

1. Usuário cria um bot com o **@BotFather** no Telegram (fora do projeto,
   inevitável) e recebe um token tipo `123456:ABC-DEF...`.
2. Cola o token num campo novo no painel (`/display/alarms`, card
   "Telegram"). O backend valida o token na hora (chama `getMe`), salva em
   `config.json` e já mostra um botão "Abrir bot no Telegram"
   (`https://t.me/<bot_username>`).
3. Usuário abre esse link e manda **qualquer mensagem** (ex. `/start`) pro
   bot. O backend está em long-polling (`getUpdates`) assim que o token é
   salvo — captura o `chat_id` automaticamente, salva, e responde no chat
   confirmando ("✅ Vigia AI conectado — você vai receber os alarmes aqui.").
4. O painel mostra o chat conectado (nome do usuário do Telegram) com botão
   remover, e um botão "Enviar teste".
5. Dali em diante, todo evento de alarme (mesmo `AlarmEngine` que já dispara
   push) também manda mensagem pro(s) chat(s) registrado(s).

Não precisa de HTTPS público nem webhook — long-polling roda dentro do mesmo
processo asyncio que já existe (`UsageHub`), então funciona igual em
LAN/Mac local, sem exigir mudança de infra.

## Design técnico (espelha o padrão existente de `push.py`)

### 1. `backend/app/store.py` — novo bloco de config

Em `default_config()` (linha ~113, ao lado de `"push": {...}`):

```python
"telegram": {"bot_token": "", "bot_username": "", "chats": []},
```

- `chats`: lista de `{"id": "<chat_id>", "label": "<nome/username>", "added_at": "<epoch>"}`
  — mesmo formato/espírito de `push.subscriptions`.
- Adicionar `_parse_telegram_chats(raw)` (mirror de `_parse_subscriptions`,
  linha 165) e usar em `_normalize()` (perto da linha 305-308, junto do
  bloco `push`).
- `bot_token`/`bot_username` são strings simples, tratadas como segredo —
  já ficam no mesmo `config.json` gitignored (chmod 600) que os tokens dos
  provedores e as chaves VAPID privadas. Nenhum diretório/arquivo novo.

### 2. `backend/app/telegram_bot.py` (novo — mirror de `push.py`)

Funções síncronas (chamadas via `asyncio.to_thread` a partir de
`alarms.py`, igual ao `push.broadcast` hoje), usando `httpx.Client` (já é
dependência do projeto — `pyproject.toml:20` — nenhuma lib nova):

- `get_bot_token() -> str` — lê de `config.json`.
- `validate_token(token: str) -> dict` — chama
  `GET https://api.telegram.org/bot<token>/getMe`; levanta exceção se
  inválido; devolve `{"id":, "username":, ...}`.
- `set_token(token: str, username: str) -> None` — salva via `update()`.
- `clear_token() -> None` — zera `bot_token`, `bot_username`, `chats`.
- `add_chat(chat_id: str, label: str) -> bool` — idempotente (mesmo padrão
  de `add_subscription`); devolve `True` se era novo (pra saber se manda a
  mensagem de confirmação).
- `remove_chat(chat_id: str) -> None`.
- `broadcast(title: str, body: str) -> int` — mirror exato de
  `push.broadcast` (linha 82): itera `chats`, `POST sendMessage` por chat;
  em erro `403` (bot bloqueado pelo usuário) ou `400` chat not found, remove
  o chat da lista (mesma lógica de pruning de endpoints mortos do push,
  linhas 104-114); loga e segue nos demais erros.

Função assíncrona (roda dentro do loop asyncio, chamada só pelo poller):

- `async def poll_once(client: httpx.AsyncClient, token: str, offset: int) -> int`
  — um `GET getUpdates?timeout=25&offset=<offset>`; para cada update com
  `message.chat.id`, chama `add_chat` (thread-safe via `store.update`) e, se
  novo, manda a mensagem de confirmação; devolve o próximo `offset`.

### 3. `backend/app/telegram_poller.py` (novo — mirror de `UsageHub` em `hub.py`)

Classe `TelegramPoller` com o mesmíssimo padrão de lifecycle de
`UsageHub.start()/stop()` (`hub.py:72-101`, `asyncio.create_task` +
`cancel()`/`await`):

```python
class TelegramPoller:
    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if telegram_bot.get_bot_token():
            self._task = asyncio.create_task(self._loop(), name="telegram-poller")

    async def stop(self) -> None: ...  # cancel + await, igual hub.stop()

    async def restart(self) -> None:
        await self.stop()
        await self.start()

    async def _loop(self) -> None:
        offset = 0
        async with httpx.AsyncClient(timeout=35) as client:
            while True:
                token = telegram_bot.get_bot_token()
                if not token:
                    return
                try:
                    offset = await telegram_bot.poll_once(client, token, offset)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    print(f"[telegram] erro no polling: {exc}")
                    await asyncio.sleep(5)
```

`restart()` é chamado pelo router sempre que o token muda (salvo/limpo), pra
não precisar reiniciar o processo inteiro.

### 4. `backend/app/schemas.py` — novos modelos (perto de `PushSubscriptionBody`, linha 651)

```python
class TelegramChat(BaseModel):
    id: str
    label: str
    added_at: str

class TelegramStatus(BaseModel):
    configured: bool
    bot_username: str = ""
    chats: list[TelegramChat]

class TelegramTokenBody(BaseModel):
    bot_token: str

class TelegramChatBody(BaseModel):
    chat_id: str
```

### 5. `backend/app/routers/telegram.py` (novo — mirror de `routers/push.py`)

```
GET  /api/telegram/status          -> TelegramStatus
POST /api/telegram/token           -> valida (getMe), salva, poller.restart()
POST /api/telegram/token/clear     -> limpa tudo, poller.stop()
POST /api/telegram/chats/remove    -> remove_chat
POST /api/telegram/test            -> broadcast("Vigia AI", "Notificação de teste");
                                       400 se não houver chat registrado (igual /api/push/test)
```

`token` e `test` são `async def(request: Request, ...)`, acessam
`request.app.state.telegram_poller` — mesmo padrão de
`request.app.state.hub` em `routers/usage.py:55,81,135`.

### 6. `backend/app/main.py`

- Import `from app.routers.telegram import router as telegram_router` +
  `app.include_router(telegram_router)` (perto da linha 108, junto do
  `push_router`).
- No `lifespan()` (linha 48-57): criar `telegram_poller = TelegramPoller()`,
  `app.state.telegram_poller = telegram_poller`, `await
  telegram_poller.start()` (só arranca a task se já tiver token salvo —
  senão não faz nada), e `await telegram_poller.stop()` no `finally`, ao
  lado do `hub.stop()`.

### 7. `backend/app/alarms.py` — disparo (linha 158-174)

Em `AlarmEngine.handle_payload`, ao lado do `push.broadcast(...)` (linha
171), adicionar:

```python
from app import telegram_bot  # mesmo import tardio que o de push, linha 166

try:
    telegram_bot.broadcast(title, body)
except Exception as exc:  # noqa: BLE001
    print(f"[alarms] falha ao enviar telegram: {exc}")
```

Mesmo `try/except` isolado por canal que já existe pro push — se um canal
falhar, não afeta o outro.

### 8. Frontend

- **`frontend/src/api/types.ts`**: `TelegramStatus`, `TelegramChat` (mirror
  dos tipos de push/alarm já existentes).
- **`frontend/src/api/client.ts`** (perto das funções de push, linha
  118-142): `fetchTelegramStatus()`, `saveTelegramToken(token)`,
  `clearTelegramToken()`, `removeTelegramChat(chatId)`, `testTelegram()`.
- **`frontend/src/pages/config/useTelegram.ts`** (novo, mirror de
  `usePush.ts`): estado `{status, busy}`, `refresh()`, `saveToken(token)`,
  `clearToken()`, `removeChat(id)`, `sendTest()`.
- **`frontend/src/pages/config/AlarmsPage.tsx`**: novo `<Card>` "Telegram"
  logo abaixo do card de push existente (linha 168-203), reaproveitando os
  mesmos componentes (`ActionRow`, `Button`, `TextField`, `FieldStatus`,
  `StatusPill`) já importados de `./ui`. Conteúdo:
  - Se não configurado: `TextField` pro token + botão "Salvar" (chama
    `saveToken`), texto explicando o passo do BotFather.
  - Se configurado, sem chat: mostra botão "Abrir bot no Telegram"
    (`https://t.me/<bot_username>`, `target="_blank"`) + hint "manda
    qualquer mensagem pro bot pra conectar".
  - Se tem chat(s): lista com nome + botão remover, `StatusPill` "Conectado",
    botão "Enviar teste" (reaproveita o mesmo padrão de `testAction`/
    `pushAction` que já existe, sem o countdown de 15s do push — esse
    countdown existe só por causa da peculiaridade dos banners do Chrome,
    não se aplica ao Telegram).
  - Botão "Trocar token" / "Desconectar" chama `clearToken()`.
- **`frontend/src/pages/config/alarmsCopy.ts`**: novas chaves
  (`telegramTitle`, `telegramLead`, `telegramTokenPh`,
  `telegramSaveToken`, `telegramOpenBot`, `telegramConnected`,
  `telegramNotConnected`, `telegramDisconnect`, etc.) nos três locales
  já existentes (`pt`, `en`, `es`) — seguindo o padrão atual do arquivo.

### 9. Documentação (convenção do projeto — `.agents/CONTEXTO_IA.md:47`)

- Adicionar seção "Telegram" em `.agents/NOTIFICACOES.md` (mesmo template:
  modelo → chaves/storage → limitações → arquivos → como testar), cobrindo
  o fluxo de conexão via `getUpdates` e onde fica o token.
  Atualizar a tabela "Arquivos" (linha 101-112) com as novas peças.
- Atualizar a tabela de arquivos em `.agents/CONTEXTO_IA.md:49-72` se ela
  listar os arquivos de notificação individualmente.
- Depois de implementado, este arquivo (`PLANO_TELEGRAM.md`) deve ser
  removido/mesclado ao `NOTIFICACOES.md` final, seguindo a mesma prática de
  `PLANO.md` (planos viram histórico, não ficam como fonte de verdade).

## O que fica de fora (escopo)

- Não vira webhook (exigiria HTTPS público) — fica long-polling, consistente
  com "single process, sem infra extra" do projeto.
- Sem multi-bot / multi-usuário — é um único bot/token por instalação, igual
  o resto do config (`config.json` já é single-user).
- Não mexe no contrato JSON principal (`CONTRATO_JSON.md`) nem no firmware —
  é 100% painel + backend, mesmo escopo do push atual.

## Verificação (quando for implementado)

1. `./dev up`, abrir `http://127.0.0.1:5173/display/alarms`.
2. Criar um bot de teste via @BotFather, colar o token no card Telegram →
   deve validar e mostrar o link do bot.
3. Mandar `/start` pro bot no Telegram → o painel deve passar a mostrar o
   chat conectado (pode precisar de `refresh()` manual ou polling leve no
   frontend).
4. Clicar "Enviar teste" → mensagem deve chegar no Telegram.
5. Ativar mock (`/display/config`), criar uma regra de alarme com limiar
   abaixo do valor mockado → forçar `GET /usage` → mensagem deve chegar
   tanto por push (se em contexto seguro) quanto por Telegram.
6. Remover o chat / limpar o token → confirmar que o poller para (sem loop
   órfão) e que alarmes só disparam push depois disso.
7. `cd backend && ruff check .` (lint do projeto).
