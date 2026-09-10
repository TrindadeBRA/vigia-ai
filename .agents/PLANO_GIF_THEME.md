# Plano — GIF (Giphy) como fundo animado do tema, com animação real na ESP32

Decisão tomada com o usuário (2026-09-10): quer animação de verdade rodando
na placa física (poucos frames, fps baixo) — não só o preview animado no
navegador. Ver seção "Risco principal" pra números concretos de flash/RAM
que sustentam esse "poucos frames, fps baixo".

## Estado atual (o que já existe, não precisa reconstruir)

- **Giphy já está integrado no coletor**, só que só é usado hoje pelo card
  de imagem do `/display` (`ImageWidgetModal.tsx`), não pelo editor de tema:
  - Key em `config.json` → `wallpapers.providers.giphy_key`, card próprio em
    `WallpaperProvidersConfigCard.tsx`.
  - Busca: `GET /api/wallpapers/search/giphy?q=&page=&per_page=` já existe
    em `backend/src/routers/wallpapers/router.ts:472` (chama
    `api.giphy.com/v1/gifs/search`, devolve `type: "gif"` com `thumb` fixo e
    `full` = GIF original animado).
  - `ImageWidgetModal` (o "card de imagem" citado) usa o resultado da busca
    **direto como URL** (`handlePickSearch` → `<img src={item.full}>`) — não
    passa pelo pipeline de conversão. Como é renderizado no navegador
    (`/display`, board web), o GIF **já anima sozinho** ali, de graça (é só
    um `<img>`). **Isso não precisa de nenhuma mudança.**
- **O editor de tema (`/display/theme` → `ThemeEditorPage.tsx` +
  `wallpaperManager/Library.tsx`) só busca Wallhaven/Pexels/Unsplash** —
  Giphy não aparece na lista de provedores de busca ali
  (`Library.tsx:129-131`). É o primeiro gap a fechar.
- **Import de wallpaper (`POST /api/wallpapers/import`) já aceita
  `provider: "giphy"`** (`router.ts:517,532`) mas o pipeline de conversão
  (`imageToRaw` em `rgb565.ts`, via Jimp) só lê **1 frame** — hoje, importar
  um GIF do Giphy como papel de parede do tema vira fundo estático (perde a
  animação). Isso é o segundo gap.
- **Fundo do tema na placa hoje = 1 frame estático**, RAW RGB565, resolução
  = metade da tela (`customThemeCanvasWidth/Height()`), gravado em
  `LittleFS:/theme_bg.raw` (ou em RAM se não montar — só no Wokwi, capado em
  `kBgRamCapMax = 200000` bytes — `firmware/src/ui/customtheme.cpp:448`).
  Repintura do fundo só acontece quando `g_bgDirty` (mudou de tema) — ver
  `customThemeTickClock()`: só repinta a tela **1x por minuto** (troca do
  relógio), não tem tick de frame. **Isso precisa de um ticker novo.**
- Contrato completo do fluxo hoje: `.agents/CONTRATO_TEMA.md` (ler antes de
  mexer — qualquer mudança de contrato tem que atualizar esse doc também,
  por regra do próprio arquivo).

## Objetivo

1. Buscar/escolher um GIF do Giphy dentro do editor de tema (`/theme`),
   igual à experiência que já existe no card de imagem do `/display`.
2. Preview do GIF **animado** no editor (trivial — é `<img>`/navegador).
3. A ESP32 física baixa uma sequência de frames reduzida do GIF escolhido e
   **anima de verdade** a `VIEW_THEME`, em loop, com ícones/relógio/texto
   desenhados por cima a cada frame.

## Risco principal — por que "poucos frames, fps baixo" é a única opção viável

Números reais do projeto, não estimativa solta:

- Partição `spiffs` (LittleFS) da placa: **896 KB** total
  (`huge_app.csv: spiffs, 0xE0000` = 917504 bytes) — e é o **único**
  storage on-device; ícones já vêm embutidos no binário (`PROGMEM`), então
  sobra quase tudo isso pro tema, mas não é ilimitado.
- Resolução atual do fundo estático = metade da tela: **240×160** no
  hardware real (480×320 ILI9488), **160×120** no Wokwi (320×240 ILI9341).
  Um frame nessa resolução já é 76.800 bytes (hw) / 38.400 bytes (Wokwi).
  Guardar 10-16 frames **nessa** resolução (768 KB–1,2 MB) estoura a
  partição inteira sozinho. **Precisa de uma resolução de animação menor
  que a do fundo estático.**
- No Wokwi o LittleFS **não monta** (`fs_ok: false`, confirmado no próprio
  código) — lá o fundo cai no fallback de RAM, capado em **200.000 bytes**
  (`kBgRamCapMax`). Isso é ainda mais apertado que a flash da placa real.
- SPI é lento: o fundo estático já faz upscale nearest-neighbor linha a
  linha (`drawThemeBackground()`); repintar a tela inteira em loop, todo
  frame, compete no mesmo `loop()` com mineração/câmera/Wi-Fi
  (`main.cpp:82-117`, ciclo com `delay(20)` mas outras tarefas dentro do
  mesmo laço). Fps alto não é realista.

**Decisão de design**: resolução de animação = **metade da resolução do
fundo estático** (ou seja, um quarto da tela cheia) — **120×80** no
hardware, **80×60** no Wokwi. Frame = 120×80×2 = **19.200 bytes** (hw) /
80×60×2 = **9.600 bytes** (Wokwi).

Com `MAX_ANIM_FRAMES = 12`:
- Hardware: 12 × 19.200 = **230.400 bytes** (~225 KB) — folga confortável
  dentro dos 896 KB da partição, sobra espaço pro `theme.json`, overhead do
  próprio LittleFS e o fundo estático (se o usuário tiver um também
  guardado — mas só um fica ativo por vez, ver "Arquitetura" abaixo).
- Wokwi (fallback RAM): 12 × 9.600 = **115.200 bytes** — cabe dentro do
  cap de 200.000 bytes com folga. Fora do fallback de RAM não precisa mudar
  nada — mesmo mecanismo que já existe pro fundo estático, só reaproveitado.

Fps: delay uniforme entre frames (não por-frame, ver "Fora do MVP") clamped
em **150–600 ms** (≈1,7–6,7 fps) — na faixa que a placa consegue sustentar
sem travar o resto do `loop()`. É visivelmente mais "stop motion" que um
GIF de navegador, mas é o que cabe no orçamento de flash/RAM/SPI real.

## Arquitetura da mudança

```
Frontend (/theme)                 Backend (coletor)                    Firmware (ESP32)
─────────────────                 ──────────────────                   ────────────────
wallpaperManager/Library.tsx  →   POST /api/wallpapers/import      →   theme.json (via /theme/meta)
  + aba "Giphy" (busca)             detecta GIF animado                 background.type = "gif"
  + preview animado (<img>)         extrai N frames (gifuct-js)         background.frame_count
                                     reduz p/ 120x80 (hw) / 80x60 (wk)   background.frame_delay_ms
                                     grava <id>_anim.raw (hw)
                                     grava <id>_anim_wokwi.raw

                               GET /api/theme/background/anim     →   customThemeBeginAnimWrite()
                                 (novo, análogo ao /background)        /theme_bg_anim.raw (LittleFS)
                                                                        ou RAM (fallback Wokwi, mesmo
                                                                        padrão do g_bgRam atual)

                                                                        customThemeTickAnimation()
                                                                        (novo, chamado no loop() —
                                                                        rate-limited por millis() e
                                                                        frame_delay_ms do theme.json)
                                                                        → avança frame, força redraw
                                                                        do fundo + ícones/relógio/texto
                                                                        por cima (mesmo `paintCustomHome`,
                                                                        só ignorando g_bgDirty)
```

### Backend

- **Novo módulo** `backend/src/routers/wallpapers/gif.ts`:
  - `extractGifFrames(bytes: Buffer, maxFrames: number, targetW: number, targetH: number): Promise<{ frames: Buffer[]; delayMs: number }>`.
  - Usa **`gifuct-js`** (pura JS, sem binário nativo — mesma filosofia do
    Jimp já documentada em `PLANO_NODE.md §2.3`) pra decodificar o GIF
    **com composição de disposal method correta** (frame a frame "cru" sem
    compor dá quadro corrompido em GIFs que usam disposal `restore to
    background`/`previous` — não dá pra pular essa parte).
  - Amostragem: se o GIF-fonte tem mais frames que `MAX_ANIM_FRAMES`,
    escolhe **frames igualmente espaçados** ao longo da linha do tempo
    total (não só os primeiros N) — preserva o "formato" do loop.
    `delayMs` final = duração total do GIF-fonte / número de frames
    escolhidos, clampado em 150–600 ms.
  - Cada frame composto (RGBA) reaproveita a mesma aritmética de conversão
    pra RGB565 que já existe em `rgb565.ts` (`cover` resize + pack
    RGB565) — extrair isso pra uma função utilitária compartilhada
    (`packRgba565`) chamada tanto por `imageToRaw` quanto pelo novo
    `extractGifFrames`, em vez de duplicar a fórmula de bits.
- **`POST /api/wallpapers/import`**: detectar GIF animado (assinatura de
  bytes `47 49 46 38` / content-type, e mais de 1 frame decodificado) e, só
  nesse caso, além do fluxo estático de sempre (mantém `<id>.raw`/
  `<id>_wokwi.raw`/`<id>.jpg` como fallback pra placas que não têm suporte
  de firmware novo — ver "Compatibilidade"), gerar também
  `<id>_anim.raw` (12×19.200 bytes) e `<id>_anim_wokwi.raw` (12×9.600
  bytes), e marcar no `wallpapers.json` os campos novos: `kind: "gif"`,
  `frame_count`, `frame_delay_ms`.
  - Preferir a variante `images.fixed_height` ou `images.downsized` do
    resultado do Giphy (não `original`) como `image_url` de import — já
    reduzimos pra 12 frames minúsculos, baixar o GIF original em alta
    resolução é desperdício de banda/tempo de decode.
- **`backend/src/routers/theme.ts`**: nova rota `GET
  /api/theme/background/anim` (mesmo padrão de `screenSuffix()` já usado em
  `GET /api/theme/background`) servindo `<id>_anim.raw` ou
  `<id>_anim_wokwi.raw` do wallpaper selecionado; `404` se o selecionado não
  for `kind: "gif"`.
- **`patchThemeBackgroundType`**: passa a aceitar `"gif"` além de
  `"image"`/`"color"`, e escrever `frame_count`/`frame_delay_ms` no
  `theme.json` junto (`background.type`, `background.frame_count`,
  `background.frame_delay_ms`).
- Nova dependência: `gifuct-js` em `backend/package.json`.

### Firmware

- `firmware/src/ui/customtheme.h`/`.cpp`:
  - `customThemeCanvasAnimWidth()`/`Height()` — `tft.width()/4`,
    `tft.height()/4` (arredondado pra baixo, mesmo padrão de
    `customThemeCanvasWidth/Height()` atual).
  - `customThemeBeginAnimWrite()` / `customThemeWriteAnimChunk()` /
    `customThemeEndAnimWrite(bool ok)` — mesmo padrão de streaming em
    blocos que já existe pro fundo estático (`kBgPath` →
    `/theme_bg_anim.raw`), reaproveitando o fallback de RAM
    (`g_bgRam`/`kBgRamCapMax`) já existente pro caso do Wokwi.
  - Validação de tamanho: `frame_count * animW * animH * 2` (frame_count
    vem do `theme.json` já aplicado — meta sempre chega **antes** do
    upload de imagem, mesma ordem que o fluxo estático já assume hoje).
  - `customThemeTickAnimation()` (nova função, chamada em `loop()` — ver
    `main.cpp:82-117`, ao lado de `uiTickClock()`): só ativa quando
    `background.type == "gif"`; usa `millis()` internamente pra respeitar
    `frame_delay_ms` sem bloquear o resto do loop; ao disparar, avança
    `g_animFrameIdx = (g_animFrameIdx + 1) % frame_count` e chama uma
    variante de `paintCustomHome()` que **sempre** redesenha o fundo
    (ignora `g_bgDirty`) lendo o frame atual de `/theme_bg_anim.raw`
    (`seek` pro offset `idx * frameBytes`) ou do buffer de RAM, com upscale
    nearest-neighbor 4x (generalizar a lógica de `drawThemeBackground()`,
    que hoje faz 2x fixo, pra aceitar um fator de escala).
- `firmware/src/net/theme_server.cpp`: rota espelho
  `POST /theme/background/anim` (debug, direto na placa) igual a
  `/theme/background` hoje, só apontando pro trio de funções de anim.
- `firmware/src/net/client.cpp` (`themeClientReload()`/`themeClientTick()`):
  quando `GET /api/theme` reporta `background.type == "gif"`, buscar também
  `GET /api/theme/background/anim` (com o mesmo header
  `X-Vigia-Screen`/query já usado) e aplicar via
  `customThemeBeginAnimWrite()`/etc. — mesmo formato de chamada que já
  existe pro fundo estático, só endpoint novo.

### Frontend

- `frontend/src/pages/config/wallpaperManager/Library.tsx`: adicionar
  `"giphy"` à lista de provedores de busca (`Library.tsx:129-131`, mesmo
  padrão de `providers?.giphy.configured` que `ImageWidgetModal.tsx` já
  usa) — reaproveita a mesma rota `GET /api/wallpapers/search/giphy` que já
  existe, backend não muda aqui.
- **Extrair um componente compartilhado** de grid de resultados de busca
  (hoje duplicado quase igual entre `ImageWidgetModal.tsx` e
  `Library.tsx`) pra não copiar a UI de card+thumb+"Usar" pela segunda vez
  — ex. `frontend/src/components/ProviderSearchGrid.tsx`, usado pelos dois.
- No item de resultado Giphy (e nos itens já importados como `kind: "gif"`
  na biblioteca), mostrar um selo "GIF" e, ao selecionar, deixar claro que
  a placa física vai reproduzir **N frames** reduzidos (não o GIF completo)
  — evita expectativa de "vai ficar idêntico ao navegador".
- `ThemeCanvasView.tsx`/preview do editor: se `background.type === "gif"`,
  usar a URL original do Giphy (`image_url`/`preview_url` guardado no
  wallpaper) como `<img>`/`background-image` do preview — anima sozinho no
  navegador, sem trabalho extra.
- Textos novos em `themeCopy.ts`/`i18n.ts` (pt/en/es): aba "Giphy", aviso
  de N frames/fps reduzido na placa, selo "GIF".

## Contrato (`.agents/CONTRATO_TEMA.md`) — o que precisa ser atualizado

Regra do próprio doc: mudar o contrato = atualizar esse arquivo **e**
`customtheme.cpp` **e** `backend/src/routers/theme.ts` **e**
`ThemeEditorPage.tsx` juntos. Seções a adicionar/editar:

- `background.type`: incluir `"gif"` como terceiro valor.
- Novos campos `background.frame_count` (int, 2–12) e
  `background.frame_delay_ms` (int, 150–600).
- Nova seção "Imagem de fundo animada" (espelhando a seção "Imagem de
  fundo" existente): resolução = **um quarto** da tela (não metade),
  fórmula de tamanho esperado, formato RAW RGB565 idêntico ao estático mas
  concatenado por frame, ordem sequencial.
- Tabela de rotas do coletor: `GET /api/theme/background/anim`.
- Tabela de rotas da placa: `POST /theme/background/anim`.
- "Limites conhecidos": adicionar o teto de 12 frames / 150–600ms, e que
  fps real sustentado depende de quanto o resto do `loop()` (mineração/
  câmera) está ocupado no momento — não é garantido.

## Compatibilidade com tema salvo hoje

- Wallpaper `kind: "static"` (tudo que já existe hoje, e qualquer import
  não-GIF novo) continua funcionando **sem nenhuma mudança** — o campo
  `kind` é novo e default pra `"static"` em wallpapers antigos
  (`wallpapers.json` sem esse campo).
- Se o usuário importar um GIF mas a build de firmware na placa ainda for
  antiga (sem suporte a `/theme/background/anim`), o campo
  `background.type: "gif"` no `theme.json` seria desconhecido pro firmware
  antigo — **decisão**: manter também `<id>.raw`/`<id>_wokwi.raw` (1 frame,
  igual hoje) gerados no import de GIF, e o firmware antigo simplesmente
  ignora `type: "gif"` como se fosse tipo desconhecido → cai pra
  `background.color` (mesmo comportamento documentado hoje pra
  `background.type` inválido/ausente). Sem crash, só sem animação até
  atualizar o firmware.

## Passos de implementação (ordem sugerida)

1. Backend: `packRgba565` compartilhado + `gifuct-js` + `extractGifFrames`
   + testes unitários (frame count, amostragem uniforme, clamp de delay).
2. Backend: `POST /api/wallpapers/import` gera variantes `_anim`/`_anim_wokwi`
   quando o source é GIF animado; `wallpapers.json` ganha `kind`/
   `frame_count`/`frame_delay_ms`.
3. Backend: `GET /api/theme/background/anim` em `theme.ts`;
   `patchThemeBackgroundType` escreve os campos novos no `theme.json`.
4. Frontend: aba Giphy em `Library.tsx` (reusa rota de busca existente);
   componente de grid compartilhado com `ImageWidgetModal.tsx`; preview
   animado + selo "GIF"; textos i18n.
5. Firmware: `customThemeCanvasAnimWidth/Height`,
   `customThemeBeginAnimWrite`/write/end, leitura com seek por frame,
   generalizar upscale pra fator 4x.
6. Firmware: `customThemeTickAnimation()` chamado em `main.cpp` `loop()`;
   `theme_server.cpp` rota debug `/theme/background/anim`;
   `net/client.cpp` busca a variante anim quando `type == "gif"`.
7. Atualizar `.agents/CONTRATO_TEMA.md` com as seções novas.
8. Testes manuais: hardware real primeiro (é o caso que importa — Wokwi não
   monta LittleFS, então a animação lá sempre cai no fallback de RAM, mais
   apertado); confirmar fps real sustentado com mineração/câmera ativos ao
   mesmo tempo (pior caso de contenção do `loop()`).

## Fora do MVP (não implementar sem pedido explícito)

- Delay **por frame** fiel ao GIF original (fica uniforme — 1 valor pra
  sequência inteira) — GIFs do Giphy raramente têm timing crítico, e por-
  frame custaria 2 bytes/frame + lógica extra pra ganho perceptível baixo.
- GIFs com mais de 12 frames-fonte re-samplados com mais fidelidade
  (ex. otimização de qual frame escolher por diferença visual) — amostragem
  uniforme por tempo é suficiente pro MVP.
- Fundo animado no board web do `/display` (`GridWallpaperModal.tsx`/
  `useGridWallpaper.ts`) — hoje ele renderiza a **preview JPEG estática**
  (`gridWallpaperUrl`), não o GIF original; deixar animado ali seria trivial
  (trocar preview por `original_url` quando `kind === "gif"`) mas é uma
  superfície diferente da pedida (`/theme` + ESP32) — vira um follow-up
  separado se for pedido.
- Cache/CDN de GIFs do Giphy, paginação avançada, favoritos — segue exatamente
  o padrão que Wallhaven/Pexels/Unsplash já têm hoje, nada novo aqui.
- Upload de GIF arbitrário do usuário (fora da busca Giphy) como fundo
  animado — o pipeline (`extractGifFrames`) funciona pra qualquer GIF, mas
  a UI de upload de wallpaper hoje é só imagem estática; adicionar aceitação
  de `.gif` no upload é natural de estender depois, não bloqueia o MVP do
  Giphy.

## Riscos conhecidos

- **Contenção de CPU/SPI no `loop()`**: com mineração e/ou câmera ativos,
  o fps real da animação pode cair bem abaixo do `frame_delay_ms`
  configurado — é best-effort, documentar isso na UI (aviso já mencionado
  acima) e no contrato, não prometer fps fixo.
- **Escrita repetida em LittleFS**: cada troca de fundo animado regrava
  ~225 KB na flash — sem problema de desgaste em uso normal (troca de tema
  não é uma operação de alta frequência), mas vale não fazer isso em
  polling automático (mesma regra que já vale pro fundo estático — só
  troca no recarregar manual).
- **Rate limit da API do Giphy**: mesma politica que já existe pro
  Pexels/Unsplash (falha da busca vira erro visível, sem retry automático
  agressivo) — nada novo pra desenhar aqui.
- **`gifuct-js` é dependência nova** — validar que builda sem módulo nativo
  (mesma exigência que levou o projeto a escolher Jimp puro-JS) antes de
  travar a escolha.
