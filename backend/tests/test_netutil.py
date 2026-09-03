from __future__ import annotations

from app.netutil import display_lan_url, panel_lan_url
from app.telegram_bot import url_button_markup


def test_display_lan_url(monkeypatch) -> None:
    monkeypatch.setattr("app.netutil.lan_ipv4", lambda: ["192.168.3.58"])
    assert display_lan_url(8787) == "http://192.168.3.58:8787/display"
    assert panel_lan_url(8787) == "http://192.168.3.58:8787/"


def test_display_lan_url_empty_without_ip(monkeypatch) -> None:
    monkeypatch.setattr("app.netutil.lan_ipv4", lambda: [])
    assert display_lan_url(8787) == ""


def test_url_button_markup() -> None:
    markup = url_button_markup("http://192.168.3.58:8787/display")
    assert markup == {
        "inline_keyboard": [[{"text": "Abrir VigiaAI", "url": "http://192.168.3.58:8787/display"}]]
    }
