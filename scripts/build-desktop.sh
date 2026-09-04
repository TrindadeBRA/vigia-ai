#!/usr/bin/env bash
# Build completo do app desktop: frontend + sidecar + instalador.
#
# Rode no SO de destino — o sidecar (PyInstaller) não tem cross-compile.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-}"   # vazio = plataforma atual; ou --mac / --win / --linux / --dir

echo "== 1/4 frontend =="
(cd "$ROOT_DIR/frontend" && [ -d node_modules ] || npm ci) || true
(cd "$ROOT_DIR/frontend" && npm run build)

echo "== 2/4 sidecar (PyInstaller) =="
"$ROOT_DIR/scripts/build-sidecar.sh"

echo "== 3/4 electron (TypeScript) =="
(cd "$ROOT_DIR/desktop" && { [ -d node_modules ] || npm ci; } && npm run build)

echo "== 4/4 instalador (electron-builder) =="
(cd "$ROOT_DIR/desktop" && npx electron-builder ${TARGET:+$TARGET} --config electron-builder.yml)

echo
echo "== artefatos em $ROOT_DIR/dist =="
ls -la "$ROOT_DIR/dist" 2>/dev/null | grep -vE "^total|mac-|linux-|win-" || true
