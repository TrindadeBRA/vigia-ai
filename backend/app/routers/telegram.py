"""Rotas do Telegram: token do bot, chats registrados e teste de envio."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app import telegram_bot
from app.schemas import OkResult, TelegramChat, TelegramChatBody, TelegramStatus, TelegramTokenBody
from app.store import load

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


def _status() -> TelegramStatus:
    cfg = load()
    tg = cfg.get("telegram") or {}
    token = str(tg.get("bot_token") or "")
    chats_raw = tg.get("chats") or []
    chats = [TelegramChat.model_validate(ch) for ch in chats_raw if isinstance(ch, dict)]
    return TelegramStatus(
        configured=bool(token),
        bot_username=str(tg.get("bot_username") or ""),
        chats=chats,
    )


@router.get(
    "/status",
    response_model=TelegramStatus,
    summary="Estado do bot Telegram (token configurado e chats conectados)",
)
def status() -> TelegramStatus:
    return _status()


@router.post(
    "/token",
    response_model=OkResult,
    summary="Valida e salva o token do bot (@BotFather)",
)
async def save_token(request: Request, body: TelegramTokenBody) -> OkResult:
    token = body.bot_token.strip()
    if not token:
        raise HTTPException(400, "token vazio")
    try:
        me = telegram_bot.validate_token(token)
    except Exception as exc:
        raise HTTPException(400, f"token inválido: {exc}") from exc
    username = str(me.get("username") or "")
    telegram_bot.set_token(token, username)
    poller = request.app.state.telegram_poller
    await poller.restart()
    return OkResult(ok=True)


@router.post(
    "/token/clear",
    response_model=OkResult,
    summary="Remove token e todos os chats registrados",
)
async def clear_token(request: Request) -> OkResult:
    telegram_bot.clear_token()
    poller = request.app.state.telegram_poller
    await poller.stop()
    return OkResult(ok=True)


@router.post(
    "/chats/remove",
    response_model=OkResult,
    summary="Remove um chat da lista de notificações",
)
def remove_chat(body: TelegramChatBody) -> OkResult:
    if not body.chat_id:
        return OkResult(ok=False, error="chat_id vazio")
    telegram_bot.remove_chat(body.chat_id)
    return OkResult(ok=True)


@router.post(
    "/test",
    response_model=OkResult,
    summary="Envia uma mensagem de teste para todos os chats registrados",
)
def test() -> OkResult:
    sent = telegram_bot.broadcast("Vigia AI", "Notificação de teste")
    if sent == 0:
        raise HTTPException(400, "nenhum chat registrado — mande /start pro bot primeiro")
    return OkResult(ok=True)
