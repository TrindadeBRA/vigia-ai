# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Provedor **GPT** (cota da assinatura ChatGPT / Codex CLI via `~/.codex/auth.json` e `GET /backend-api/wham/usage`). Card no firmware, no mostrador e no painel.
- Template de issue de feature.
- **Alarmes + Telegram** (`/display/alarms`): regras de provedor + métrica + limiar, edge-triggered, disparando mensagem no Telegram quando cruzadas. Nome sugerido automaticamente e edição inline das regras — ver `.agents/NOTIFICACOES.md`.
- Provedor **Bitcoin** (endereço público de carteira → saldo on-chain via Blockstream Esplora + cotação USD/BRL via CoinGecko, sem chave privada). Card no firmware, no mostrador e no painel — ver `.agents/APIS_BITCOIN.md`.
- Seção **Financeiro** no painel de configuração (Bitcoin + AdSense + cotação de moedas).
- Provedor **AdSense** (OAuth Google → ganhos estimados de hoje + saldo não pago). Card no firmware, no mostrador e no painel, ao lado do Bitcoin — ver `.agents/APIS_ADSENSE.md`.
- **Cotação de moedas** (`/api/currencies`): lista livre do usuário, moedas fiat (câmbio via open.er-api.com) ou cripto (CoinGecko, com busca embutida), todas convertidas pra uma moeda base configurável. Card no mostrador web **e no firmware** (Início, Agora e detalhe).
- Card **Clima** no firmware (Início, Agora e detalhe), no mesmo padrão de Moedas: objeto único no `/usage`, some da placa se desligado/oculto.
- **Papéis de parede**: upload de imagem, busca e importação de Pexels/Wallhaven/Unsplash pro fundo do editor de tema (ESP32) e pro grid do `/display`, com biblioteca própria e conversão automática pra RAW RGB565 — ver `.agents/CONTRATO_TEMA.md`.
- Card **AdSense** no mostrador (`/display`), no mesmo padrão dos demais provedores.
- Layout do board (`/display`) agora também persiste no backend (`/api/board`), além do `localStorage` — sincroniza entre dispositivos na mesma LAN.
- **Exportar/Importar alarmes** (`/display/alarms`): baixa as regras salvas como JSON e repõe a partir de um arquivo — ver `.agents/NOTIFICACOES.md`.

### Fixed

- OpenCode Go: `percent` das janelas rolling/weekly/monthly usava `as_percent()` (fração 0–1, certo pro Claude), mas a API do OpenCode já devolve 0–100 — `percent: 1.0` (1% usado) virava 100% na tela. Trocado para `as_percent_points()`, igual ao Cursor.
- Claude: no schema novo (`limits[]`), o campo `percent` também já vem 0–100, mas o parser usava `as_percent()` (a mesma função certa pro `utilization` do schema antigo). Sessão/semana com uso baixo logo após o reset (ex.: 1%) virava 100% na tela. Trocado para `as_percent_points()` quando `utilization` não está presente.
- Modo foco (`/display`) forçava tela cheia do navegador via `requestFullscreen`, e um listener de `fullscreenchange` desligava o foco sozinho ao trocar de aba (a troca de aba já sai da tela cheia do browser). Agora o foco só esconde a UI, sem mexer em tela cheia.
- Alça de arrastar dos cards do `/display` alinhada ao topo esquerdo — antes ficava centralizada verticalmente, desalinhada dos outros botões (duplicar/tamanho/remover) do card.

### Security

- **SSRF na importação de papel de parede externo** (`POST /api/wallpapers/import`): `image_url`/`thumb_url` agora precisam apontar pra um host público via `http`/`https` — `file://`, loopback, rede privada e link-local são rejeitados antes do download (redirects são revalidados a cada hop).

### Removed

- **Web Push** (VAPID, service worker `sw.js`, `/api/push`, `pywebpush`): notificações de alarme passam só pelo **Telegram** — ver `.agents/NOTIFICACOES.md`.
- Scripts de instalação standalone (`install-scripts/`) — usar `./dev` ou Docker Compose.

### Changed

- Chaves de API dos provedores de papel de parede (Pexels/Wallhaven/Unsplash) saíram do editor de tema e agora são cards próprios em Configurações → "Papéis de parede".
- Rota do editor de tema: `/display/theme` (inglês, como as demais slugs). `/display/tema` redireciona. Alarmes: `/display/alarms` (`/display/alarmes` redireciona).
- Tema da placa: cada ícone de provedor mostra uma **métrica de cota ao vivo** (sessão, saldo, etc.) escolhida no editor — firmware desenha ícone + valor; o painel gerencia provedor e métrica no canvas.

- Início da placa abre em **grade** por padrão.
- `.agents/REESCRITA.md` removido — o monorepo (`firmware/`, `backend/`, `frontend/`, `./dev`) é o estado vigente. Índice aponta para ARQUITETURA e CONTRIBUTING.

## [1.0.0] — 2026-08-31

### Added

- Monorepo: `firmware/`, `backend/` (FastAPI + OpenAPI/Swagger), `frontend/` (Vite + React + TypeScript).
- Single `./dev` script (replaces `dev.sh`, `dev-collector.sh`, `dev-wokwi.sh`).
- LICENSE (MIT), CONTRIBUTING, SECURITY, CI, issue templates.
- Nested `config.json` (`version: 1`) with migration from the old flat env-style file.

### Changed

- Collector is FastAPI; `GET /docs` is the Swagger UI.
- Panel and display are a real React app (no UMD, no Tailwind CDN).
- Firmware lives under `firmware/`; `MOCK_USAGE` removed (mock is a backend flag).

### Removed

- `POST /api/docker` and Docker socket mount from the panel.
- Retired `gerar_env_*.py` scripts.
