#!/usr/bin/env python3
"""Cria collector/.env.cursor a partir do JWT que o Cursor ja guarda no Mac."""

from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from shutil import copy2

HERE = Path(__file__).resolve().parent
OUT = HERE / ".env.cursor"


def state_db() -> Path:
    home = Path.home()
    candidates = [
        home / "Library/Application Support/Cursor/User/globalStorage/state.vscdb",
        home / ".config/Cursor/User/globalStorage/state.vscdb",
    ]
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidates.append(Path(appdata) / "Cursor/User/globalStorage/state.vscdb")
    for p in candidates:
        if p.is_file():
            return p
    return candidates[0]


def read_key(db_path: Path, key: str) -> str | None:
    if not db_path.is_file():
        return None
    fd, tmp = tempfile.mkstemp(suffix=".vscdb")
    os.close(fd)
    try:
        copy2(db_path, tmp)
        con = sqlite3.connect(tmp)
        try:
            row = con.execute("SELECT value FROM ItemTable WHERE key = ?", (key,)).fetchone()
        finally:
            con.close()
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    if not row or row[0] is None:
        return None
    val = row[0]
    if isinstance(val, bytes):
        val = val.decode("utf-8", errors="replace")
    s = str(val).strip().strip('"')
    return s or None


def main() -> int:
    db = state_db()
    token = read_key(db, "cursorAuth/accessToken")
    if not token:
        print(f"nao achei JWT em {db}")
        print("abra o Cursor, faca login, feche e rode este script de novo")
        return 1
    plan = read_key(db, "cursorAuth/stripeMembershipType") or ""
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
