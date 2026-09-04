"""Wallpapers: papéis de parede + provedores externos (Pexels, Wallhaven, Unsplash)."""

from __future__ import annotations

import io
import ipaddress
import json
import secrets
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import data_dir
from app.store import load, update

router = APIRouter(prefix="/api/wallpapers", tags=["wallpapers"])

_MAX_BG_BYTES = 400_000
_MAX_PREVIEW_BYTES = 500_000

# Diretórios e arquivos
def _wallpapers_dir() -> Path:
    return data_dir() / "wallpapers"

def _wallpapers_meta_path() -> Path:
    return data_dir() / "wallpapers.json"

def _wallpaper_raw_path(wid: str, suffix: str = "") -> Path:
    # suffix: "" = 480x320 half (240x160), "_wokwi" = 320x240 half (160x120)
    if suffix:
        return _wallpapers_dir() / f"{wid}{suffix}.raw"
    return _wallpapers_dir() / f"{wid}.raw"

def _wallpaper_preview_path(wid: str) -> Path:
    return _wallpapers_dir() / f"{wid}.jpg"

def _wallpaper_orig_path(wid: str) -> Path:
    return _wallpapers_dir() / f"{wid}.orig"

def _load_meta() -> dict[str, Any]:
    p = _wallpapers_meta_path()
    if not p.is_file():
        return {"wallpapers": []}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(raw, dict) and isinstance(raw.get("wallpapers"), list):
            return raw
    except (OSError, json.JSONDecodeError):
        pass
    return {"wallpapers": []}

def _save_meta(meta: dict[str, Any]) -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    p = _wallpapers_meta_path()
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(p)

def _list_wallpapers(scope: str | None = None) -> list[dict[str, Any]]:
    meta = _load_meta()
    out: list[dict[str, Any]] = []
    for w in meta.get("wallpapers") or []:
        if not isinstance(w, dict) or not w.get("id"):
            continue
        wid = str(w["id"])
        # Filtra por scope se solicitado: "theme" ou "grid"
        # Sem scope => retorna todos (compat). Com scope, só os desse scope.
        # Wallpapers antigos sem scope são considerados "theme" para não quebrar.
        w_scope = str(w.get("scope") or "theme").strip() or "theme"
        if scope and w_scope != scope:
            # permite que wallpapers sem scope apareçam em theme, mas não em grid
            # para grid, só mostra scope == "grid"
            continue
        # Verifica se arquivo existe (pelo menos um dos raws)
        if not _wallpaper_raw_path(wid).is_file() and not _wallpaper_raw_path(wid, "_wokwi").is_file() and not _wallpaper_preview_path(wid).is_file():
            # Também verifica se tem orig
            if not _wallpaper_orig_path(wid).is_file():
                continue
        out.append({
            "id": wid,
            "source": w.get("source", "upload"),
            "provider": w.get("provider"),
            "external_id": w.get("external_id"),
            "preview_url": w.get("preview_url"),
            "created_at": w.get("created_at"),
            "has_preview": _wallpaper_preview_path(wid).is_file(),
            "scope": w_scope,
        })
    return out

def _get_selected_id() -> str | None:
    ids = [w["id"] for w in _list_wallpapers(scope="theme")]
    if not ids:
        # fallback: se não há theme wallpapers, tenta qualquer
        ids_all = [w["id"] for w in _list_wallpapers()]
        if not ids_all:
            return None
        cfg = load()
        wp = cfg.get("wallpapers") or {}
        selected = str(wp.get("selected_id") or "").strip()
        if selected in ids_all:
            return selected
        return ids_all[0] if ids_all else None
    cfg = load()
    wp = cfg.get("wallpapers") or {}
    selected = str(wp.get("selected_id") or "").strip()
    if selected in ids:
        return selected
    return ids[0]


def _patch_theme_background_type(kind: str) -> None:
    p = data_dir() / "theme.json"
    if not p.is_file():
        return
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(raw, dict):
        return
    bg = raw.get("background")
    if not isinstance(bg, dict):
        raw["background"] = {"type": kind, "color": "#0f0f0f"}
    else:
        bg["type"] = kind
        raw["background"] = bg
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(raw, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(p)


def _set_selected_id(wid: str | None) -> None:
    def mut(cfg: dict[str, Any]) -> None:
        wp = cfg.setdefault("wallpapers", {})
        wp["selected_id"] = str(wid or "")

    update(mut)
    _patch_theme_background_type("image" if wid else "color")


def _get_grid_selected_id() -> str | None:
    cfg = load()
    wp = cfg.get("wallpapers") or {}
    grid_id = str(wp.get("grid_selected_id") or "").strip()
    if grid_id:
        # valida que existe (qualquer scope) para compat com wallpapers antigos sem scope
        if grid_id in {w["id"] for w in _list_wallpapers()}:
            return grid_id
        return None
    return None


def _set_grid_selected_id(wid: str | None) -> None:
    def mut(cfg: dict[str, Any]) -> None:
        wp = cfg.setdefault("wallpapers", {})
        wp["grid_selected_id"] = str(wid or "")

    update(mut)


def _get_provider_keys() -> dict[str, str]:
    cfg = load()
    wp = cfg.get("wallpapers") or {}
    prov = wp.get("providers") or {}
    return {
        "pexels_key": str(prov.get("pexels_key") or ""),
        "unsplash_key": str(prov.get("unsplash_key") or ""),
        "wallhaven_key": str(prov.get("wallhaven_key") or ""),
    }

def _provider_status() -> dict[str, Any]:
    keys = _get_provider_keys()
    return {
        "pexels": {"configured": bool(keys["pexels_key"].strip()), "needs_key": True},
        "unsplash": {"configured": bool(keys["unsplash_key"].strip()), "needs_key": True},
        "wallhaven": {"configured": True, "has_key": bool(keys["wallhaven_key"].strip()), "needs_key": False},
    }

# Conversão de imagem para RAW RGB565 (cover crop)
def _image_to_raw(image_bytes: bytes, target_w: int, target_h: int) -> bytes:
    """Converte bytes de imagem (JPEG/PNG) para RAW RGB565 little-endian com cover crop."""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        raise HTTPException(500, "Pillow não instalado no coletor")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        # Cover crop: escala para cobrir target, depois crop central
        iw, ih = img.size
        scale = max(target_w / iw, target_h / ih)
        nw = int(iw * scale)
        nh = int(ih * scale)
        img = img.resize((nw, nh), Image.LANCZOS)
        left = (nw - target_w) // 2
        top = (nh - target_h) // 2
        img = img.crop((left, top, left + target_w, top + target_h))
        # Converte para RGB565 little-endian
        out = bytearray(target_w * target_h * 2)
        idx = 0
        for y in range(target_h):
            for x in range(target_w):
                r, g, b = img.getpixel((x, y))
                v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
                out[idx] = v & 0xFF
                out[idx + 1] = (v >> 8) & 0xFF
                idx += 2
        return bytes(out)
    except Exception as e:
        raise HTTPException(400, f"falha ao converter imagem: {e}")

def _raw_to_preview(raw_bytes: bytes, w: int, h: int) -> bytes:
    """Converte RAW RGB565 para JPEG preview (para thumbnails)."""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return b""
    try:
        img = Image.new("RGB", (w, h))
        idx = 0
        for y in range(h):
            for x in range(w):
                lo = raw_bytes[idx]
                hi = raw_bytes[idx + 1]
                v = lo | (hi << 8)
                r = (v >> 11) & 0x1F
                g = (v >> 5) & 0x3F
                b = v & 0x1F
                # Expand to 8-bit
                r = (r << 3) | (r >> 2)
                g = (g << 2) | (g >> 4)
                b = (b << 3) | (b >> 2)
                img.putpixel((x, y), (r, g, b))
                idx += 2
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except Exception:
        return b""

# ── Proteção SSRF: só http(s) para hosts públicos, sem seguir redirect pra dentro ──
# (ver SECURITY_REVIEW.md, Finding 1 — _download_image/_http_json antes aceitavam
# qualquer URL, incluindo file:// e IPs internos/loopback/link-local).

def _is_blocked_host(hostname: str) -> bool:
    host = (hostname or "").strip().lower().rstrip(".")
    if not host or host == "localhost":
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return True  # não resolve -> bloqueia por segurança
    for info in infos:
        raw_ip = info[4][0].split("%")[0]  # remove zona IPv6 (fe80::1%eth0)
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            return True
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return True
    return False


def _validate_public_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "URL deve ser http:// ou https://")
    if not parsed.hostname or _is_blocked_host(parsed.hostname):
        raise HTTPException(400, "host da URL não permitido")


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        _validate_public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_SAFE_OPENER = urllib.request.build_opener(_SafeRedirectHandler)


def _download_image(url: str, timeout: float = 15.0) -> bytes:
    _validate_public_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (VigiaAI/1.0)"})
    try:
        with _SAFE_OPENER.open(req, timeout=timeout) as resp:
            data = resp.read()
            if len(data) > 10_000_000:
                raise HTTPException(413, "imagem muito grande")
            return data
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"falha ao baixar imagem: HTTP {e.code}")
    except urllib.error.URLError as e:
        raise HTTPException(502, f"falha ao baixar imagem: {e.reason}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"falha ao baixar imagem: {e}")

def _http_json(url: str, headers: dict[str, str] | None = None, timeout: float = 15.0) -> Any:
    _validate_public_url(url)
    hdrs = dict(headers or {})
    # Wallhaven bloqueia urllib default; usa User-Agent de navegador
    if "User-Agent" not in hdrs and "user-agent" not in {k.lower() for k in hdrs}:
        hdrs["User-Agent"] = "Mozilla/5.0 (VigiaAI/1.0)"
    req = urllib.request.Request(url, headers=hdrs)
    try:
        with _SAFE_OPENER.open(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        raise HTTPException(e.code, f"API erro {e.code}: {body}")
    except urllib.error.URLError as e:
        raise HTTPException(502, f"API rede: {e.reason}")
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"API JSON inválido: {e}")

@router.get("", summary="Lista wallpapers")
def list_wallpapers(request: Request) -> dict[str, Any]:
    scope = request.query_params.get("scope")
    # normaliza scope: só aceita "theme" ou "grid", senão ignora (lista tudo)
    if scope not in ("theme", "grid"):
        scope = None
    wallpapers = _list_wallpapers(scope=scope)
    providers = _provider_status()
    # Para compat, sempre retorna ambos selected; mas filtra lista por scope
    return {
        "wallpapers": wallpapers,
        "selected_id": _get_selected_id(),
        "grid_selected_id": _get_grid_selected_id(),
        "providers": providers,
        "count": len(wallpapers),
        "scope": scope,
    }

@router.get("/selected", summary="Papel de parede ativo")
def get_selected() -> dict[str, Any]:
    return {"selected_id": _get_selected_id()}

@router.put("/selected", summary="Define o papel de parede ativo")
async def put_selected(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "JSON inválido")
    wid = body.get("id")
    if wid is not None and not isinstance(wid, str):
        raise HTTPException(400, "id deve ser string")
    existing = {w["id"] for w in _list_wallpapers(scope="theme")}
    # fallback: se não há theme wallpapers mas id existe em geral, permite (compat)
    if wid and wid not in existing:
        if wid not in {w["id"] for w in _list_wallpapers()}:
            raise HTTPException(400, "wallpaper id inválido")
    if wid:
        _set_selected_id(wid)
    else:
        _set_selected_id(None)
    return {"ok": True, "selected_id": _get_selected_id()}

@router.get("/providers", summary="Status dos provedores")
def get_providers() -> dict[str, Any]:
    return _provider_status()

@router.put("/providers", summary="Atualiza chaves dos provedores")
async def put_providers(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "JSON inválido")
    pexels_key = body.get("pexels_key")
    unsplash_key = body.get("unsplash_key")
    wallhaven_key = body.get("wallhaven_key")
    # Validação básica: se fornecido, deve ser string
    for k, v in [("pexels_key", pexels_key), ("unsplash_key", unsplash_key), ("wallhaven_key", wallhaven_key)]:
        if v is not None and not isinstance(v, str):
            raise HTTPException(400, f"{k} deve ser string")
        if isinstance(v, str) and v.strip() == "********":
            # Não altera se for máscara
            if k == "pexels_key":
                pexels_key = None
            elif k == "unsplash_key":
                unsplash_key = None
            elif k == "wallhaven_key":
                wallhaven_key = None
    def mut(cfg: dict[str, Any]) -> None:
        wp = cfg.setdefault("wallpapers", {})
        prov = wp.setdefault("providers", {"pexels_key": "", "unsplash_key": "", "wallhaven_key": ""})
        if pexels_key is not None:
            prov["pexels_key"] = str(pexels_key).strip()
        if unsplash_key is not None:
            prov["unsplash_key"] = str(unsplash_key).strip()
        if wallhaven_key is not None:
            prov["wallhaven_key"] = str(wallhaven_key).strip()
    update(mut)
    return {"ok": True, **_provider_status()}

@router.post("/upload", summary="Upload de wallpaper (RAW ou imagem)")
async def upload_wallpaper(request: Request) -> dict[str, Any]:
    # Suporta multipart com campo "file" ou "bg" (compat com theme), ou raw bytes
    # Scope separa bibliotecas: "theme" (/display/theme) vs "grid" (/display)
    scope_param = request.query_params.get("scope")
    if scope_param not in ("theme", "grid"):
        scope_param = None
    content_type = request.headers.get("content-type", "")
    wid = secrets.token_hex(4)
    target_w, target_h = 240, 160  # default hardware half
    # Tenta pegar device resolution do hub se disponível
    # Por enquanto usa default; frontend já converte para RAW no tamanho correto
    raw_bytes: bytes | None = None
    preview_bytes: bytes | None = None
    source = "upload"
    # Se for multipart, tenta ler arquivo
    if "multipart/form-data" in content_type:
        form = await request.form()
        # scope pode vir no form (ex: grid)
        if not scope_param:
            form_scope = str(form.get("scope") or "").strip()
            if form_scope in ("theme", "grid"):
                scope_param = form_scope
        file = form.get("file") or form.get("bg") or form.get("image")
        if file is None:
            raise HTTPException(400, "campo file/bg/image obrigatório")
        # file pode ser UploadFile
        if hasattr(file, "read"):
            data = await file.read()  # type: ignore
        else:
            data = bytes(file)  # type: ignore
        if not data:
            raise HTTPException(400, "arquivo vazio")
        if len(data) > _MAX_BG_BYTES + 1000 and len(data) < 500000:
            # Pode ser RAW já (tamanho exato 240*160*2=76800 ou 160*120*2=38400)
            # Verifica se é RAW válido
            if len(data) in (240*160*2, 160*120*2, 480*320*2, 320*240*2):
                raw_bytes = data
                # Tenta gerar preview
                if len(data) == 240*160*2:
                    preview_bytes = _raw_to_preview(data, 240, 160)
                elif len(data) == 160*120*2:
                    preview_bytes = _raw_to_preview(data, 160, 120)
            else:
                # Assume que é imagem original (JPEG/PNG), converte
                try:
                    raw_bytes = _image_to_raw(data, target_w, target_h)
                    # Gera preview da original (redimensiona para 320px)
                    try:
                        from PIL import Image  # type: ignore
                        img = Image.open(io.BytesIO(data))
                        img.thumbnail((320, 320), Image.LANCZOS)
                        buf = io.BytesIO()
                        img.convert("RGB").save(buf, format="JPEG", quality=85)
                        preview_bytes = buf.getvalue()
                    except Exception:
                        preview_bytes = None
                    # Salva original também
                    _wallpapers_dir().mkdir(parents=True, exist_ok=True)
                    _wallpaper_orig_path(wid).write_bytes(data)
                except HTTPException:
                    raise
                except Exception as e:
                    raise HTTPException(400, f"imagem inválida: {e}")
        else:
            # Tenta como imagem
            if len(data) > 100 and data[:2] not in (b"\xff\xd8", b"\x89P"):  # não é JPEG/PNG header, pode ser RAW
                # Se tamanho bate com RAW, trata como RAW
                if len(data) in (240*160*2, 160*120*2):
                    raw_bytes = data
                    preview_bytes = _raw_to_preview(data, 240 if len(data)==76800 else 160, 160 if len(data)==76800 else 120)
                else:
                    # Tenta converter como imagem mesmo assim
                    try:
                        raw_bytes = _image_to_raw(data, target_w, target_h)
                        _wallpapers_dir().mkdir(parents=True, exist_ok=True)
                        _wallpaper_orig_path(wid).write_bytes(data)
                        # preview
                        try:
                            from PIL import Image  # type: ignore
                            img = Image.open(io.BytesIO(data))
                            img.thumbnail((320, 320), Image.LANCZOS)
                            buf = io.BytesIO()
                            img.convert("RGB").save(buf, format="JPEG", quality=85)
                            preview_bytes = buf.getvalue()
                        except Exception:
                            pass
                    except Exception as e:
                        raise HTTPException(400, f"imagem inválida: {e}")
            else:
                # É imagem
                try:
                    raw_bytes = _image_to_raw(data, target_w, target_h)
                    _wallpapers_dir().mkdir(parents=True, exist_ok=True)
                    _wallpaper_orig_path(wid).write_bytes(data)
                    try:
                        from PIL import Image  # type: ignore
                        img = Image.open(io.BytesIO(data))
                        img.thumbnail((320, 320), Image.LANCZOS)
                        buf = io.BytesIO()
                        img.convert("RGB").save(buf, format="JPEG", quality=85)
                        preview_bytes = buf.getvalue()
                    except Exception:
                        pass
                except HTTPException:
                    raise
                except Exception as e:
                    raise HTTPException(400, f"imagem inválida: {e}")
        if raw_bytes is None:
            raise HTTPException(400, "não foi possível processar imagem")
    else:
        # Raw bytes direto (como theme/background faz)
        data = await request.body()
        if not data:
            raise HTTPException(400, "corpo vazio")
        if len(data) > _MAX_BG_BYTES:
            raise HTTPException(413, "imagem grande demais")
        # Assume RAW
        raw_bytes = data
        if len(data) == 240*160*2:
            preview_bytes = _raw_to_preview(data, 240, 160)
        elif len(data) == 160*120*2:
            preview_bytes = _raw_to_preview(data, 160, 120)

    if raw_bytes is None:
        raise HTTPException(400, "falha ao processar wallpaper")

    # Salva RAW
    _wallpapers_dir().mkdir(parents=True, exist_ok=True)
    _wallpaper_raw_path(wid).write_bytes(raw_bytes)
    # Também salva versão wokwi se for 240x160, gera 160x120
    if len(raw_bytes) == 240*160*2:
        try:
            # Gera versão wokwi a partir do preview ou re-converte
            # Para simplificar, gera a partir do RAW: downscale 240x160 -> 160x120
            # Converte RAW para imagem, resize, volta para RAW
            from PIL import Image  # type: ignore
            # RAW -> Image
            img = Image.new("RGB", (240, 160))
            idx = 0
            for y in range(160):
                for x in range(240):
                    lo = raw_bytes[idx]
                    hi = raw_bytes[idx+1]
                    v = lo | (hi << 8)
                    r = (v >> 11) & 0x1F
                    g = (v >> 5) & 0x3F
                    b = v & 0x1F
                    r = (r << 3) | (r >> 2)
                    g = (g << 2) | (g >> 4)
                    b = (b << 3) | (b >> 2)
                    img.putpixel((x, y), (r, g, b))
                    idx += 2
            img2 = img.resize((160, 120), Image.LANCZOS)
            # Image -> RAW 160x120
            out2 = bytearray(160*120*2)
            idx2 = 0
            for y in range(120):
                for x in range(160):
                    r, g, b = img2.getpixel((x, y))
                    v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
                    out2[idx2] = v & 0xFF
                    out2[idx2+1] = (v >> 8) & 0xFF
                    idx2 += 2
            _wallpaper_raw_path(wid, "_wokwi").write_bytes(bytes(out2))
        except Exception:
            pass
    elif len(raw_bytes) == 160*120*2:
        # Gera versão hardware a partir do wokwi (upscale)
        try:
            from PIL import Image  # type: ignore
            img = Image.new("RGB", (160, 120))
            idx = 0
            for y in range(120):
                for x in range(160):
                    lo = raw_bytes[idx]
                    hi = raw_bytes[idx+1]
                    v = lo | (hi << 8)
                    r = (v >> 11) & 0x1F
                    g = (v >> 5) & 0x3F
                    b = v & 0x1F
                    r = (r << 3) | (r >> 2)
                    g = (g << 2) | (g >> 4)
                    b = (b << 3) | (b >> 2)
                    img.putpixel((x, y), (r, g, b))
                    idx += 2
            img2 = img.resize((240, 160), Image.LANCZOS)
            out2 = bytearray(240*160*2)
            idx2 = 0
            for y in range(160):
                for x in range(240):
                    r, g, b = img2.getpixel((x, y))
                    v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
                    out2[idx2] = v & 0xFF
                    out2[idx2+1] = (v >> 8) & 0xFF
                    idx2 += 2
            _wallpaper_raw_path(wid, "_wokwi").write_bytes(raw_bytes)
            _wallpaper_raw_path(wid).write_bytes(bytes(out2))
        except Exception:
            pass

    if preview_bytes:
        _wallpaper_preview_path(wid).write_bytes(preview_bytes)

    # Atualiza meta
    effective_scope = scope_param if scope_param in ("theme", "grid") else "theme"
    meta = _load_meta()
    meta.setdefault("wallpapers", []).append({
        "id": wid,
        "source": source,
        "provider": None,
        "external_id": None,
        "preview_url": None,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "scope": effective_scope,
    })
    _save_meta(meta)

    # Novo upload passa a ser o papel ativo do tema/grid conforme scope.
    if effective_scope == "grid":
        _set_grid_selected_id(wid)
    else:
        _set_selected_id(wid)

    return {"ok": True, "id": wid, "scope": effective_scope}

@router.delete("/{wid}", summary="Remove wallpaper")
def delete_wallpaper(wid: str) -> dict[str, Any]:
    if not wid or "/" in wid or "\\" in wid or ".." in wid:
        raise HTTPException(400, "id inválido")
    meta = _load_meta()
    found = False
    new_list = []
    for w in meta.get("wallpapers") or []:
        if str(w.get("id")) == wid:
            found = True
        else:
            new_list.append(w)
    if not found:
        # Verifica se arquivo existe mesmo sem meta
        if not _wallpaper_raw_path(wid).is_file() and not _wallpaper_preview_path(wid).is_file():
            raise HTTPException(404, "wallpaper não encontrado")
    meta["wallpapers"] = new_list
    _save_meta(meta)
    # Remove arquivos
    for p in [_wallpaper_raw_path(wid), _wallpaper_raw_path(wid, "_wokwi"), _wallpaper_preview_path(wid), _wallpaper_orig_path(wid)]:
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
    # Se o removido era o ativo, escolhe outro (ou nenhum) dentro do mesmo scope.
    remaining_theme = [w["id"] for w in _list_wallpapers(scope="theme")]
    remaining_grid = [w["id"] for w in _list_wallpapers(scope="grid")]
    remaining_all = [w["id"] for w in _list_wallpapers()]
    selected = load().get("wallpapers", {}).get("selected_id") or ""
    if selected == wid or (selected and selected not in {w["id"] for w in _list_wallpapers(scope="theme")} and selected not in remaining_all):
        # tenta manter dentro do theme, senão limpa
        if remaining_theme:
            _set_selected_id(remaining_theme[0])
        elif selected == wid:
            _set_selected_id(None)
    grid_selected = load().get("wallpapers", {}).get("grid_selected_id") or ""
    if grid_selected == wid:
        _set_grid_selected_id(None)
    elif grid_selected and grid_selected not in remaining_grid and grid_selected not in remaining_all:
        _set_grid_selected_id(None)
    return {"ok": True}

@router.get("/{wid}/original", summary="Imagem original em alta qualidade")
def get_original(wid: str) -> Response:
    if not wid or "/" in wid or "\\" in wid:
        raise HTTPException(400, "id inválido")
    # 1) Tenta arquivo original salvo (pode ser .orig, .orig.jpg, .orig.png)
    orig = _wallpaper_orig_path(wid)
    if orig.is_file():
        data = orig.read_bytes()
        if data[:2] == b"\xff\xd8":
            return Response(content=data, media_type="image/jpeg")
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            return Response(content=data, media_type="image/png")
        if data[:6] in (b"GIF87a", b"GIF89a"):
            return Response(content=data, media_type="image/gif")
        # tenta detectar via header, fallback jpeg
        return Response(content=data, media_type="image/jpeg")
    # 1b) Tenta variações com extensão
    for ext, mime in [(".jpg", "image/jpeg"), (".jpeg", "image/jpeg"), (".png", "image/png"), (".gif", "image/gif"), (".webp", "image/webp")]:
        p = _wallpapers_dir() / f"{wid}.orig{ext}"
        if p.is_file():
            return Response(content=p.read_bytes(), media_type=mime)
    # 2) Fallback: usa preview se original não existe (ex: RAW antigo sem orig)
    p = _wallpaper_preview_path(wid)
    if p.is_file():
        return Response(content=p.read_bytes(), media_type="image/jpeg")
    # 3) Tenta gerar preview a partir do RAW como último recurso
    raw_p = _wallpaper_raw_path(wid)
    if raw_p.is_file():
        raw = raw_p.read_bytes()
        if len(raw) == 240*160*2:
            jpg = _raw_to_preview(raw, 240, 160)
            if jpg:
                return Response(content=jpg, media_type="image/jpeg")
        elif len(raw) == 160*120*2:
            jpg = _raw_to_preview(raw, 160, 120)
            if jpg:
                return Response(content=jpg, media_type="image/jpeg")
    raise HTTPException(404, "original não encontrado")


@router.get("/{wid}/preview", summary="Preview JPEG do wallpaper")
def get_preview(wid: str) -> Response:
    if not wid or "/" in wid or "\\" in wid:
        raise HTTPException(400, "id inválido")
    p = _wallpaper_preview_path(wid)
    if p.is_file():
        return Response(content=p.read_bytes(), media_type="image/jpeg")
    # Tenta gerar a partir do RAW
    raw_p = _wallpaper_raw_path(wid)
    if raw_p.is_file():
        raw = raw_p.read_bytes()
        if len(raw) == 240*160*2:
            jpg = _raw_to_preview(raw, 240, 160)
            if jpg:
                return Response(content=jpg, media_type="image/jpeg")
        elif len(raw) == 160*120*2:
            jpg = _raw_to_preview(raw, 160, 120)
            if jpg:
                return Response(content=jpg, media_type="image/jpeg")
    # Tenta orig
    orig = _wallpaper_orig_path(wid)
    if orig.is_file():
        data = orig.read_bytes()
        # Se for JPEG/PNG, retorna direto
        if data[:2] == b"\xff\xd8" or data[:8] == b"\x89PNG\r\n\x1a\n":
            # Detecta mime
            if data[:2] == b"\xff\xd8":
                return Response(content=data, media_type="image/jpeg")
            else:
                return Response(content=data, media_type="image/png")
    raise HTTPException(404, "preview não encontrado")

@router.get("/{wid}/raw", summary="RAW do wallpaper (para debug)")
def get_raw(wid: str, request: Request) -> Response:
    if not wid or "/" in wid or "\\" in wid:
        raise HTTPException(400, "id inválido")
    # Decide qual versão servir baseado no device (query ou header)
    # Query ?w=240&h=160 ou header X-Vigia-Screen
    w = request.query_params.get("w")
    h = request.query_params.get("h")
    target = None
    if w and h:
        try:
            wi = int(w)
            hi = int(h)
            if wi == 160 and hi == 120:
                target = "_wokwi"
            elif wi == 240 and hi == 160:
                target = ""
        except ValueError:
            pass
    if target is None:
        # Tenta header
        screen = request.headers.get("X-Vigia-Screen") or request.headers.get("x-vigia-screen")
        if screen and "x" in screen:
            try:
                ws, _, hs = screen.partition("x")
                wi = int(ws)
                hi = int(hs)
                if wi == 320 and hi == 240:
                    target = "_wokwi"
                elif wi == 480 and hi == 320:
                    target = ""
            except ValueError:
                pass
    # Fallback: tenta hub device info via app state? Não temos acesso aqui, usa default
    if target == "_wokwi":
        p = _wallpaper_raw_path(wid, "_wokwi")
        if p.is_file():
            return Response(content=p.read_bytes(), media_type="application/octet-stream")
    p = _wallpaper_raw_path(wid)
    if p.is_file():
        return Response(content=p.read_bytes(), media_type="application/octet-stream")
    # Tenta gerar a partir do orig
    orig = _wallpaper_orig_path(wid)
    if orig.is_file():
        data = orig.read_bytes()
        # Converte para target
        tw, th = (160, 120) if target == "_wokwi" else (240, 160)
        try:
            raw = _image_to_raw(data, tw, th)
            return Response(content=raw, media_type="application/octet-stream")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"falha ao converter: {e}")
    raise HTTPException(404, "wallpaper não encontrado")

# --- Provedores externos ---

@router.get("/search/{provider}", summary="Busca em provedor externo")
def search_provider(provider: str, request: Request) -> dict[str, Any]:
    provider = provider.lower().strip()
    if provider not in ("pexels", "wallhaven", "unsplash"):
        raise HTTPException(400, "provider deve ser pexels, wallhaven ou unsplash")
    q = request.query_params.get("q") or request.query_params.get("query") or ""
    page_s = request.query_params.get("page") or "1"
    per_page_s = request.query_params.get("per_page") or "15"
    try:
        page = max(1, int(page_s))
    except ValueError:
        page = 1
    try:
        per_page = max(1, min(30, int(per_page_s)))
    except ValueError:
        per_page = 15
    if not q.strip():
        raise HTTPException(400, "query q obrigatória")

    keys = _get_provider_keys()
    if provider == "pexels":
        key = keys["pexels_key"].strip()
        if not key:
            raise HTTPException(400, "Pexels precisa de API key configurada")
        url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(q)}&per_page={per_page}&page={page}&orientation=landscape"
        headers = {"Authorization": key}
        data = _http_json(url, headers=headers)
        # Normaliza
        photos = data.get("photos") or []
        results = []
        for p in photos:
            src = p.get("src") or {}
            results.append({
                "id": str(p.get("id")),
                "provider": "pexels",
                "width": p.get("width"),
                "height": p.get("height"),
                "url": p.get("url"),
                "photographer": p.get("photographer"),
                "thumb": src.get("medium") or src.get("small") or src.get("tiny"),
                "full": src.get("large2x") or src.get("large") or src.get("original"),
                "preview": src.get("medium"),
            })
        return {
            "provider": "pexels",
            "query": q,
            "page": page,
            "per_page": per_page,
            "total": data.get("total_results"),
            "results": results,
        }
    elif provider == "wallhaven":
        key = keys["wallhaven_key"].strip()
        # Wallhaven: q, categories=111, purity=100, sorting=relevance, order=desc, atleast=1920x1080
        params = {
            "q": q,
            "page": str(page),
            "categories": "111",
            "purity": "100",
            "sorting": "relevance",
            "order": "desc",
            "atleast": "1920x1080",
        }
        qs = urllib.parse.urlencode(params)
        url = f"https://wallhaven.cc/api/v1/search?{qs}"
        headers = {}
        if key:
            headers["X-API-Key"] = key
        data = _http_json(url, headers=headers)
        items = data.get("data") or []
        results = []
        for it in items:
            results.append({
                "id": str(it.get("id")),
                "provider": "wallhaven",
                "width": it.get("dimension_x"),
                "height": it.get("dimension_y"),
                "url": it.get("url"),
                "thumb": (it.get("thumbs") or {}).get("small") or (it.get("thumbs") or {}).get("large"),
                "full": it.get("path"),
                "preview": (it.get("thumbs") or {}).get("large"),
                "resolution": it.get("resolution"),
            })
        meta = data.get("meta") or {}
        return {
            "provider": "wallhaven",
            "query": q,
            "page": page,
            "per_page": 24,
            "total": meta.get("total"),
            "results": results,
        }
    elif provider == "unsplash":
        key = keys["unsplash_key"].strip()
        if not key:
            raise HTTPException(400, "Unsplash precisa de API key configurada")
        params = {
            "query": q,
            "page": str(page),
            "per_page": str(per_page),
            "orientation": "landscape",
        }
        qs = urllib.parse.urlencode(params)
        url = f"https://api.unsplash.com/search/photos?{qs}"
        headers = {"Authorization": f"Client-ID {key}", "Accept-Version": "v1"}
        data = _http_json(url, headers=headers)
        items = data.get("results") or []
        results = []
        for it in items:
            urls = it.get("urls") or {}
            results.append({
                "id": str(it.get("id")),
                "provider": "unsplash",
                "width": it.get("width"),
                "height": it.get("height"),
                "url": it.get("links", {}).get("html") or f"https://unsplash.com/photos/{it.get('id')}",
                "photographer": (it.get("user") or {}).get("name"),
                "thumb": urls.get("small") or urls.get("thumb"),
                "full": urls.get("regular") or urls.get("full") or urls.get("raw"),
                "preview": urls.get("small"),
                "color": it.get("color"),
            })
        return {
            "provider": "unsplash",
            "query": q,
            "page": page,
            "per_page": per_page,
            "total": data.get("total"),
            "results": results,
        }
    raise HTTPException(400, "provider inválido")

@router.post("/import", summary="Importa wallpaper de provedor externo")
async def import_wallpaper(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "JSON inválido")
    # scope separa bibliotecas: query ?scope=grid ou body.scope
    scope_param = request.query_params.get("scope")
    if scope_param not in ("theme", "grid"):
        scope_param = str(body.get("scope") or "").strip()
        if scope_param not in ("theme", "grid"):
            scope_param = None
    effective_scope = scope_param if scope_param in ("theme", "grid") else "theme"
    provider = str(body.get("provider") or "").lower().strip()
    external_id = str(body.get("id") or body.get("external_id") or "").strip()
    image_url = str(body.get("image_url") or body.get("full") or body.get("url") or "").strip()
    thumb_url = str(body.get("thumb") or body.get("preview") or "").strip()
    if provider not in ("pexels", "wallhaven", "unsplash"):
        raise HTTPException(400, "provider deve ser pexels, wallhaven ou unsplash")
    if not image_url:
        raise HTTPException(400, "image_url obrigatório")
    # Verifica se provedor precisa de key
    keys = _get_provider_keys()
    if provider == "pexels" and not keys["pexels_key"].strip():
        raise HTTPException(400, "Pexels precisa de API key")
    if provider == "unsplash" and not keys["unsplash_key"].strip():
        raise HTTPException(400, "Unsplash precisa de API key")
    # Wallhaven não precisa, mas se tiver key usa

    # Baixa imagem
    # Para Unsplash, precisa adicionar w/h params para pegar tamanho adequado
    # Mas vamos baixar a URL como está; se for Unsplash raw, adiciona w=1920
    if provider == "unsplash" and "images.unsplash.com" in image_url and "w=" not in image_url:
        sep = "&" if "?" in image_url else "?"
        image_url = f"{image_url}{sep}w=1920&h=1080&fit=crop"

    image_bytes = _download_image(image_url)
    # Valida que é imagem
    if len(image_bytes) < 100:
        raise HTTPException(400, "imagem baixada muito pequena")
    # Converte para RAW em ambas resoluções
    wid = secrets.token_hex(4)
    _wallpapers_dir().mkdir(parents=True, exist_ok=True)
    # Salva original
    # Detecta extensão
    ext = ".jpg"
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        ext = ".png"
    elif image_bytes[:6] in (b"GIF87a", b"GIF89a"):
        ext = ".gif"
    _wallpaper_orig_path(wid).write_bytes(image_bytes)
    # Também salva com extensão para preview fallback
    try:
        ( _wallpapers_dir() / f"{wid}.orig{ext}").write_bytes(image_bytes)
    except Exception:
        pass

    # Converte para RAW 240x160 e 160x120
    try:
        raw_hw = _image_to_raw(image_bytes, 240, 160)
        raw_wokwi = _image_to_raw(image_bytes, 160, 120)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"falha ao converter: {e}")

    _wallpaper_raw_path(wid).write_bytes(raw_hw)
    _wallpaper_raw_path(wid, "_wokwi").write_bytes(raw_wokwi)

    # Gera preview JPEG 320px
    preview_bytes = None
    try:
        from PIL import Image  # type: ignore
        img = Image.open(io.BytesIO(image_bytes))
        img.thumbnail((400, 400), Image.LANCZOS)
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        preview_bytes = buf.getvalue()
        _wallpaper_preview_path(wid).write_bytes(preview_bytes)
    except Exception:
        # Fallback: usa thumb_url se disponível
        if thumb_url:
            try:
                thumb_bytes = _download_image(thumb_url)
                # Se for imagem, salva como preview
                if thumb_bytes[:2] == b"\xff\xd8" or thumb_bytes[:8] == b"\x89PNG\r\n\x1a\n":
                    # Converte para JPEG se for PNG
                    try:
                        from PIL import Image  # type: ignore
                        img = Image.open(io.BytesIO(thumb_bytes))
                        buf = io.BytesIO()
                        img.convert("RGB").save(buf, format="JPEG", quality=85)
                        _wallpaper_preview_path(wid).write_bytes(buf.getvalue())
                    except Exception:
                        _wallpaper_preview_path(wid).write_bytes(thumb_bytes)
            except Exception:
                pass

    # Atualiza meta
    meta = _load_meta()
    meta.setdefault("wallpapers", []).append({
        "id": wid,
        "source": "provider",
        "provider": provider,
        "external_id": external_id,
        "preview_url": thumb_url or image_url,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "original_url": image_url,
        "scope": effective_scope,
    })
    _save_meta(meta)

    # Importado passa a ser o papel ativo do tema/grid conforme scope.
    if effective_scope == "grid":
        _set_grid_selected_id(wid)
    else:
        _set_selected_id(wid)

    return {"ok": True, "id": wid, "provider": provider}

@router.get("/grid/selected", summary="Papel de parede do grid (alta qualidade)")
def get_grid_selected() -> dict[str, Any]:
    wid = _get_grid_selected_id()
    # valida se ainda existe (qualquer scope) para compat
    if wid and wid not in {w["id"] for w in _list_wallpapers()}:
        wid = None
        _set_grid_selected_id(None)
    return {"grid_selected_id": wid}


@router.put("/grid/selected", summary="Define papel de parede do grid")
async def put_grid_selected(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "JSON inválido")
    wid = body.get("id")
    if wid is not None and not isinstance(wid, str):
        raise HTTPException(400, "id deve ser string")
    if wid:
        existing_grid = {w["id"] for w in _list_wallpapers(scope="grid")}
        existing_all = {w["id"] for w in _list_wallpapers()}
        # permite id de grid ou, por compat, qualquer id existente (mas ideal grid)
        if wid not in existing_grid and wid not in existing_all:
            raise HTTPException(400, "wallpaper id inválido")
        _set_grid_selected_id(wid)
    else:
        _set_grid_selected_id(None)
    return {"ok": True, "grid_selected_id": _get_grid_selected_id()}


@router.get("/providers/status", summary="Status detalhado dos provedores (alias)")
def providers_status_alias() -> dict[str, Any]:
    return _provider_status()
