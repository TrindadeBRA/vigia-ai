#!/usr/bin/env bash
# Empacota o coletor FastAPI num binário standalone (PyInstaller).
#
# Sem cross-compile: rode este script no MESMO SO que vai receber o instalador.
# Saída: desktop/resources/sidecar/vigia-collector[.exe]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT_DIR/backend/.venv"
OUT="$ROOT_DIR/desktop/resources/sidecar"
WORK="$ROOT_DIR/build/pyinstaller"

# No Windows (Git Bash no CI) o interpretador é `python`, e o venv usa Scripts/.
BOOTSTRAP_PY="python3"
command -v python3 >/dev/null 2>&1 || BOOTSTRAP_PY="python"

if [ ! -d "$VENV" ]; then
  echo "== criando backend/.venv =="
  "$BOOTSTRAP_PY" -m venv "$VENV"
fi
PY="$VENV/bin/python"
[ -x "$PY" ] || PY="$VENV/Scripts/python.exe"
[ -x "$PY" ] || { echo "erro: não achei o python do venv em $VENV" >&2; exit 1; }

echo "== dependências =="
"$PY" -m pip install -q -e "$ROOT_DIR/backend" pyinstaller

echo "== limpando saída anterior =="
rm -rf "$OUT" "$WORK"
mkdir -p "$OUT" "$WORK"

echo "== PyInstaller =="
# --onedir (não --onefile): --onefile extrai tudo em /tmp a cada boot, o que
# deixa o startup lento e quebra em máquinas com /tmp restrito.
"$PY" -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --name vigia-collector \
  --distpath "$WORK/dist" \
  --workpath "$WORK/work" \
  --specpath "$WORK" \
  --paths "$ROOT_DIR/backend" \
  --collect-all fastapi \
  --collect-all starlette \
  --collect-all uvicorn \
  --collect-all pydantic \
  --collect-all pydantic_core \
  --collect-binaries PIL \
  --hidden-import app.main \
  --hidden-import uvicorn.protocols.http.h11_impl \
  --hidden-import uvicorn.protocols.http.httptools_impl \
  --hidden-import uvicorn.protocols.websockets.websockets_impl \
  --hidden-import uvicorn.protocols.websockets.wsproto_impl \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import uvicorn.lifespan.off \
  --hidden-import uvicorn.loops.asyncio \
  --hidden-import uvicorn.loops.uvloop \
  --hidden-import multipart \
  --exclude-module tkinter \
  --exclude-module pytest \
  --console \
  "$ROOT_DIR/backend/app/desktop.py"

echo "== movendo para desktop/resources/sidecar =="
# `mv dir/*` deixa arquivos ocultos para trás; cp -R + rm é portátil.
cp -R "$WORK/dist/vigia-collector/." "$OUT/"
rm -rf "$WORK/dist"

BIN="$OUT/vigia-collector"
[ -f "$BIN" ] || BIN="$OUT/vigia-collector.exe"
echo "== pronto: $BIN ($(du -sh "$OUT" | cut -f1)) =="
