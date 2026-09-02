# Frontend

Vite + React + TypeScript em `frontend/`.

| Rota              | Papel                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `/`               | Redireciona para `/display/config`                                                               |
| `/setup`          | Redireciona para `/display/setup`                                                                |
| `/display`        | Réplica das telas da placa — escuta `GET /events` (SSE); o botão de atualizar chama `GET /usage` |
| `/display/config` | Contas — mesmo layout do mostrador                                                               |
| `/display/setup`  | Placa, `secrets.h`, rede, mock e passo a passo                                                   |

Em desenvolvimento o Vite (`:5173`) faz proxy para o FastAPI (`:8787`). Em produção o backend serve `frontend/dist`. `./dev up` e `./dev wokwi` rebuildam esse dist — o coletor na LAN / QR da placa usa o build, não o Vite.

Tema/cor/idioma do mostrador ficam no `localStorage` (`vigia_display_prefs`). Paleta em `frontend/src/theme.ts` — mesmos RGB do firmware (`firmware/src/ui/theme.cpp`).

O board de `/display` usa **dnd-kit** em grade de células com 5 tamanhos: **Pequeno** 1×1, **Largo** 1×2, **Médio** 2×2, **Wide** 2×4, **Grande** 4×4. O packing é retangular e evita sobreposição. O botão de tamanho abre um **menu** com todos os tamanhos. **Redefinir grade** empilha de novo na ordem das contas. Posição e tamanho ficam no `localStorage` (`BoardLayout.size` com `sm|lg|md|wl|xl`). O firmware espelha os mesmos 5 tamanhos (`CardSize` em `ui/ui.h`, NVS `cs` blob, packing 2 colunas em `views/home.cpp`, até 20 linhas). MCPs: [MCPS.md](MCPS.md).

## Marca

`frontend/src/components/Logo.tsx` — `EyeMark` (olho SVG animado) e `Logo` (olho + `VIGIA AI`). A íris usa `var(--accent)`, então acompanha o tema. O olho dá sacadas para posições aleatórias, pisca em intervalos irregulares e segue o ponteiro do mouse quando ele passa perto (`follow`, ligado por padrão). Com `prefers-reduced-motion` o olho fica parado no centro. Versão estática em `frontend/public/favicon.svg`.
