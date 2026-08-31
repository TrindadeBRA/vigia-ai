"""Modelos Pydantic = contrato OpenAPI (`GET /usage` e painel)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ProviderId = Literal["claude", "cursor", "openrouter", "deepseek"]


class AccountBase(BaseModel):
    id: str = Field(description="Chave estável de UI, não é segredo.")
    label: str = Field(default="", description="Apelido opcional. Vazio = só o nome do provedor.")
    ok: bool
    error: str | None = None


class ClaudeAccount(AccountBase):
    session_percent: float | None = None
    session_resets_at: str | None = None
    weekly_percent: float | None = None
    weekly_resets_at: str | None = None
    sonnet_percent: float | None = None
    sonnet_resets_at: str | None = None
    opus_percent: float | None = None
    opus_resets_at: str | None = None


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
    """Contrato da placa e do mostrador web. HTTP 200 mesmo com contas `ok: false`."""

    updated_at: str
    claude: list[ClaudeAccount]
    cursor: list[CursorAccount]
    openrouter: list[CreditsAccount]
    deepseek: list[CreditsAccount]


class HealthPayload(BaseModel):
    ok: bool = True
    version: str
    panel: str = "/"
    display: str = "/display"
    usage: str = "/usage"
    docs: str = "/docs"
    listen: dict[str, str | int]


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
    cursor_hidden: bool | None = None
    openrouter_hidden: bool | None = None
    deepseek_hidden: bool | None = None
    claude_local_label: str | None = None
    cursor_local_label: str | None = None
    openrouter_primary_label: str | None = None
    deepseek_primary_label: str | None = None
    claude_paste: str | None = None
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
