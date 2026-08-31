#!/usr/bin/env bash
# Sobe o coletor. Configuração: collector/data/config.json (no Docker, o mesmo path no volume).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data

PORT_VAL="$(python3 -c "from store import load; print(load().get('PORT') or '8787')" 2>/dev/null || echo 8787)"
PORT_VAL="${PORT_VAL:-8787}"

if [ "${1:-}" = "docker" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker não encontrado. Instale o Docker Desktop ou rode: ./start.sh" >&2
    exit 1
  fi
  export PORT="$PORT_VAL"
  echo "painel: http://127.0.0.1:${PORT_VAL}/"
  echo "usage:  http://127.0.0.1:${PORT_VAL}/usage"
  exec docker compose up --build
fi

echo "painel: http://127.0.0.1:${PORT_VAL}/"
echo "usage:  http://127.0.0.1:${PORT_VAL}/usage"
echo "Docker: ./start.sh docker"
exec python3 server.py
