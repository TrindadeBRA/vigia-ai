"""Persistência do coletor: JSON em data/config.json (volume no Docker). Sem .env."""

from __future__ import annotations

import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("COLLECTOR_DATA") or HERE / "data")
CONFIG_PATH = DATA_DIR / "config.json"

KEYS = (
    "HOST",
    "PORT",
    "CLAUDE_OAUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CLAUDE_CREDENTIALS_PATH",
    "CURSOR_ACCESS_TOKEN",
    "CURSOR_STATE_DB",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY",
    "COLLECTOR_MOCK",
    # Claude/Cursor pegam login local sozinhos; estes flags só escondem o card
    # na ESP32 (configured=false no /usage). Ausente = visível.
    "CLAUDE_HIDDEN",
    "CURSOR_HIDDEN",
    # Apelido opcional da conta local (Keychain/state.vscdb). "" = sem apelido.
    "CLAUDE_LOCAL_LABEL",
    "CURSOR_LOCAL_LABEL",
    # Contas extras por provedor: string JSON com lista de
    # {"id","label","token"} (Claude/Cursor) ou {"id","label","key"}
    # (OpenRouter/DeepSeek). Ver get_accounts()/set_accounts() abaixo.
    "CLAUDE_ACCOUNTS",
    "CURSOR_ACCOUNTS",
    "OPENROUTER_ACCOUNTS",
    "DEEPSEEK_ACCOUNTS",
)

FLAG_KEYS = frozenset({"COLLECTOR_MOCK", "CLAUDE_HIDDEN", "CURSOR_HIDDEN"})
ACCOUNTS_KEYS = frozenset(
    {"CLAUDE_ACCOUNTS", "CURSOR_ACCOUNTS", "OPENROUTER_ACCOUNTS", "DEEPSEEK_ACCOUNTS"}
)


def env_flag(key: str) -> bool:
    return os.environ.get(key, "").strip().lower() in ("1", "true", "yes")


_LISTEN = frozenset({"HOST", "PORT"})


def _parse_legacy_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key in KEYS and val:
            out[key] = val
    return out


def _read_file() -> dict[str, str]:
    if not CONFIG_PATH.is_file():
        return {}
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    data: dict[str, str] = {}
    for key in KEYS:
        val = raw.get(key)
        if val is None:
            continue
        s = str(val).strip()
        if s:
            data[key] = s
    return data


def _write_file(data: dict[str, str]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    clean = {k: v for k, v in data.items() if k in KEYS and str(v).strip()}
    tmp = CONFIG_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(clean, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(CONFIG_PATH)
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass


def migrate_legacy_env() -> None:
    """Uma vez: copia collector/.env antigo para data/config.json e apaga o .env."""
    legacy = HERE / ".env"
    if CONFIG_PATH.is_file() or not legacy.is_file():
        return
    data = _parse_legacy_dotenv(legacy)
    if data:
        _write_file(data)
    try:
        legacy.unlink()
    except OSError:
        pass


def load() -> dict[str, str]:
    migrate_legacy_env()
    return _read_file()


def apply(*, skip: frozenset[str] | None = None, override: bool = True) -> dict[str, str]:
    data = load()
    skip = skip or frozenset()
    for key, val in data.items():
        if key in skip:
            continue
        if override or key not in os.environ:
            os.environ[key] = val
    if override:
        for key in KEYS:
            if key in skip:
                continue
            if key not in data:
                os.environ.pop(key, None)
    return data


def update(updates: dict[str, str]) -> dict[str, str]:
    data = load()
    for key, val in updates.items():
        if key not in KEYS:
            continue
        s = str(val).strip()
        if s:
            data[key] = s
        else:
            data.pop(key, None)
    _write_file(data)
    return data


def get_accounts(key: str) -> list[dict[str, str]]:
    """Lê uma lista de contas extras (CLAUDE_ACCOUNTS etc.). Entradas inválidas são ignoradas."""
    if key not in ACCOUNTS_KEYS:
        raise ValueError(f"{key} não é uma chave de contas")
    raw = os.environ.get(key, "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, str]] = []
    for item in parsed:
        if isinstance(item, dict) and item.get("id") and (item.get("token") or item.get("key")):
            out.append(item)
    return out


def set_accounts(key: str, accounts: list[dict[str, str]]) -> None:
    if key not in ACCOUNTS_KEYS:
        raise ValueError(f"{key} não é uma chave de contas")
    val = json.dumps(accounts, ensure_ascii=False) if accounts else ""
    update({key: val})
    if val:
        os.environ[key] = val
    else:
        os.environ.pop(key, None)
