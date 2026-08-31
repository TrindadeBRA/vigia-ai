"""Controle opcional do Docker Compose (mesmo diretório do coletor)."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
COMPOSE_FILE = HERE / "compose.yaml"


def _in_docker() -> bool:
    if os.environ.get("COLLECTOR_IN_DOCKER", "").strip() in ("1", "true", "yes"):
        return True
    return Path("/.dockerenv").is_file()


def _run(args: list[str], timeout: float = 20.0) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(
            args,
            cwd=HERE,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError:
        return 127, "", "comando não encontrado"
    except subprocess.TimeoutExpired:
        return 124, "", "tempo esgotado"
    return proc.returncode, proc.stdout or "", proc.stderr or ""


def docker_status() -> dict[str, Any]:
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return {
            "ok": True,
            "installed": False,
            "daemon": False,
            "in_docker": _in_docker(),
            "compose_up": False,
            "hint": "Instale o Docker Desktop se quiser o coletor em container. No Mac da mesa o Python local basta.",
        }
    code, out, err = _run([docker_bin, "info"], timeout=8)
    daemon = code == 0
    compose_up = False
    detail = ""
    if daemon:
        code2, out2, err2 = _run(
            [docker_bin, "compose", "ps", "--status", "running", "-q"],
            timeout=10,
        )
        compose_up = code2 == 0 and bool(out2.strip())
        if not compose_up:
            detail = (err2 or out2 or "").strip()[:240]
    else:
        detail = (err or out or "Docker instalado, mas o daemon não respondeu (abra o Docker Desktop)").strip()[:240]
    inside = _in_docker()
    if inside:
        hint = "Este painel já está dentro do container. Parar derruba esta página."
    elif compose_up:
        hint = "O container está no ar. Se você também rodou ./dev-collector.sh, a porta 8787 pode estar duplicada."
    elif daemon:
        hint = "Para subir o container, a porta 8787 precisa estar livre. Se este painel é o Python local, dê Ctrl+C no terminal e use Iniciar Docker, ou rode ./dev-collector.sh docker."
    else:
        hint = "Abra o Docker Desktop e tente de novo."
    return {
        "ok": True,
        "installed": True,
        "daemon": daemon,
        "in_docker": inside,
        "compose_up": compose_up,
        "detail": detail,
        "hint": hint,
    }


def docker_up() -> dict[str, Any]:
    st = docker_status()
    if not st.get("installed") or not st.get("daemon"):
        return {"ok": False, "error": st.get("hint") or "Docker indisponível", "status": st}
    if st.get("in_docker"):
        return {"ok": False, "error": "Já está no Docker.", "status": st}
    docker_bin = shutil.which("docker")
    assert docker_bin
    if not COMPOSE_FILE.is_file():
        return {"ok": False, "error": "compose.yaml não encontrado em collector/", "status": st}
    log_path = HERE / ".docker-last.log"
    with log_path.open("w", encoding="utf-8") as logf:
        subprocess.Popen(
            [docker_bin, "compose", "up", "-d", "--build"],
            cwd=HERE,
            stdout=logf,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    return {
        "ok": True,
        "hint": (
            "Docker Compose pedido. Este Python ainda usa a porta 8787 — "
            "dê Ctrl+C no terminal agora para o container subir, depois recarregue o painel."
        ),
        "status": st,
    }


def docker_down() -> dict[str, Any]:
    st = docker_status()
    if not st.get("installed") or not st.get("daemon"):
        return {"ok": False, "error": st.get("hint") or "Docker indisponível", "status": st}
    docker_bin = shutil.which("docker")
    assert docker_bin
    code, out, err = _run([docker_bin, "compose", "down"], timeout=60)
    text = (err or out).strip()[:800]
    if code != 0:
        return {"ok": False, "error": text or f"compose exit {code}", "status": docker_status()}
    return {"ok": True, "log": text, "status": docker_status()}
