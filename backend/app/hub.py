"""Fan-out de cotas: um ciclo de APIs, muitos clientes SSE."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any

from app.formatting import utc_now
from app.schemas import UsagePayload
from app.usage import build_payload

DEFAULT_INTERVAL_S = 60
HEARTBEAT_S = 15


def interval_s() -> int:
    raw = os.environ.get("USAGE_INTERVAL_S", str(DEFAULT_INTERVAL_S))
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_INTERVAL_S
    return max(15, min(value, 600))


def _log_failures(payload: dict[str, Any]) -> None:
    for name in ("claude", "gpt", "cursor", "openrouter", "deepseek", "opencode_go", "opencode_zen"):
        for acc in payload.get(name) or []:
            if isinstance(acc, dict) and not acc.get("ok"):
                who = acc.get("label") or acc.get("id") or "?"
                print(f"[{utc_now()}] ERRO {name} ({who}): {acc.get('error')}")


class UsageHub:
    def __init__(self, seconds: int | None = None) -> None:
        self.seconds = seconds if seconds is not None else interval_s()
        self._lock = asyncio.Lock()
        self._latest: dict[str, Any] | None = None
        self._queues: set[asyncio.Queue[dict[str, Any] | None]] = set()
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        await self.refresh()
        self._task = asyncio.create_task(self._loop(), name="usage-hub")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        for queue in list(self._queues):
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    async def _loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(self.seconds)
                await self.refresh()
        except asyncio.CancelledError:
            return

    async def refresh(self) -> dict[str, Any]:
        async with self._lock:
            payload = await asyncio.to_thread(build_payload)
            self._latest = payload
            _log_failures(payload)
            self._broadcast(payload)
            return payload

    def snapshot(self) -> dict[str, Any] | None:
        return self._latest

    def _broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[asyncio.Queue[dict[str, Any] | None]] = []
        for queue in self._queues:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    queue.put_nowait(payload)
                except asyncio.QueueFull:
                    dead.append(queue)
        for queue in dead:
            self._queues.discard(queue)

    def subscribe(self) -> asyncio.Queue[dict[str, Any] | None]:
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=4)
        self._queues.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any] | None]) -> None:
        self._queues.discard(queue)


def format_sse(payload: dict[str, Any]) -> str:
    data = UsagePayload.model_validate(payload).model_dump_json()
    return f"event: usage\ndata: {data}\n\n"


async def sse_bytes(hub: UsageHub) -> AsyncIterator[bytes]:
    queue = hub.subscribe()
    try:
        yield b": connected\n\n"
        latest = hub.snapshot()
        if latest is not None:
            yield format_sse(latest).encode("utf-8")
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_S)
            except TimeoutError:
                yield b": ping\n\n"
                continue
            if item is None:
                break
            yield format_sse(item).encode("utf-8")
    finally:
        hub.unsubscribe(queue)
