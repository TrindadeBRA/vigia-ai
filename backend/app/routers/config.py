"""Rotas de configuração do painel (sem devolver tokens)."""

from __future__ import annotations

import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.config import in_docker
from app.local.claude_oauth import claude_token_candidates, credentials_path, last_keychain_error
from app.local.cursor_state import cursor_missing_hint, cursor_token_candidates, jwt_expired
from app.netutil import lan_ipv4
from app.providers.deepseek import clean_deepseek_key
from app.providers.openrouter import clean_openrouter_key
from app.schemas import (
    AccountPublic,
    AddAccountBody,
    AddAccountResult,
    ConfigPatch,
    ConfigPublic,
    ConfigSaveResult,
    ListenPublic,
    OkResult,
    ProviderCardPublic,
    UrlsPublic,
)
from app.store import load, provider as provider_cfg, update

router = APIRouter(prefix="/api", tags=["config"])


def _suffix(token: str) -> str | None:
    token = token.strip()
    if len(token) < 8:
        return None
    return token[-4:]


def _accounts_public(p: dict[str, Any]) -> list[AccountPublic]:
    out: list[AccountPublic] = []
    for acc in p.get("accounts") or []:
        secret = str(acc.get("secret") or "")
        out.append(
            AccountPublic(id=str(acc.get("id") or ""), label=str(acc.get("label") or ""), suffix=_suffix(secret))
        )
    return out


def _claude_card(cfg: dict[str, Any]) -> ProviderCardPublic:
    p = provider_cfg(cfg, "claude")
    cands = claude_token_candidates(cfg)
    paste = str(p.get("paste_secret") or "").strip()
    now_ms = int(time.time() * 1000)
    live: tuple[str, str] | None = None
    expired_only = False
    for source, token, exp_ms in cands:
        if exp_ms and exp_ms < now_ms:
            expired_only = True
            continue
        live = (source, token)
        break
    extras = _accounts_public(p)
    if live:
        source, token = live
        if source == "keychain":
            label = "Lido do Keychain do Claude Code"
        else:
            label = f"Lido de {credentials_path(cfg)}"
        if paste:
            label += " · token colado ignorado na conta local (o app tem prioridade)"
        return ProviderCardPublic(
            source=source,
            label=label,
            configured=True,
            suffix=None,
            mode="local",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    if expired_only:
        return ProviderCardPublic(
            source="expired",
            label="OAuth expirado — abra o Claude Code neste Mac para renovar",
            configured=False,
            suffix=None,
            mode="need_local",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    if paste:
        return ProviderCardPublic(
            source="env",
            label="Token colado neste coletor",
            configured=True,
            suffix=_suffix(paste),
            mode="paste",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    if in_docker():
        return ProviderCardPublic(
            source="missing",
            label="Docker não lê o Keychain — monte ~/.claude ou cole o token abaixo",
            configured=False,
            suffix=None,
            mode="need_paste",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    hint = last_keychain_error() or "Nenhum login encontrado — rode `claude` neste Mac"
    return ProviderCardPublic(
        source="missing",
        label=hint,
        configured=False,
        suffix=None,
        mode="need_local",
        hidden=bool(p.get("hidden")),
        local_label=str(p.get("local_label") or ""),
        accounts=extras,
    )


def _cursor_card(cfg: dict[str, Any]) -> ProviderCardPublic:
    p = provider_cfg(cfg, "cursor")
    cands = cursor_token_candidates(cfg)
    paste = str(p.get("paste_secret") or "").strip()
    extras = _accounts_public(p)
    live: tuple[str, str] | None = None
    expired_only = False
    for source, token, _plan in cands:
        if jwt_expired(token):
            expired_only = True
            continue
        live = (source, token)
        break
    if live:
        source, _token = live
        label = "Lido do login do Cursor neste computador"
        if paste:
            label += " · token colado ignorado na conta local"
        return ProviderCardPublic(
            source=source,
            label=label,
            configured=True,
            suffix=None,
            mode="local",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    if expired_only:
        return ProviderCardPublic(
            source="expired",
            label="JWT expirado — abra o Cursor neste computador para renovar",
            configured=False,
            suffix=None,
            mode="need_local",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    if paste:
        return ProviderCardPublic(
            source="env",
            label="Token colado neste coletor",
            configured=True,
            suffix=_suffix(paste),
            mode="paste",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    if in_docker():
        return ProviderCardPublic(
            source="missing",
            label="Docker: monte o state.vscdb ou cole o token abaixo",
            configured=False,
            suffix=None,
            mode="need_paste",
            hidden=bool(p.get("hidden")),
            local_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    return ProviderCardPublic(
        source="missing",
        label=cursor_missing_hint(cfg) + " — ou cole o token abaixo",
        configured=False,
        suffix=None,
        mode="need_local",
        hidden=bool(p.get("hidden")),
        local_label=str(p.get("local_label") or ""),
        accounts=extras,
    )


def _key_card(cfg: dict[str, Any], name: str) -> ProviderCardPublic:
    p = provider_cfg(cfg, name)
    paste = str(p.get("paste_secret") or "").strip()
    extras = _accounts_public(p)
    if paste:
        return ProviderCardPublic(
            source="env",
            label="Key salva neste coletor",
            configured=True,
            suffix=_suffix(paste),
            mode="paste",
            hidden=bool(p.get("hidden")),
            primary_label=str(p.get("local_label") or ""),
            accounts=extras,
        )
    return ProviderCardPublic(
        source="missing",
        label="Nenhuma key configurada",
        configured=bool(extras),
        suffix=None,
        mode="need_paste",
        hidden=bool(p.get("hidden")),
        primary_label=str(p.get("local_label") or ""),
        accounts=extras,
    )


def _secrets_h_file(usage_lan: str) -> str:
    return (
        "#pragma once\n\n"
        '#define WIFI_SSID "SUA_REDE"\n'
        '#define WIFI_PASSWORD "SUA_SENHA"\n'
        f'#define USAGE_URL "{usage_lan}"\n'
    )


def config_public(listen_host: str, listen_port: int) -> ConfigPublic:
    cfg = load()
    ips = lan_ipv4()
    usage_paths = [f"http://127.0.0.1:{listen_port}/usage"]
    panel_paths = [f"http://127.0.0.1:{listen_port}/"]
    for ip in ips:
        usage_paths.append(f"http://{ip}:{listen_port}/usage")
        panel_paths.append(f"http://{ip}:{listen_port}/")
    usage_local = f"http://127.0.0.1:{listen_port}/usage"
    usage_lan = f"http://{ips[0]}:{listen_port}/usage" if ips else usage_local
    stored_port = int(cfg["listen"]["port"])
    return ConfigPublic(
        in_docker=in_docker(),
        mock=bool(cfg.get("mock")),
        listen=ListenPublic(host=listen_host, port=listen_port),
        urls=UrlsPublic(
            panel=panel_paths,
            usage=usage_paths,
            usage_lan=usage_lan,
            usage_local=usage_local,
            secrets_h=f'#define USAGE_URL "{usage_lan}"',
            secrets_h_file=_secrets_h_file(usage_lan),
            board_ok=bool(ips),
        ),
        lan_ips=ips,
        restart_needed_for_port=stored_port != listen_port,
        providers={
            "claude": _claude_card(cfg),
            "cursor": _cursor_card(cfg),
            "openrouter": _key_card(cfg, "openrouter"),
            "deepseek": _key_card(cfg, "deepseek"),
        },
    )


def _listen(request: Request) -> tuple[str, int]:
    return str(request.app.state.listen_host), int(request.app.state.listen_port)


@router.get(
    "/config",
    response_model=ConfigPublic,
    summary="Status do coletor (sem tokens)",
    description=(
        "IPs LAN, mock, contas visíveis e sufixo das keys coladas. "
        "**Nunca** devolve Bearer, JWT nem API key completa."
    ),
)
def get_config(request: Request) -> ConfigPublic:
    host, port = _listen(request)
    return config_public(host, port)


@router.post(
    "/config",
    response_model=ConfigSaveResult,
    summary="Grava mock, labels, hidden, porta, tokens colados",
    description="Corpo `ConfigPatch`. Segredos só entram; a resposta não os ecoa.",
)
def post_config(body: ConfigPatch, request: Request) -> ConfigSaveResult:
    _host, listen_port = _listen(request)
    restart = False

    def mut(cfg: dict[str, Any]) -> None:
        nonlocal restart
        if body.host is not None:
            cfg["listen"]["host"] = body.host.strip() or "0.0.0.0"
        if body.port is not None:
            cfg["listen"]["port"] = body.port
            restart = body.port != listen_port
        if body.mock is not None:
            cfg["mock"] = body.mock
        mapping = {
            "claude": (body.claude_hidden, body.claude_local_label, body.claude_paste, None),
            "cursor": (body.cursor_hidden, body.cursor_local_label, body.cursor_paste, None),
            "openrouter": (body.openrouter_hidden, body.openrouter_primary_label, body.openrouter_paste, "openrouter"),
            "deepseek": (body.deepseek_hidden, body.deepseek_primary_label, body.deepseek_paste, "deepseek"),
        }
        for name, (hidden, label, paste, kind) in mapping.items():
            p = cfg["providers"][name]
            if hidden is not None:
                p["hidden"] = hidden
            if label is not None:
                p["local_label"] = label
            if paste is not None and paste not in ("", "********"):
                secret = paste.strip()
                if kind == "openrouter":
                    cleaned = clean_openrouter_key(secret)
                    if not cleaned:
                        raise HTTPException(400, "API key OpenRouter inválida; cole só a chave sk-or-...")
                    secret = cleaned
                elif kind == "deepseek":
                    cleaned = clean_deepseek_key(secret)
                    if not cleaned:
                        raise HTTPException(400, "API key DeepSeek inválida; cole só a chave sk-...")
                    secret = cleaned
                p["paste_secret"] = secret

    try:
        update(mut)
    except HTTPException:
        raise
    return ConfigSaveResult(ok=True, restart_needed_for_port=restart)


@router.post(
    "/config/account",
    response_model=AddAccountResult,
    summary="Adiciona conta extra",
    description="Uma assinatura a mais no mesmo provedor. O token/key fica só no `config.json` gitignored.",
)
def add_account(body: AddAccountBody) -> AddAccountResult:
    secret = (body.token or body.key or "").strip()
    if body.provider == "openrouter":
        cleaned = clean_openrouter_key(secret)
        if not cleaned:
            return AddAccountResult(ok=False, error="API key OpenRouter inválida; cole só a chave sk-or-...")
        secret = cleaned
    elif body.provider == "deepseek":
        cleaned = clean_deepseek_key(secret)
        if not cleaned:
            return AddAccountResult(ok=False, error="API key DeepSeek inválida; cole só a chave sk-...")
        secret = cleaned
    elif not secret:
        return AddAccountResult(ok=False, error="token vazio")
    account_id = secrets.token_hex(4)

    def mut(cfg: dict[str, Any]) -> None:
        cfg["providers"][body.provider]["accounts"].append(
            {"id": account_id, "label": (body.label or "").strip(), "secret": secret}
        )

    update(mut)
    return AddAccountResult(ok=True, id=account_id)


@router.delete(
    "/config/account/{provider}/{account_id}",
    response_model=OkResult,
    summary="Remove conta extra",
    description="Não apaga a conta local (Keychain / state.vscdb / primeira key).",
)
def delete_account(provider: str, account_id: str) -> OkResult:
    if provider not in ("claude", "cursor", "openrouter", "deepseek"):
        return OkResult(ok=False, error="provider inválido")
    if not account_id:
        return OkResult(ok=False, error="id vazio")

    def mut(cfg: dict[str, Any]) -> None:
        p = cfg["providers"][provider]
        p["accounts"] = [a for a in p.get("accounts") or [] if a.get("id") != account_id]

    update(mut)
    return OkResult(ok=True)


@router.delete(
    "/config/secret/{name}",
    response_model=OkResult,
    summary="Apaga token/key colado",
    description="Apaga só o *paste* do painel. Não mexe no login do Claude Code nem do Cursor.",
)
def clear_secret(name: str) -> OkResult:
    mapping = {
        "claude": "claude",
        "claude_paste": "claude",
        "CLAUDE_OAUTH_TOKEN": "claude",
        "cursor": "cursor",
        "cursor_paste": "cursor",
        "CURSOR_ACCESS_TOKEN": "cursor",
        "openrouter": "openrouter",
        "openrouter_paste": "openrouter",
        "OPENROUTER_API_KEY": "openrouter",
        "deepseek": "deepseek",
        "deepseek_paste": "deepseek",
        "DEEPSEEK_API_KEY": "deepseek",
    }
    provider = mapping.get(name)
    if not provider:
        return OkResult(ok=False, error="chave não é segredo gerenciável")

    def mut(cfg: dict[str, Any]) -> None:
        cfg["providers"][provider]["paste_secret"] = ""

    update(mut)
    return OkResult(ok=True, cleared=name)


@router.get(
    "/secrets.h",
    response_class=PlainTextResponse,
    summary="Arquivo secrets.h para a ESP32",
    description=(
        "Gera `USAGE_URL` com o IP LAN. O firmware escuta SSE em `/events` "
        "(troca o path `/usage` → `/events`). Preencha SSID e senha Wi-Fi no arquivo."
    ),
    responses={
        200: {
            "content": {"text/plain": {"schema": {"type": "string"}}},
            "description": "Texto C para `firmware/src/secrets.h`.",
        }
    },
)
def download_secrets(request: Request) -> PlainTextResponse:
    host, port = _listen(request)
    pub = config_public(host, port)
    return PlainTextResponse(pub.urls.secrets_h_file, media_type="text/plain; charset=utf-8")
