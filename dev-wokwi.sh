#!/usr/bin/env bash
# Sobe tudo que o simulador Wokwi precisa: coletor (collector/server.py) e o
# gateway de rede (.tools/wokwigw, exigido pelo wokwi.toml -> ws://localhost:9011).
# Depois disso é só abrir o simulador no editor (Cmd+Shift+P -> "Wokwi: Start Simulator").
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WOKWIGW_BIN="$ROOT_DIR/.tools/wokwigw"

if [ ! -x "$WOKWIGW_BIN" ]; then
  echo "erro: $WOKWIGW_BIN nao encontrado ou sem permissao de execucao." >&2
  echo "baixe o binario para macOS em https://github.com/wokwi/wokwigw/releases/latest" >&2
  exit 1
fi

PIDS=()

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "encerrando..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null
  done
  sleep 1
  for pid in "${PIDS[@]}"; do
    kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null
  done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

echo "== coletor (collector/server.py) =="
(cd "$ROOT_DIR/collector" && python3 server.py) &
PIDS+=("$!")

sleep 1

echo "== gateway de rede (.tools/wokwigw, porta 9011) =="
"$WOKWIGW_BIN" &
PIDS+=("$!")

sleep 1

echo ""
echo "coletor:  http://127.0.0.1:8787/usage"
echo "gateway:  ws://localhost:9011"
echo ""
echo "agora abra o simulador no editor: Cmd+Shift+P -> \"Wokwi: Start Simulator\""
echo "Ctrl+C aqui encerra os dois processos."
echo ""

wait
