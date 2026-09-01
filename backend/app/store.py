"""Persistência JSON aninhada (`version: 1`) + migração do saco de chaves antigo."""

from __future__ import annotations

import json
import os
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.config import config_path, data_dir

_LOCK = threading.Lock()

PROVIDERS = ("claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal")

_EMPTY_PROVIDER: dict[str, Any] = {
    "hidden": False,
    "local_label": "",
    "paste_secret": "",
    "accounts": [],
}


def default_config() -> dict[str, Any]:
    return {
        "version": 1,
        "listen": {"host": "0.0.0.0", "port": 8787},
        "mock": False,
        "paths": {"claude_credentials": "", "cursor_state_db": "", "codex_auth": ""},
        "providers": {name: deepcopy(_EMPTY_PROVIDER) for name in PROVIDERS},
    }


def _empty_provider() -> dict[str, Any]:
    return deepcopy(_EMPTY_PROVIDER)


def _parse_accounts_blob(raw: Any, secret_field: str) -> list[dict[str, str]]:
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
    else:
        parsed = raw
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, str]] = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        secret = str(item.get(secret_field) or item.get("secret") or item.get("token") or item.get("key") or "")
        if not secret:
            continue
        out.append(
            {
                "id": str(item["id"]),
                "label": str(item.get("label") or ""),
                "secret": secret,
            }
        )
    return out


def _flag(raw: Any) -> bool:
    return str(raw or "").strip().lower() in ("1", "true", "yes")


def migrate_legacy(raw: dict[str, Any]) -> dict[str, Any]:
    """Converte o JSON plano estilo env (`CLAUDE_OAUTH_TOKEN`, …) para `version: 1`."""
    cfg = default_config()
    host = str(raw.get("HOST") or "0.0.0.0").strip() or "0.0.0.0"
    port_s = str(raw.get("PORT") or "8787").strip() or "8787"
    try:
        port = int(port_s)
    except ValueError:
        port = 8787
    cfg["listen"] = {"host": host, "port": port}
    cfg["mock"] = _flag(raw.get("COLLECTOR_MOCK"))
    cfg["paths"]["claude_credentials"] = str(raw.get("CLAUDE_CREDENTIALS_PATH") or "")
    cfg["paths"]["cursor_state_db"] = str(raw.get("CURSOR_STATE_DB") or "")

    claude = cfg["providers"]["claude"]
    claude["hidden"] = _flag(raw.get("CLAUDE_HIDDEN"))
    claude["local_label"] = str(raw.get("CLAUDE_LOCAL_LABEL") or "")
    claude["paste_secret"] = str(raw.get("CLAUDE_OAUTH_TOKEN") or raw.get("CLAUDE_CODE_OAUTH_TOKEN") or "")
    claude["accounts"] = _parse_accounts_blob(raw.get("CLAUDE_ACCOUNTS"), "token")

    gpt = cfg["providers"]["gpt"]
    gpt["hidden"] = _flag(raw.get("GPT_HIDDEN"))
    gpt["local_label"] = str(raw.get("GPT_LOCAL_LABEL") or "")
    gpt["paste_secret"] = str(raw.get("GPT_OAUTH_TOKEN") or raw.get("CODEX_ACCESS_TOKEN") or "")
    gpt["accounts"] = _parse_accounts_blob(raw.get("GPT_ACCOUNTS") or raw.get("CODEX_ACCOUNTS"), "token")

    cursor = cfg["providers"]["cursor"]
    cursor["hidden"] = _flag(raw.get("CURSOR_HIDDEN"))
    cursor["local_label"] = str(raw.get("CURSOR_LOCAL_LABEL") or "")
    cursor["paste_secret"] = str(raw.get("CURSOR_ACCESS_TOKEN") or "")
    cursor["accounts"] = _parse_accounts_blob(raw.get("CURSOR_ACCOUNTS"), "token")

    openrouter = cfg["providers"]["openrouter"]
    openrouter["hidden"] = _flag(raw.get("OPENROUTER_HIDDEN"))
    openrouter["local_label"] = str(raw.get("OPENROUTER_LEGACY_LABEL") or "")
    openrouter["paste_secret"] = str(raw.get("OPENROUTER_API_KEY") or "")
    openrouter["accounts"] = _parse_accounts_blob(raw.get("OPENROUTER_ACCOUNTS"), "key")

    deepseek = cfg["providers"]["deepseek"]
    deepseek["hidden"] = _flag(raw.get("DEEPSEEK_HIDDEN"))
    deepseek["local_label"] = str(raw.get("DEEPSEEK_LEGACY_LABEL") or "")
    deepseek["paste_secret"] = str(raw.get("DEEPSEEK_API_KEY") or "")
    deepseek["accounts"] = _parse_accounts_blob(raw.get("DEEPSEEK_ACCOUNTS"), "key")
    return cfg


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("version") != 1 or "providers" not in raw:
        if any(k.startswith("CLAUDE_") or k in ("HOST", "PORT", "COLLECTOR_MOCK") for k in raw):
            return migrate_legacy(raw)
        return default_config()
    cfg = default_config()
    listen = raw.get("listen") if isinstance(raw.get("listen"), dict) else {}
    cfg["listen"]["host"] = str(listen.get("host") or "0.0.0.0")
    try:
        cfg["listen"]["port"] = int(listen.get("port") or 8787)
    except (TypeError, ValueError):
        cfg["listen"]["port"] = 8787
    cfg["mock"] = bool(raw.get("mock"))
    paths = raw.get("paths") if isinstance(raw.get("paths"), dict) else {}
    cfg["paths"]["claude_credentials"] = str(paths.get("claude_credentials") or "")
    cfg["paths"]["cursor_state_db"] = str(paths.get("cursor_state_db") or "")
    cfg["paths"]["codex_auth"] = str(paths.get("codex_auth") or "")
    providers = raw.get("providers") if isinstance(raw.get("providers"), dict) else {}
    for name in PROVIDERS:
        src = providers.get(name) if isinstance(providers.get(name), dict) else {}
        dest = cfg["providers"][name]
        dest["hidden"] = bool(src.get("hidden"))
        dest["local_label"] = str(src.get("local_label") or "")
        dest["paste_secret"] = str(src.get("paste_secret") or "")
        dest["accounts"] = _parse_accounts_blob(src.get("accounts") or [], "secret")
    # Migração: opencode_go/opencode_zen (antigos) → opencode (unificado).
    # Ambos usavam a mesma chave; consolida a primeira chave encontrada.
    if not cfg["providers"]["opencode"]["paste_secret"] and not cfg["providers"]["opencode"]["accounts"]:
        for old in ("opencode_go", "opencode_zen"):
            src = providers.get(old) if isinstance(providers.get(old), dict) else {}
            if not src:
                continue
            dest = cfg["providers"]["opencode"]
            if not dest["paste_secret"]:
                dest["paste_secret"] = str(src.get("paste_secret") or "")
            if not dest["local_label"]:
                dest["local_label"] = str(src.get("local_label") or "")
            dest["hidden"] = dest["hidden"] or bool(src.get("hidden"))
            dest["accounts"] = _parse_accounts_blob(src.get("accounts") or [], "secret")
    return cfg


def _write(path: Path, cfg: dict[str, Any]) -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def load() -> dict[str, Any]:
    path = config_path()
    if not path.is_file():
        return default_config()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default_config()
    if not isinstance(raw, dict):
        return default_config()
    cfg = _normalize(raw)
    if raw.get("version") != 1:
        _write(path, cfg)
    return cfg


def save(cfg: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize(cfg)
    with _LOCK:
        _write(config_path(), normalized)
    return normalized


def update(mutator: Any) -> dict[str, Any]:
    with _LOCK:
        cfg = load()
        mutator(cfg)
        normalized = _normalize(cfg)
        _write(config_path(), normalized)
        return normalized


def provider(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    return cfg["providers"].get(name) or _empty_provider()
