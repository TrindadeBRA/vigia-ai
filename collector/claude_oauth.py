"""OAuth da assinatura Claude Code. No macOS o token vive no Keychain, não no .credentials.json."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

KEYCHAIN_SERVICES = (
    "Claude Code-credentials",
)


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
    try:
        dump = subprocess.run(
            ["security", "dump-keychain"],
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired):
        return names
    for line in dump.stdout.splitlines():
        if "Claude Code-credentials" not in line:
            continue
        # "svce"<blob>="Claude Code-credentials-abcd"
        if '="' in line:
            name = line.split('="', 1)[1].rstrip('"')
            if name and name not in names:
                names.append(name)
    return names


def from_macos_keychain() -> tuple[str | None, int | None, str | None]:
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
            last_err = (proc.stderr or proc.stdout or "keychain recusou").strip()[:200]
            continue
        token, exp = parse_oauth_blob(proc.stdout.strip())
        if not token:
            last_err = f"item {svc} sem accessToken"
            continue
        if best is None or (exp or 0) >= (best[1] or 0):
            best = (token, exp)
    if best:
        return best[0], best[1], None
    return None, None, last_err


def load_claude_oauth() -> tuple[str | None, int | None, str | None]:
    env_tok = os.environ.get("CLAUDE_OAUTH_TOKEN", "").strip()
    if env_tok:
        return env_tok, None, None

    path = Path(
        os.environ.get("CLAUDE_CREDENTIALS_PATH")
        or Path.home() / ".claude" / ".credentials.json"
    ).expanduser()
    token, exp, err = from_credentials_file(path)
    if token:
        return token, exp, None

    kc_token, kc_exp, kc_err = from_macos_keychain()
    if kc_token:
        return kc_token, kc_exp, None

    bits = []
    if not path.is_file():
        bits.append(f"sem {path} (no macOS o Claude Code 2.x usa o Keychain)")
    elif err:
        bits.append(err)
    if kc_err:
        bits.append(kc_err)
    bits.append("rode `claude` e, se o Mac pedir, permita acesso ao Keychain")
    return None, None, "; ".join(bits)
