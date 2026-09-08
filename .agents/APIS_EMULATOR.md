# Emulador (EmulatorJS)

Cards de jogos retro no `/display` + biblioteca dedicada (`/display/emulator`), sem instalar nada: carrega o [EmulatorJS](https://emulatorjs.org) direto da **CDN oficial** (`https://cdn.emulatorjs.org/{stable|latest|nightly}/data/loader.js`) via `<script>` injetada em runtime, setando as globais `window.EJS_*`. **Não** usa o pacote npm `react-emulatorjs` — foi removido por não ser usado; ele só embrulharia a mesma CDN numa API de componente, sem empacotar os cores (wasm, pesados) localmente. Se algum dia fizer sentido rodar 100% offline, a alternativa é hospedar a pasta `data/` do EmulatorJS no próprio backend, não trocar de pacote.

## Onde mora

- Frontend: `frontend/src/components/cards/EmulatorCard.tsx` (`EmulatorBoardCard`, o card em si — usado tanto solto quanto dentro do `EmulatorTileCard` do board) · `frontend/src/pages/EmulatorLibraryPage.tsx` (biblioteca, `/display/emulator`) · `frontend/src/pages/config/EmulatorConfigCard.tsx` (configurações).
- Backend: `backend/src/routers/emulator.ts` (rotas) · `backend/src/schemas/emulator.ts` (schema Zod + lista de plataformas) · `backend/src/providers/igdb.ts` (capas/dados via IGDB).
- Config persistida em `backend/data/config.json` → chave `emulator` (gitignored).

## Plataformas

Lista fixa em `EMULATOR_PLATFORMS` (`backend/src/schemas/emulator.ts`) — ~29 plataformas (NES até 3DS/DOS), cada uma com o core do EmulatorJS, extensões de ROM aceitas e se exige BIOS (NDS, PSX, Sega CD, Saturn, 3DO, Amiga). Habilitar uma plataforma no painel (Configurações → Emulador) e apontar a pasta de ROMs cria um card próprio no board. Também existe um card **unificado** (`platform: "all"`) que agrega os jogos de todas as plataformas habilitadas numa biblioteca só.

## Rotas

- `GET/PATCH /api/emulator/config` — config global (CDN, volume, idioma, IGDB, etc.) + lista de plataformas habilitadas (`romPath`/`biosPath`/`core` por plataforma).
- `GET /api/emulator/roms?platform=X` · `GET /api/emulator/roms/all` — lista ROMs da pasta configurada (filtro por extensão permitida da plataforma), agrupadas por plataforma no caso `all`.
- `GET /api/emulator/rom/:platform/:file` — stream do arquivo de ROM (`safeJoin` valida que o caminho resolvido não escapa da pasta configurada).
- `GET /api/emulator/bios/:platform` · `GET /api/emulator/bios/:platform/:file` — stream do BIOS.
- `GET /api/emulator/platforms` — metadados estáticos das plataformas (para o combobox do painel).
- `GET /api/emulator/igdb/status|search|game/:id` — integração IGDB (capas/sinopse/nota), exige `igdb.clientId`/`clientSecret` configurados (Configurações → Emulador → IGDB).
- `GET/PATCH/DELETE /api/emulator/game-meta` — metadados de capa por jogo (chave `"platform::file"`), sobrepõe o nome/capa vindos do IGDB por cima do que foi lido do arquivo.

## Como o card carrega um jogo

`EmulatorBoardCard` seta as globais `window.EJS_*` (`EJS_core`, `EJS_gameUrl`, `EJS_biosUrl`, `EJS_pathtodata` apontando pra CDN, volume, idioma, etc.) e injeta `<script src=".../loader.js">` no `<body>`. O EmulatorJS não foi feito para múltiplas instâncias na mesma página, então trocar de jogo passa por `destroyEmulator()`: tenta parar áudio (contexts patchados via `AudioContext`/`webkitAudioContext` pra rastrear e fechar), pausar o loop principal, terminar workers, remover o `<script>`/`<link>` da CDN e apagar todas as globais `EJS_*` antes de recarregar do zero.

Fluxo "▶ Jogar" na biblioteca (`EmulatorLibraryPage`): grava `localStorage['vigia:emulator:pending']` + dispara `CustomEvent('vigia:emulator-play')`, navega pra `/display`. O card unificado (se existir no board) escuta esse evento/chave e carrega o jogo pendente sozinho, sem o usuário precisar reabrir o card manualmente.

## Menu interno do EmulatorJS

Por padrão o card mantém a barra de menu do próprio EmulatorJS escondida (classe `ejs_menu_bar_hidden` → `display: none !important`, CSS injetada uma vez em `<head>`) e expõe um botão próprio (`data-emu-menu-btn`, ícone ☰) pra abrir/fechar. Fechar acontece por `Esc` ou clique fora do menu (listener em `document`, com 100ms de atraso pra não fechar no mesmo clique que abriu).

**Bug corrigido (2026-09):** havia um segundo `useEffect` que interceptava `click`/`mousedown`/`touchstart` em **toda** a área do jogo, em fase de captura, chamando `preventDefault()` — a ideia era impedir cliques de "vazar" pro menu escondido, mas um elemento `display:none` já não recebe clique nenhum, então esse bloqueio só atrapalhava: engolia toque em controles virtuais/canvas, e `preventDefault()` no `mousedown` cancela o foco automático do navegador — o card nunca conseguia receber foco de teclado, nem sozinho nem clicando. Removido; a lógica de "fechar ao clicar fora" já existia isolada, sem depender disso.

## Foco (`noAutoFocus`)

`EJS_noAutoFocus` (config `noAutoFocus`, toggle "Não focar automaticamente ao carregar" em Configurações → Emulador, padrão `false`) controla se o EmulatorJS foca o canvas sozinho assim que o jogo termina de carregar. Ficou hardcoded pra `true` por um tempo, sobrescrevendo a config logo depois de lê-la (nenhum efeito visível da config, foco automático sempre desligado) — corrigido, a config agora é respeitada de verdade.

## Resize

Um `ResizeObserver` (`gameContainerRef`) avisa o EmulatorJS (`handleResize()`/`resize()` + evento `resize` do `window`) sempre que o tile muda de tamanho, pra recalcular a resolução interna do canvas. O tamanho **visual** do `<canvas>` é só CSS (`[&_canvas]:!w-full [&_canvas]:!h-full [&_canvas]:!object-contain` no wrapper) — **não** escrever `canvas.style.width/height` via JS ali: o `!important` do Tailwind sempre ganha de qualquer inline style na mesma propriedade, então isso só gera layout/repaint à toa a cada resize (era o caso antes da limpeza de 2026-09).

## Saves

O EmulatorJS salva estado em IndexedDB do navegador — não no backend. O campo `saveFolder` na config é só um lembrete de onde fazer backup manual; não há sincronização automática entre dispositivos.

## Gotchas

- `EJS_threads` é sempre `false` — sem SharedArrayBuffer/threads, evita exigir headers COOP/COEP no servidor.
- BIOS é obrigatório pra NDS, PSX, Sega CD, Saturn, 3DO e Amiga — sem ele o core carrega mas o jogo trava ou não boota.
- Trocar `cdnVersion` (`stable`/`latest`/`nightly`) muda de onde vêm o `loader.js` e os cores — útil se a `stable` tiver algum bug conhecido do EmulatorJS upstream.
- `defaultOptions`, `disableAutoUnload`, `disableBatchBootup`, `softLoad`, `disableCue`, `backgroundBlur` e `color` existem no schema/config e são repassados ao `EJS_*` correspondente, mas ainda não têm campo próprio no painel (`EmulatorConfigCard.tsx`) — só dá pra ajustar via `PATCH /api/emulator/config` direto.
