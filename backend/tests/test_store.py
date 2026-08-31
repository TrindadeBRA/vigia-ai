from __future__ import annotations

from app.store import migrate_legacy


def test_migrate_legacy_flat_env() -> None:
    cfg = migrate_legacy(
        {
            "HOST": "0.0.0.0",
            "PORT": "8787",
            "COLLECTOR_MOCK": "1",
            "CLAUDE_HIDDEN": "1",
            "CLAUDE_LOCAL_LABEL": "Pessoal",
            "CLAUDE_OAUTH_TOKEN": "secret-token-xxxx",
            "CLAUDE_ACCOUNTS": '[{"id":"a1","label":"Empresa","token":"tok-emp"}]',
            "OPENROUTER_API_KEY": "sk-or-v1-abc",
        }
    )
    assert cfg["version"] == 1
    assert cfg["mock"] is True
    assert cfg["providers"]["claude"]["hidden"] is True
    assert cfg["providers"]["claude"]["local_label"] == "Pessoal"
    assert cfg["providers"]["claude"]["paste_secret"] == "secret-token-xxxx"
    assert cfg["providers"]["claude"]["accounts"][0]["id"] == "a1"
    assert cfg["providers"]["claude"]["accounts"][0]["secret"] == "tok-emp"
    assert cfg["providers"]["openrouter"]["paste_secret"] == "sk-or-v1-abc"
