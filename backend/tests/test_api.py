from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.store import default_config, save


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("COLLECTOR_DATA", str(tmp_path))
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "8787")
    cfg = default_config()
    cfg["mock"] = True
    save(cfg)
    app = create_app()
    return TestClient(app)


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "version" in body


def test_usage_mock_schema(client: TestClient) -> None:
    r = client.get("/usage")
    assert r.status_code == 200
    body = r.json()
    assert "updated_at" in body
    assert isinstance(body["claude"], list)
    assert isinstance(body["cursor"], list)
    assert body["claude"][0]["ok"] is True
    assert "session_percent" in body["claude"][0]


def test_config_does_not_leak_token(client: TestClient) -> None:
    from app.store import load, save as save_cfg

    cfg = load()
    cfg["providers"]["claude"]["paste_secret"] = "super-secret-token-value"
    save_cfg(cfg)
    r = client.get("/api/config")
    assert r.status_code == 200
    text = r.text
    assert "super-secret-token-value" not in text
    body = r.json()
    suffix = body["providers"]["claude"].get("suffix")
    if suffix:
        assert suffix == "alue"


def test_openapi_available(client: TestClient) -> None:
    r = client.get("/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    assert "/usage" in spec["paths"]
    assert "/api/config" in spec["paths"]
