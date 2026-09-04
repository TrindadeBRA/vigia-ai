"""Tema personalizado (protótipo) — o coletor só guarda os bytes que o painel
manda e devolve pra placa buscar (GET). Não valida o JSON do tema (é opaco
pro coletor, quem entende o schema é o firmware/frontend — ver
.agents/CONTRATO_TEMA.md); não faz parte do contrato de /usage."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import data_dir

router = APIRouter(prefix="/api/theme", tags=["theme"])

_MAX_META_BYTES = 8192


def _meta_path():
    return data_dir() / "theme.json"


def _wallpapers_dir():
    return data_dir() / "wallpapers"


def _wallpaper_raw_path(wid: str, suffix: str = ""):
    if suffix:
        return _wallpapers_dir() / f"{wid}{suffix}.raw"
    return _wallpapers_dir() / f"{wid}.raw"


def _screen_suffix(request: Request) -> str:
    screen = request.headers.get("X-Vigia-Screen") or request.headers.get("x-vigia-screen") or ""
    suffix = ""
    if screen and "x" in screen:
        try:
            ws, _, hs = screen.partition("x")
            wi = int(ws)
            hi = int(hs)
            if wi == 320 and hi == 240:
                suffix = "_wokwi"
        except ValueError:
            pass
    w = request.query_params.get("w")
    h = request.query_params.get("h")
    if w and h:
        try:
            wi = int(w)
            hi = int(h)
            if wi == 160 and hi == 120:
                suffix = "_wokwi"
            elif wi == 240 and hi == 160:
                suffix = ""
        except ValueError:
            pass
    return suffix


@router.get(
    "",
    summary="Tema salvo (protótipo)",
    description="A placa busca aqui (botão de recarregar no header) pra aplicar o último tema que o painel salvou.",
)
def get_theme() -> dict:
    from app.routers.wallpapers import _get_selected_id

    meta_path = _meta_path()
    theme = None
    if meta_path.is_file():
        theme = meta_path.read_text(encoding="utf-8")
    selected_id = _get_selected_id()
    return {
        "active": theme is not None,
        "theme": theme,
        "has_background": selected_id is not None,
        "background_id": selected_id,
    }


@router.post("/meta", summary="Salva o theme.json (protótipo)")
async def post_theme_meta(request: Request) -> dict:
    body = await request.body()
    if not body:
        raise HTTPException(400, "corpo vazio")
    if len(body) > _MAX_META_BYTES:
        raise HTTPException(413, "tema grande demais")
    data_dir().mkdir(parents=True, exist_ok=True)
    _meta_path().write_bytes(body)
    return {"ok": True}


@router.get(
    "/background",
    summary="Bytes RAW do papel de parede selecionado",
    response_class=Response,
)
def get_theme_background(request: Request) -> Response:
    from app.routers.wallpapers import _get_selected_id, _image_to_raw

    wid = _get_selected_id()
    if not wid:
        raise HTTPException(404, "nenhum papel de parede selecionado")
    suffix = _screen_suffix(request)
    wp_path = _wallpaper_raw_path(wid, suffix)
    if wp_path.is_file():
        return Response(content=wp_path.read_bytes(), media_type="application/octet-stream")
    wp_path2 = _wallpaper_raw_path(wid)
    if wp_path2.is_file():
        return Response(content=wp_path2.read_bytes(), media_type="application/octet-stream")
    orig = _wallpapers_dir() / f"{wid}.orig"
    if orig.is_file():
        try:
            tw, th = (160, 120) if suffix == "_wokwi" else (240, 160)
            raw = _image_to_raw(orig.read_bytes(), tw, th)
            return Response(content=raw, media_type="application/octet-stream")
        except Exception:
            pass
    raise HTTPException(404, "papel de parede não encontrado")


@router.get("/background/index", include_in_schema=False)
def get_background_index() -> dict:
    """Compat: placas antigas polleavam o slideshow. Sempre desligado."""
    from app.routers.wallpapers import _get_selected_id

    wid = _get_selected_id()
    return {"enabled": False, "index": 0, "count": 1 if wid else 0, "interval": 0, "current_id": wid}


@router.delete("", summary="Apaga o tema salvo (protótipo)")
def delete_theme() -> dict:
    _meta_path().unlink(missing_ok=True)
    return {"ok": True}
