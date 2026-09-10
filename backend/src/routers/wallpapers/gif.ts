import { createRequire } from "node:module";
import { packRgba565 } from "./rgb565.js";

const require = createRequire(import.meta.url);
const { parseGIF, decompressFrames } = require("gifuct-js") as typeof import("gifuct-js");

export const MAX_ANIM_FRAMES = 12;
export const ANIM_DELAY_MIN_MS = 40;
export const ANIM_DELAY_MAX_MS = 80;
export const ANIM_HW = { w: 120, h: 80 } as const;
export const ANIM_WOKWI = { w: 80, h: 60 } as const;

export function isGifSignature(bytes: Buffer): boolean {
  return bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
}

/** Índices igualmente espaçados ao longo da linha do tempo (não só os primeiros N). */
export function pickUniformIndices(count: number, maxKeep: number): number[] {
  if (count <= 0) return [];
  const keep = Math.min(count, Math.max(1, maxKeep));
  if (keep >= count) return Array.from({ length: count }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < keep; i++) {
    out.push(Math.floor((i * count) / keep));
  }
  return out;
}

export function clampAnimDelayMs(ms: number): number {
  if (!Number.isFinite(ms)) return ANIM_DELAY_MIN_MS;
  return Math.min(ANIM_DELAY_MAX_MS, Math.max(ANIM_DELAY_MIN_MS, Math.round(ms)));
}

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function blitPatch(
  canvas: Uint8Array,
  canvasW: number,
  canvasH: number,
  patch: Uint8ClampedArray,
  left: number,
  top: number,
  pw: number,
  ph: number,
): void {
  for (let y = 0; y < ph; y++) {
    const cy = top + y;
    if (cy < 0 || cy >= canvasH) continue;
    for (let x = 0; x < pw; x++) {
      const cx = left + x;
      if (cx < 0 || cx >= canvasW) continue;
      const si = (y * pw + x) * 4;
      const a = patch[si + 3] ?? 0;
      if (a === 0) continue;
      const di = (cy * canvasW + cx) * 4;
      canvas[di] = patch[si] ?? 0;
      canvas[di + 1] = patch[si + 1] ?? 0;
      canvas[di + 2] = patch[si + 2] ?? 0;
      canvas[di + 3] = 255;
    }
  }
}

function fillRectRgba(canvas: Uint8Array, canvasW: number, canvasH: number, left: number, top: number, pw: number, ph: number, rgba: [number, number, number, number]): void {
  for (let y = 0; y < ph; y++) {
    const cy = top + y;
    if (cy < 0 || cy >= canvasH) continue;
    for (let x = 0; x < pw; x++) {
      const cx = left + x;
      if (cx < 0 || cx >= canvasW) continue;
      const di = (cy * canvasW + cx) * 4;
      canvas[di] = rgba[0];
      canvas[di + 1] = rgba[1];
      canvas[di + 2] = rgba[2];
      canvas[di + 3] = rgba[3];
    }
  }
}

/** Cover-crop nearest-neighbor de RGBA8 para RGB565 LE. */
export function coverRgbaToRgb565(src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number): Buffer {
  const out = Buffer.alloc(dstW * dstH * 2);
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return out;
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const cropW = dstW / scale;
  const cropH = dstH / scale;
  const srcX0 = (srcW - cropW) / 2;
  const srcY0 = (srcH - cropH) / 2;
  let idx = 0;
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.max(0, Math.floor(srcY0 + ((y + 0.5) * cropH) / dstH)));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.max(0, Math.floor(srcX0 + ((x + 0.5) * cropW) / dstW)));
      const si = (sy * srcW + sx) * 4;
      const v = packRgba565(src[si] ?? 0, src[si + 1] ?? 0, src[si + 2] ?? 0);
      out[idx] = v & 0xff;
      out[idx + 1] = (v >> 8) & 0xff;
      idx += 2;
    }
  }
  return out;
}

export async function extractGifFrames(
  bytes: Buffer,
  maxFrames: number,
  targetW: number,
  targetH: number,
): Promise<{ frames: Buffer[]; delayMs: number } | null> {
  if (!isGifSignature(bytes)) return null;
  let parsed: import("gifuct-js").ParsedGif;
  let rawFrames: import("gifuct-js").ParsedFrame[];
  try {
    parsed = parseGIF(toArrayBuffer(bytes));
    rawFrames = decompressFrames(parsed, true);
  } catch {
    return null;
  }
  if (!rawFrames.length) return null;

  const canvasW = parsed.lsd.width;
  const canvasH = parsed.lsd.height;
  if (canvasW <= 0 || canvasH <= 0) return null;

  const bgIndex = parsed.lsd.backgroundColorIndex ?? 0;
  const bgRgb = parsed.gct?.[bgIndex] ?? [0, 0, 0];
  const bgRgba: [number, number, number, number] = [bgRgb[0] ?? 0, bgRgb[1] ?? 0, bgRgb[2] ?? 0, 255];

  const canvas = new Uint8Array(canvasW * canvasH * 4);
  fillRectRgba(canvas, canvasW, canvasH, 0, 0, canvasW, canvasH, bgRgba);

  const composed: { rgba: Uint8Array; delay: number }[] = [];
  let previous: Uint8Array | null = null;

  for (const frame of rawFrames) {
    const disposal = frame.disposalType ?? 0;
    if (disposal === 3) previous = Uint8Array.from(canvas);

    const { left, top, width: pw, height: ph } = frame.dims;
    blitPatch(canvas, canvasW, canvasH, frame.patch, left, top, pw, ph);
    composed.push({ rgba: Uint8Array.from(canvas), delay: frame.delay || 100 });

    if (disposal === 2) {
      fillRectRgba(canvas, canvasW, canvasH, left, top, pw, ph, bgRgba);
    } else if (disposal === 3 && previous) {
      canvas.set(previous);
    }
  }

  if (composed.length < 2) return null;

  const totalMs = composed.reduce((s, f) => s + (f.delay || 0), 0);
  const indices = pickUniformIndices(composed.length, maxFrames);
  const frames = indices.map((i) => coverRgbaToRgb565(composed[i]!.rgba, canvasW, canvasH, targetW, targetH));
  const delayMs = clampAnimDelayMs(totalMs / frames.length);
  return { frames, delayMs };
}
