"""Tema personalizado (protótipo) — o coletor só guarda os bytes que o painel
manda e devolve pra placa buscar (GET). Não valida o JSON do tema (é opaco
pro coletor, quem entende o schema é o firmware/frontend — ver
docs/CONTRATO_TEMA.md); não faz parte do contrato de /usage."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import Response

from app.config import data_dir

router = APIRouter(prefix="/api/theme", tags=["theme"])

_MAX_META_BYTES = 8192
_MAX_BG_BYTES = 400_000


def _meta_path():
    return data_dir() / "theme.json"


def _bg_path():
    return data_dir() / "theme_bg.raw"


@router.get(
    "",
    summary="Tema salvo (protótipo)",
    description="A placa busca aqui (botão de recarregar no header) pra aplicar o último tema que o painel salvou.",
)
def get_theme() -> dict:
    meta_path = _meta_path()
    theme = None
    if meta_path.is_file():
        theme = meta_path.read_text(encoding="utf-8")
    return {
        "active": theme is not None,
        "theme": theme,
        "has_background": _bg_path().is_file(),
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


@router.post("/background", summary="Salva a imagem de fundo RAW RGB565 (protótipo)")
async def post_theme_background(bg: UploadFile) -> dict:
    body = await bg.read(_MAX_BG_BYTES + 1)
    if len(body) > _MAX_BG_BYTES:
        raise HTTPException(413, "imagem grande demais")
    if not body:
        raise HTTPException(400, "arquivo vazio")
    data_dir().mkdir(parents=True, exist_ok=True)
    _bg_path().write_bytes(body)
    return {"ok": True}


@router.get(
    "/background",
    summary="Bytes RAW da imagem de fundo (protótipo)",
    response_class=Response,
)
def get_theme_background() -> Response:
    path = _bg_path()
    if not path.is_file():
        raise HTTPException(404, "sem imagem de fundo salva")
    return Response(content=path.read_bytes(), media_type="application/octet-stream")


@router.delete("", summary="Apaga o tema salvo (protótipo)")
def delete_theme() -> dict:
    _meta_path().unlink(missing_ok=True)
    _bg_path().unlink(missing_ok=True)
    return {"ok": True}
