#!/usr/bin/env python3
"""Atualiza CURSOR_ACCESS_TOKEN em collector/.env a partir do JWT que o Cursor ja guarda no Mac."""

from __future__ import annotations

import sys
from pathlib import Path

from cursor_state import read_item, state_db_path
from http_util import upsert_dotenv

HERE = Path(__file__).resolve().parent
OUT = HERE / ".env"


def main() -> int:
    db = state_db_path()
    token = read_item(db, "cursorAuth/accessToken")
    if not token:
        print(f"nao achei JWT em {db}")
        print("abra o Cursor, faca login, feche e rode este script de novo")
        return 1
    plan = read_item(db, "cursorAuth/stripeMembershipType") or ""
    upsert_dotenv(
        OUT,
        {
            "CURSOR_ACCESS_TOKEN": token,
            "CURSOR_STATE_DB": str(db),
        },
    )
    extra = f" plano={plan}" if plan else ""
    print(f"gravado CURSOR_ACCESS_TOKEN em {OUT} ({len(token)} chars, nao exibido){extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
