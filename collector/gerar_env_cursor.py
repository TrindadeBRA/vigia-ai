#!/usr/bin/env python3
"""Aposentado: não copie o JWT do Cursor para config.json."""

from __future__ import annotations

import sys

from store import CONFIG_PATH


def main() -> int:
    print("gerar_env_cursor.py foi aposentado.")
    print()
    print("No Mac, NÃO copie o JWT do Cursor para disco.")
    print("Suba o coletor com ./dev-collector.sh (Python local) e deixe o campo vazio no painel.")
    print("O coletor lê o state.vscdb do app já logado.")
    print()
    print("Docker: monte o globalStorage do Cursor (somente leitura) — ver docs/COLETOR.md")
    print("Cole JWT no painel só se o app não estiver neste PC.")
    print()
    print(f"Não grave Bearer em {CONFIG_PATH} se o Cursor estiver neste computador.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
