"""Telegram: token do bot, chats registrados e envio via Bot API."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import httpx

from app.http_util import log_notification
from app.store import load, update

TELEGRAM_API = "https://api.telegram.org"
TELEGRAM_LOG_MESSAGE = f"{TELEGRAM_API}/bot/sendMessage"
TELEGRAM_LOG_PHOTO = f"{TELEGRAM_API}/bot/sendPhoto"
CONFIRMATION_MSG = "✅ Vigia AI conectado — você vai receber os alarmes aqui."

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ICON_DIR = _REPO_ROOT / "frontend" / "public" / "icons"


def get_bot_token() -> str:
    cfg = load()
    return str((cfg.get("telegram") or {}).get("bot_token") or "")


def provider_icon_path(provider: str) -> Path | None:
    path = _ICON_DIR / f"{provider}.png"
    return path if path.is_file() else None


def validate_token(token: str) -> dict[str, Any]:
    url = f"{TELEGRAM_API}/bot{token}/getMe"
    with httpx.Client(timeout=15) as client:
        resp = client.get(url)
        resp.raise_for_status()
        data = resp.json()
    if not data.get("ok"):
        raise ValueError(data.get("description") or "token inválido")
    result = data.get("result")
    if not isinstance(result, dict):
        raise ValueError("resposta inválida do Telegram")
    return result


def set_token(token: str, username: str) -> None:
    def mut(c: dict[str, Any]) -> None:
        c["telegram"]["bot_token"] = token
        c["telegram"]["bot_username"] = username

    update(mut)


def clear_token() -> None:
    def mut(c: dict[str, Any]) -> None:
        c["telegram"]["bot_token"] = ""
        c["telegram"]["bot_username"] = ""
        c["telegram"]["chats"] = []

    update(mut)


def add_chat(chat_id: str, label: str) -> bool:
    cfg = load()
    existing = next((ch for ch in cfg["telegram"]["chats"] if ch["id"] == chat_id), None)
    if existing is not None:
        return False

    def mut(c: dict[str, Any]) -> None:
        chats = list(c["telegram"]["chats"])
        chats.append(
            {
                "id": chat_id,
                "label": label,
                "added_at": str(int(time.time())),
            }
        )
        c["telegram"]["chats"] = chats

    update(mut)
    return True


def remove_chat(chat_id: str) -> None:
    def mut(c: dict[str, Any]) -> None:
        c["telegram"]["chats"] = [ch for ch in c["telegram"]["chats"] if ch["id"] != chat_id]

    update(mut)


def _send_message_sync(
    token: str,
    chat_id: str,
    text: str,
    *,
    parse_mode: str | None = "HTML",
) -> tuple[httpx.Response, float]:
    url = f"{TELEGRAM_API}/bot{token}/sendMessage"
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    start = time.perf_counter()
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, json=payload)
    return resp, (time.perf_counter() - start) * 1000


def _send_photo_sync(
    token: str,
    chat_id: str,
    photo_path: Path,
    caption: str,
    *,
    parse_mode: str = "HTML",
) -> tuple[httpx.Response, float]:
    url = f"{TELEGRAM_API}/bot{token}/sendPhoto"
    data = {"chat_id": chat_id, "caption": caption, "parse_mode": parse_mode}
    start = time.perf_counter()
    with httpx.Client(timeout=15) as client:
        with photo_path.open("rb") as photo:
            resp = client.post(url, data=data, files={"photo": (photo_path.name, photo, "image/png")})
    return resp, (time.perf_counter() - start) * 1000


def _log_delivery(
    *,
    used_photo: bool,
    status: int | None,
    elapsed_ms: float,
    error: str | None = None,
) -> None:
    log_notification(
        "POST",
        TELEGRAM_LOG_PHOTO if used_photo else TELEGRAM_LOG_MESSAGE,
        label="TELEGRAM",
        status=status,
        elapsed_ms=elapsed_ms,
        error=error,
    )


def broadcast(text: str, *, provider: str | None = None, parse_mode: str = "HTML") -> int:
    """Envia para todos os chats. Com `provider`, anexa o ícone PNG via sendPhoto."""
    cfg = load()
    token = str(cfg["telegram"].get("bot_token") or "")
    chats = list(cfg["telegram"].get("chats") or [])
    if not token or not chats:
        return 0

    icon = provider_icon_path(provider) if provider else None
    sent = 0
    dead: list[str] = []
    for chat in chats:
        start = time.perf_counter()
        used_photo = False
        try:
            if icon is not None:
                resp, elapsed_ms = _send_photo_sync(token, chat["id"], icon, text, parse_mode=parse_mode)
                used_photo = True
            else:
                resp, elapsed_ms = _send_message_sync(token, chat["id"], text, parse_mode=parse_mode)
            data = resp.json()
            if resp.status_code == 200 and data.get("ok"):
                sent += 1
                _log_delivery(used_photo=used_photo, status=resp.status_code, elapsed_ms=elapsed_ms)
            elif resp.status_code in (400, 403):
                dead.append(chat["id"])
                _log_delivery(used_photo=used_photo, status=resp.status_code, elapsed_ms=elapsed_ms)
            else:
                _log_delivery(
                    used_photo=used_photo,
                    status=resp.status_code,
                    elapsed_ms=elapsed_ms,
                    error=resp.text[:300],
                )
        except Exception as exc:
            _log_delivery(
                used_photo=used_photo,
                status=None,
                elapsed_ms=(time.perf_counter() - start) * 1000,
                error=str(exc),
            )
    if dead:

        def mut(c: dict[str, Any]) -> None:
            c["telegram"]["chats"] = [ch for ch in c["telegram"]["chats"] if ch["id"] not in dead]

        update(mut)
    return sent


async def poll_once(client: httpx.AsyncClient, token: str, offset: int) -> int:
    url = f"{TELEGRAM_API}/bot{token}/getUpdates"
    resp = await client.get(url, params={"timeout": 25, "offset": offset})
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise ValueError(data.get("description") or "getUpdates falhou")
    updates = data.get("result") or []
    next_offset = offset
    for item in updates:
        if not isinstance(item, dict):
            continue
        update_id = item.get("update_id")
        if isinstance(update_id, int):
            next_offset = max(next_offset, update_id + 1)
        message = item.get("message")
        if not isinstance(message, dict):
            continue
        chat = message.get("chat")
        if not isinstance(chat, dict):
            continue
        chat_id_raw = chat.get("id")
        if chat_id_raw is None:
            continue
        chat_id = str(chat_id_raw)
        first_name = str(chat.get("first_name") or "")
        last_name = str(chat.get("last_name") or "")
        username = str(chat.get("username") or "")
        parts = [p for p in (first_name, last_name) if p]
        label = " ".join(parts) or (f"@{username}" if username else chat_id)
        is_new = add_chat(chat_id, label)
        if is_new:
            try:
                await client.post(
                    f"{TELEGRAM_API}/bot{token}/sendMessage",
                    json={"chat_id": chat_id, "text": CONFIRMATION_MSG},
                )
            except Exception as exc:
                print(f"[telegram] falha ao confirmar chat {chat_id}: {exc}")
    return next_offset
