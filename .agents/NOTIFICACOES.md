# Alarmes e notificações Telegram (protótipo)

Painel `/display/alarms`: regras de **provedor + métrica + limiar** que
disparam mensagem no **Telegram** quando cruzadas. Fora do contrato JSON
principal (`CONTRATO_JSON.md`) — não mexe em `/usage` nem no firmware.

## Modelo da regra

`backend/src/alarms.ts:METRICS` é o catálogo curado (por provedor, só os
campos que a API real preenche — ver `USAGE_EXAMPLE` em `schemas/usage.ts`). Cada
métrica tem um `kind`:

- `percent` (0–100): dispara quando `valor >= limiar` — "avise quando a cota
  passar de X%".
- `cents` (centavos): dispara quando `valor <= limiar` — "avise quando o
  saldo cair pra $X".

Sem operador configurável na UI — o sentido do gatilho já vem do tipo da
métrica. **Edge-triggered**: dispara uma vez na transição "abaixo → acima" (ou
o equivalente pro lado seguro em `cents`) e não repete a cada ciclo de 60s do
hub enquanto o valor continuar do mesmo lado (`AlarmEngine._armed`, em
memória — reseta se o coletor reiniciar). Sem seletor de conta específica por
enquanto (`account_id` sempre `"*"`): a maioria tem uma conta por provedor, e
o campo já existe no modelo pra dar pra adicionar granularidade depois sem
migração.

O painel sugere um nome pra regra automaticamente (`AlarmsPage.tsx:suggestLabel`)
no formato `[Provedor] - Uso de X% da cota [Métrica]` (ou "Saldo de $X..." pras
métricas em `cents`), atualizando ao vivo enquanto o campo "Nome" não é editado
à mão. Regras já criadas têm um botão **Editar** (limiar e nome — provedor e
métrica não mudam depois de criada; pra isso, remove e cria de novo).

**Exportar/Importar** (`AlarmsPage.tsx:AlarmsIOButtons`, ícones no cabeçalho do
card "Regras"): exportar baixa um JSON (`{version, exported_at, alarms: [...]}`)
com `provider/metric/threshold/enabled/label` de cada regra; importar lê o
arquivo e chama `POST /api/alarms` uma vez por regra válida (o backend já
rejeita provider/metric desconhecidos). É só client-side — não existe rota de
export/import no backend.

O engine roda dentro do ciclo do `UsageHub` (`backend/src/hub.ts`, hook
`on_payload`) — mesma cadência do `USAGE_INTERVAL_S`, e também dispara numa
chamada manual de `GET /usage`. O envio pro Telegram roda de forma assíncrona
(promise) pra não atrasar a resposta de `/usage` nem o fan-out do SSE.

## Telegram

Funciona em qualquer dispositivo com o app do Telegram, sem depender de
contexto seguro do navegador.

### Fluxo de conexão

1. Usuário cria um bot com o **@BotFather** no Telegram (fora do projeto) e
   recebe um token.
2. Cola o token no card "Telegram" em `/display/alarms`. O backend valida na
   hora (`GET getMe`), salva em `config.json` e mostra o link do bot.
3. Usuário abre o link e manda qualquer mensagem (ex. `/start`). O backend
   está em long-polling (`getUpdates`) e captura o `chat_id` automaticamente,
   respondendo no chat com confirmação.
4. Dali em diante, todo alarme dispara mensagem nos chats registrados.

### Chaves e storage

`backend/data/config.json` (gitignored, chmod 600):

```json
"alarms": [
  {
    "id": "uuid",
    "label": "Cursor - Uso do plano 80%",
    "provider": "cursor",
    "metric": "percent",
    "threshold": 80,
    "account_id": "*",
    "enabled": true
  }
],
"telegram": {
  "bot_token": "...",
  "bot_username": "meu_bot",
  "chats": [{"id": "123", "label": "João", "added_at": "..."}]
}
```

Regras persistem via `POST/PATCH/DELETE /api/alarms`. O estado
edge-triggered (`_armed`) fica só em memória — reiniciar o coletor pode
disparar de novo se o valor já estiver do lado “perigoso” do limiar.

O token do bot é tratado como segredo — mesmo arquivo dos tokens dos
provedores. Nunca comitar.

### Limitações

- Long-polling (não webhook) — funciona em LAN/Mac local sem HTTPS público.
- Um único bot/token por instalação (single-user, igual ao resto do config).
- Chats que bloqueiam o bot (403) ou não existem mais (400) são removidos
  automaticamente no próximo envio.

## Arquivos

| Peça | Arquivo |
| --- | --- |
| Catálogo de métricas + motor de disparo | `backend/src/alarms.ts` |
| Token Telegram + envio + polling unitário | `backend/src/telegramBot.ts` |
| Long-polling (lifecycle) | `backend/src/telegramPoller.ts` |
| Rotas `/api/alarms/*` | `backend/src/routers/alarms.ts` |
| Rotas `/api/telegram/*` | `backend/src/routers/telegram.ts` |
| Hook no ciclo do hub | `backend/src/hub.ts` (`on_payload`) |
| Hook no painel | `frontend/src/pages/config/useTelegram.ts` |
| Painel | `frontend/src/pages/config/AlarmsPage.tsx` |

## Como testar

1. `./dev up`, abrir `http://127.0.0.1:5173/display/alarms` (ou `:8787` no build).
2. Criar bot de teste via @BotFather, colar o token → deve validar e mostrar
   o link do bot.
3. Mandar `/start` pro bot → painel deve mostrar o chat conectado.
4. Clicar "Enviar teste" → mensagem chega no Telegram.
5. Ativar mock (`/display/config`), criar regra com limiar abaixo do valor
   mockado → forçar `GET /usage` (ou esperar os 60s do hub) → mensagem chega
   no Telegram.
