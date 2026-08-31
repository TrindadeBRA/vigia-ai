# Frontend

Vite + React + TypeScript em `frontend/`.

| Rota | Papel |
| --- | --- |
| `/` | Redireciona para `/display/config` |
| `/display` | Réplica das telas da placa — escuta `GET /events` (SSE); o botão de atualizar chama `GET /usage` |
| `/display/config` | Contas, arquivo da placa, mock e rede — mesmo layout do mostrador |

Em desenvolvimento o Vite (`:5173`) faz proxy para o FastAPI (`:8787`). Em produção o backend serve `frontend/dist`. `./dev up` e `./dev wokwi` rebuildam esse dist — o coletor na LAN / QR da placa usa o build, não o Vite.

Tema/cor/idioma do mostrador ficam no `localStorage` (`vigia_display_prefs`). Paleta em `frontend/src/theme.ts` — mesmos RGB do firmware (`firmware/src/ui/theme.cpp`).
