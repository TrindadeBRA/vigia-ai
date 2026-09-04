#!/usr/bin/env bash
# Empacota o coletor Node num bundle JS (esbuild) para o Electron.
#
# Saída: desktop/resources/collector/desktop.js (ou build/collector/ se preferir)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT_DIR/desktop/resources/collector"
BUILD_OUT="$ROOT_DIR/build/collector"

echo "== build backend =="
(cd "$ROOT_DIR/backend" && npm run build)

echo "== copiando bundle para desktop/resources/collector =="
rm -rf "$OUT" "$BUILD_OUT"
mkdir -p "$OUT" "$BUILD_OUT"
cp -R "$ROOT_DIR/backend/dist/." "$OUT/"
cp -R "$ROOT_DIR/backend/dist/." "$BUILD_OUT/"
# inclui node_modules de produção se necessário para runtime (sharp/jimp etc já em bundle)
# Para Jimp puro JS, basta o .js; mantém package.json para referência
if [ -f "$ROOT_DIR/backend/package.json" ]; then
  cp "$ROOT_DIR/backend/package.json" "$OUT/" 2>/dev/null || true
  cp "$ROOT_DIR/backend/package.json" "$BUILD_OUT/" 2>/dev/null || true
fi
# tsc não bundla deps — o coletor precisa de node_modules em produção.
# Copia apenas deps de produção para dentro do bundle (sem devDeps como tsx/vitest).
echo "== instalando deps de produção no bundle =="
# Usa npm ci --omit=dev dentro de OUT para garantir node_modules mínimo e correto
if [ -f "$ROOT_DIR/backend/package-lock.json" ]; then
  cp "$ROOT_DIR/backend/package-lock.json" "$OUT/" 2>/dev/null || true
  cp "$ROOT_DIR/backend/package-lock.json" "$BUILD_OUT/" 2>/dev/null || true
fi
# Instala prod deps direto no OUT (e no BUILD_OUT) — silencioso, sem scripts
(cd "$OUT" && npm install --omit=dev --ignore-scripts --silent 2>&1 | tail -5 || echo "aviso: npm install no bundle falhou, tentando fallback cp")
if [ ! -d "$OUT/node_modules" ] && [ -d "$ROOT_DIR/backend/node_modules" ]; then
  echo "fallback: copiando node_modules filtrado"
  mkdir -p "$OUT/node_modules"
  # copia só prod: fastify, zod, jimp e deps transitivas necessárias
  for dep in fastify "@fastify" zod jimp pino ajv rfdc fast-json-stringify; do
    if [ -e "$ROOT_DIR/backend/node_modules/$dep" ]; then
      cp -R "$ROOT_DIR/backend/node_modules/$dep" "$OUT/node_modules/" 2>/dev/null || true
    fi
  done
fi
# replica para BUILD_OUT se ainda vazio
if [ ! -d "$BUILD_OUT/node_modules" ] && [ -d "$OUT/node_modules" ]; then
  cp -R "$OUT/node_modules" "$BUILD_OUT/" 2>/dev/null || true
fi

# Também copia backend/data se existir (não obrigatório)
echo "== pronto: $OUT/desktop.js ($(du -sh "$OUT" | cut -f1)) =="
ls -lh "$OUT" | head -20
