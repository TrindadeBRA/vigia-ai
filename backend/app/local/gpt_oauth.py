"""OAuth da assinatura ChatGPT / Codex CLI. Token em ~/.codex/auth.json."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from app.local.cursor_state import jwt_expired, jwt_exp_unix


def auth_path(cfg: dict | None = None) -> Path:
    env_file = os.environ.get("CODEX_AUTH_PATH", "").strip()
    if env_file:
        return Path(env_file).expanduser()
    env_home = os.environ.get("CODEX_HOME", "").strip()
    if env_home:
        return Path(env_home).expanduser() / "auth.json"
    stored = ""
    if cfg:
        stored = str((cfg.get("paths") or {}).get("codex_auth") or "").strip()
    if stored:
        return Path(stored).expanduser()
    return Path.home() / ".codex" / "auth.json"


def parse_auth_blob(data: Any) -> tuple[str | None, str | None]:
    """Devolve (access_token, account_id). Não lê OPENAI_API_KEY."""
    if isinstance(data, str):
        text = data.strip()
        if not text:
            return None, None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return text, None
    if not isinstance(data, dict):
        return None, None
    tokens = data.get("tokens") if isinstance(data.get("tokens"), dict) else data
    token = str(tokens.get("access_token") or data.get("access_token") or "").strip()
    account_id = str(tokens.get("account_id") or data.get("account_id") or "").strip() or None
    if not token:
        return None, None
    return token, account_id


def from_auth_file(path: Path) -> tuple[str | None, str | None, str | None]:
    if not path.is_file():
        return None, None, None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, None, f"auth.json: {exc}"
    token, account_id = parse_auth_blob(data)
    if not token:
        return None, None, "auth.json sem access_token — rode `codex login`"
    return token, account_id, None


def gpt_token_candidates(cfg: dict | None = None) -> list[tuple[str, str, str | None, int | None]]:
    """Arquivo do Codex CLI. Token colado no painel não entra aqui."""
    found: list[tuple[str, str, str | None, int | None]] = []
    seen: set[str] = set()

    def add(source: str, token: str | None, account_id: str | None) -> None:
        if not token or token in seen:
            return
        seen.add(token)
        found.append((source, token, account_id, jwt_exp_unix(token)))

    token, account_id, _err = from_auth_file(auth_path(cfg))
    add("auth", token, account_id)
    return found


def gpt_missing_hint(cfg: dict | None = None) -> str:
    path = auth_path(cfg)
    if path.is_file():
        return "auth.json sem access_token — rode `codex login` neste Mac"
    return f"Nenhum login Codex encontrado — rode `codex login` neste Mac (sem {path})"


def gpt_token_expired(token: str) -> bool:
    return jwt_expired(token)
