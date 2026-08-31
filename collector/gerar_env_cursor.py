#!/usr/bin/env python3
"""Grava CURSOR_ACCESS_TOKEN em data/config.json a partir do JWT do Cursor. Não imprime o token."""

from __future__ import annotations

import sys

from cursor_state import read_item, state_db_path
from store import CONFIG_PATH, update


def main() -> int:
    db = state_db_path()
    token = read_item(db, "cursorAuth/accessToken")
    if not token:
        print(f"nao achei JWT em {db}")
        print("abra o Cursor, faca login, feche e rode este script de novo")
        return 1
    plan = read_item(db, "cursorAuth/stripeMembershipType") or ""
    update({"CURSOR_ACCESS_TOKEN": token, "CURSOR_STATE_DB": str(db)})
    extra = f" plano={plan}" if plan else ""
    print(f"gravado CURSOR_ACCESS_TOKEN em {CONFIG_PATH} ({len(token)} chars, nao exibido){extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
