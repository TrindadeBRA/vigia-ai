#!/usr/bin/env python3
"""Atualiza CLAUDE_OAUTH_TOKEN em collector/.env a partir do Claude Code (Keychain no macOS). Não imprime o token."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from claude_oauth import load_claude_oauth
from http_util import upsert_dotenv

HERE = Path(__file__).resolve().parent
OUT = HERE / ".env"


def main() -> int:
    os.environ.pop("CLAUDE_OAUTH_TOKEN", None)
    token, exp, err = load_claude_oauth()
    if not token:
        print(err or "sem OAuth Claude")
        print("1) `claude` no terminal e login da assinatura")
        print("2) se o macOS pedir senha/Keychain, permitir")
        print("3) rode este script de novo")
        print("Nao use ANTHROPIC_API_KEY / sk-ant-...")
        return 1
    upsert_dotenv(OUT, {"CLAUDE_OAUTH_TOKEN": token})
    print("fonte: Keychain ou credentials.json")
    print(f"gravado CLAUDE_OAUTH_TOKEN em {OUT} ({len(token)} chars, nao exibido)")
    if isinstance(exp, (int, float)) and exp > 0:
        ms = exp / 1000.0 if exp > 1e11 else float(exp)
        dt = datetime.fromtimestamp(ms, tz=timezone.utc)
        print(f"expiresAt UTC {dt.isoformat()}")
        if dt.timestamp() < datetime.now(timezone.utc).timestamp():
            print("token expirado: rode `claude` e gere de novo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
