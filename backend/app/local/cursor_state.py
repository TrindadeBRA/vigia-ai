"""Leitura do state.vscdb do Cursor (SQLite local)."""

from __future__ import annotations

import base64
import json
import os
import sqlite3
import sys
import tempfile
import time
from pathlib import Path
from shutil import copy2
from typing import Any


def state_db_path(cfg: dict | None = None) -> Path:
    override = os.environ.get("CURSOR_STATE_DB", "").strip()
    if override:
        return Path(override).expanduser()
    stored = ""
    if cfg:
        stored = str((cfg.get("paths") or {}).get("cursor_state_db") or "").strip()
    if stored:
        return Path(stored).expanduser()
    for path in state_db_candidates():
        if path.is_file():
            return path
    # Nenhum existe: devolve o caminho nativo do SO — é ele que aparece na mensagem de erro.
    return state_db_candidates()[0]


def state_db_candidates() -> list[Path]:
    """Locais do state.vscdb, na ordem do SO atual primeiro."""
    home = Path.home()
    rel = "Cursor/User/globalStorage/state.vscdb"
    macos = home / "Library/Application Support" / rel
    linux = home / ".config" / rel
    appdata = os.environ.get("APPDATA", "").strip()
    windows = Path(appdata) / rel if appdata else home / "AppData/Roaming" / rel
    if sys.platform == "darwin":
        return [macos, linux, windows]
    if sys.platform.startswith("win"):
        return [windows, linux, macos]
    return [linux, macos, windows]


CURSOR_STATE_CACHE_TTL_S = 30.0

_cursor_state_cache: tuple[float, Path, list[tuple[str, str, str | None]]] | None = None


def _clean_value(val: Any) -> str | None:
    if val is None:
        return None
    if isinstance(val, bytes):
        val = val.decode("utf-8", errors="replace")
    s = str(val).strip().strip('"')
    return s or None


def read_items(db_path: Path, keys: list[str]) -> dict[str, str | None]:
    """Lê várias chaves com uma única cópia do state.vscdb (que pode ter ~1 GB)."""
    if not db_path.is_file():
        return dict.fromkeys(keys)
    fd, tmp = tempfile.mkstemp(suffix=".vscdb")
    os.close(fd)
    try:
        copy2(db_path, tmp)
        con = sqlite3.connect(tmp)
        try:
            placeholders = ",".join("?" * len(keys))
            rows = con.execute(f"SELECT key, value FROM ItemTable WHERE key IN ({placeholders})", keys).fetchall()
        finally:
            con.close()
    except sqlite3.Error:
        return dict.fromkeys(keys)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    values = dict.fromkeys(keys)
    for key, value in rows:
        values[key] = _clean_value(value)
    return values


def read_item(db_path: Path, key: str) -> str | None:
    return read_items(db_path, [key])[key]


def cursor_token_candidates(cfg: dict | None = None) -> list[tuple[str, str, str | None]]:
    global _cursor_state_cache
    db = state_db_path(cfg)
    if _cursor_state_cache is not None:
        cached_at, cached_db, cached_result = _cursor_state_cache
        if cached_db == db and time.monotonic() - cached_at < CURSOR_STATE_CACHE_TTL_S:
            return cached_result

    found: list[tuple[str, str, str | None]] = []
    seen: set[str] = set()
    values = read_items(db, ["cursorAuth/stripeMembershipType", "cursorAuth/accessToken"])
    plan = values["cursorAuth/stripeMembershipType"]

    def add(source: str, token: str | None) -> None:
        if not token or token in seen:
            return
        seen.add(token)
        found.append((source, token, plan))

    add("vscdb", values["cursorAuth/accessToken"])
    _cursor_state_cache = (time.monotonic(), db, found)
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
