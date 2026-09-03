from __future__ import annotations

from fastapi.testclient import TestClient


def test_board_empty_by_default(client: TestClient) -> None:
    r = client.get("/api/board")
    assert r.status_code == 200
    assert r.json() == {}


def test_board_roundtrip(client: TestClient) -> None:
    payload = {"boards": {"8": {"size": {"claude:local": "md"}, "pos": {"claude:local": {"r": 0, "c": 0}}}}}
    r = client.put("/api/board", json=payload)
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r = client.get("/api/board")
    assert r.status_code == 200
    assert r.json() == payload


def test_board_rejects_invalid_json(client: TestClient) -> None:
    r = client.put("/api/board", content=b"not json", headers={"content-type": "application/json"})
    assert r.status_code == 400


def test_board_delete_clears_it(client: TestClient) -> None:
    client.put("/api/board", json={"boards": {"4": {"size": {}, "pos": {}}}})
    r = client.delete("/api/board")
    assert r.status_code == 200
    r = client.get("/api/board")
    assert r.json() == {}
