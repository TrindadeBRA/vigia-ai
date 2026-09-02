# Contrato do tema personalizado (protótipo)

Protótipo, fora do fluxo normal do coletor — placas sem tema custom
continuam funcionando exatamente como antes, e isso não tem relação com
`CONTRATO_JSON.md` (`/usage`).

Mudar este contrato = atualizar este doc, `firmware/src/ui/customtheme.cpp`,
`backend/app/routers/theme.py` **e** `frontend/src/pages/config/ThemeEditorPage.tsx`.

## Como o tema chega na placa (fluxo principal)

1. **Painel web → coletor**: `frontend/.../ThemeEditorPage.tsx` monta o tema
   e manda pro **coletor** (`POST /api/theme/meta` + `POST /api/theme/background`,
   mesma origem do painel — sem CORS, sem precisar saber o IP da placa).
2. **Coletor guarda**: `backend/app/routers/theme.py` só persiste os bytes
   (`backend/data/theme.json` + `backend/data/theme_bg.raw`, gitignored) —
   não entende o schema, é opaco pro coletor.
3. **Placa → coletor**: o usuário toca o ícone de recarregar (seta pra
   baixo) no header da placa, logo abaixo do ícone de relógio — só existe no
   header vertical (esquerda/direita). Isso chama
   `firmware/src/net/client.cpp:themeClientReload()`, que faz
   `GET <origem do USAGE_URL>/api/theme` (+ `/api/theme/background` se
   houver) e aplica via `ui/customtheme.h`.
4. **Tela dedicada**: aplicar um tema (por esse pull ou pelo `POST /theme/meta`
   direto na placa, abaixo) sempre troca pra `VIEW_THEME`
   (`core/state.h`) — uma view **nova**, tela cheia, **sem** o header/menu da
   firmware. Não substitui a Início. Qualquer toque ou swipe nela volta pra
   Início (mesmo padrão da `VIEW_NOW`).

## Servidor HTTP da placa (porta 80, opcional/debug)

Além do fluxo acima, a placa também escuta HTTP na **porta 80**
(`firmware/src/net/theme_server.cpp`) com as mesmas rotas `/theme/*` — útil
pra mandar um tema **direto** (sem passar pelo coletor) e pra depuração
visual (`GET /theme/screenshot`). O coletor guarda o último IP que falou com
ele (`GET /usage`/`GET /events`) só pra pré-preencher esse campo de IP no
painel (`device` em `GET /api/config`, ver `backend/app/schemas.py:DevicePublic`) —
`GET /events` também é consumido pelo `/display` (SSE do mostrador), então o
firmware manda um header `X-Vigia-Device: esp32` nesses dois requests
(`firmware/src/net/client.cpp`) pro coletor não confundir o navegador do
usuário com a placa (`backend/app/routers/usage.py`). Não é autenticação.

Junto com esse header, a placa também manda `X-Vigia-Screen: <largura>x<altura>`
(`tft.width()`/`height()`) — o coletor guarda em `device.width`/`device.height`
(`GET /api/config`) e o editor usa isso pra acertar a resolução do fundo
**sozinho**, sem precisar do IP (`ThemeEditorPage.tsx`, efeito que observa
`cfg.device.width/height`). O IP só é necessário pro card de depuração
(envio direto pra placa e `GET /theme/screenshot`).

LAN only, igual ao resto do projeto: não exponha essa porta na internet.

## Coordenadas

`x`/`y` são **frações 0.0–1.0** da tela **inteira** (`VIEW_THEME` não tem
header) — não pixels. Isso resolve a diferença de resolução entre o
hardware real (480×320, ILI9488) e o Wokwi (320×240, ILI9341): o firmware
sempre converte fração → pixel na hora de desenhar, contra
`tft.width()`/`height()` atuais.

## `theme.json`

```json
{
  "version": 1,
  "background": { "type": "color", "color": "#10151A" },
  "clock": { "enabled": true, "x": 0.5, "y": 0.16, "scale": 2, "format24h": true, "color": "#F7F7F7", "showBackground": true, "autoColor": false },
  "icons": [
    { "provider": "claude", "x": 0.25, "y": 0.55, "scale": 1.5, "color": "#E1C6A0" },
    { "provider": "brand", "x": 0.75, "y": 0.55, "scale": 1.0 }
  ],
  "texts": [
    { "text": "VIGIA AI", "x": 0.5, "y": 0.85, "scale": 1, "color": "#AD76FF" }
  ]
}
```

- `background.type`: `"color"` ou `"image"` (a imagem é o que foi mandado em
  `.../theme/background` — se não existir ou o tamanho não bater com a
  resolução atual da placa, cai pra `background.color`).
- `background.color`, `clock.color`, `icons[].color`, `texts[].color`: hex
  `#RRGGBB` opcional (omitido ou inválido = cor padrão do tema/tela).
- `clock.showBackground`: `boolean` (default `true`) — quando `false`, o relógio é desenhado sem o retângulo de fundo (transparente).
- `clock.autoColor`: `boolean` (default `false`) — quando `true`, a cor do texto do relógio é calculada automaticamente via `generateReadableColor` sobre `background.color` (WCAG AA 4.5:1), ignorando `clock.color`.
- `scale`: multiplicador de tamanho, clamp **0.5–4.0**.
- `icons[].provider`: `claude` | `gpt` | `cursor` | `openrouter` | `deepseek`
  | `opencode` | `fal` | `weather` | `brand` (o olho da marca). Item com provider
  desconhecido é ignorado, o resto do tema continua válido.
- Limites: até **8** ícones, até **4** textos (`texts[].text` até 23 chars) —
  o excesso é descartado silenciosamente.
- JSON inválido → erro, tema anterior **não** é alterado.

## Imagem de fundo

RAW **RGB565 little-endian** (2 bytes por pixel, sem cabeçalho), exatamente
`width * height * 2` bytes onde `width`/`height` são **metade** da
resolução da tela, arredondada pra baixo (240×160 no hardware real 480×320,
160×120 no Wokwi 320×240) — a placa desenha com upscale 2x nearest-neighbor
(`customThemeCanvasWidth/Height()` + `drawThemeBackground()` em
`ui/customtheme.cpp`).

Por quê: um fundo em resolução cheia (480×320×2 ≈ 300 KB, ou 320×240×2 ≈
150 KB no Wokwi) não cabe num bloco **contíguo** de heap depois do
WiFi/HTTPClient já terem fragmentado a RAM — confirmado no Wokwi (182 KB
"livres" no total, só ~110 KB no maior bloco alocável). Ícones, relógio e
texto continuam com posição fracionária contra a tela **cheia**
(`tft.width()`/`height()` direto) — só o fundo usa essa resolução reduzida.
`GET /theme` (na placa) sempre reporta a tela cheia em `width`/`height` (pra
não confundir o editor, que usa isso pra posicionar/dimensionar os outros
elementos) — o `ThemeEditorPage.tsx` divide por 2 sozinho na hora de
converter a imagem.

Conversão no browser (`ThemeEditorPage.tsx`): `<canvas>` faz o crop/resize
"cover" pra `width`×`height` (já na metade), e cada pixel RGBA vira

```ts
const v = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
bytes.push(v & 0xff, (v >> 8) & 0xff); // little-endian
```

— a mesma convenção dos ícones `PROGMEM` do firmware (ver
`firmware/src/ui/widgets.cpp:drawIcon`, que já usa `setSwapBytes(true)` pra
esse formato).

## Rotas do coletor (`backend/app/routers/theme.py` + `wallpapers.py`)

| Rota                                                       | O que faz                                                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/theme`                                           | `{ "active": bool, "theme": "<json ou null>", "has_background": bool, "slideshow": { "enabled", "interval", "order", "count" } }` |
| `POST /api/theme/meta`                                     | corpo = `theme.json` cru (`Content-Type` qualquer, máx. 8 KB)                                                                     |
| `POST /api/theme/background`                               | `multipart/form-data`, campo `bg` (máx. ~400 KB) — legado, ainda funciona                                                         |
| `GET /api/theme/background`                                | bytes RAW, `application/octet-stream`, `404` se não houver. Se slideshow ativo, retorna o wallpaper atual (round-robin por tempo) |
| `GET /api/theme/background/index`                          | `{ "enabled", "index", "count", "interval", "current_id", "order" }` — índice atual do slideshow                                  |
| `DELETE /api/theme`                                        | apaga os dois arquivos                                                                                                            |
| `GET /api/wallpapers`                                      | `{ "wallpapers": [...], "slideshow": {...}, "providers": {...}, "count" }`                                                        |
| `GET /api/wallpapers/slideshow`                            | config do slideshow                                                                                                               |
| `PUT /api/wallpapers/slideshow`                            | `{ "enabled": bool, "interval": 1-120, "order": string[] }`                                                                       |
| `GET /api/wallpapers/providers`                            | status dos provedores                                                                                                             |
| `PUT /api/wallpapers/providers`                            | `{ "pexels_key"?, "unsplash_key"?, "wallhaven_key"? }`                                                                            |
| `POST /api/wallpapers/upload`                              | `multipart/form-data` campo `file` (JPEG/PNG ou RAW)                                                                              |
| `DELETE /api/wallpapers/{id}`                              | remove wallpaper                                                                                                                  |
| `GET /api/wallpapers/{id}/preview`                         | JPEG preview                                                                                                                      |
| `GET /api/wallpapers/{id}/raw?w=&h=`                       | RAW do wallpaper (resolução via query ou header `X-Vigia-Screen`)                                                                 |
| `GET /api/wallpapers/search/{provider}?q=&page=&per_page=` | busca em `pexels`/`wallhaven`/`unsplash`                                                                                          |
| `POST /api/wallpapers/import`                              | `{ "provider", "id", "image_url", "thumb" }` — baixa, converte e salva                                                            |

Não valida o schema do `theme.json` — é opaco pro coletor (quem valida é a
placa ao aplicar, e o painel ao montar).

### Slideshow

- O usuário configura 1+ wallpapers e um intervalo de 1–120 minutos.
- O coletor calcula o índice atual como `floor(now / (interval*60)) % count` — determinístico, sem estado.
- `GET /api/theme/background` já retorna o wallpaper correto automaticamente quando slideshow ativo.
- A placa faz polling em `GET /api/theme/background/index` a cada 30s (`themeClientPollSlideshow()` em `net/client.cpp`) e só baixa o novo fundo quando o índice muda.
- Wallpapers são armazenados em `data/wallpapers/` como RAW RGB565 em duas resoluções (240×160 hardware + 160×120 wokwi) + JPEG preview + original.

### Provedores externos

| Provedor      | Base                                     | Auth                                         | Notas                                                  |
| ------------- | ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| **Wallhaven** | `https://wallhaven.cc/api/v1/search`     | Opcional (`X-API-Key`)                       | Sem key funciona para SFW; com key libera NSFW/sketchy |
| **Pexels**    | `https://api.pexels.com/v1/search`       | Obrigatória (`Authorization: KEY`)           | Só disponível se usuário fornecer key                  |
| **Unsplash**  | `https://api.unsplash.com/search/photos` | Obrigatória (`Authorization: Client-ID KEY`) | Só disponível se usuário fornecer key                  |

Chaves ficam em `config.json` → `wallpapers.providers.{pexels_key,unsplash_key,wallhaven_key}` (gitignored, nunca expostas no `GET /api/config`).

## Rotas da placa (`firmware/src/net/theme_server.cpp`, porta 80)

| Rota                     | O que faz                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /theme`             | `{ "width", "height", "active", "fs_ok", "theme" }` — resolução = tela inteira                                                                                                                                                                                                                                                                                                                                                           |
| `POST /theme/meta`       | mesmo corpo do coletor; aplica na hora (`VIEW_THEME`)                                                                                                                                                                                                                                                                                                                                                                                    |
| `POST /theme/background` | `multipart/form-data`, campo `bg`, streamado direto (nunca bufferiza os ~300 KB em RAM) via `HTTPUpload`                                                                                                                                                                                                                                                                                                                                 |
| `DELETE /theme`          | apaga o tema, desliga `VIEW_THEME`                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /theme/screenshot`  | BMP 24 bits da tela **de verdade**, lida pixel a pixel via SPI (`tft.readRectRGB`, precisa do `MISO` ligado — ver `docs/HARDWARE.md`). Lento (alguns segundos) e bloqueia o `loop()` enquanto captura — só pra depuração manual, nunca automático. **Não funciona no Wokwi** (o simulador não emula leitura de pixel por SPI, só escrita) — use a janela do próprio simulador pra conferir visualmente lá; a rota vale pra placa física. |

CORS: toda resposta leva `Access-Control-Allow-Origin: *`. `OPTIONS`
responde `204` (preflight do `application/json` e do `DELETE`; o
`multipart/form-data` do upload de imagem e o `GET` do screenshot não
disparam preflight).

### Achar o IP da placa pra usar essas rotas direto

- **Hardware real**: o painel pré-preenche sozinho (`device.ip` em
  `GET /api/config`) assim que a placa fala com o coletor.
- **Wokwi**: o `wokwigw` (usado por `./dev wokwi`) já expõe a porta 80 da
  placa simulada em **`127.0.0.1:9080`** por padrão (forward embutido, sem
  configuração extra — confirmado rodando `wokwigw --help`/sem flags e
  olhando o log "Port forwards"). Completa a porta à mão nesse caso: o
  coletor só reporta `127.0.0.1` (não sabe a porta), e o painel avisa
  quando o IP é loopback sem porta (`isBareLoopback` em
  `ThemeEditorPage.tsx`).

## Limites conhecidos (protótipo)

- Só `VIEW_THEME` (a tela nova) usa o tema — as demais views (Início,
  Claude, GPT, Status etc.) continuam com o layout de sempre.
- O botão de recarregar no header só existe no header **vertical**
  (esquerda/direita) — no horizontal a barra já é apertada demais pra mais
  um ícone.
- Só os 7 ícones de provedor + a marca — sem upload de ícone/PNG arbitrário.
- Relógio mostra só `HH:MM` (sem segundos) e repinta a tela inteira 1x por
  minuto — sem blitting parcial.
- No Wokwi, o LittleFS não monta (`fs_ok: false`) — o tema (JSON pequeno e a
  imagem de fundo, já em meia resolução — ~38 KB no Wokwi, ~77 KB no
  hardware real, ver seção "Imagem de fundo" acima) fica só em RAM pra
  sessão atual; reiniciar o simulador perde o tema (mas o botão de
  recarregar busca de novo do coletor, que persiste em disco no host).
- Corpo do `POST /theme/meta` direto na placa é bufferizado inteiro em RAM
  pelo `WebServer` (`arg("plain")`) antes de chegar no handler — por isso o
  limite de 8 KB.
