#!/usr/bin/env bash
# Atalho na raiz: painel + /usage. Passe docker para compose.
exec "$(cd "$(dirname "$0")" && pwd)/collector/start.sh" "$@"
