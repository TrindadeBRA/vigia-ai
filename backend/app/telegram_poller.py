"""Long-polling do Telegram para capturar chat_id automaticamente."""

from __future__ import annotations

import asyncio

import httpx

from app import telegram_bot


class TelegramPoller:
    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if telegram_bot.get_bot_token():
            self._task = asyncio.create_task(self._loop(), name="telegram-poller")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def restart(self) -> None:
        await self.stop()
        await self.start()

    async def _loop(self) -> None:
        offset = 0
        async with httpx.AsyncClient(timeout=35) as client:
            while True:
                token = telegram_bot.get_bot_token()
                if not token:
                    return
                try:
                    offset = await telegram_bot.poll_once(client, token, offset)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    print(f"[telegram] erro no polling: {exc}")
                    await asyncio.sleep(5)
