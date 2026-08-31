"""Coletor de cotas — FastAPI. Serve GET /usage (ESP32) e o painel React."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.config import frontend_dist
from app.netutil import lan_ipv4
from app.routers.config import router as config_router
from app.routers.usage import router as usage_router
from app.store import load


class CloseConnectionMiddleware(BaseHTTPMiddleware):
    """A ESP32 (e o Wokwi) às vezes reseta keep-alive HTTP/1.1. Fecha cada resposta."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers["Connection"] = "close"
        response.headers["Cache-Control"] = "no-store"
        return response


def create_app() -> FastAPI:
    cfg = load()
    host = os.environ.get("HOST") or str(cfg["listen"]["host"] or "0.0.0.0")
    port = int(os.environ.get("PORT") or cfg["listen"]["port"] or 8787)

    app = FastAPI(
        title="Vigia AI",
        version=__version__,
        description=(
            "Coletor local de cotas (Claude, Cursor, OpenRouter, DeepSeek). "
            "Tokens ficam neste computador. A placa só lê `GET /usage`. "
            "Não exponha esta porta na internet."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
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

    dist = frontend_dist()
    if dist is not None:
        assets = dist / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")
        icons = dist / "icons"
        if icons.is_dir():
            app.mount("/icons", StaticFiles(directory=icons), name="icons")

        @app.get("/", include_in_schema=False)
        @app.get("/display", include_in_schema=False)
        @app.get("/display/", include_in_schema=False)
        def spa() -> FileResponse:
            return FileResponse(dist / "index.html")

    @app.exception_handler(404)
    async def not_found(_request: Request, _exc: Exception) -> JSONResponse | FileResponse:
        if dist is not None and (_request.url.path.startswith("/display") or _request.url.path == "/"):
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
        print(f"painel     http://{item}:{port}/{label}")
        print(f"mostrador  http://{item}:{port}/display{label}")
        print(f"usage      http://{item}:{port}/usage{label}")
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
