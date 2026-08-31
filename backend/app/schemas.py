"""Modelos Pydantic = contrato OpenAPI (`GET /usage`, `GET /events` e painel)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProviderId = Literal["claude", "gpt", "cursor", "openrouter", "deepseek"]

USAGE_EXAMPLE = {
    "updated_at": "2026-08-31T14:00:00-03:00",
    "claude": [
        {
            "id": "local",
            "label": "Pessoal",
            "ok": True,
            "error": None,
            "session_percent": 42.0,
            "session_resets_at": "31/08 18h00",
            "weekly_percent": 18.5,
            "weekly_resets_at": "04/09 03h00",
            "sonnet_percent": None,
            "sonnet_resets_at": None,
            "opus_percent": None,
            "opus_resets_at": None,
        }
    ],
    "gpt": [
        {
            "id": "local",
            "label": "",
            "ok": True,
            "error": None,
            "session_percent": 12.0,
            "session_resets_at": "31/08 21h00",
            "weekly_percent": 8.0,
            "weekly_resets_at": "04/09 03h00",
            "plan": "plus",
        }
    ],
    "cursor": [
        {
            "id": "local",
            "label": "Pessoal",
            "ok": True,
            "error": None,
            "percent": 35.0,
            "other_percent": 12.0,
            "used_cents": 700,
            "limit_cents": 2000,
            "remaining_cents": 1300,
            "bonus_cents": 0,
            "cycle_end": "15/09",
            "plan": "pro",
            "requests_used": None,
            "requests_limit": None,
        }
    ],
    "openrouter": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "percent": 66.6,
            "limit_cents": 1000,
            "used_cents": 666,
            "remaining_cents": 334,
        }
    ],
    "deepseek": [
        {
            "id": "legacy",
            "label": "",
            "ok": True,
            "error": None,
            "percent": 25.0,
            "limit_cents": 1000,
            "used_cents": 250,
            "remaining_cents": 750,
        }
    ],
}

SSE_WIRE_EXAMPLE = (
    ": connected\n\n"
    "event: usage\n"
    'data: {"updated_at":"2026-08-31T14:00:00-03:00","claude":[],"gpt":[],"cursor":[],"openrouter":[],"deepseek":[]}\n\n'
    ": ping\n\n"
)


class AccountBase(BaseModel):
    id: str = Field(description="Chave estável de UI, não é segredo.")
    label: str = Field(default="", description="Apelido opcional. Vazio = só o nome do provedor.")
    ok: bool = Field(description="False se esta conta falhou; as outras seguem no mesmo JSON.")
    error: str | None = Field(default=None, description="Mensagem curta quando ok é false.")


class ClaudeAccount(AccountBase):
    session_percent: float | None = Field(default=None, description="0–100, janela de 5 h.")
    session_resets_at: str | None = None
    weekly_percent: float | None = Field(default=None, description="0–100, limite semanal.")
    weekly_resets_at: str | None = None
    sonnet_percent: float | None = None
    sonnet_resets_at: str | None = None
    opus_percent: float | None = None
    opus_resets_at: str | None = None


class GptAccount(AccountBase):
    session_percent: float | None = Field(default=None, description="0–100, janela curta (~5 h) se o plano tiver.")
    session_resets_at: str | None = None
    weekly_percent: float | None = Field(default=None, description="0–100, janela longa (semana / mês).")
    weekly_resets_at: str | None = None
    plan: str | None = Field(default=None, description="plus, pro, free, … — vem do Codex / ChatGPT.")


class CursorAccount(AccountBase):
    percent: float | None = None
    other_percent: float | None = None
    used_cents: int | None = None
    limit_cents: int | None = None
    remaining_cents: int | None = None
    bonus_cents: int | None = None
    cycle_end: str | None = None
    plan: str | None = None
    requests_used: int | None = None
    requests_limit: int | None = None


class CreditsAccount(AccountBase):
    percent: float | None = None
    limit_cents: int | None = None
    used_cents: int | None = None
    remaining_cents: int | None = None


class UsagePayload(BaseModel):
    """Contrato da placa e do mostrador. Mesmo JSON em GET /usage e no evento SSE `usage`."""

    model_config = ConfigDict(json_schema_extra={"example": USAGE_EXAMPLE})

    updated_at: str = Field(description="ISO-8601 com offset, ou o instante do ciclo no coletor.")
    claude: list[ClaudeAccount]
    gpt: list[GptAccount]
    cursor: list[CursorAccount]
    openrouter: list[CreditsAccount]
    deepseek: list[CreditsAccount]


class HealthPayload(BaseModel):
    ok: bool = True
    version: str = Field(description="Versão do coletor.")
    panel: str = Field(default="/", description="Painel React.")
    panel_lan: str = Field(
        default="",
        description="URL absoluta do painel na LAN (telefone / outro PC). Vazia se não houver IPv4.",
    )
    display: str = Field(default="/display", description="Mostrador web.")
    usage: str = Field(default="/usage", description="JSON na hora (força um ciclo de APIs).")
    events: str = Field(default="/events", description="Stream SSE (firmware e /display).")
    docs: str = Field(default="/docs", description="Swagger UI.")
    listen: dict[str, str | int] = Field(description="host e port em que o Uvicorn está escutando.")
    interval_s: int = Field(description="Segundos entre ciclos do hub (`USAGE_INTERVAL_S`).")


class AccountPublic(BaseModel):
    id: str
    label: str = ""
    suffix: str | None = None


class ProviderCardPublic(BaseModel):
    source: str
    label: str
    configured: bool
    suffix: str | None = None
    mode: str
    hidden: bool = False
    local_label: str = ""
    primary_label: str = ""
    accounts: list[AccountPublic] = Field(default_factory=list)


class UrlsPublic(BaseModel):
    panel: list[str]
    usage: list[str]
    usage_lan: str
    usage_local: str
    secrets_h: str
    secrets_h_file: str
    board_ok: bool


class ListenPublic(BaseModel):
    host: str
    port: int


class ConfigPublic(BaseModel):
    ok: bool = True
    in_docker: bool
    mock: bool
    listen: ListenPublic
    urls: UrlsPublic
    lan_ips: list[str]
    restart_needed_for_port: bool = False
    providers: dict[str, ProviderCardPublic]


class ConfigPatch(BaseModel):
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    mock: bool | None = None
    claude_hidden: bool | None = None
    gpt_hidden: bool | None = None
    cursor_hidden: bool | None = None
    openrouter_hidden: bool | None = None
    deepseek_hidden: bool | None = None
    claude_local_label: str | None = None
    gpt_local_label: str | None = None
    cursor_local_label: str | None = None
    openrouter_primary_label: str | None = None
    deepseek_primary_label: str | None = None
    claude_paste: str | None = None
    gpt_paste: str | None = None
    cursor_paste: str | None = None
    openrouter_paste: str | None = None
    deepseek_paste: str | None = None


class ConfigSaveResult(BaseModel):
    ok: bool
    error: str | None = None
    restart_needed_for_port: bool = False


class AddAccountBody(BaseModel):
    provider: ProviderId
    label: str = ""
    token: str | None = None
    key: str | None = None


class AddAccountResult(BaseModel):
    ok: bool
    id: str | None = None
    error: str | None = None


class OkResult(BaseModel):
    ok: bool
    error: str | None = None
    cleared: str | None = None
