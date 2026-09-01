from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.store import default_config, save


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("COLLECTOR_DATA", str(tmp_path))
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "8787")
    monkeypatch.setenv("USAGE_INTERVAL_S", "60")
    cfg = default_config()
    cfg["mock"] = True
    save(cfg)
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
