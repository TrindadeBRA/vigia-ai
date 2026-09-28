# SPTrans (Olho Vivo)

Ônibus de São Paulo em tempo real no `/display`: cada **ponto (parada)** vira um card próprio no board, e em cada card você escolhe **quais linhas daquele ponto** monitorar — cada linha mostra o **tempo estimado até o ponto** (`12 min · 23:11`).

## Onde mora

- Frontend: `frontend/src/components/cards/SpTransCard.tsx` (`SpTransBoardCard`, poll próprio de 30 s) · `frontend/src/pages/config/SpTransConfigCard.tsx` (token + busca de ponto + escolha de linhas) · `frontend/src/hooks/useSpTransStops.ts` (lista de pontos, igual `useAndroidDevices`).
- Backend: `backend/src/providers/sptrans.ts` (client Olho Vivo com cookie de sessão) · `backend/src/routers/sptrans.ts` (rotas) · `backend/src/schemas/sptrans.ts` (Zod).
- Config em `backend/data/config.json` → chave `sptrans: { token, stops: [{ id, cp, name, address, nickname, lines: [{ cl, c, lt, tl, sl, lt0, lt1 }] }] }` (gitignored). `GET /api/config` devolve as paradas **sem o token** (só `has_token` + `suffix`).

## API Olho Vivo v2.1

Base `https://api.olhovivo.sptrans.com.br/v2.1` (doc oficial: `sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/`). Token gratuito em "Meus Aplicativos".

- `POST /Login/Autenticar?token={token}` → `true` + cookie de sessão (`Set-Cookie`). Sem reenviar o cookie, todo GET volta 401 — por isso o provider mantém um jar em memória e reloga 1x em 401/403.
- `GET /Parada/Buscar?termosBusca={q}` → `[{ cp, np, ed, py, px }]` (busca fonética por nome/endereço).
- `GET /Linha/Buscar?termosBusca={q}` → `[{ cl, lc, lt, sl, tl, tp, ts }]` (`cl` = código da linha **por sentido**).
- `GET /Previsao/Parada?codigoParada={cp}` → `{ hr, p: { cp, np, py, px, l: [{ c, cl, sl, lt0, lt1, qv, vs: [{ p, t, a, ta, py, px }] }] } }`. O `t` de cada veículo é o **HH:MM previsto** (horário de SP); `mins` = `(t - agora + 1440) % 1440` (`minutesUntil` em `providers/sptrans.ts`, coberto por teste).
- `GET /Parada/BuscarParadasPorLinha?codigoLinha={cl}` existe como fallback, não usado hoje.

## Rotas do coletor (tag `SPTrans`)

- `GET /api/sptrans/status` — `{ configured, suffix, stops }`, sem token cheio.
- `PUT /api/sptrans/token { token }` — valida na hora (autentica + busca boba) antes de salvar.
- `DELETE /api/sptrans/token`.
- `GET /api/sptrans/stops` · `POST /api/sptrans/stops { cp, nickname? }` (resolve nome + linhas via `Previsao/Parada`) · `PATCH /api/sptrans/stops/:id { nickname?, lines? }` · `DELETE /api/sptrans/stops/:id`.
- `GET /api/sptrans/search/stops?q=` · `GET /api/sptrans/search/lines?q=`.
- `GET /api/sptrans/previsao/:cp[?all=1]` — previsão filtrada pras linhas monitoradas (o que o card polla); `?all=1` devolve todas as linhas do ponto (usado na config pra montar os checkboxes). Cache em memória 30 s por parada (chave separada pro `all`).
- `GET /api/sptrans/nearby?lat=&lng=[&limit=]` — pontos mais próximos (haversine sobre o banco local).
- `GET /api/sptrans/cache` · `POST /api/sptrans/cache/refresh` — banco local de paradas (`backend/data/sptrans-stops.json`, refresh 7 dias): varre `GET /Corredor` + `GET /Parada/BuscarParadasPorCorredor` (a API não tem endpoint de proximidade). A busca `search/stops` é combinada: geocode do endereço (Nominatim, 1 req/s) → arredores primeiro, depois a fonética da API, sem duplicar `cp`.

## Como o card funciona

`buildSpTransProviders` (igual `buildCameraProviders`) cria um `ProviderMeta` por parada (`widget:sptrans:{id}`); `SptransTileCard` + `SpTransBoardCard` fazem poll em `/api/sptrans/previsao/:cp` a cada 30 s (padrão `SpotifyCard`: `document.hidden` guard + `visibilitychange`). `sm` = próxima linha (hero); `md` = até 3; `lg/wl/wxl/free` = todas, ordenadas por `mins`. Linha sem veículo = `t.sptransNoForecast`. Remover do board chama `DELETE /api/sptrans/stops/:id` via `onRemoveSpTrans` (`Overview.tsx`, prefixo `widget:sptrans:`).

## Gotchas

- `Previsao/Parada` só traz linha com veículo na rua **naquele momento** — de madrugada a lista pode vir curta; os checkboxes da config mostram o que a API devolveu na hora.
- `t` é HH:MM sem data: se a previsão passar da meia-noite, `mins` rola +24h (correto pro caso normal de "próximo ônibus").
- Fora do contrato `/usage` de propósito: previsão é por parada sob demanda (poll do card), não entra no ciclo de 60 s do hub — igual Spotify/câmera.
- i18n: mostrador em `frontend/src/i18n.ts` (`sptrans*`); config em `frontend/src/pages/config/copy.ts` (`sptrans*`).
