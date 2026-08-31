#!/usr/bin/env bash
# Compila (e, na placa, grava) o firmware via PlatformIO.
# O coletor e o gateway Wokwi continuam no ./dev-wokwi.sh — este script so chama o pio.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_BAUD=115200

usage() {
  cat <<EOF
uso: ./dev-pio.sh <alvo> [args extras do pio]

  wokwi     pio run -e wokwi                 firmware do simulador
  placa     pio run -e esp32dev              so compilacao da placa real
  upload    pio run -e esp32dev -t upload    grava na ESP32
  monitor   pio device monitor -b ${MONITOR_BAUD}
  flash     upload + monitor                 grava e abre o serial

exemplos:
  ./dev-pio.sh wokwi
  ./dev-pio.sh upload
  ./dev-pio.sh flash
EOF
}

find_pio() {
  if command -v pio >/dev/null 2>&1; then
    command -v pio
    return 0
  fi
  local bundled="$HOME/.platformio/penv/bin/pio"
  if [ -x "$bundled" ]; then
    printf '%s\n' "$bundled"
    return 0
  fi
  echo "erro: pio nao encontrado no PATH nem em $bundled." >&2
  echo "instale o PlatformIO CLI: https://docs.platformio.org/en/latest/core/installation.html" >&2
  exit 1
}

warn_secrets() {
  local secrets="$ROOT_DIR/src/secrets.h"
  if [ ! -f "$secrets" ]; then
    echo "aviso: src/secrets.h nao existe — o Wi-Fi da placa usa placeholders." >&2
    echo "        cp src/secrets.h.example src/secrets.h  # preencha SSID, senha e USAGE_URL" >&2
    echo ""
    return
  fi
  if grep -q 'SUA_REDE\|SUA_SENHA' "$secrets"; then
    echo "aviso: src/secrets.h ainda tem SUA_REDE/SUA_SENHA — a placa nao vai associar no Wi-Fi." >&2
    echo ""
  fi
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

TARGET="$1"
shift

PIO="$(find_pio)"
cd "$ROOT_DIR"

case "$TARGET" in
  -h|--help|help)
    usage
    exit 0
    ;;
  wokwi)
    echo "== pio run -e wokwi =="
    echo "depois: deixe o ./dev-wokwi.sh rodando e abra Wokwi: Start Simulator"
    echo ""
    exec "$PIO" run -e wokwi "$@"
    ;;
  placa|esp32|esp32dev)
    warn_secrets
    echo "== pio run -e esp32dev =="
    exec "$PIO" run -e esp32dev "$@"
    ;;
  upload)
    warn_secrets
    echo "== pio run -e esp32dev -t upload =="
    echo "USB da placa precisa estar conectada."
    echo ""
    exec "$PIO" run -e esp32dev -t upload "$@"
    ;;
  monitor)
    echo "== pio device monitor -b ${MONITOR_BAUD} =="
    exec "$PIO" device monitor -b "$MONITOR_BAUD" "$@"
    ;;
  flash)
    warn_secrets
    echo "== pio run -e esp32dev -t upload =="
    echo "USB da placa precisa estar conectada."
    echo ""
    "$PIO" run -e esp32dev -t upload "$@"
    echo ""
    echo "== pio device monitor -b ${MONITOR_BAUD} =="
    echo "Ctrl+C encerra o monitor."
    echo ""
    exec "$PIO" device monitor -b "$MONITOR_BAUD"
    ;;
  *)
    echo "erro: alvo desconhecido: $TARGET" >&2
    echo "" >&2
    usage >&2
    exit 1
    ;;
esac
