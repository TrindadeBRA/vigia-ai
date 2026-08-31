"""GET /health e GET /usage."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app import __version__
from app.formatting import utc_now
from app.schemas import HealthPayload, UsagePayload
from app.usage import build_payload

router = APIRouter(tags=["usage"])


@router.get("/health", response_model=HealthPayload, summary="Liveness")
def health(request: Request) -> HealthPayload:
    return HealthPayload(
        version=__version__,
        listen={"host": request.app.state.listen_host, "port": request.app.state.listen_port},
    )


@router.get(
    "/usage",
    response_model=UsagePayload,
    summary="Cotas para a ESP32 e o mostrador web",
    response_description="HTTP 200 mesmo quando uma conta falha (`ok: false` só nela).",
)
def usage() -> UsagePayload:
    payload = build_payload()
    for name in ("claude", "cursor", "openrouter", "deepseek"):
        for acc in payload.get(name) or []:
            if isinstance(acc, dict) and not acc.get("ok"):
                who = acc.get("label") or acc.get("id") or "?"
                print(f"[{utc_now()}] ERRO {name} ({who}): {acc.get('error')}")
    return UsagePayload.model_validate(payload)
