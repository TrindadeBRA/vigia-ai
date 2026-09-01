"""Fan-out de cotas: um ciclo de APIs, muitos clientes SSE."""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import AsyncIterator
from typing import Any, Callable

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
    for name in ("claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal"):
        for acc in payload.get(name) or []:
            if isinstance(acc, dict) and not acc.get("ok"):
                who = acc.get("label") or acc.get("id") or "?"
                print(f"[{utc_now()}] ERRO {name} ({who}): {acc.get('error')}")


class UsageHub:
    def __init__(self, seconds: int | None = None, on_payload: Callable[[dict[str, Any]], None] | None = None) -> None:
        self.seconds = seconds if seconds is not None else interval_s()
        self._lock = asyncio.Lock()
        self._latest: dict[str, Any] | None = None
        self._queues: set[asyncio.Queue[dict[str, Any] | None]] = set()
        self._task: asyncio.Task[None] | None = None
        self._on_payload = on_payload
        # IP de quem chamou GET /usage ou /events por último (a placa) — usado só pra
        # pré-preencher o "enviar tema pro device" no painel; não faz parte do contrato JSON.
        self.device_ip: str | None = None
        self.device_seen_at: float | None = None
        # Resolução da tela (header X-Vigia-Screen, ver firmware/src/net/client.cpp) —
        # deixa o editor de tema (protótipo) acertar o tamanho do fundo sem precisar do IP.
        self.device_width: int | None = None
        self.device_height: int | None = None

    def note_device(self, ip: str | None, screen: str | None = None) -> None:
        if not ip:
            return
        self.device_ip = ip
        self.device_seen_at = time.monotonic()
        if screen:
            w_s, _, h_s = screen.partition("x")
            try:
                self.device_width = int(w_s)
                self.device_height = int(h_s)
            except ValueError:
                pass

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
            if self._on_payload is not None:
                # dispara em background (pode fazer request de push síncrona) sem
                # atrasar a resposta de GET /usage nem o fan-out do SSE.
                asyncio.create_task(self._run_on_payload(payload))
            return payload

    async def _run_on_payload(self, payload: dict[str, Any]) -> None:
        assert self._on_payload is not None
        try:
            await asyncio.to_thread(self._on_payload, payload)
        except Exception as exc:  # noqa: BLE001
            print(f"[{utc_now()}] ERRO on_payload: {exc}")

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
