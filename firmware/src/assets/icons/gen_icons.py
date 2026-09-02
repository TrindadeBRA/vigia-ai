#!/usr/bin/env python3
"""Converte os PNGs de src/assets/icons em arrays RGB565 PROGMEM p/ TFT_eSPI.

Faz o blend do alpha contra COL_CARD (fundo dos cards) porque pushImage()
sem mascara nao suporta transparencia real -- e mais simples/leve que
carregar um decoder de PNG no ESP32.
"""
import struct
from pathlib import Path
from PIL import Image

ICON_SIZE = 20
COL_CARD = 0x1904  # src/ui.h

ASSETS_DIR = Path(__file__).resolve().parent

def rgb565_to_rgb888(c):
    r5 = (c >> 11) & 0x1F
    g6 = (c >> 5) & 0x3F
    b5 = c & 0x1F
    return (r5 * 255 // 31, g6 * 255 // 63, b5 * 255 // 31)

def rgb888_to_rgb565(r, g, b):
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)

def mipmap_downscale(img: Image.Image, target: int) -> Image.Image:
    # Reduz por metade (filtro de caixa) ate chegar perto do alvo, so entao
    # da o passo final com Lanczos -- evita o ruido de aliasing que uma unica
    # reducao 128->20 produz em detalhe fino (raios finos, sombreado).
    w, h = img.size
    while w // 2 >= target and h // 2 >= target:
        w, h = w // 2, h // 2
        img = img.resize((w, h), Image.BOX)
    return img.resize((target, target), Image.LANCZOS)

def convert(png_path: Path, out_name: str, macro_prefix: str):
    bg = rgb565_to_rgb888(COL_CARD)
    img = Image.open(png_path).convert("RGBA")
    img = mipmap_downscale(img, ICON_SIZE)
    pixels = []
    for y in range(ICON_SIZE):
        for x in range(ICON_SIZE):
            r, g, b, a = img.getpixel((x, y))
            a = a / 255.0
            rr = round(r * a + bg[0] * (1 - a))
            gg = round(g * a + bg[1] * (1 - a))
            bb = round(b * a + bg[2] * (1 - a))
            pixels.append(rgb888_to_rgb565(rr, gg, bb))

    out_path = ASSETS_DIR / out_name
    with open(out_path, "w") as f:
        f.write("#pragma once\n\n")
        f.write("#include <Arduino.h>\n\n")
        f.write(f"// Gerado a partir de {png_path.name} ({ICON_SIZE}x{ICON_SIZE}, RGB565, fundo pre-misturado com COL_CARD).\n")
        f.write("// Regerar com gen_icons.py (neste diretorio) se o PNG de origem mudar.\n")
        f.write(f"constexpr int {macro_prefix}_W = {ICON_SIZE};\n")
        f.write(f"constexpr int {macro_prefix}_H = {ICON_SIZE};\n")
        f.write(f"const uint16_t {macro_prefix}[{ICON_SIZE * ICON_SIZE}] PROGMEM = {{\n")
        for row in range(ICON_SIZE):
            row_vals = pixels[row * ICON_SIZE:(row + 1) * ICON_SIZE]
            f.write("  " + ", ".join(f"0x{v:04X}" for v in row_vals) + ",\n")
        f.write("};\n")
    print(f"wrote {out_path}")

convert(ASSETS_DIR / "claude.png", "icon_claude.h", "ICON_CLAUDE")
convert(ASSETS_DIR / "gpt.png", "icon_gpt.h", "ICON_GPT")
convert(ASSETS_DIR / "cursor.png", "icon_cursor.h", "ICON_CURSOR")
convert(ASSETS_DIR / "openrouter.png", "icon_openrouter.h", "ICON_OPENROUTER")
convert(ASSETS_DIR / "deepseek.png", "icon_deepseek.h", "ICON_DEEPSEEK")
convert(ASSETS_DIR / "opencode.png", "icon_opencode.h", "ICON_OPENCODE")
convert(ASSETS_DIR / "fal.png", "icon_fal.h", "ICON_FAL")
convert(ASSETS_DIR / "bitcoin.png", "icon_bitcoin.h", "ICON_BITCOIN")
