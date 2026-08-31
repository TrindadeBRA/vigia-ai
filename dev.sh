#!/usr/bin/env bash
# Helper de desenvolvimento: pergunta Wokwi ou placa e dispara o fluxo.
# ./dev-wokwi.sh continua existindo se voce so quiser coletor + gateway.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_BAUD=115200

usage() {
  cat <<EOF
uso: ./dev.sh

Helper interativo. Pergunta se e Wokwi ou placa e o que fazer.

atalhos (pulam as perguntas):
  ./dev.sh wokwi      compilacao do simulador
  ./dev.sh placa      compilacao da ESP32
  ./dev.sh upload     grava na ESP32
  ./dev.sh flash      grava e abre o serial
  ./dev.sh monitor    so o serial
  ./dev.sh coletor    so o collector/server.py
EOF
}

need_tty() {
  if [ ! -t 0 ]; then
    echo "erro: rode ./dev.sh num terminal (ele pergunta o que fazer)." >&2
    usage >&2
    exit 1
  fi
}

ask_line() {
  local prompt="$1"
  local reply
  # prompt no stderr: $(ask_line) so captura a resposta, nao o texto da pergunta
  printf "%s" "$prompt" >&2
  read -r reply
  printf '%s\n' "${reply:-}"
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

run_pio() {
  local pio
  pio="$(find_pio)"
  (cd "$ROOT_DIR" && "$pio" "$@")
}

run_wokwi_build() {
  echo "== compilando firmware do simulador (pio run -e wokwi) =="
  echo ""
  run_pio run -e wokwi
}

run_placa_build() {
  warn_secrets
  echo "== compilando firmware da placa (pio run -e esp32dev) =="
  echo ""
  run_pio run -e esp32dev
}

run_upload() {
  warn_secrets
  echo "== gravando na ESP32 (pio run -e esp32dev -t upload) =="
  echo "USB da placa precisa estar conectada."
  echo ""
  run_pio run -e esp32dev -t upload
}

run_monitor() {
  echo "== serial (pio device monitor -b ${MONITOR_BAUD}) =="
  echo "Ctrl+C encerra."
  echo ""
  run_pio device monitor -b "$MONITOR_BAUD"
}

run_flash() {
  run_upload
  echo ""
  run_monitor
}

run_coletor() {
  echo "== coletor (collector/server.py) =="
  echo "Ctrl+C encerra."
  echo ""
  cd "$ROOT_DIR/collector"
  exec python3 server.py
}

run_wokwi_services() {
  echo "== coletor + gateway (./dev-wokwi.sh) =="
  echo "depois: Cmd+Shift+P -> Wokwi: Start Simulator"
  echo "Ctrl+C encerra os dois processos."
  echo ""
  exec "$ROOT_DIR/dev-wokwi.sh"
}

helper_wokwi() {
  echo "Wokwi: o simulador precisa do firmware compilado e do coletor + gateway."
  echo ""
  local build services
  build="$(ask_line "compilar o firmware agora? [S/n] ")"
  services="$(ask_line "subir coletor + gateway agora? (fica rodando) [S/n] ")"
  echo ""

  case "${build:-S}" in
    n|N|nao|não) ;;
    *) run_wokwi_build ;;
  esac

  case "${services:-S}" in
    n|N|nao|não)
      echo "quando quiser: ./dev-wokwi.sh  e depois abra o simulador."
      ;;
    *)
      echo ""
      run_wokwi_services
      ;;
  esac
}

helper_placa() {
  echo "Placa real (ESP32 + TFT 3,5\")."
  echo ""
  echo "  1) so compilar"
  echo "  2) gravar na ESP32"
  echo "  3) gravar e abrir o serial"
  echo "  4) so o serial"
  echo ""
  local choice
  choice="$(ask_line "escolha [1-4]: ")"
  echo ""

  case "$choice" in
    1) run_placa_build ;;
    2) run_upload ;;
    3) run_flash ;;
    4) run_monitor ;;
    *)
      echo "erro: escolha invalida: $choice" >&2
      exit 1
      ;;
  esac
}

helper() {
  need_tty
  echo "Vigia AI — helper"
  echo ""
  echo "Onde voce vai rodar?"
  echo ""
  echo "  1) Wokwi (simulador)"
  echo "  2) Placa real"
  echo "  3) So o coletor (Python no Mac)"
  echo ""
  local where
  where="$(ask_line "escolha [1-3]: ")"
  echo ""

  case "$where" in
    1|wokwi) helper_wokwi ;;
    2|placa|esp32) helper_placa ;;
    3|coletor) run_coletor ;;
    *)
      echo "erro: escolha invalida: $where" >&2
      exit 1
      ;;
  esac
}

cd "$ROOT_DIR"

if [ $# -lt 1 ]; then
  helper
  exit 0
fi

TARGET="$1"
shift

case "$TARGET" in
  -h|--help|help) usage ;;
  wokwi) run_wokwi_build ;;
  placa|esp32|esp32dev) run_placa_build ;;
  upload) run_upload ;;
  monitor) run_monitor ;;
  flash) run_flash ;;
  coletor) run_coletor ;;
  *)
    echo "erro: alvo desconhecido: $TARGET" >&2
    echo "" >&2
    usage >&2
    exit 1
    ;;
esac
