"""Coletor de cotas — FastAPI. Serve GET /usage, GET /events (SSE) e o painel React."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.alarms import AlarmEngine
from app.config import frontend_dist
from app.hub import UsageHub
from app.netutil import lan_ipv4
from app.routers.alarms import router as alarms_router
from app.routers.config import router as config_router
from app.routers.push import router as push_router
from app.routers.theme import router as theme_router
from app.routers.usage import router as usage_router
from app.store import load


class CloseConnectionMiddleware(BaseHTTPMiddleware):
    """Fecha HTTP/1.1 nas respostas curtas (ESP32). O stream SSE precisa ficar aberto."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        path = request.url.path.rstrip("/")
        if path.endswith("/events"):
            response.headers["Content-Type"] = "text/event-stream"
            response.headers["Connection"] = "keep-alive"
            response.headers["Cache-Control"] = "no-cache"
            return response
        response.headers["Connection"] = "close"
        response.headers["Cache-Control"] = "no-store"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    alarm_engine = AlarmEngine()
    hub = UsageHub(on_payload=alarm_engine.handle_payload)
    app.state.hub = hub
    await hub.start()
    try:
        yield
    finally:
        await hub.stop()


def create_app() -> FastAPI:
    cfg = load()
    host = os.environ.get("HOST") or str(cfg["listen"]["host"] or "0.0.0.0")
    port = int(os.environ.get("PORT") or cfg["listen"]["port"] or 8787)

    app = FastAPI(
        title="Vigia AI",
        version=__version__,
        description=(
            "Coletor local de cotas (**Claude**, **Cursor**, **OpenRouter**, **DeepSeek**). "
            "Tokens ficam neste computador — a placa e o browser **nunca** os recebem.\n\n"
            "- **GET /events** — SSE: `Content-Type: text/event-stream`, `Connection: keep-alive`. "
            "Firmware e `/display`.\n"
            "- **GET /usage** — o mesmo JSON, na hora; avisa quem está no stream.\n"
            "- **GET /docs** — este Swagger (OpenAPI em `/openapi.json`).\n\n"
            "LAN only. **Não exponha a porta 8787 na internet.**"
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
        openapi_tags=[
            {
                "name": "usage",
                "description": (
                    "Cotas na LAN. `GET /events` é o canal ao vivo; "
                    "`GET /usage` força um ciclo e devolve o snapshot. "
                    "Contrato: `UsagePayload` (sem Bearer)."
                ),
            },
            {
                "name": "config",
                "description": (
                    "Painel. `GET /api/config` não devolve tokens — só sufixo. "
                    "`GET /api/secrets.h` gera o header da ESP32 (SSID/senha você preenche)."
                ),
            },
        ],
    )
    app.state.listen_host = host
    app.state.listen_port = port

    app.add_middleware(CloseConnectionMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Content-Type"],
    )
    app.include_router(usage_router)
    app.include_router(config_router)
    app.include_router(theme_router)
    app.include_router(alarms_router)
    app.include_router(push_router)

    dist = frontend_dist()
    if dist is not None:
        assets = dist / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")
        icons = dist / "icons"
        if icons.is_dir():
            app.mount("/icons", StaticFiles(directory=icons), name="icons")

        @app.get("/", include_in_schema=False)
        @app.get("/setup", include_in_schema=False)
        @app.get("/setup/", include_in_schema=False)
        @app.get("/display", include_in_schema=False)
        @app.get("/display/", include_in_schema=False)
        @app.get("/display/config", include_in_schema=False)
        @app.get("/display/config/", include_in_schema=False)
        @app.get("/display/setup", include_in_schema=False)
        @app.get("/display/setup/", include_in_schema=False)
        def spa() -> FileResponse:
            return FileResponse(dist / "index.html")

        dist_root = dist.resolve()

        @app.get("/{static_name}", include_in_schema=False)
        def dist_root_static(static_name: str) -> FileResponse:
            """Arquivos copiados de frontend/public/ para a raiz do dist pelo Vite."""
            if not static_name or "/" in static_name or "\\" in static_name or static_name in (".", ".."):
                raise HTTPException(status_code=404)
            path = (dist / static_name).resolve()
            if not str(path).startswith(str(dist_root)) or not path.is_file():
                raise HTTPException(status_code=404)
            media_type = "application/manifest+json" if static_name.endswith(".webmanifest") else None
            return FileResponse(path, media_type=media_type)

    @app.exception_handler(404)
    async def not_found(_request: Request, _exc: Exception) -> JSONResponse | FileResponse:
        if dist is not None and (_request.url.path.startswith("/display") or _request.url.path in ("/", "/setup", "/setup/")):
            return FileResponse(dist / "index.html")
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)

    return app


app = create_app()


def main() -> None:
    import uvicorn

    cfg = load()
    host = os.environ.get("HOST") or str(cfg["listen"]["host"] or "0.0.0.0")
    port = int(os.environ.get("PORT") or cfg["listen"]["port"] or 8787)
    hosts = ["127.0.0.1", *lan_ipv4()]
    for item in hosts:
        label = "  (LAN — use este em outro aparelho)" if item != "127.0.0.1" else ""
        print(f"painel     http://{item}:{port}/display/config{label}")
        print(f"mostrador  http://{item}:{port}/display{label}")
        print(f"usage      http://{item}:{port}/usage{label}")
        print(f"events     http://{item}:{port}/events{label}")
        print(f"swagger    http://{item}:{port}/docs{label}")
    print(f"repo {Path(__file__).resolve().parent.parent.parent}")
    uvicorn.run(
        app,
        host=host,
        port=port,
        timeout_keep_alive=0,
    )


if __name__ == "__main__":
    main()
