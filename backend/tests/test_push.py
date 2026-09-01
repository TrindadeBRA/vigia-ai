from __future__ import annotations

from fastapi.testclient import TestClient


def test_vapid_public_key_is_stable(client: TestClient) -> None:
    r1 = client.get("/api/push/vapid-public-key")
    r2 = client.get("/api/push/vapid-public-key")
    assert r1.status_code == 200
    assert r1.json()["public_key"] == r2.json()["public_key"]
    assert len(r1.json()["public_key"]) > 40


def test_subscribe_does_not_leak_private_key(client: TestClient) -> None:
    r = client.post(
        "/api/push/subscribe",
        json={"endpoint": "https://push.example/abc", "p256dh": "p256dh-value", "auth": "auth-value", "ua": "pytest"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    cfg = client.get("/api/push/vapid-public-key").json()
    public_key = cfg["public_key"]

    from app.store import load

    stored = load()
    private_key = stored["push"]["vapid_private_key"]
    assert private_key
    assert private_key != public_key
    # nada de endpoint público deveria devolver a chave privada
    r = client.get("/openapi.json")
    assert private_key not in r.text


def test_unsubscribe_removes_subscription(client: TestClient) -> None:
    endpoint = "https://push.example/xyz"
    client.post("/api/push/subscribe", json={"endpoint": endpoint, "p256dh": "a", "auth": "b", "ua": ""})
    from app.store import load

    assert any(s["endpoint"] == endpoint for s in load()["push"]["subscriptions"])

    r = client.post("/api/push/unsubscribe", json={"endpoint": endpoint})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert not any(s["endpoint"] == endpoint for s in load()["push"]["subscriptions"])


def test_test_endpoint_without_subscriptions_fails(client: TestClient) -> None:
    r = client.post("/api/push/test")
    assert r.status_code == 400


def test_create_alarm_invalid_metric(client: TestClient) -> None:
    r = client.post("/api/alarms", json={"provider": "claude", "metric": "bogus", "threshold": 80})
    assert r.status_code == 400


def test_alarm_crud(client: TestClient) -> None:
    r = client.post("/api/alarms", json={"provider": "claude", "metric": "session_percent", "threshold": 80, "label": "Claude alto"})
    assert r.status_code == 200
    rule = r.json()
    assert rule["provider"] == "claude"
    assert rule["metric"] == "session_percent"
    assert rule["enabled"] is True
    rule_id = rule["id"]

    r = client.get("/api/alarms")
    assert r.status_code == 200
    body = r.json()
    assert any(x["id"] == rule_id for x in body["rules"])
    assert "claude" in body["metrics"]
    assert any(m["key"] == "session_percent" for m in body["metrics"]["claude"])

    r = client.patch(f"/api/alarms/{rule_id}", json={"threshold": 90, "enabled": False})
    assert r.status_code == 200
    updated = next(x for x in client.get("/api/alarms").json()["rules"] if x["id"] == rule_id)
    assert updated["threshold"] == 90
    assert updated["enabled"] is False

    r = client.delete(f"/api/alarms/{rule_id}")
    assert r.status_code == 200
    assert not any(x["id"] == rule_id for x in client.get("/api/alarms").json()["rules"])


def test_patch_unknown_alarm_404(client: TestClient) -> None:
    r = client.patch("/api/alarms/does-not-exist", json={"enabled": False})
    assert r.status_code == 404
