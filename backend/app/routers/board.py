"""Layout do grid do painel (protótipo) — o coletor só guarda os bytes que o
painel manda e devolve pra qualquer navegador buscar (GET), pra persistir o
grid entre monitores/resoluções diferentes (chave = quantidade de colunas
visíveis). O schema é opaco pro coletor, quem entende é o frontend — ver
app/routers/theme.py para o mesmo padrão."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import data_dir

router = APIRouter(prefix="/api/board", tags=["board"])

_MAX_BYTES = 262144  # 256 KiB — grid com muitos cards/clones cabe folgado


def _board_path():
    return data_dir() / "board.json"


@router.get(
    "",
    summary="Layout salvo do grid (por quantidade de colunas)",
    description="Bytes crus do último JSON salvo pelo painel; `{}` se nada foi salvo ainda.",
)
def get_board() -> Response:
    path = _board_path()
    if not path.is_file():
        return Response(content="{}", media_type="application/json")
    return Response(content=path.read_bytes(), media_type="application/json")


@router.put("", summary="Salva o layout do grid")
async def put_board(request: Request) -> dict:
    body = await request.body()
    if not body:
        raise HTTPException(400, "corpo vazio")
    if len(body) > _MAX_BYTES:
        raise HTTPException(413, "grade grande demais")
    try:
        json.loads(body)
    except ValueError as exc:
        raise HTTPException(400, "JSON inválido") from exc
    data_dir().mkdir(parents=True, exist_ok=True)
    _board_path().write_bytes(body)
    return {"ok": True}


@router.delete("", summary="Apaga o layout salvo do grid")
def delete_board() -> dict:
    _board_path().unlink(missing_ok=True)
    return {"ok": True}
