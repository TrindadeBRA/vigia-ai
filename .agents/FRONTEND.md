# Frontend

Vite + React + TypeScript em `frontend/`.

| Rota              | Papel                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`               | Redireciona para `/display/config`                                                                                                                       |
| `/setup`          | Redireciona para `/display/setup`                                                                                                                        |
| `/display`        | Réplica das telas da placa — escuta `GET /events` (SSE); o botão de atualizar chama `GET /usage`                                                         |
| `/display/now`    | "Agora" — lista com todas as contas/cotas, no mesmo estilo da tela "Agora" da placa (sem o board arrastável)                                             |
| `/display/canvas` | Espelha o tema da placa (fundo/relógio/ícones) em tela cheia no navegador — kiosk, sem chrome, Esc volta pro `/display`                                  |
| `/display/config` | Configurações — contas, Financeiro (Bitcoin/AdSense/moedas), Clima, Papéis de parede                                                                     |
| `/display/setup`  | Placa, `secrets.h`, rede, mock e passo a passo                                                                                                           |
| `/display/theme`  | Editor de tema da placa (fundo, relógio, ícones com a cota ao vivo) — biblioteca de papéis de parede embutida (chaves de API ficam em `/display/config`) |
| `/display/alarms` | Alarmes e notificações Telegram, com exportar/importar regras em JSON                                                                                    |

Em desenvolvimento o Vite (`:5173`) faz proxy para o Fastify (Node 22) (`:8787`). Em produção o backend serve `frontend/dist`. `./dev up` e `./dev wokwi` rebuildam esse dist — o coletor na LAN / QR da placa usa o build, não o Vite.

Tema/cor/idioma do mostrador (`Prefs` em `frontend/src/pages/display/usePrefs.ts`) ficam no backend (`/api/prefs`, `backend/data/prefs.json`) — sem `localStorage` como fonte de verdade, só uma migração única do `vigia_display_prefs` antigo na primeira carga. Paleta em `frontend/src/theme.ts` — mesmos RGB do firmware (`firmware/src/ui/theme.cpp`).

O board de `/display` usa **dnd-kit** em grade de células com **13 tamanhos** (`CardSize` em `frontend/src/board.ts`: `xs, sm, sw, sx, sc, scw, md, lg, xl, wl, wm, wxl, free`) — além do normal/grande/longo, há variantes compactas (`sw/sx/sc/scw`) que mostram um valor específico do card em vez do padrão, `xs` (usado por `EyeCard`/`ImageCard`/`SystemCard`) e `free` (retângulo custom, redimensionado livremente em vez de escolhido no menu). O packing é retangular e evita sobreposição. O botão de tamanho abre um **menu** só com os tamanhos que aquele card permite (`allowedSizes` por card, ex.: `adsenseAllowedSizes`). **Redefinir grade** empilha de novo na ordem das contas. Posição e tamanho persistem só no backend (`/api/board`, `frontend/src/hooks/useGridBoards.ts`) — sem cache em `localStorage` — pra sincronizar entre dispositivos na mesma LAN. **O firmware ainda só tem 6 tamanhos** (`CardSize` em `firmware/src/ui/ui.h`: `SM, MD, LG, XL, WL, WXL`, NVS `cs` blob, packing 2 colunas em `views/home.cpp`, até 20 linhas) — as variantes compactas extras do frontend (`sw/sx/sc/scw/wm`) não têm equivalente na placa. MCPs: [MCPS.md](MCPS.md).

## Sem localStorage como fonte de verdade — só backend

Notas (`frontend/src/hooks/useServerNotes.ts`, `/api/notes`) e imagens (`frontend/src/hooks/useImageWidgets.ts`, `/api/images`) dos cards do board são **só backend**. Antes cada uma tinha seu próprio armazenamento local por navegador (criado pelos botões "+ Nota"/"+ Imagem" do painel) sem indicação visual disso — o conteúdo criado pela UI não aparecia em outro navegador/app/monitor, e parecia "sumir" ao trocar de tela. Cada hook faz uma migração única, na primeira carga, do `localStorage` antigo (`vigia_note_widgets`/`vigia_image_widgets`) pro backend (o que falhar por rede fica salvo pra tentar de novo na próxima carga). Imagem aceita `src` como `data:image/...` base64 (arquivo enviado pelo painel, até 8MB) ou URL http(s) — igual já era local, só mudou onde fica.

`NoteBoardCard` só sincroniza o rascunho com o texto vindo do servidor quando **não** está editando (senão o poll de 15s ou o refresh no foco apaga o que o usuário está digitando no meio da nota), e salva o rascunho pendente ao desmontar (troca de rota/câmera, resize do grid) ou ao ser fechado à força em modo somente-leitura — antes esses casos descartavam silenciosamente uma edição ainda não capturada pelo debounce de 500 ms.

O mesmo padrão (backend-only + migração única) vale pro rascunho do editor de tema (`useThemeDraft` em `pages/config/themeEditor/themeState.ts`, `loadThemeDraft` em `pages/config/themeCanvas/state.ts`, ambos em `/api/theme-draft`) e pro easter egg retrô (`useKonamiCode.ts`, `/api/retro`). Como efeito colateral bom: o rascunho de tema agora é o mesmo em qualquer dispositivo, então `/display/canvas` passa a espelhar de verdade o que está sendo editado em outra tela/aparelho, não só na mesma aba do navegador.

## Marca

`frontend/src/components/Logo.tsx` — `EyeMark` (olho SVG animado) e `Logo` (olho + `VIGIA AI`). A íris usa `var(--accent)`, então acompanha o tema. O olho dá sacadas para posições aleatórias, pisca em intervalos irregulares e segue o ponteiro do mouse quando ele passa perto (`follow`, ligado por padrão). Com `prefers-reduced-motion` o olho fica parado no centro. Versão estática em `frontend/public/favicon.svg`.

## Campos de caminho — picker nativo só no Electron

Todo campo que representa caminho de pasta ou arquivo (ex.: `saveFolder`, `biosFolder`, `romPath`, `biosPath`, `source` do Git) **deve** usar `PathField` (`frontend/src/pages/config/ui.tsx`) em vez de `TextField`/`input` cru.

- `PathField` renderiza `input` + botão `…` lado a lado.
- O botão só aparece quando `window.vigia?.isDesktop === true` (Electron). No navegador o campo é apenas texto — sem botão, sem `dialog`.
- `kind`: `"folder"` (pasta), `"file"` (arquivo) ou `"both"` (qualquer um). Ex.: BIOS aceita arquivo ou pasta → `kind="both"`.
- Ao clicar, chama `pickPath({ defaultPath, kind })` (`frontend/src/desktop.ts` → `window.vigia.pickPath` → `desktop/src/preload.ts` → `desktop/src/ipc.ts` → `dialog.showOpenDialog`). Retorna `string | null`; `null` se cancelado.
- `onPicked` preenche o valor e já dispara o save quando fizer sentido (ex.: `saveFolder`/`biosFolder` salvam imediatamente); `onChange` continua para digitação manual.
- Manter build único: nada de `ipcRenderer` direto no renderer, só via `window.vigia`.

Campos já migrados: `EmulatorConfigCard` (`saveFolder`, `biosFolder`, `romPath`, `biosPath`) e `GitConfigCard` (`source`). Novos campos de caminho devem seguir o mesmo padrão.

## Excluir/remover — sempre via ConfirmModal

Toda funcionalidade que remove algo de forma permanente (conta, wallpaper, regra, card do board, repositório, dispositivo, etc.) **deve** passar por `ConfirmModal` (`frontend/src/components/ConfirmModal.tsx`) antes de disparar a exclusão de verdade — nunca excluir direto no `onClick`/`onPress` do botão ou ícone de lixeira.

- Props: `open`, `title`, `body`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`.
- Padrão: um `useState` local guarda o id/alvo pendente (ex.: `const [toRemove, setToRemove] = useState<string | null>(null)`); o botão de excluir só seta esse state (abre o modal); a chamada de exclusão de fato roda em `onConfirm`, que também limpa o state.
- Já usado em: `GithubConfigCard`, `GitConfigCard`, `CalendarConfigCard`, `CameraConfigCard`, `RetroAchievementsConfigCard`, `ExtraAccounts`, `AndroidConfigCard`, `CurrenciesConfigCard`, `RssConfigCard`, `alarmsPage/RulesList`, `alarmsPage/TelegramConnectedPanel`, `wallpaperManager/Library`, `GridWallpaperModal`, `display/Overview` (remover card do board) — usar esses como referência de integração, não reinventar um `window.confirm()` ou modal próprio.

## Emulador (EmulatorJS)

Cards de jogos retro (`EmulatorCard.tsx`) + biblioteca dedicada (`/display/emulator`) carregando o EmulatorJS direto da CDN oficial, sem pacote npm — arquitetura, rotas do backend, o bug de foco no Mac corrigido em 2026-09 e outras pegadinhas (menu interno, resize, `noAutoFocus`) estão em [APIS_EMULATOR.md](APIS_EMULATOR.md).
