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


def env_cursor_token() -> str:
    return os.environ.get("CURSOR_ACCESS_TOKEN", "").strip()


def cursor_token_candidates() -> list[tuple[str, str, str | None]]:
    """App local (state.vscdb) primeiro; token colado só como fallback (Docker / outro PC)."""
    found: list[tuple[str, str, str | None]] = []
    seen: set[str] = set()
    db = state_db_path()
    plan = read_item(db, "cursorAuth/stripeMembershipType")

    def add(source: str, token: str | None) -> None:
        if not token or token in seen:
            return
        seen.add(token)
        found.append((source, token, plan))

    add("vscdb", read_item(db, "cursorAuth/accessToken"))
    add("env", env_cursor_token() or None)
    return found


def cursor_missing_hint() -> str:
    """Mensagem curta quando não há candidato de token (nem vscdb, nem colado).

    Cursor recente pode não gravar mais `cursorAuth/accessToken` em
    state.vscdb para toda conta (ex.: login via SSO/Team) mesmo com o app
    aberto e logado — por isso a dica não é só "abra o Cursor".
    """
    db = state_db_path()
    if db.is_file():
        return "cursorAuth/accessToken ausente — saia e entre de novo na conta no Cursor"
    return f"Cursor não encontrado neste Mac (sem {db})"


def cursor_token_and_plan() -> tuple[str | None, str | None, str | None]:
    cands = cursor_token_candidates()
    if not cands:
        return None, None, cursor_missing_hint()
    _src, token, plan = cands[0]
    return token, plan, None


def jwt_exp_unix(token: str) -> int | None:
    """Lê `exp` do payload JWT sem verificar assinatura — só para mensagem de erro."""
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
