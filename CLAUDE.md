# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A desktop panel: ESP32 + 3.5" TFT touchscreen shows usage quotas for the Claude and Cursor subscriptions, across multiple screens (home, Claude detail, Cursor detail, info). The board never stores tokens. A Python collector running on the Mac reads local credentials (or a `.env`), calls the authenticated subscription APIs, and serves a JSON summary on the LAN. The firmware only does an HTTP GET on that JSON and draws the UI.

UI and documentation language is **Portuguese (Brazil)**. Code identifiers are in English.

## Start here: `docs/`

This repo's real documentation lives in `docs/`, written for both humans and AI agents. **Read `docs/CONTEXTO_IA.md` first** — it is the entry point for agents and lists the hard rules for generating code in this repo (token handling, JSON contract, cache TTLs, GPIO constraints, scope limits). Then go to the specific doc for the area you're touching:

| Doc | Covers |
| --- | --- |
| [docs/CONTEXTO_IA.md](docs/CONTEXTO_IA.md) | Agent entry point + rules for generated code — read before editing anything |
| [docs/PLANO.md](docs/PLANO.md) | Scope, phases, what's already done |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Collector ↔ ESP32 ↔ APIs data flow and trust boundaries |
| [docs/CONTRATO_JSON.md](docs/CONTRATO_JSON.md) | `GET /usage` JSON shape — do not break without updating both this doc and the firmware parser |
| [docs/APIS_CLAUDE.md](docs/APIS_CLAUDE.md) | Anthropic OAuth usage endpoint (unofficial) |
| [docs/APIS_CURSOR.md](docs/APIS_CURSOR.md) | Cursor Dashboard Connect RPC (unofficial) |
| [docs/HARDWARE.md](docs/HARDWARE.md) | Board, pinout, TFT drivers |
| [docs/TOUCH.md](docs/TOUCH.md) | Views, XPT2046 touch, calibration, Wokwi touch emulation |
| [docs/COLETOR.md](docs/COLETOR.md) | Running/authenticating the local collector server |
| [docs/FIRMWARE.md](docs/FIRMWARE.md) | PlatformIO environments, Wokwi, `secrets.h` |
| [docs/DECISOES.md](docs/DECISOES.md) | Why the current choices were made (read before proposing an architecture change) |

## Commands

Collector (Mac, Python 3 stdlib only):
```bash
cd collector
cp .env.example .env    # optional, for token overrides
python3 server.py
curl -s http://127.0.0.1:8787/usage | python3 -m json.tool   # verify
```

Firmware (PlatformIO):
```bash
cp src/secrets.h.example src/secrets.h   # fill in Wi-Fi + USAGE_URL; gitignored
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

Wokwi simulator (mock data, no Wi-Fi):
```bash
pio run -e wokwi
# then Cmd+Shift+P -> "Wokwi: Start Simulator"
# no resistive touch in Wokwi: use Prev/Next buttons or serial keys n/p/0/1/2/3
```

`pio run` with no `-e` builds both `esp32dev` and `wokwi`.

## Architecture

Three pieces, one firmware sketch:

- **`collector/server.py`** — HTTP server on `:8787`. Reads Claude OAuth credentials (`~/.claude/.credentials.json`) and Cursor's local JWT (`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`), or overrides from `collector/.env`. Calls each provider's internal (unofficial) usage endpoint, caches results (≥5 min — the Claude endpoint rate-limits), and serves one merged JSON at `/usage`. A failure in one provider must not take down the other; `ok: false` on that provider's object is the contract.
- **`src/main.cpp`** — Wi-Fi connection, HTTP GET of `/usage`, JSON parsing (ArduinoJson), poll loop (`USAGE_POLL_MS`).
- **`src/ui.cpp`** — the four views/tabs (Início, Claude, Cursor, Info) and their rendering (TFT_eSPI).
- **`src/input.cpp`** — touch (XPT2046 on hardware), Prev/Next buttons (Wokwi), serial key input.

`platformio.ini` builds the *same* `src/main.cpp` sketch into two environments distinguished only by `build_flags`:

- `esp32dev` — real 3.5" board, ILI9488 320×480, real Wi-Fi + HTTP to the collector.
- `wokwi` — ILI9341 240×320, `MOCK_USAGE` fixed data, no network (Wokwi can't reliably reach the Mac collector).

Tokens exist only on the Mac (official app files or `collector/.env`, both gitignored). The board and the LAN JSON never carry a Bearer token — only computed percentages and dates. Do not add auth to the collector or expose port 8787 outside the LAN without being asked; that's a deliberate v1 decision (see `docs/DECISOES.md`).

The subscription usage endpoints used here are the same ones the Claude Code CLI and Cursor IDE use internally — they are **not** the paid metered API and are not a stable public contract. Treat 401/429/HTML responses as a provider-specific failure, not a crash.
