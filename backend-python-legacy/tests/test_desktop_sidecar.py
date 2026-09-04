"""Handshake do sidecar — é o contrato com o processo Electron (desktop/src/sidecar.ts)."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import urllib.request
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
READY = "VIGIA_READY "
ERROR = "VIGIA_ERROR "


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _spawn(port: int, data_dir: Path) -> subprocess.Popen[str]:
    return subprocess.Popen(
        [sys.executable, "-m", "app.desktop"],
        cwd=BACKEND,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1,
        env={
            "PATH": "/usr/bin:/bin",
            "HOME": str(data_dir),
            "HOST": "127.0.0.1",
            "PORT": str(port),
            "COLLECTOR_DATA": str(data_dir),
            "VIGIA_LOG_LEVEL": "warning",
            "PYTHONPATH": str(BACKEND),
        },
    )


@pytest.mark.slow
def test_handshake_e_encerramento_pela_stdin(tmp_path: Path):
    """Sobe, anuncia VIGIA_READY, responde /health e morre quando a stdin fecha."""
    port = _free_port()
    proc = _spawn(port, tmp_path)
    try:
        line = proc.stdout.readline()  # type: ignore[union-attr]
        assert line.startswith(READY), line
        info = json.loads(line[len(READY) :])
        assert info["port"] == port
        assert info["pid"] == proc.pid
        assert Path(info["data_dir"]) == tmp_path

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=10) as res:
            assert json.load(res)["ok"] is True

        # O Electron morrendo fecha a stdin — sem isso viraria órfão no Windows.
        proc.stdin.close()  # type: ignore[union-attr]
        assert proc.wait(timeout=20) == 0
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=10)


@pytest.mark.slow
def test_porta_ocupada_devolve_codigo_3(tmp_path: Path):
    """A placa tem a URL no secrets.h: conflito de porta é decisão da UI, não do coletor."""
    with socket.socket() as busy:
        busy.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        busy.bind(("127.0.0.1", 0))
        busy.listen(1)
        port = int(busy.getsockname()[1])

        proc = _spawn(port, tmp_path)
        out, _ = proc.communicate(timeout=30)

    assert proc.returncode == 3, out
    line = next(ln for ln in out.splitlines() if ln.startswith(ERROR))
    assert json.loads(line[len(ERROR) :])["code"] == "port_in_use"


def test_parent_pipe_accepts_socketpair(monkeypatch: pytest.MonkeyPatch) -> None:
    """O libuv (Node/Electron) faz o stdio com socketpair(), não com pipe().

    Testar só S_ISFIFO desligava o vigia de stdin exatamente dentro do
    Electron: o coletor ignorava o fechamento da stdin e só morria no SIGKILL
    depois do timeout de 10 s. TTY e /dev/null continuam de fora — são char
    devices, e vigiá-los mataria o coletor assim que ele subisse.
    """
    from app.desktop import _parent_pipe

    parent, child = socket.socketpair()
    with parent, child:
        monkeypatch.setattr("sys.stdin", child.makefile("r"))
        assert _parent_pipe() is True


def test_parent_pipe_ignores_tty_and_devnull(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.desktop import _parent_pipe

    with open(os.devnull) as devnull:
        monkeypatch.setattr("sys.stdin", devnull)
        assert _parent_pipe() is False
