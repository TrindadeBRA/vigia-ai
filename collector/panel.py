"""Painel de configuração do coletor: status, IPs/portas e gravação em data/config.json."""

from __future__ import annotations

import os
import socket
from pathlib import Path
from typing import Any

from claude_oauth import credentials_path, env_claude_token
from cursor_state import read_item, state_db_path
from docker_ctl import docker_status
from store import KEYS as ALLOWED_KEYS
from store import apply as apply_store
from store import update as update_store

HERE = Path(__file__).resolve().parent
WEB_DIR = HERE / "web"

_SECRET_KEYS = {
    "CLAUDE_OAUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CURSOR_ACCESS_TOKEN",
    "OPENROUTER_API_KEY",
}


def in_docker() -> bool:
    if os.environ.get("COLLECTOR_IN_DOCKER", "").strip() in ("1", "true", "yes"):
        return True
    return Path("/.dockerenv").is_file()


def reload_env() -> None:
    apply_store(skip=frozenset({"HOST", "PORT"}), override=True)


def _suffix(token: str) -> str | None:
    token = token.strip()
    if len(token) < 8:
        return None
    return token[-4:]


def lan_ipv4() -> list[str]:
    found: list[str] = []
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.3)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        if ip and not ip.startswith("127."):
            found.append(ip)
    except OSError:
        pass
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in found:
                found.append(ip)
    except OSError:
        pass
    return found


def _claude_card() -> dict[str, Any]:
    token = env_claude_token()
    if token:
        return {
            "source": "env",
            "label": "Token salvo neste coletor",
            "configured": True,
            "suffix": _suffix(token),
            "mode": "paste",
        }
    creds = credentials_path()
    if creds.is_file():
        return {
            "source": "credentials",
            "label": "Arquivo do Claude Code neste computador",
            "configured": True,
            "suffix": None,
            "mode": "local",
        }
    if in_docker():
        return {
            "source": "missing",
            "label": "No Docker o login do Mac não entra — cole o token abaixo",
            "configured": False,
            "suffix": None,
            "mode": "need_paste",
        }
    return {
        "source": "app",
        "label": "Vai usar o Claude Code já logado neste Mac",
        "configured": True,
        "suffix": None,
        "mode": "local",
    }


def _cursor_card() -> dict[str, Any]:
    env_tok = os.environ.get("CURSOR_ACCESS_TOKEN", "").strip()
    if env_tok:
        return {
            "source": "env",
            "label": "Token salvo neste coletor",
            "configured": True,
            "suffix": _suffix(env_tok),
            "mode": "paste",
        }
    db = state_db_path()
    if db.is_file() and read_item(db, "cursorAuth/accessToken"):
        return {
            "source": "vscdb",
            "label": "Vai usar o Cursor já logado neste computador",
            "configured": True,
            "suffix": None,
            "mode": "local",
        }
    if in_docker():
        return {
            "source": "missing",
            "label": "No Docker o Cursor do Mac não entra — cole o token abaixo",
            "configured": False,
            "suffix": None,
            "mode": "need_paste",
        }
    return {
        "source": "missing",
        "label": "Abra o Cursor logado neste Mac — ou cole o token se estiver em outro PC",
        "configured": False,
        "suffix": None,
        "mode": "need_local",
    }


def _openrouter_card() -> dict[str, Any]:
    token = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if token:
        return {
            "source": "env",
            "label": "API key salva neste coletor",
            "configured": True,
            "suffix": _suffix(token),
            "mode": "paste",
        }
    return {
        "source": "missing",
        "label": "Falta a key — o OpenRouter não tem app neste Mac",
        "configured": False,
        "suffix": None,
        "mode": "need_paste",
    }


def config_payload(listen_host: str, listen_port: int) -> dict[str, Any]:
    reload_env()
    ips = lan_ipv4()
    port = listen_port
    usage_paths = [f"http://127.0.0.1:{port}/usage"]
    panel_paths = [f"http://127.0.0.1:{port}/"]
    for ip in ips:
        usage_paths.append(f"http://{ip}:{port}/usage")
        panel_paths.append(f"http://{ip}:{port}/")
    usage_local = f"http://127.0.0.1:{port}/usage"
    usage_lan = f"http://{ips[0]}:{port}/usage" if ips else usage_local
    secrets_h = f'#define USAGE_URL "{usage_lan}"'
    env_port = (os.environ.get("PORT") or "").strip()
    restart = bool(env_port) and env_port != str(listen_port)
    return {
        "ok": True,
        "in_docker": in_docker(),
        "mock": os.environ.get("COLLECTOR_MOCK", "").strip() in ("1", "true", "yes"),
        "listen": {"host": listen_host, "port": listen_port},
        "urls": {
            "panel": panel_paths,
            "usage": usage_paths,
            "usage_lan": usage_lan,
            "usage_local": usage_local,
            "secrets_h": secrets_h,
            "board_ok": bool(ips),
        },
        "lan_ips": ips,
        "port_file": env_port or str(listen_port),
        "restart_needed_for_port": restart,
        "providers": {
            "claude": _claude_card(),
            "cursor": _cursor_card(),
            "openrouter": _openrouter_card(),
        },
        "docker": docker_status(),
        "fields": {
            "HOST": os.environ.get("HOST", "0.0.0.0"),
            "PORT": str(listen_port),
            "CLAUDE_CREDENTIALS_PATH": os.environ.get("CLAUDE_CREDENTIALS_PATH", ""),
            "CURSOR_STATE_DB": os.environ.get("CURSOR_STATE_DB", ""),
            "COLLECTOR_MOCK": os.environ.get("COLLECTOR_MOCK", ""),
        },
    }


def save_config(body: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(body, dict):
        return {"ok": False, "error": "JSON inválido"}
    updates: dict[str, str] = {}
    for key in ALLOWED_KEYS:
        if key not in body:
            continue
        raw = body[key]
        if raw is None:
            continue
        val = str(raw).strip()
        if key in _SECRET_KEYS and val in ("", "********"):
            continue
        if key == "PORT" and val:
            try:
                n = int(val)
            except ValueError:
                return {"ok": False, "error": "PORT precisa ser um número"}
            if n < 1 or n > 65535:
                return {"ok": False, "error": "PORT fora do intervalo 1–65535"}
        if key == "COLLECTOR_MOCK" and val.lower() in ("true", "yes"):
            val = "1"
        if key == "COLLECTOR_MOCK" and val.lower() in ("false", "no", "0"):
            val = ""
        updates[key] = val
    if not updates:
        return {"ok": True, "changed": [], "note": "nada para gravar"}
    clear_keys = [k for k, v in list(updates.items()) if v == "" and k not in _SECRET_KEYS]
    update_store(updates)
    for key, val in updates.items():
        if val:
            os.environ[key] = val
        else:
            os.environ.pop(key, None)
    reload_env()
    return {
        "ok": True,
        "changed": [k for k in updates if k not in _SECRET_KEYS or updates[k]],
        "cleared": clear_keys,
        "restart_needed_for_port": "PORT" in updates,
    }


def clear_secret(name: str) -> dict[str, Any]:
    if name not in _SECRET_KEYS:
        return {"ok": False, "error": "chave não é segredo gerenciável"}
    update_store({name: ""})
    os.environ.pop(name, None)
    if name == "CLAUDE_OAUTH_TOKEN":
        update_store({"CLAUDE_CODE_OAUTH_TOKEN": ""})
        os.environ.pop("CLAUDE_CODE_OAUTH_TOKEN", None)
    reload_env()
    return {"ok": True, "cleared": name}
