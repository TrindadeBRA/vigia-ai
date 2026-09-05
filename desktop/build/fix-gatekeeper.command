#!/bin/bash
# Vigia AI não tem certificado pago da Apple (Developer ID) — o macOS marca
# apps baixados da internet sem essa assinatura como "danificados" mesmo
# estando 100% íntegros (é o Gatekeeper bloqueando app não notarizado, não
# corrupção de arquivo). Este script remove só a flag de quarentena que o
# navegador grava no download; não desativa nenhuma proteção do sistema.
set -e

APP_NAME="Vigia AI.app"
FOUND=0

for CANDIDATE in "/Applications/$APP_NAME" "$(dirname "$0")/$APP_NAME"; do
  if [ -d "$CANDIDATE" ]; then
    xattr -cr "$CANDIDATE"
    echo "Corrigido: $CANDIDATE"
    FOUND=1
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "Não encontrei o Vigia AI.app nem aqui nem em /Applications."
  echo "Arraste o app para a pasta Applications antes de rodar este script."
else
  echo ""
  echo "Pronto! Agora é só abrir o Vigia AI normalmente."
fi

read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
echo ""
