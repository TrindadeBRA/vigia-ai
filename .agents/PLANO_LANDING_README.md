# Plano — revisão da landing page e do README

Escopo: `docs/index.html` (landing page, GitHub Pages) e `README.md` (landing
page do repo no GitHub). Objetivo do usuário: atualizar a copy com as
features novas, trocar mock/diagramas por fotos reais do device onde fizer
sentido, e deixar a instalação **Mac/Linux/Windows** clara e em destaque —
hoje isso está fraco na landing page.

Não implementar ainda — este arquivo é só o plano, pra alinhar antes de mexer.

## Diagnóstico (por que revisar agora)

### 1. Landing page ficou 4 minor versions atrás

`docs/index.html` foi editado pela última vez no commit `70c596b`
(2026-09-08, ~v2.9/2.10). A versão atual é **2.13.8** (`desktop/package.json`,
`frontend/package.json`, `backend/package.json`). O banner "NOVIDADES" ainda
diz **"v2.4 → v2.9"**. Já existe cobertura de Git/GitHub/RetroAchievements/
Calendário/RSS/Clima/Moedas/ISS/Spotify/YouTube Music/Câmera/Android/
Emulador/Mineração/Sistema/Wallpapers/Notas/Imagens — isso está OK. Falta o
que entrou depois (`git log b5f200d..HEAD`, excluindo bumps de versão):

- **Fundos animados (GIF) no editor de tema** (`bd6b7f3`) — wallpaper GIF
  vira quadros RAW RGB565 pra placa.
- **Integração GitHub reforçada**: cards de repositório e perfil separados no
  painel, tratamento de erro melhor, schemas/SSE dedicados (`cce505b`,
  `a7b8280`, `4bf150f`). A landing já tem um card "GitHub" na seção
  NOVIDADES, mas não menciona perfil (stars/seguidores) separado do card de
  repositório.
- **Flash e download de firmware pelo próprio painel** (`/display/setup`):
  grava a ESP32 via USB sem sair da tela, e baixa o firmware da tag do
  GitHub quando a pasta `firmware/` não existe (instalação via Homebrew/cask)
  (`a11a0ef`, `7544557`). Hoje a landing só menciona `./dev firmware flash`
  no terminal — não menciona o fluxo pelo painel.
- **Command palette + suporte offline (service worker/PWA)** (`585783e`) —
  não aparece em lugar nenhum da landing.
- **Toast com o olho animado da logo** (`bbcf882`, `419e495`) — detalhe de
  polish, opcional citar.
- **RGB channel swap no tema** + melhorias de captura de screenshot
  (`4676865`) — corrige cores erradas em telas com wiring RGB invertido.
- Confirm modals padronizados em ações destrutivas (`ca3b254`, `3861b42`).
- Refinamentos de Spotify/YouTube Music (`13c263d`, `9f00c4a`).

### 2. Seção de instalação da landing está incompleta — o problema central

`#instalacao` no `docs/index.html` (linha ~1484) só mostra:

```
git clone https://github.com/TrindadeBRA/vigia-ai.git && cd vigia-ai && ./dev up
```

Ou seja, a landing **só documenta o caminho de dev** (clonar o monorepo e
rodar `./dev`). Não menciona os instaladores prontos — que já existem e
**já estão bem documentados no README** (`## Comece agora`, linha 219-269):

- **macOS**: `brew tap` + `brew install --cask vigia-ai` (recomendado, evita
  o aviso do Gatekeeper) ou `.dmg` direto + `fix-gatekeeper.command`/`xattr`.
- **Linux**: oneliner `curl ... install.sh | bash` (com `--user`/`--system`/
  `--uninstall`), ou `.AppImage`/`.deb`/`.tar.gz` direto dos releases.
- **Windows**: `.exe` (NSIS) direto dos releases — **sem menção alguma na
  landing hoje**.

Isso é exatamente o que o usuário pediu pra destacar. A landing precisa de
uma seção "Instalação" com abas/cards por SO (Mac/Linux/Windows), com os
instaladores como caminho principal e o `git clone && ./dev up` como opção
"a partir do código" pra quem quer contribuir — invertendo a ênfase atual.

### 3. Gap de aviso do Windows SmartScreen

O README explica em detalhe o aviso do Gatekeeper no macOS (`.dmg` não
assinado) mas **não menciona o aviso equivalente do Windows SmartScreen**
("Windows protegeu seu PC"), que existe pelo mesmo motivo (sem certificado
Authenticode) — confirmado em `.agents/DESKTOP.md` linha 105. Isso deixa
quem baixa o `.exe` sem saber que precisa clicar em "Mais informações" →
"Executar assim mesmo".

### 4. README com seção "Recursos" e badges desatualizados

- Linha 8: lista de badges/provedores no topo cita só os 10 originais
  (Claude, GPT, Cursor, OpenRouter, DeepSeek, OpenCode Go/Zen, fal.ai,
  Bitcoin, AdSense) — sem Git, GitHub, RetroAchievements, Calendário, RSS,
  Clima, Moedas, ISS, Spotify, YouTube Music, Câmera, Android, Emulador,
  Mineração.
- Linha 59: "**10 provedores, múltiplas contas cada**" — desatualizado, hoje
  são 20+ integrações de dados (sem contar as de UI/board).
- Faltam bullets sobre: command palette, suporte offline, fundos GIF
  animados, flash/download de firmware pelo painel, board com notas/imagens
  (já existe uma menção solta, pode virar bullet próprio).

### 5. Fotos reais do device: existem, mas só no README

`.agents/assets/firmware/hardware-desk.jpg` (foto real do ESP32 + TFT na
mesa, adicionada em `ff841d5`) está no README (linha 20) mas **não existe em
`docs/assets/`** nem é usada na landing page — o hero da landing ainda é só
o mock CSS de dashboard + o diagrama de wiring do Wokwi. Vale promover essa
foto real pro hero ou pra seção "Onde roda" da landing, como prova de que o
produto é físico de verdade (não só uma maquete).

### 6. Screenshots pendentes (não existem ainda em `docs/assets/` nem em `.agents/assets/`)

Nenhuma destas features tem captura de tela hoje:

- Card GitHub (repositório + perfil separados)
- Card Câmera, Android, Emulador, Mineração, Sistema (mencionados em texto,
  sem imagem em nenhum dos dois documentos)
- Command palette
- Editor de tema com fundo GIF animado
- Painel `/display/setup` com flash/download de firmware
- Toast com o olho animado

## Escopo das alterações propostas

### A. `docs/index.html`

1. **Banner de versão**: trocar "v2.4 → v2.9" por algo que não precise ser
   reescrito a cada release — ex. "20+ integrações, atualizações contínuas"
   — ou manter um range mas versionado corretamente (v2.4 → v2.13).
2. **Seção NOVIDADES**: adicionar cards para GIF animado, command palette +
   offline, flash/download de firmware pelo painel, RGB channel swap. Ajustar
   o card GitHub pra citar perfil + repositório como cards separados.
3. **Reformular `#instalacao`** (mudança mais importante):
   - Estrutura em 3 blocos lado a lado ou em abas: **macOS** (Homebrew +
     nota do Gatekeeper), **Linux** (oneliner `install.sh` + nota
     `--user`/`--system`), **Windows** (`.exe` direto + nota do SmartScreen).
   - Botão de copiar por comando, como já existe hoje pro oneliner.
   - Link pros releases (`github.com/.../releases/latest`) em destaque.
   - Manter "A partir do código" (`git clone && ./dev up`) como card
     secundário/colapsável, claramente rotulado pra quem quer contribuir ou
     rodar sem instalador.
4. **Hero / "Onde roda"**: adicionar a foto real `hardware-desk.jpg` (copiar
   pra `docs/assets/`) — como imagem de apoio no hero ou substituindo/
   complementando o mock CSS atual, e no card "Físico" da seção "Onde roda".
5. Conferir se `JSON-LD` e meta description continuam batendo com a contagem
   de integrações depois do ajuste de copy.

### B. `README.md`

1. Atualizar a linha de badges/provedores (linha 8-9) pra refletir a lista
   atual, ou trocar por um resumo curto ("20+ integrações — veja a lista
   completa abaixo") pra não precisar editar essa linha a cada provedor novo.
2. Reescrever o bullet "10 provedores..." (linha 59) com a contagem e
   categorias atuais (Cotas de IA / Financeiro / Dev / Vida / Mídia /
   Hardware), no mesmo agrupamento que a landing já usa.
3. Adicionar bullets: command palette, suporte offline, fundos animados
   (GIF), flash/download de firmware pelo painel de configuração.
4. Em "Comece agora" → aviso do macOS (linha 255), adicionar bloco irmão
   pro **Windows SmartScreen** ("Mais informações" → "Executar assim
   mesmo"), citando que também não há certificado pago (Authenticode).
5. Screenshots: inserir os que já existem mas não estão no README/landing
   (nenhum identificado além do hardware-desk.jpg que já está no README) e
   marcar quais precisam ser capturados antes de poderem entrar (ver item C).

### C. Assets pendentes (bloqueiam parte do item A/B até serem capturados)

- Copiar `.agents/assets/firmware/hardware-desk.jpg` → `docs/assets/`.
- Capturar (rodando o app local, `./dev up` ou `./dev app`):
  card GitHub, Câmera, Android, Emulador, Mineração, Sistema, command
  palette, editor de tema com GIF, painel de flash/download de firmware,
  toast do olho.
- Essas capturas podem ser feitas com o `claude-in-chrome` depois de subir
  o app localmente — mas é um passo à parte deste plano de copy, porque
  precisa de credenciais/providers configurados pra ficar realista (ex.
  câmera precisa de um stream RTSP de verdade).

### D. Processo (opcional, fora do escopo imediato)

`.agents/RELEASE.md` não tem nenhum item de checklist lembrando de manter
`docs/index.html`/`README.md` em dia — é por isso que a landing ficou 4
minors pra trás. Depois de revisar a copy, vale adicionar uma linha ao
checklist de release (algo como "toda feature nova de peso ganha 1 bullet na
landing e/ou README antes do tag") pra não repetir o drift.

## Ordem sugerida de execução

1. Copiar a foto real do device pra `docs/assets/`.
2. Reescrever `#instalacao` da landing com os 3 caminhos por SO (maior
   impacto pro pedido do usuário).
3. Atualizar NOVIDADES da landing com as features do item A.2.
4. Atualizar README: badges, bullet de recursos, aviso Windows SmartScreen.
5. (Opcional, depende de captura de tela) Adicionar screenshots novos aos
   dois documentos.
6. (Opcional) Adicionar lembrete no `RELEASE.md`.

## Em aberto — decisões do usuário

- Quer que eu já capture as screenshots pendentes (item C) rodando o app
  localmente com o `claude-in-chrome`, ou prefere fornecer as imagens?
- O banner de versão da landing deve virar um range fixo por release
  (precisa lembrar de editar a cada minor) ou um texto sem número de versão
  (menos manutenção, mas menos "prova de atividade recente")?
- Mantém `install.sh` Linux-only (sem tentar suportar Windows/macOS no
  mesmo script) — confirmar que é intencional antes de eu documentar isso
  como "definitivo" na landing?
