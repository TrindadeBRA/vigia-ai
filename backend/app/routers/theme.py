"""Tema personalizado (protótipo) — o coletor só guarda os bytes que o painel
manda e devolve pra placa buscar (GET). Não valida o JSON do tema (é opaco
pro coletor, quem entende o schema é o firmware/frontend — ver
.agents/CONTRATO_TEMA.md); não faz parte do contrato de /usage."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import data_dir
from app.store import load

router = APIRouter(prefix="/api/theme", tags=["theme"])

_MAX_META_BYTES = 8192


def _meta_path():
    return data_dir() / "theme.json"


def _wallpapers_dir():
    return data_dir() / "wallpapers"


def _wallpaper_raw_path(wid: str, suffix: str = "") -> "Path":
    from pathlib import Path as _P

    if suffix:
        return _wallpapers_dir() / f"{wid}{suffix}.raw"
    return _wallpapers_dir() / f"{wid}.raw"


def _slideshow_state() -> dict:
    """Retorna estado do slideshow para incluir em GET /api/theme."""
    try:
        cfg = load()
        wp = cfg.get("wallpapers") or {}
        sl = wp.get("slideshow") or {}
        enabled = bool(sl.get("enabled", False))
        interval = int(sl.get("interval", 5))
        order = list(sl.get("order") or [])
        # Filtra order para só ids que existem
        existing = set()
        try:
            import json as _json

            meta_p = data_dir() / "wallpapers.json"
            if meta_p.is_file():
                raw = _json.loads(meta_p.read_text(encoding="utf-8"))
                for w in raw.get("wallpapers") or []:
                    if isinstance(w, dict) and w.get("id"):
                        existing.add(str(w["id"]))
        except Exception:
            pass
        # Também verifica arquivos soltos
        if _wallpapers_dir().is_dir():
            for p in _wallpapers_dir().glob("*.raw"):
                # nome sem sufixo _wokwi
                name = p.stem
                if name.endswith("_wokwi"):
                    name = name[:-6]
                existing.add(name)
        filtered = [x for x in order if x in existing]
        # Se slideshow enabled mas order vazio, tenta usar todos
        if enabled and not filtered and existing:
            filtered = sorted(existing)
        return {
            "enabled": enabled,
            "interval": max(1, min(120, interval)),
            "order": filtered,
            "count": len(filtered),
        }
    except Exception:
        return {"enabled": False, "interval": 5, "order": [], "count": 0}


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
    slideshow = _slideshow_state()
    return {
        "active": theme is not None,
        "theme": theme,
        "has_background": slideshow["count"] > 0,
        "slideshow": slideshow,
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
    summary="Bytes RAW do papel de parede atual",
    response_class=Response,
)
def get_theme_background(request: Request) -> Response:
    slideshow = _slideshow_state()
    if slideshow["count"] == 0:
        raise HTTPException(404, "nenhum papel de parede cadastrado")
    # Se slideshow desabilitado mas há wallpapers, serve o primeiro da ordem
    if slideshow["enabled"] and slideshow["count"] > 0:
        order = slideshow["order"]
        interval = slideshow["interval"]
        import time as _time

        idx = int(_time.time() // (interval * 60)) % len(order)
        wid = order[idx]
    else:
        # Slideshow desabilitado: serve o primeiro wallpaper cadastrado
        wid = slideshow["order"][0] if slideshow["order"] else None
        if not wid:
            raise HTTPException(404, "nenhum papel de parede cadastrado")
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
    wp_path = _wallpaper_raw_path(wid, suffix)
    if wp_path.is_file():
        return Response(content=wp_path.read_bytes(), media_type="application/octet-stream")
    wp_path2 = _wallpaper_raw_path(wid)
    if wp_path2.is_file():
        return Response(content=wp_path2.read_bytes(), media_type="application/octet-stream")
    orig = _wallpapers_dir() / f"{wid}.orig"
    if orig.is_file():
        try:
            from app.routers.wallpapers import _image_to_raw  # type: ignore

            tw, th = (160, 120) if suffix == "_wokwi" else (240, 160)
            raw = _image_to_raw(orig.read_bytes(), tw, th)
            return Response(content=raw, media_type="application/octet-stream")
        except Exception:
            pass
    raise HTTPException(404, "papel de parede não encontrado")


@router.get("/background/index", summary="Índice atual do slideshow")
def get_background_index() -> dict:
    slideshow = _slideshow_state()
    if not slideshow["enabled"] or slideshow["count"] == 0:
        return {"enabled": False, "index": 0, "count": 0, "interval": slideshow["interval"]}
    import time as _time

    interval = slideshow["interval"]
    order = slideshow["order"]
    idx = int(_time.time() // (interval * 60)) % len(order)
    return {
        "enabled": True,
        "index": idx,
        "count": len(order),
        "interval": interval,
        "current_id": order[idx],
        "order": order,
    }


@router.delete("", summary="Apaga o tema salvo (protótipo)")
def delete_theme() -> dict:
    _meta_path().unlink(missing_ok=True)
    return {"ok": True}
