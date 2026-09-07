# Plano — Múltiplas câmeras + controle PTZ (ONVIF)

Decisões já tomadas com o usuário (2026-09-07):

- Câmera do usuário é uma "360" motorizada (pan/tilt) tipo Yoosee/HiIP — provavelmente fala **ONVIF PTZ** na porta 80/8000, separado do RTSP (porta 554) que já é usado hoje só pra vídeo.
- Hoje `backend/data/camera.json` guarda **uma única câmera** (`host/port/path/username/password`). Objetivo: suportar **várias câmeras configuráveis**, cada uma virando seu próprio bloco no board (igual às notas — não como o card único de RSS que lista feeds dentro de si).
- Sem dependências novas se der pra evitar: o projeto já evita libs (RSS faz parse de XML na mão, comentário explícito "Sem dependências externas"). PTZ ONVIF vai ser implementado com SOAP cru (`fetch` + `node:crypto` pra WS-Security), sem adicionar `onvif`/`node-onvif` ao `package.json`. Se isso se provar frágil demais durante o teste real com a câmera, reavaliar.

## O que é, de fato

ONVIF PTZ é um protocolo SOAP sobre HTTP: a câmera expõe um "device service" (`/onvif/device_service`) e um "PTZ service" (URL descoberta via `GetCapabilities`). Pra mover a câmera:
1. `GetProfiles` → pega o `ProfileToken` (perfil de streaming/PTZ ativo).
2. `ContinuousMove` com esse token + vetor `{x, y, zoom}` → câmera começa a girar continuamente.
3. `Stop` → para o movimento (chamado ao soltar o botão).

Autenticação normalmente é **WS-Security UsernameToken** (nonce + timestamp + `SHA1(nonce + created + password)` em base64), diferente do RTSP Digest que a câmera já usa pra vídeo — os dois esquemas coexistem no mesmo dispositivo.

## Escopo do MVP

**Dentro:**
- Backend: `camera.json` migra de objeto único pra `{ cameras: CameraItem[] }`. Migração automática do formato antigo no `load()` (câmera existente vira a primeira entrada da lista, com um `id` gerado).
- CRUD de câmeras: `GET/POST /api/camera/cameras`, `PATCH/DELETE /api/camera/cameras/:id` — no padrão que `backend/src/routers/rss.ts` já usa pra feeds (id via `randomBytes(4).toString("hex")`).
- Snapshot/stream por câmera: `/api/camera/cameras/:id/snapshot` e `/api/camera/cameras/:id/stream`, reusando a lógica de cache/fan-out de ffmpeg já existente, só trocando as variáveis globais (`cache`, `inFlight`, `shared`) por `Map<cameraId, ...>`.
- Novo módulo `backend/src/providers/onvifPtz.ts`: SOAP cru pra `GetProfiles` (com cache em memória por câmera), `ContinuousMove` e `Stop`. Endpoint `POST /api/camera/cameras/:id/ptz` com body `{ action: "up"|"down"|"left"|"right"|"zoom_in"|"zoom_out"|"stop" }`.
- Schema: cada `CameraItem` ganha `label`, `ptzEnabled` (bool, default `false`) e `onvifPort` (default `80`) além dos campos já existentes.
- Frontend `CameraConfigCard.tsx`: reescrito no padrão de `RssConfigCard.tsx` — lista de câmeras configuradas (editar/remover) + formulário de "adicionar câmera" (host/porta/caminho RTSP/usuário/senha + toggle "tem motor PTZ" + porta ONVIF).
- Board: cada câmera configurada vira **um bloco próprio automaticamente** (igual notas — `buildCameraProviders(cameras)` em vez do toggle único em `AddWidgetModal`/`buildWidgetProviders`). Remove `"camera"` de `WIDGET_KINDS`.
- `CameraBoardCard`: passa a receber a câmera específica (id/label/ptzEnabled) via `ProviderMeta`, consome `/api/camera/cameras/:id/stream`. Se `ptzEnabled`, mostra um D-pad simples sobreposto (setas + zoom) que faz `mousedown` → `ContinuousMove`, `mouseup`/`mouseleave` → `Stop`.
- Textos novos em `frontend/src/pages/config/copy.ts` e `frontend/src/i18n.ts` (pt/en/es) pro fluxo de lista + PTZ.

**Fora do MVP (não implementar sem pedido explícito):**
- Descoberta automática de câmeras na rede (WS-Discovery) — usuário cadastra o IP manualmente, como já faz hoje.
- Presets PTZ (posições salvas), tour automático, home position.
- Zoom óptico real (a maioria dessas câmeras baratas não tem — só cobrir o comando, sem garantir que a câmera responde).
- Autenticação ONVIF alternativa (HTTP Digest puro em vez de WS-Security) — implementar WS-Security primeiro; só adicionar fallback se a câmera do usuário não aceitar.

## Risco principal — resolvido em 2026-09-07

Validado com a câmera real do usuário (Yoosee/HiIP clone, "onvif1"):

- **`USER_CMD_SET`** (método RTSP customizado que aparece no `OPTIONS`) é beco morto — a câmera aceita qualquer corpo e sempre responde `200 OK` sem fazer nada. Confirmado também por terceiros (github.com/victorbillyph/Yoosee-camera-documentation): "Comando USER_CMD_SET listado no OPTIONS → Conexão fecha ao usar".
- **ONVIF de verdade existe, mas na porta 5000** (não 80/8000/8080 — todas fechadas/recusadas nessa câmera). `GetCapabilities`/`GetProfiles` respondem sem exigir auth; `ContinuousMove`/`Stop` funcionam com WS-Security. Token do perfil: `IPCProfilesToken0` (mesmo valor documentado por terceiros pra essa família de câmera).
- **`GetStatus` não é implementado** — a conexão fecha sem resposta. Não dá pra usar isso pra feedback de posição.
- **Zoom motorizado não existe** nessa câmera — `ContinuousMove` com `Zoom` responde exatamente igual ao pan/tilt (SOAP vazio de sucesso) mas não move nada; é uma câmera pan/tilt de lente fixa, "360" se refere ao giro, não a zoom óptico.
- Ajustes feitos por causa disso: `onvifPort` default mudou de 80 → **5000** (schema + placeholder da UI); velocidade do `ContinuousMove` de pan/tilt subiu de 0.5 → **1.5** (câmera não valida o range -1..1 documentado pelo ONVIF, então dá pra usar valores "fora do padrão" pra andar mais rápido por toque no D-pad).

## Arquitetura

```
backend/src/schemas/camera.ts
  CameraItemSchema        # id, label, host, port, path, username, password,
                           # ptzEnabled, onvifPort
  CamerasFileSchema        # { cameras: CameraItem[] } — com migração do formato antigo

backend/src/routers/camera.ts
  GET    /api/camera/cameras                    # lista (sem senha)
  POST   /api/camera/cameras                    # cria
  PATCH  /api/camera/cameras/:id                 # edita
  DELETE /api/camera/cameras/:id                 # remove (mata stream ativo, se houver)
  GET    /api/camera/cameras/:id/snapshot        # jpeg único (cache/inFlight por id)
  GET    /api/camera/cameras/:id/stream          # mjpeg fan-out (por id)
  POST   /api/camera/cameras/:id/ptz             # { action } -> onvifPtz.ts

backend/src/providers/onvifPtz.ts
  getProfileToken(camera)      # SOAP GetProfiles, cache em memória
  continuousMove(camera, dir)  # SOAP ContinuousMove
  stopMove(camera)             # SOAP Stop
  # WS-Security UsernameToken via node:crypto (sha1 digest, base64)

frontend/src/api/{client,types}.ts
  fetchCameras / addCamera / updateCamera / removeCamera / sendPtz

frontend/src/pages/config/CameraConfigCard.tsx
  # reescrito no padrão RssConfigCard.tsx: lista + form de adicionar

frontend/src/pages/display/buildProviders.ts
  buildCameraProviders(cameras, t)   # 1 ProviderMeta por câmera, id `widget:camera:<id>`
  # remove branch "camera" de buildWidgetProviders

frontend/src/components/AddWidgetModal.tsx
  # remove "camera" de WIDGET_KINDS (não é mais toggle único)

frontend/src/components/cards/CameraCard.tsx
  # recebe camera {id,label,ptzEnabled} via props/ProviderMeta
  # stream aponta pra /api/camera/cameras/:id/stream
  # D-pad PTZ sobreposto quando ptzEnabled

frontend/src/pages/config/copy.ts + frontend/src/i18n.ts
  # novos textos (lista de câmeras, botões PTZ) em pt/en/es
```

## Como validar

1. Testes unitários do backend (vitest) pro CRUD de câmeras e migração do formato antigo (padrão dos testes que já existem em `backend/src/providers/*.test.ts`).
2. Rodar o coletor local, cadastrar a câmera real do usuário na nova UI, confirmar snapshot/stream por id funcionando (regressão do que já existe).
3. Testar PTZ manualmente contra a câmera real do usuário — sem isso não há como confirmar que o SOAP/WS-Security está correto pra essa câmera específica.
