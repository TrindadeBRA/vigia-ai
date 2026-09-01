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


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "version" in body
    assert "panel_lan" in body
    assert isinstance(body["panel_lan"], str)
    assert body["interval_s"] == 60
    if body["panel_lan"]:
        assert body["panel_lan"].startswith("http://")
        assert body["panel_lan"].endswith("/")


def test_usage_mock_schema(client: TestClient) -> None:
    r = client.get("/usage")
    assert r.status_code == 200
    body = r.json()
    assert "updated_at" in body
    assert isinstance(body["claude"], list)
    assert isinstance(body["gpt"], list)
    assert isinstance(body["cursor"], list)
    assert isinstance(body["openrouter"], list)
    assert isinstance(body["deepseek"], list)
    assert isinstance(body["opencode"], list)
    assert body["claude"][0]["ok"] is True
    assert "session_percent" in body["claude"][0]
    assert body["gpt"][0]["ok"] is True
    assert "plan" in body["gpt"][0]
    assert "rolling_percent" in body["opencode"][0]
    assert "weekly_percent" in body["opencode"][0]
    assert "monthly_percent" in body["opencode"][0]
    assert body["opencode"][0]["ok"] is True
    assert "remaining_cents" in body["opencode"][0]


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
    assert "gpt" in body["providers"]


def test_openapi_available(client: TestClient) -> None:
    r = client.get("/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    assert "/usage" in spec["paths"]
    assert "/events" in spec["paths"]
    events = spec["paths"]["/events"]["get"]
    assert events["operationId"] == "get_events"
    assert "text/event-stream" in events["responses"]["200"]["content"]
    headers = events["responses"]["200"]["headers"]
    assert "Connection" in headers
    assert "Content-Type" in headers
    assert "UsagePayload" in spec["components"]["schemas"]
    tag_names = {t["name"] for t in spec["tags"]}
    assert tag_names >= {"usage", "config"}
    assert "/api/config" in spec["paths"]


def test_sse_frame_matches_usage_contract(client: TestClient) -> None:
    from app.hub import format_sse

    body = client.get("/usage").json()
    frame = format_sse(body)
    assert frame.startswith("event: usage\n")
    assert "data: {" in frame
    assert '"claude"' in frame
    assert '"gpt"' in frame
    assert frame.endswith("\n\n")
