# Frontend

Vite + React + TypeScript em `frontend/`.

| Rota | Papel |
| --- | --- |
| `/` | Painel de contas, mock, `secrets.h` |
| `/display` | Réplica das telas da placa — lê só `GET /usage` |

Em desenvolvimento o Vite (`:5173`) faz proxy para o FastAPI (`:8787`). Em produção o backend serve `frontend/dist`.

Tema/cor/idioma do mostrador ficam no `localStorage` (`vigia_display_prefs`). Paleta em `frontend/src/theme.ts` — mesmos RGB do firmware (`firmware/src/ui.cpp`).
