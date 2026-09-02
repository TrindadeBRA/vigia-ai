# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Provedor **GPT** (cota da assinatura ChatGPT / Codex CLI via `~/.codex/auth.json` e `GET /backend-api/wham/usage`). Card no firmware, no mostrador e no painel.
- Template de issue de feature.
- **Alarmes + notificações push** (`/display/alarmes`): regras de provedor + métrica + limiar, edge-triggered, disparando Web Push (VAPID + service worker) quando cruzadas. Nome sugerido automaticamente e edição inline das regras. Só funciona em contexto seguro (`http://127.0.0.1` ou HTTPS) — ver `docs/NOTIFICACOES.md`.
- Provedor **Bitcoin** (endereço público de carteira → saldo on-chain via Blockstream Esplora + cotação USD/BRL via CoinGecko, sem chave privada). Card no firmware, no mostrador e no painel — ver `docs/APIS_BITCOIN.md`.

### Changed

- Início da placa abre em **grade** por padrão.
- `docs/REESCRITA.md` removido — o monorepo (`firmware/`, `backend/`, `frontend/`, `./dev`) é o estado vigente. Índice aponta para ARQUITETURA e CONTRIBUTING.

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
