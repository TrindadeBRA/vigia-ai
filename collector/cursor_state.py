"""Leitura do state.vscdb do Cursor (SQLite local). Usado pelo coletor e por gerar_env_cursor.py."""

from __future__ import annotations

import os
import sqlite3
import tempfile
from pathlib import Path
from shutil import copy2


def state_db_path() -> Path:
    override = os.environ.get("CURSOR_STATE_DB", "").strip()
    if override:
        return Path(override).expanduser()
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


def read_item(db_path: Path, key: str) -> str | None:
    if not db_path.is_file():
        return None
    fd, tmp = tempfile.mkstemp(suffix=".vscdb")
    os.close(fd)
    try:
        copy2(db_path, tmp)
        con = sqlite3.connect(tmp)
        try:
            row = con.execute(
                "SELECT value FROM ItemTable WHERE key = ?", (key,)
            ).fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        return None
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
