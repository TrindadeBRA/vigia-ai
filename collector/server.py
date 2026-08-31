#!/usr/bin/env python3
"""Coletor de cotas. Serve GET /usage (ESP32) e o painel web de configuração."""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from docker_ctl import docker_down, docker_up
from formatting import utc_now
from store import apply as apply_store
from store import env_flag
from panel import WEB_DIR, add_account, clear_secret, config_payload, lan_ipv4, reload_env, remove_account, save_config
from providers.claude import _claude_fail, fetch_claude_accounts
from providers.cursor import _cursor_fail, fetch_cursor_accounts
from providers.deepseek import _deepseek_fail, fetch_deepseek_accounts
from providers.openrouter import _openrouter_fail, fetch_openrouter_accounts

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8787


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def mock_payload() -> dict[str, Any]:
    now = utc_now()
    return {
        "updated_at": now,
        "claude": [
            {
                "id": "local",
                "label": "",
                "ok": True,
                "error": None,
                "session_percent": 42.0,
                "session_resets_at": now,
                "weekly_percent": 18.0,
                "weekly_resets_at": now,
                "sonnet_percent": None,
                "sonnet_resets_at": None,
                "opus_percent": None,
                "opus_resets_at": None,
            }
        ],
        "cursor": [
            {
                "id": "local",
                "label": "",
                "ok": True,
                "error": None,
                "percent": 70.0,
                "other_percent": 73.0,
                "used_cents": 0,
                "limit_cents": 1000,
                "remaining_cents": 1000,
                "bonus_cents": 0,
                "cycle_end": "01/09",
                "plan": "pro",
                "requests_used": None,
                "requests_limit": None,
            }
        ],
        "openrouter": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "percent": 66.6,
                "limit_cents": 1000,
                "used_cents": 666,
                "remaining_cents": 334,
            }
        ],
        "deepseek": [
            {
                "id": "legacy",
                "label": "",
                "ok": True,
                "error": None,
                "percent": 25.0,
                "limit_cents": 1000,
                "used_cents": 250,
                "remaining_cents": 750,
            }
        ],
    }


def build_payload() -> dict[str, Any]:
    reload_env()
    if env_flag("COLLECTOR_MOCK"):
        payload = mock_payload()
        if env_flag("CLAUDE_HIDDEN"):
            payload["claude"] = []
        if env_flag("CURSOR_HIDDEN"):
            payload["cursor"] = []
        return payload
    # Cada fetch_*_accounts() já isola erro por conta (uma conta ruim não
    # derruba as outras do mesmo provedor); o try/except aqui é só rede de
    # segurança pra um provedor inteiro nunca derrubar o HTTP 200 do /usage.
    try:
        claude = fetch_claude_accounts()
    except Exception as exc:  # noqa: BLE001 — isolar provedor
        claude = [{"id": "local", "label": "", **_claude_fail(str(exc))}]
    try:
        cursor = fetch_cursor_accounts()
    except Exception as exc:  # noqa: BLE001
        cursor = [{"id": "local", "label": "", **_cursor_fail(str(exc))}]
    try:
        openrouter = fetch_openrouter_accounts()
    except Exception as exc:  # noqa: BLE001
        openrouter = [{"id": "legacy", "label": "", **_openrouter_fail(str(exc))}]
    try:
        deepseek = fetch_deepseek_accounts()
    except Exception as exc:  # noqa: BLE001
        deepseek = [{"id": "legacy", "label": "", **_deepseek_fail(str(exc))}]
    return {
        "updated_at": utc_now(),
        "claude": claude,
        "cursor": cursor,
        "openrouter": openrouter,
        "deepseek": deepseek,
    }


class Handler(BaseHTTPRequestHandler):
    # HTTP/1.0 + Connection: close — o HTTPClient da ESP32 (Wokwi) abre TCP e
    # às vezes reseta keep-alive 1.1 antes de ler o body.
    protocol_version = "HTTP/1.0"
    timeout = 20

    def handle(self) -> None:
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError):
            return

    def handle_one_request(self) -> None:
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError):
            self.close_connection = True

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{utc_now()}] {self.address_string()} {fmt % args}")

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Connection", "close")
        self.send_header("Cache-Control", "no-store")

    def _send_json(self, code: int, obj: Any) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        self.wfile.write(raw)

    def _send_html(self, path: Path) -> None:
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        self.wfile.write(raw)

    def _send_static(self, path: Path, content_type: str) -> None:
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            obj = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}
        return obj if isinstance(obj, dict) else {}

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/config":
            body = self._read_json()
            result = save_config(body)
            if result.get("ok") and "PORT" in body:
                try:
                    result["restart_needed_for_port"] = int(str(body["PORT"])) != LISTEN_PORT
                except (TypeError, ValueError):
                    pass
            self._send_json(200 if result.get("ok") else 400, result)
            return
        if path == "/api/docker":
            body = self._read_json()
            action = str((body or {}).get("action") or "")
            if action == "up":
                result = docker_up()
            elif action == "down":
                result = docker_down()
            else:
                result = {"ok": False, "error": "action deve ser up ou down"}
            self._send_json(200 if result.get("ok") else 400, result)
            return
        if path == "/api/config/clear":
            name = str((self._read_json() or {}).get("name") or "")
            result = clear_secret(name)
            self._send_json(200 if result.get("ok") else 400, result)
            return
        if path == "/api/config/account":
            body = self._read_json()
            provider = str(body.get("provider") or "")
            label = str(body.get("label") or "")
            secret = str(body.get("token") or body.get("key") or "")
            result = add_account(provider, label, secret)
            self._send_json(200 if result.get("ok") else 400, result)
            return
        if path == "/api/config/account/delete":
            body = self._read_json()
            provider = str(body.get("provider") or "")
            account_id = str(body.get("id") or "")
            result = remove_account(provider, account_id)
            self._send_json(200 if result.get("ok") else 400, result)
            return
        self._send_json(404, {"ok": False, "error": "not found"})

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/favicon.ico":
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        if path in ("/", "/index.html", "/panel"):
            self._send_html(WEB_DIR / "index.html")
            return
        if path in ("/display", "/display.html", "/display/"):
            self._send_html(WEB_DIR / "display.html")
            return
        if path.startswith("/vendor/") and "/" not in path[len("/vendor/") :]:
            name = path[len("/vendor/") :]
            if name in ("react.production.min.js", "react-dom.production.min.js"):
                self._send_static(WEB_DIR / "vendor" / name, "application/javascript; charset=utf-8")
                return
            self._send_json(404, {"ok": False, "error": "not found"})
            return
        if path.startswith("/icons/") and "/" not in path[len("/icons/") :]:
            name = path[len("/icons/") :]
            if name in ("claude.png", "cursor.png", "openrouter.png", "deepseek.png"):
                self._send_static(WEB_DIR / "icons" / name, "image/png")
                return
            self._send_json(404, {"ok": False, "error": "not found"})
            return
        if path == "/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "panel": "/",
                    "usage": "/usage",
                    "listen": {"host": LISTEN_HOST, "port": LISTEN_PORT},
                },
            )
            return
        if path == "/api/config":
            self._send_json(200, config_payload(LISTEN_HOST, LISTEN_PORT))
            return
        if path == "/usage":
            payload = build_payload()
            for name in ("claude", "cursor", "openrouter", "deepseek"):
                for acc in payload.get(name) or []:
                    if isinstance(acc, dict) and not acc.get("ok"):
                        who = acc.get("label") or acc.get("id") or "?"
                        print(f"[{utc_now()}] ERRO {name} ({who}): {acc.get('error')}")
            self._send_json(200, payload)
            return
        self._send_json(404, {"ok": False, "error": "not found"})


class CollectorServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request: Any, client_address: Any) -> None:
        err = sys.exc_info()[1]
        if isinstance(
            err, (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError)
        ):
            return
        super().handle_error(request, client_address)


def main() -> None:
    global LISTEN_HOST, LISTEN_PORT
    apply_store(override=False)
    LISTEN_HOST = os.environ.get("HOST", "0.0.0.0")
    LISTEN_PORT = int(os.environ.get("PORT") or 8787)
    hosts = ["127.0.0.1", *lan_ipv4()]
    for host in hosts:
        label = "  (LAN — use este em outro aparelho)" if host != "127.0.0.1" else ""
        print(f"painel     http://{host}:{LISTEN_PORT}/{label}")
        print(f"mostrador  http://{host}:{LISTEN_PORT}/display{label}")
        print(f"usage      http://{host}:{LISTEN_PORT}/usage{label}")
    print(f"repo {_repo_root()}")
    CollectorServer.allow_reuse_address = True
    try:
        httpd = CollectorServer((LISTEN_HOST, LISTEN_PORT), Handler)
    except OSError as exc:
        if getattr(exc, "errno", None) == 48:
            print(
                f"porta {LISTEN_PORT} ocupada. Feche o outro python3 server.py ou: "
                f"lsof -nP -iTCP:{LISTEN_PORT}"
            )
            raise SystemExit(1) from exc
        raise
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nencerrando")
        httpd.server_close()


if __name__ == "__main__":
    main()
