# API Spotify (player: tocar/pausar/avançar/retroceder)

Card de **controle remoto** do player Spotify — mostra a música atual (capa, título, artista, progresso) e manda comandos (play/pause/próxima/anterior). Diferente de todo o resto do painel: não é uma "cota" só de leitura, o coletor manda ações que afetam de verdade a reprodução na conta do usuário.

Igual ao AdSense: o coletor **é** um cliente OAuth (guarda `client_id`, `client_secret` e `refresh_token` em `backend/data/config.json`, gitignored) e renova o access token sozinho. Não há API key avulsa.

Escopos: `user-read-playback-state user-modify-playback-state user-read-currently-playing`.

Esse card **não** faz parte do contrato JSON (`/usage`/`/events`) nem aparece na placa ESP32 — é só um widget do painel web (`/display`), com o próprio polling (a cada 5s) direto do navegador, porque "o que está tocando agora" muda rápido demais para o ciclo de 60s do hub de cotas.

## Setup no Spotify Developer Dashboard

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) e crie um app (**Create app**).
2. Em **Redirect URIs**, cadastre:
   `http://127.0.0.1:8787/api/oauth/spotify/callback`
   (a porta segue a do coletor — `:8787` em produção/instalado, `:8788` em `./dev up`; o painel mostra a URI exata no fold "Credenciais do Spotify"). O Spotify aceita `http://127.0.0.1:<porta>/...` sem HTTPS para apps rodando localmente — é uma exceção documentada nas [regras de Redirect URI](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
3. Em **Which API/SDKs are you planning to use?**, marque **Web API**.
4. Salve e abra **Settings** do app para pegar o **Client ID** e o **Client Secret** (botão "View client secret").
5. Cole os dois no fold **Credenciais do Spotify** da seção Outros do painel.
6. **Entrar com Spotify** — o coletor grava o `refresh_token`. O callback **não** pode ser o Vite (`:5173`) nem `/display/alarms`.
7. Você precisa ter o **Spotify aberto em algum aparelho** (celular, desktop, alto-falante) tocando alguma coisa para os comandos funcionarem — a API do Spotify não liga o player sozinha num dispositivo do zero.
8. Conta **Spotify Free** funciona para consultar "tocando agora", mas os endpoints de controle (`play`/`pause`/`next`/`previous`) exigem **Spotify Premium** (limitação da própria API, não do painel).

## Endpoints usados pelo coletor

Estado de reprodução:

```
GET https://api.spotify.com/v1/me/player
Authorization: Bearer <access>
```

Comandos (sem corpo, `204 No Content` em caso de sucesso):

```
PUT  https://api.spotify.com/v1/me/player/play
PUT  https://api.spotify.com/v1/me/player/pause
POST https://api.spotify.com/v1/me/player/next
POST https://api.spotify.com/v1/me/player/previous
```

Se não houver dispositivo Spotify ativo, esses endpoints devolvem `404` — o coletor traduz isso para "Nenhum dispositivo Spotify ativo — abra o Spotify em algum aparelho...".

## OAuth no coletor

| Rota | Papel |
| --- | --- |
| `GET /api/oauth/spotify/start?return_to=` | Devolve `{ url }` do login Spotify. `return_to` só `http://127.0.0.1\|localhost` + path `/display…`. |
| `GET /api/oauth/spotify/callback` | Troca o `code` pelo `refresh_token` e redireciona para o painel com `?spotify=ok\|denied\|error`. |
| `POST /api/oauth/spotify/disconnect` | Apaga o `refresh_token` (mantém Client ID/Secret). |

State OAuth vive em memória (TTL 10 min). Reiniciar o coletor no meio do login invalida o callback.

## Dados e comandos do card

| Rota | Papel |
| --- | --- |
| `GET /api/spotify` | Estado atual: `is_playing`, `progress_ms`, `track` (nome, artistas, álbum, capa, duração), `configured`. |
| `POST /api/spotify/play` \| `/pause` \| `/next` \| `/previous` | Comandos do player. `{ ok: false, error }` quando falta login ou não há dispositivo ativo. |

O access token fica em cache em memória (renovado pouco antes de expirar) para não bater no endpoint de token do Spotify a cada poll de 5s do card.

## O que a tela mostra

Capa do álbum, título, artista e (nos tamanhos maiores) barra de progresso + álbum, com botões **anterior / play-pause / próxima**. Sem login: mensagem para conectar em Configurações. Sem nada tocando: "Nada tocando". Adicione o card em `/display` pelo botão **Adicionar widget → Spotify** — ele só aparece depois de conectado.
