#!/usr/bin/env python3
"""Cria collector/.env.cursor a partir do JWT que o Cursor ja guarda no Mac."""

from __future__ import annotations

import sys
from pathlib import Path

from cursor_state import read_item, state_db_path

HERE = Path(__file__).resolve().parent
OUT = HERE / ".env.cursor"


def main() -> int:
    db = state_db_path()
    token = read_item(db, "cursorAuth/accessToken")
    if not token:
        print(f"nao achei JWT em {db}")
        print("abra o Cursor, faca login, feche e rode este script de novo")
        return 1
    plan = read_item(db, "cursorAuth/stripeMembershipType") or ""
    lines = [
        "# gerado por gerar_env_cursor.py — nao commitar",
        f"CURSOR_ACCESS_TOKEN={token}",
        f"CURSOR_STATE_DB={db}",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    extra = f" plano={plan}" if plan else ""
    print(f"gravado {OUT} ({len(token)} chars, nao exibido){extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
