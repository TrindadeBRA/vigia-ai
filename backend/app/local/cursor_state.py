"""Leitura do state.vscdb do Cursor (SQLite local)."""

from __future__ import annotations

import base64
import json
import os
import sqlite3
import tempfile
import time
from pathlib import Path
from shutil import copy2


def state_db_path(cfg: dict | None = None) -> Path:
    override = os.environ.get("CURSOR_STATE_DB", "").strip()
    if override:
        return Path(override).expanduser()
    stored = ""
    if cfg:
        stored = str((cfg.get("paths") or {}).get("cursor_state_db") or "").strip()
    if stored:
        return Path(stored).expanduser()
    home = Path.home()
    candidates = [
        home / "Library/Application Support/Cursor/User/globalStorage/state.vscdb",
        home / ".config/Cursor/User/globalStorage/state.vscdb",
    ]
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidates.append(Path(appdata) / "Cursor/User/globalStorage/state.vscdb")
    for path in candidates:
        if path.is_file():
            return path
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
            row = con.execute("SELECT value FROM ItemTable WHERE key = ?", (key,)).fetchone()
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


def cursor_token_candidates(cfg: dict | None = None) -> list[tuple[str, str, str | None]]:
    found: list[tuple[str, str, str | None]] = []
    seen: set[str] = set()
    db = state_db_path(cfg)
    plan = read_item(db, "cursorAuth/stripeMembershipType")

    def add(source: str, token: str | None) -> None:
        if not token or token in seen:
            return
        seen.add(token)
        found.append((source, token, plan))

    add("vscdb", read_item(db, "cursorAuth/accessToken"))
    return found


def cursor_missing_hint(cfg: dict | None = None) -> str:
    db = state_db_path(cfg)
    if db.is_file():
        return "cursorAuth/accessToken ausente — saia e entre de novo na conta no Cursor"
    return f"Cursor não encontrado neste computador (sem {db})"


def jwt_exp_unix(token: str) -> int | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload = parts[1]
    pad = "=" * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload + pad)
        data = json.loads(raw.decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    exp = data.get("exp")
    try:
        return int(exp) if exp is not None else None
    except (TypeError, ValueError):
        return None


def jwt_expired(token: str) -> bool:
    exp = jwt_exp_unix(token)
    if exp is None:
        return False
    return exp < time.time()
