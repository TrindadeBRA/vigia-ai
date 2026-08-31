# Changelog

All notable changes to this project are documented here.

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
