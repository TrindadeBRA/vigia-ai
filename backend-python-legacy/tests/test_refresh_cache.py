from __future__ import annotations

import pytest

from app.http_util import HttpError
from app.refresh_cache import FORCEABLE, RefreshCache, fingerprint


def test_due_until_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"t": 1000.0}
    monkeypatch.setattr("app.refresh_cache.time.monotonic", lambda: clock["t"])
    c = RefreshCache()
    assert c.due("adsense", fingerprint="a") is True
    c.store("adsense", [{"ok": True}], fingerprint="a")
    assert c.due("adsense", fingerprint="a") is False
    clock["t"] += 299
    assert c.due("adsense", fingerprint="a") is False
    clock["t"] += 2
    assert c.due("adsense", fingerprint="a") is True


def test_fingerprint_change_forces_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.refresh_cache.time.monotonic", lambda: 1000.0)
    c = RefreshCache()
    c.store("bitcoin", [{"ok": True}], fingerprint="old")
    assert c.due("bitcoin", fingerprint="old") is False
    assert c.due("bitcoin", fingerprint="new-wallet") is True


def test_force_quota_skips_market(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.refresh_cache.time.monotonic", lambda: 1000.0)
    c = RefreshCache()
    c.store("claude", [{"ok": True}], fingerprint="x")
    c.store("bitcoin", [{"ok": True}], fingerprint="x")
    assert "claude" in FORCEABLE
    assert "bitcoin" not in FORCEABLE
    assert c.due("claude", fingerprint="x", force=True) is True
    assert c.due("bitcoin", fingerprint="x", force=True) is False


def test_429_keeps_last_good(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"t": 1000.0}
    monkeypatch.setattr("app.refresh_cache.time.monotonic", lambda: clock["t"])
    c = RefreshCache()
    good = [{"id": "legacy", "ok": True, "error": None}]
    c.store("bitcoin", good, fingerprint="fp")
    err = HttpError("HTTP 429 GET https://api.coingecko.com/x retry-after=90: nah", status=429, retry_after_s=90)
    bad = [{"id": "legacy", "ok": False, "error": str(err)}]
    got = c.take("bitcoin", bad, fingerprint="fp", error=err)
    assert got == good
    assert c.get("bitcoin") == good
    assert c.due("bitcoin", fingerprint="fp") is False
    clock["t"] += 89
    assert c.due("bitcoin", fingerprint="fp") is False
    clock["t"] += 2
    assert c.due("bitcoin", fingerprint="fp") is True


def test_429_without_cache_surfaces_error() -> None:
    c = RefreshCache()
    err = HttpError("HTTP 429 GET https://example/x: nah", status=429)
    bad = [{"ok": False, "error": str(err)}]
    got = c.take("bitcoin", bad, fingerprint="fp", error=err)
    assert got == bad
    assert c.get("bitcoin") == bad


def test_fingerprint_stable_for_same_cfg() -> None:
    cfg = {"providers": {"bitcoin": {"accounts": [{"id": "a", "secret": "bc1q"}], "hidden": False}}}
    assert fingerprint(cfg, "bitcoin") == fingerprint(cfg, "bitcoin")
    cfg2 = {"providers": {"bitcoin": {"accounts": [{"id": "a", "secret": "bc1z"}], "hidden": False}}}
    assert fingerprint(cfg, "bitcoin") != fingerprint(cfg2, "bitcoin")
