#!/usr/bin/env python3
"""Aposentado: não copie o OAuth do Claude Code para config.json."""

from __future__ import annotations

import sys

from store import CONFIG_PATH


def main() -> int:
    print("gerar_env_claude.py foi aposentado.")
    print()
    print("No Mac, NÃO copie o token do Keychain para disco.")
    print("Suba o coletor com ./dev-collector.sh (Python local) e deixe o campo vazio no painel.")
    print("O coletor lê o Claude Code já logado.")
    print()
    print("Docker: o Keychain do macOS não entra no container.")
    print("  1) prefira o Python local neste Mac, ou")
    print("  2) monte ~/.claude (Linux / credentials.json) — ver docs/COLETOR.md, ou")
    print("  3) cole o accessToken no painel só como plano B (não use `claude setup-token`).")
    print()
    print(f"Não grave Bearer em {CONFIG_PATH} se o app estiver neste computador.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
