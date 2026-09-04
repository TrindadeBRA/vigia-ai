"""Entrypoint do coletor quando ele roda como *sidecar* do app Electron.

Diferenças para `app.main`:

- o socket é aberto **aqui**, antes do uvicorn, para distinguir "porta ocupada"
  de qualquer outra falha e devolver isso ao processo pai de forma legível;
- imprime `VIGIA_READY {...}` / `VIGIA_ERROR {...}` na stdout — é o handshake que
  o Electron espera antes de mostrar a janela;
- encerra quando a stdin fecha (o pai morreu), além de SIGINT/SIGTERM. Sem isso
  o coletor viraria processo órfão no Windows, onde não há SIGTERM.
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import stat
import sys
import threading
from typing import Any

from app import __version__

# Códigos de saída que o Electron interpreta (ver desktop/src/sidecar.ts).
EXIT_PORT_IN_USE = 3
EXIT_BIND_FAILED = 4
EXIT_STARTUP_FAILED = 5

READY_PREFIX = "VIGIA_READY "
ERROR_PREFIX = "VIGIA_ERROR "


def _emit(prefix: str, payload: dict[str, Any]) -> None:
    """Uma linha, sempre flushada — o pai lê isso linha a linha."""
    sys.stdout.write(prefix + json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _bind(host: str, port: int) -> socket.socket:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Sem SO_REUSEADDR no Windows: lá ele permite dois processos na mesma porta.
    if not sys.platform.startswith("win"):
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((host, port))
    except OSError as exc:
        sock.close()
        in_use = exc.errno in (48, 98, 10048) or "in use" in str(exc).lower()
        _emit(
            ERROR_PREFIX,
            {
                "code": "port_in_use" if in_use else "bind_failed",
                "host": host,
                "port": port,
                "detail": str(exc),
            },
        )
        raise SystemExit(EXIT_PORT_IN_USE if in_use else EXIT_BIND_FAILED) from exc
    sock.listen(128)
    sock.set_inheritable(True)
    return sock


def _parent_pipe() -> bool:
    """A stdin é um pipe do processo pai?

    Só nesse caso o EOF significa "o pai morreu". Rodando solto no terminal a
    stdin é um TTY, e em background é /dev/null — vigiar os dois faria o
    coletor encerrar assim que subisse.
    """
    if os.environ.get("VIGIA_WATCH_STDIN", "").strip() == "0":
        return False
    try:
        return stat.S_ISFIFO(os.fstat(sys.stdin.fileno()).st_mode)
    except (OSError, ValueError, AttributeError):
        return False


def _watch_parent(shutdown: "threading.Event") -> None:
    """EOF na stdin = o Electron morreu. Encerra em vez de virar órfão."""
    try:
        while sys.stdin.readline():
            pass
    except (OSError, ValueError):
        pass
    shutdown.set()


def main() -> None:
    import uvicorn

    from app.config import data_dir
    from app.main import app
    from app.netutil import lan_ipv4
    from app.store import load

    cfg = load()
    host = os.environ.get("HOST") or str(cfg["listen"]["host"] or "127.0.0.1")
    port = int(os.environ.get("PORT") or cfg["listen"]["port"] or 8787)

    sock = _bind(host, port)
    bound_host, bound_port = sock.getsockname()[:2]
    app.state.listen_host = host
    app.state.listen_port = bound_port

    config = uvicorn.Config(
        app,
        log_level=os.environ.get("VIGIA_LOG_LEVEL", "info"),
        timeout_keep_alive=0,
        # Sem isso o uvicorn espera os streams SSE fecharem — e eles não fecham.
        timeout_graceful_shutdown=int(os.environ.get("VIGIA_GRACEFUL_S", "3")),
        # O Electron gerencia o ciclo de vida; sinais tratados abaixo.
        access_log=False,
    )
    server = uvicorn.Server(config)
    stop = threading.Event()

    async def run() -> None:
        serve = asyncio.ensure_future(server.serve(sockets=[sock]))
        while not server.started and not serve.done():
            await asyncio.sleep(0.02)
        if serve.done():  # falhou antes de subir
            _emit(ERROR_PREFIX, {"code": "startup_failed", "detail": "servidor não iniciou"})
            raise SystemExit(EXIT_STARTUP_FAILED)
        _emit(
            READY_PREFIX,
            {
                "version": __version__,
                "host": bound_host,
                "port": bound_port,
                "lan": lan_ipv4(),
                "data_dir": str(data_dir()),
                "pid": os.getpid(),
            },
        )
        if _parent_pipe():
            threading.Thread(target=_watch_parent, args=(stop,), daemon=True).start()
        while not stop.is_set() and not serve.done():
            await asyncio.sleep(0.25)
        if not serve.done():
            server.should_exit = True
        await serve

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
