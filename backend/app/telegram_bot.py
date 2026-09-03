"""Telegram: token do bot, chats registrados e envio via Bot API."""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.store import load, update

TELEGRAM_API = "https://api.telegram.org"
CONFIRMATION_MSG = "✅ Vigia AI conectado — você vai receber os alarmes aqui."


def get_bot_token() -> str:
    cfg = load()
    return str((cfg.get("telegram") or {}).get("bot_token") or "")


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


def _send_message_sync(token: str, chat_id: str, text: str) -> httpx.Response:
    url = f"{TELEGRAM_API}/bot{token}/sendMessage"
    with httpx.Client(timeout=15) as client:
        return client.post(url, json={"chat_id": chat_id, "text": text})


def broadcast(title: str, body: str) -> int:
    cfg = load()
    token = str(cfg["telegram"].get("bot_token") or "")
    chats = list(cfg["telegram"].get("chats") or [])
    if not token or not chats:
        return 0
    text = f"{title}\n{body}"
    sent = 0
    dead: list[str] = []
    for chat in chats:
        try:
            resp = _send_message_sync(token, chat["id"], text)
            data = resp.json()
            if resp.status_code == 200 and data.get("ok"):
                sent += 1
            elif resp.status_code in (400, 403):
                dead.append(chat["id"])
            else:
                print(f"[telegram] falha ao enviar ({resp.status_code}): {resp.text}")
        except Exception as exc:
            print(f"[telegram] falha ao enviar: {exc}")
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
