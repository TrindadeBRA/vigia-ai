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

Tema/cor/idioma do mostrador ficam no `localStorage` (`vigia_display_prefs`). Paleta em `frontend/src/theme.ts` — mesmos RGB do firmware (`firmware/src/ui/theme.cpp`).

O board de `/display` usa **dnd-kit** em grade de células com **11 tamanhos** (`CardSize` em `frontend/src/board.ts`: `sm, sw, sx, sc, scw, md, lg, xl, wl, wm, wxl`) — além do normal/grande/longo, há variantes compactas (`sw/sx/sc/scw`) que mostram um valor específico do card em vez do padrão. O packing é retangular e evita sobreposição. O botão de tamanho abre um **menu** só com os tamanhos que aquele card permite (`allowedSizes` por card, ex.: `adsenseAllowedSizes`). **Redefinir grade** empilha de novo na ordem das contas. Posição e tamanho persistem no `localStorage` (`BoardLayout.size`) e também no backend (`/api/board`, `frontend/src/hooks/useGridBoards.ts`) pra sincronizar entre dispositivos na mesma LAN. **O firmware ainda só tem 6 tamanhos** (`CardSize` em `firmware/src/ui/ui.h`: `SM, MD, LG, XL, WL, WXL`, NVS `cs` blob, packing 2 colunas em `views/home.cpp`, até 20 linhas) — as variantes compactas extras do frontend (`sw/sx/sc/scw/wm`) não têm equivalente na placa. MCPs: [MCPS.md](MCPS.md).

## Notas (post-its do board)

Widget de nota (`frontend/src/components/cards/NoteCard.tsx`, hook `frontend/src/hooks/useServerNotes.ts`) é **só backend** (`/api/notes`, `backend/data/notes.json`) — sem `localStorage` como fonte de verdade, ao contrário do board (§ acima). Antes havia dois armazenamentos paralelos (um local por navegador, criado pelo botão "+ Nota"; outro no servidor, só alimentado pelo `/note` do Telegram) sem indicação visual de qual era qual — nota criada pela UI não aparecia em outro navegador/app/monitor, e parecia "sumir" ao trocar de tela. `useServerNotes` faz uma migração única, na primeira carga, de qualquer nota que ainda esteja no `localStorage` antigo (`vigia_note_widgets`) para o backend (o que falhar por rede fica salvo pra tentar de novo na próxima carga).

`NoteBoardCard` só sincroniza o rascunho com o texto vindo do servidor quando **não** está editando (senão o poll de 15s ou o refresh no foco apaga o que o usuário está digitando no meio da nota), e salva o rascunho pendente ao desmontar (troca de rota/câmera, resize do grid) ou ao ser fechado à força em modo somente-leitura — antes esses casos descartavam silenciosamente uma edição ainda não capturada pelo debounce de 500 ms.

## Marca

`frontend/src/components/Logo.tsx` — `EyeMark` (olho SVG animado) e `Logo` (olho + `VIGIA AI`). A íris usa `var(--accent)`, então acompanha o tema. O olho dá sacadas para posições aleatórias, pisca em intervalos irregulares e segue o ponteiro do mouse quando ele passa perto (`follow`, ligado por padrão). Com `prefers-reduced-motion` o olho fica parado no centro. Versão estática em `frontend/public/favicon.svg`.
