"""Caminhos e mensagens por plataforma — o app desktop roda nos três SOs."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.local import claude_oauth, cursor_state, gpt_oauth


@pytest.fixture(autouse=True)
def _clear_keychain_cache():
    claude_oauth._keychain_cache = None
    claude_oauth._last_keychain_err = None
    yield
    claude_oauth._keychain_cache = None
    claude_oauth._last_keychain_err = None


@pytest.mark.parametrize("plat", ["win32", "linux"])
def test_keychain_nao_quebra_fora_do_macos(monkeypatch, plat):
    """os.uname() não existe no Windows: from_macos_keychain tem que sair limpo."""
    monkeypatch.setattr(claude_oauth.sys, "platform", plat)

    def boom(*_a, **_k):  # pragma: no cover - não deve ser chamado
        raise AssertionError("não pode chamar `security` fora do macOS")

    monkeypatch.setattr(claude_oauth.subprocess, "run", boom)
    assert claude_oauth.from_macos_keychain() == (None, None, None)


def test_candidatos_do_claude_usam_o_arquivo_fora_do_macos(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(claude_oauth.sys, "platform", "win32")
    creds = tmp_path / ".credentials.json"
    creds.write_text('{"claudeAiOauth": {"accessToken": "tok-abc", "expiresAt": 9999999999000}}')
    monkeypatch.setenv("CLAUDE_CREDENTIALS_PATH", str(creds))

    found = claude_oauth.claude_token_candidates()

    assert [(src, tok) for src, tok, _exp in found] == [("credentials", "tok-abc")]


def test_hint_sem_login_e_especifico_por_plataforma(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("CLAUDE_CREDENTIALS_PATH", str(tmp_path / ".credentials.json"))

    monkeypatch.setattr(claude_oauth.sys, "platform", "linux")
    assert "Mac" not in claude_oauth.missing_login_hint()
    assert str(tmp_path) in claude_oauth.missing_login_hint()

    monkeypatch.setattr(claude_oauth.sys, "platform", "darwin")
    assert "Mac" in claude_oauth.missing_login_hint()


@pytest.mark.parametrize(
    ("plat", "trecho"),
    [
        ("darwin", "Library/Application Support"),
        ("linux", ".config"),
        ("win32", "AppData"),
    ],
)
def test_state_vscdb_prioriza_o_caminho_do_so(monkeypatch, plat, trecho, tmp_path: Path):
    monkeypatch.setattr(cursor_state.sys, "platform", plat)
    monkeypatch.delenv("CURSOR_STATE_DB", raising=False)
    monkeypatch.delenv("APPDATA", raising=False)
    monkeypatch.setattr(cursor_state.Path, "home", staticmethod(lambda: tmp_path))

    assert trecho in cursor_state.state_db_candidates()[0].as_posix()
    # nenhum candidato existe → o fallback é o caminho nativo, não o do macOS
    assert trecho in cursor_state.state_db_path().as_posix()


def test_state_vscdb_respeita_appdata_no_windows(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(cursor_state.sys, "platform", "win32")
    monkeypatch.delenv("CURSOR_STATE_DB", raising=False)
    monkeypatch.setenv("APPDATA", str(tmp_path / "Roaming"))

    first = cursor_state.state_db_candidates()[0]

    assert first == tmp_path / "Roaming/Cursor/User/globalStorage/state.vscdb"


def test_codex_auth_json_e_cross_platform(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("CODEX_AUTH_PATH", raising=False)
    monkeypatch.delenv("CODEX_HOME", raising=False)
    monkeypatch.setattr(gpt_oauth.Path, "home", staticmethod(lambda: tmp_path))

    assert gpt_oauth.auth_path() == tmp_path / ".codex" / "auth.json"
