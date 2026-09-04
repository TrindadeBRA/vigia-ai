"""Caminhos e flags de ambiente (Docker overlay, data dir)."""

from __future__ import annotations

import os
from pathlib import Path


def in_docker() -> bool:
    if os.environ.get("COLLECTOR_IN_DOCKER", "").strip().lower() in ("1", "true", "yes"):
        return True
    return Path("/.dockerenv").is_file()


def data_dir() -> Path:
    override = os.environ.get("COLLECTOR_DATA") or os.environ.get("VIGIA_DATA")
    if override:
        return Path(override).expanduser()
    return Path(__file__).resolve().parent.parent / "data"


def config_path() -> Path:
    return data_dir() / "config.json"


def frontend_dist() -> Path | None:
    override = os.environ.get("VIGIA_FRONTEND_DIST", "").strip()
    if override:
        path = Path(override).expanduser()
        return path if path.is_dir() else None
    here = Path(__file__).resolve().parent.parent.parent
    dist = here / "frontend" / "dist"
    return dist if dist.is_dir() else None
