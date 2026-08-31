#!/usr/bin/env python3
"""Coletor de cotas Claude + Cursor. Serve GET /usage para a ESP32."""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from formatting import utc_now
from http_util import load_dotenv
from providers.claude import _claude_fail, fetch_claude
from providers.cursor import _cursor_fail, fetch_cursor
from providers.openrouter import _openrouter_fail, fetch_openrouter


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def mock_payload() -> dict[str, Any]:
    return {
        "updated_at": utc_now(),
        "claude": {
            "ok": True,
            "error": None,
            "session_percent": 42.0,
            "session_resets_at": utc_now(),
            "weekly_percent": 18.0,
            "weekly_resets_at": utc_now(),
        },
        "cursor": {
            "ok": True,
            "error": None,
            "percent": 70.0,
            "other_percent": 73.0,
            "used_cents": 0,
            "limit_cents": 1000,
            "bonus_cents": 0,
            "cycle_end": "01/09",
            "plan": "pro",
        },
        "openrouter": {
            "ok": True,
            "error": None,
            "percent": 66.6,
            "limit_cents": 1000,
            "used_cents": 666,
            "remaining_cents": 334,
        },
    }


def build_payload() -> dict[str, Any]:
    if os.environ.get("COLLECTOR_MOCK", "").strip() in ("1", "true", "yes"):
        return mock_payload()
    claude: dict[str, Any]
    cursor: dict[str, Any]
    openrouter: dict[str, Any]
    try:
        claude = fetch_claude()
    except Exception as exc:  # noqa: BLE001 — isolar provedor
        claude = _claude_fail(str(exc))
    try:
        cursor = fetch_cursor()
    except Exception as exc:  # noqa: BLE001
        cursor = _cursor_fail(str(exc))
    try:
        openrouter = fetch_openrouter()
    except Exception as exc:  # noqa: BLE001
        openrouter = _openrouter_fail(str(exc))
    return {
        "updated_at": utc_now(),
        "claude": claude,
        "cursor": cursor,
        "openrouter": openrouter,
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

    def _send(self, code: int, obj: Any) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/health", "/"):
            self._send(200, {"ok": True})
            return
        if path == "/usage":
            payload = build_payload()
            for name in ("claude", "cursor"):
                block = payload.get(name) or {}
                if isinstance(block, dict) and not block.get("ok"):
                    print(f"[{utc_now()}] ERRO {name}: {block.get('error')}")
            self._send(200, payload)
            return
        self._send(404, {"ok": False, "error": "not found"})


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
    here = Path(__file__).resolve().parent
    load_dotenv(here / ".env")
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT") or 8787)
    print(f"coletor em http://{host}:{port}/usage")
    print(f"repo {_repo_root()}")
    CollectorServer.allow_reuse_address = True
    try:
        httpd = CollectorServer((host, port), Handler)
    except OSError as exc:
        if getattr(exc, "errno", None) == 48:
            print(f"porta {port} ocupada. Feche o outro python3 server.py ou: lsof -nP -iTCP:{port}")
            raise SystemExit(1) from exc
        raise
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nencerrando")
        httpd.server_close()


if __name__ == "__main__":
    main()
