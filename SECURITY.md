# Security

Vigia AI is a **LAN-only** collector. Do not expose port 8787 (or the frontend) to the public internet.

## Secrets

Never commit:

- `backend/data/config.json` (OAuth tokens, API keys, JWTs)
- `firmware/src/secrets.h` (Wi-Fi password)
- dumps of Cursor `state.vscdb` or Claude `~/.claude/.credentials.json`

The JSON served at `GET /usage` contains percentages and dates, **not** Bearer tokens. `GET /api/config` returns only a suffix of pasted secrets.

## Unofficial APIs

Claude and Cursor usage endpoints are **not** public contracts. Treat 401/429 as a provider failure. If you discover a security issue in this repo, use GitHub Security Advisories on the public repository (or email the maintainer listed on the repo).

## Rate limits

There is **no cache**. Each `GET /usage` hits the upstream APIs. The Claude OAuth usage endpoint rate-limits if hammered; keep `USAGE_POLL_MS` around 60–180 s.
