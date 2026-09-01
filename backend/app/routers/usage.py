"""GET /health, GET /usage e GET /events (SSE)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app import __version__
from app.hub import sse_bytes
from app.netutil import panel_lan_url
from app.schemas import SSE_WIRE_EXAMPLE, HealthPayload, UsagePayload

router = APIRouter(tags=["usage"])

_SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}

_SSE_RESPONSE_HEADERS = {
    "Content-Type": {
        "description": "Obrigatório para o cliente tratar o corpo como SSE.",
        "schema": {"type": "string", "enum": ["text/event-stream"]},
    },
    "Connection": {
        "description": "Mantém o TCP aberto (firmware e EventSource).",
        "schema": {"type": "string", "enum": ["keep-alive"]},
    },
    "Cache-Control": {
        "description": "Impede proxy/browser de cachear o stream.",
        "schema": {"type": "string", "enum": ["no-cache"]},
    },
    "X-Accel-Buffering": {
        "description": "Pede ao nginx/Vite para não bufferizar o stream.",
        "schema": {"type": "string", "enum": ["no"]},
    },
}


@router.get(
    "/health",
    response_model=HealthPayload,
    summary="Liveness",
    operation_id="get_health",
    description=(
        "Processo no ar. Inclui os caminhos do painel, mostrador, "
        "`GET /usage`, `GET /events` e o Swagger. "
        "`panel_lan` é a URL absoluta para abrir o painel em outro aparelho da rede "
        "(a placa usa isso no QR da tela Sistema)."
    ),
)
def health(request: Request) -> HealthPayload:
    port = int(request.app.state.listen_port)
    return HealthPayload(
        version=__version__,
        panel_lan=panel_lan_url(port),
        listen={"host": request.app.state.listen_host, "port": port},
        interval_s=int(request.app.state.hub.seconds),
    )


@router.get(
    "/usage",
    response_model=UsagePayload,
    summary="Cotas na hora",
    operation_id="get_usage",
    description=(
        "Consulta Claude, GPT, Cursor, OpenRouter e DeepSeek **neste request**, "
        "grava o snapshot no hub e avisa todos os clientes de `GET /events`.\n\n"
        "HTTP **200** mesmo quando uma conta vem com `ok: false`. "
        "Use no `curl`, no botão «Atualizar consumo» e no Try it out do Swagger. "
        "A placa e o `/display` **não** fazem poll neste path — eles escutam `/events`."
    ),
    response_description="Mesmo schema do evento SSE `usage`. HTTP 200 com falha parcial.",
)
async def usage(request: Request) -> UsagePayload:
    hub = request.app.state.hub
    if request.client and request.headers.get("x-vigia-device") == "esp32":
        hub.note_device(request.client.host, request.headers.get("x-vigia-screen"))
    payload = await hub.refresh()
    return UsagePayload.model_validate(payload)


@router.get(
    "/events",
    summary="Stream SSE das cotas",
    operation_id="get_events",
    description=(
        "Server-Sent Events para o firmware (ESP32/Wokwi) e o mostrador React (`/display`).\n\n"
        "**Headers da resposta**\n\n"
        "- `Content-Type: text/event-stream`\n"
        "- `Connection: keep-alive`\n"
        "- `Cache-Control: no-cache`\n"
        "- `X-Accel-Buffering: no`\n\n"
        "**Quadro**\n\n"
        "```\n"
        "event: usage\n"
        "data: <JSON UsagePayload>\n"
        "\n"
        "```\n\n"
        "O JSON em `data:` é **idêntico** ao de `GET /usage` "
        "(schema `UsagePayload`). Comentários `: ping` a cada ~15 s mantêm NAT/ESP32 acordados. "
        "O coletor consulta as APIs a cada `USAGE_INTERVAL_S` (padrão 60 s) e empurra um `usage` "
        "a todos os inscritos. `GET /usage` força um ciclo extra.\n\n"
        "O Try it out do Swagger **segura a conexão** (stream infinito) — para um JSON único use `/usage`."
    ),
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Stream infinito. Primeiro um comentário `: connected`, depois `event: usage`.",
            "headers": _SSE_RESPONSE_HEADERS,
            "content": {
                "text/event-stream": {
                    "schema": {
                        "type": "string",
                        "description": "Quadros SSE. O campo data de `event: usage` valida contra UsagePayload.",
                    },
                    "examples": {
                        "quadro": {
                            "summary": "connected + usage + ping",
                            "value": SSE_WIRE_EXAMPLE,
                        }
                    },
                }
            },
        }
    },
)
async def events(request: Request) -> StreamingResponse:
    hub = request.app.state.hub
    if request.client and request.headers.get("x-vigia-device") == "esp32":
        hub.note_device(request.client.host, request.headers.get("x-vigia-screen"))
    return StreamingResponse(
        sse_bytes(hub),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
