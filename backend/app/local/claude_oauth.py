"""OAuth da assinatura Claude Code. No macOS o token vive no Keychain."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

KEYCHAIN_SERVICES = ("Claude Code-credentials",)
KEYCHAIN_CACHE_TTL_S = 30.0

_last_keychain_err: str | None = None
_keychain_cache: tuple[float, tuple[str | None, int | None, str | None]] | None = None


def parse_oauth_blob(data: Any) -> tuple[str | None, int | None]:
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            token = data.strip()
            return (token, None) if token else (None, None)
    if not isinstance(data, dict):
        return None, None
    oauth = data.get("claudeAiOauth") or data.get("oauth") or data
    if not isinstance(oauth, dict):
        return None, None
    token = (oauth.get("accessToken") or data.get("accessToken") or "").strip()
    exp = oauth.get("expiresAt") or data.get("expiresAt")
    exp_i = int(exp) if isinstance(exp, (int, float)) else None
    if not token:
        return None, None
    return token, exp_i


def from_credentials_file(path: Path) -> tuple[str | None, int | None, str | None]:
    if not path.is_file():
        return None, None, None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, None, f"credentials.json: {exc}"
    token, exp = parse_oauth_blob(data)
    if not token:
        return None, None, "credentials.json sem accessToken"
    return token, exp, None


def _keychain_services() -> list[str]:
    names = list(KEYCHAIN_SERVICES)
    extra = os.environ.get("CLAUDE_KEYCHAIN_SERVICE", "").strip()
    if extra and extra not in names:
        names.insert(0, extra)
    return names


def _keychain_error(svc: str, proc: subprocess.CompletedProcess[str]) -> str:
    raw = (proc.stderr or proc.stdout or "").strip()
    low = raw.lower()
    if "could not be found" in low or proc.returncode == 44:
        return (
            f"Keychain sem o item «{svc}». Abra o Claude Code (`claude`) neste Mac, "
            "faça login, e se o sistema pedir, permita o acesso do coletor."
        )
    if "user interaction is not allowed" in low:
        return (
            "Keychain recusou (sem janela para confirmar). Rode o coletor no Terminal "
            "deste Mac — não no Docker — e permita o acesso quando o macOS pedir."
        )
    if "errsecauthfailed" in low or "authorization" in low:
        return "Keychain recusou a senha. Rode `claude` e tente o coletor de novo no Terminal."
    return (raw or "keychain recusou")[:240]


def last_keychain_error() -> str | None:
    return _last_keychain_err


def from_macos_keychain() -> tuple[str | None, int | None, str | None]:
    global _last_keychain_err, _keychain_cache
    if _keychain_cache is not None:
        cached_at, result = _keychain_cache
        if time.monotonic() - cached_at < KEYCHAIN_CACHE_TTL_S:
            _last_keychain_err = result[2]
            return result
    _last_keychain_err = None
    if os.uname().sysname != "Darwin":
        return None, None, None
    best: tuple[str, int | None] | None = None
    last_err = None
    for svc in _keychain_services():
        try:
            proc = subprocess.run(
                ["security", "find-generic-password", "-s", svc, "-w"],
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            last_err = str(exc)
            continue
        if proc.returncode != 0:
            last_err = _keychain_error(svc, proc)
            continue
        token, exp = parse_oauth_blob(proc.stdout.strip())
        if not token:
            last_err = f"item {svc} sem accessToken"
            continue
        if best is None or (exp or 0) >= (best[1] or 0):
            best = (token, exp)
    if best:
        _last_keychain_err = None
        result = (best[0], best[1], None)
    else:
        _last_keychain_err = last_err
        result = (None, None, last_err)
    _keychain_cache = (time.monotonic(), result)
    return result


def credentials_path(cfg: dict | None = None) -> Path:
    env = os.environ.get("CLAUDE_CREDENTIALS_PATH", "").strip()
    if env:
        return Path(env).expanduser()
    stored = ""
    if cfg:
        stored = str((cfg.get("paths") or {}).get("claude_credentials") or "").strip()
    if stored:
        return Path(stored).expanduser()
    return Path.home() / ".claude" / ".credentials.json"


def claude_token_candidates(cfg: dict | None = None) -> list[tuple[str, str, int | None]]:
    """Keychain e credentials.json. Token colado no painel não entra aqui."""
    found: list[tuple[str, str, int | None]] = []
    seen: set[str] = set()

    def add(source: str, token: str | None, exp: int | None) -> None:
        if not token or token in seen:
            return
        seen.add(token)
        found.append((source, token, exp))

    kc_token, kc_exp, _kc_err = from_macos_keychain()
    add("keychain", kc_token, kc_exp)
    file_tok, file_exp, _err = from_credentials_file(credentials_path(cfg))
    add("credentials", file_tok, file_exp)
    return found
