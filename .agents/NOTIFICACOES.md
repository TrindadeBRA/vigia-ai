# Alarmes e notificações push (protótipo)

Painel `/display/alarms`: regras de **provedor + métrica + limiar** que
disparam uma notificação **Web Push** quando cruzadas. Fora do contrato JSON
principal (`CONTRATO_JSON.md`) — não mexe em `/usage` nem no firmware.

## Modelo da regra

`backend/app/alarms.py:METRICS` é o catálogo curado (por provedor, só os
campos que a API real preenche — ver `USAGE_EXAMPLE` em `schemas.py`). Cada
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

O engine roda dentro do ciclo do `UsageHub` (`backend/app/hub.py`, hook
`on_payload`) — mesma cadência do `USAGE_INTERVAL_S`, e também dispara numa
chamada manual de `GET /usage`. O envio do push em si roda em thread separada
(`asyncio.to_thread`) pra não atrasar a resposta de `/usage` nem o fan-out do
SSE.

## Web Push: chaves e assinaturas

`backend/app/push.py` gera um par de chaves VAPID (EC P-256) na primeira vez
que alguém chama `GET /api/push/vapid-public-key` ou dispara um alarme, e
guarda em `backend/data/config.json` (`push.vapid_private_key` /
`push.vapid_public_key`) — **mesmo arquivo gitignored dos tokens dos
provedores, nunca comitar**. A chave privada nunca é devolvida por nenhum
endpoint público; só a pública (é o `applicationServerKey` que o navegador
usa em `pushManager.subscribe()`).

Cada assinatura do navegador (`endpoint` + `keys.p256dh` + `keys.auth`) fica
em `push.subscriptions`. Uma assinatura que responde 404/410 (usuário
revogou, ou expirou) é removida automaticamente no próximo envio.

## Limitação de contexto seguro (importante)

A Push API só funciona em **contexto seguro**: HTTPS, ou
`http://localhost`/`http://127.0.0.1`. O coletor serve HTTP puro na LAN
(`http://192.168.x.x:8787`, o endereço que normalmente se usa do celular) —
esse endereço **não** é contexto seguro, então `pushManager.subscribe()` é
rejeitado nele.

Isso significa, na prática:

- Configurar as regras de alarme funciona de qualquer endereço (é só
  `fetch`/JSON, sem restrição).
- **Só recebe o push de verdade quem abrir o painel em
  `http://127.0.0.1:<porta>` no mesmo Mac onde o coletor roda.** Pelo IP da
  LAN (celular, outro computador), o botão "Ativar notificações" mostra
  "não suportado" em vez de travar silenciosamente — ver `usePush.ts`
  (`isSecureContext`).
- Fazer isso funcionar também no celular exigiria HTTPS local na LAN (ex.
  `mkcert`, confiar a CA no aparelho) — decidido, por ora, fora de escopo.

## "Enviei o teste e não chegou nada"

Antes de suspeitar do backend/`pywebpush`, isola o problema direto no
DevTools (aba `/display/alarms`, `F12` → Console):

```js
const reg = await navigator.serviceWorker.getRegistration();
await reg.showNotification("Teste direto", { body: "sem passar pelo push do servidor" });
```

- **Não lança erro mas não aparece nada na tela**: não é bug de código — é
  bloqueio do **macOS**, fora do controle do navegador. Confira **Ajustes do
  Sistema → Notificações → Google Chrome** (permitir notificações ligado,
  estilo de alerta diferente de "Nenhum") e se não tem Foco/Não Perturbe
  ativo. Isso costuma travar porque, na primeira vez que qualquer site tenta
  notificar, o macOS (não o Chrome) pede permissão num diálogo próprio do
  sistema — clicar "Não permitir" aí bloqueia **todo** o Chrome, mesmo com
  `Notification.permission === "granted"` no JS.
- **Aparece esse teste direto, mas não o do botão "Enviar teste"**: aí sim é
  específico da entrega via push (`webpush()` aceita a mensagem no FCM, mas o
  payload pode não estar sendo descriptografado no navegador) — vale
  investigar `backend/app/push.py`.

O botão "Enviar teste" espera **15 s** antes de disparar (contagem regressiva
no próprio botão) — dá tempo de minimizar/trocar de janela antes da
notificação chegar, já que o Chrome pode não mostrar o banner do sistema
enquanto a aba está em primeiro plano.

## Arquivos

| Peça | Arquivo |
| --- | --- |
| Catálogo de métricas + motor de disparo | `backend/app/alarms.py` |
| Chaves VAPID + envio | `backend/app/push.py` |
| Rotas `/api/alarms/*` | `backend/app/routers/alarms.py` |
| Rotas `/api/push/*` | `backend/app/routers/push.py` |
| Hook no ciclo do hub | `backend/app/hub.py` (`on_payload`) |
| Service worker | `frontend/public/sw.js` |
| Hook de assinatura do navegador | `frontend/src/pages/config/usePush.ts` |
| Painel | `frontend/src/pages/config/AlarmsPage.tsx` |

## Como testar

`./dev up`, abrir `http://127.0.0.1:5173/display/alarms` (ou `:8787` no
build). Ativar mock (`/display/config`) pra ter valores previsíveis, criar
uma regra com limiar abaixo do valor mockado, clicar "Ativar notificações" e
depois "Enviar teste". Pra ver o disparo automático, force um ciclo com
`GET /usage` (ou espere os 60s do hub).
