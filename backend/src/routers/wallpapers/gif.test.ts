import { describe, expect, it } from "vitest";
import { packRgba565 } from "./rgb565.js";
import {
  ANIM_DELAY_MAX_MS,
  ANIM_DELAY_MIN_MS,
  clampAnimDelayMs,
  coverRgbaToRgb565,
  extractGifFrames,
  isGifSignature,
  MAX_ANIM_FRAMES,
  pickUniformIndices,
} from "./gif.js";

const GIF6 = Buffer.from(
  "R0lGODlhDAAIAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAHgAAACwAAAAADAAIAAAIEgABCBxIsKDBgwgTKlzIsGHBgAAh+QQBHgABACwAAAAADAAIAIEAAP8AAAAAAAAAAAAIEgABCBxIsKDBgwgTKlzIsGHBgAAh+QQBHgABACwAAAAADAAIAIEA/wAAAAAAAAAAAAAIEgABCBxIsKDBgwgTKlzIsGHBgAAh+QQBHgABACwAAAAADAAIAIH//wAAAAAAAAAAAAAIEgABCBxIsKDBgwgTKlzIsGHBgAAh+QQBHgABACwAAAAADAAIAIEA//8AAAAAAAAAAAAIEgABCBxIsKDBgwgTKlzIsGHBgAAh+QQBHgABACwAAAAADAAIAIH/AP8AAAAAAAAAAAAIEgABCBxIsKDBgwgTKlzIsGHBgAA7",
  "base64",
);

const GIF16 = Buffer.from(
  "R0lGODlhBAAEAIEAAAAA/wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIEQAO8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIEgAN8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIEwAM8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIFAAL8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIFQAK8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIFgAJ8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIFwAI8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIGAAH8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIGQAG8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIGgAF8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIGwAE8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIHAAD8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIHQAC8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIHgAB8AAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAEAIHwAA8AAAAAAAAAAAAICQABCBxIsCCAgAA7",
  "base64",
);

describe("packRgba565", () => {
  it("empacota vermelho e verde no layout little-endian do firmware", () => {
    expect(packRgba565(255, 0, 0)).toBe(0xf800);
    expect(packRgba565(0, 255, 0)).toBe(0x07e0);
    expect(packRgba565(0, 0, 255)).toBe(0x001f);
  });
});

describe("pickUniformIndices", () => {
  it("devolve todos os índices quando cabe no teto", () => {
    expect(pickUniformIndices(5, 12)).toEqual([0, 1, 2, 3, 4]);
  });

  it("amostra igualmente espaçado, não só os primeiros N", () => {
    expect(pickUniformIndices(16, 12)).toEqual([0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]);
    expect(pickUniformIndices(16, 12)[0]).toBe(0);
    expect(pickUniformIndices(16, 12).at(-1)).toBeGreaterThan(4);
  });
});

describe("clampAnimDelayMs", () => {
  it("clampa em 40–80 ms", () => {
    expect(clampAnimDelayMs(20)).toBe(ANIM_DELAY_MIN_MS);
    expect(clampAnimDelayMs(900)).toBe(ANIM_DELAY_MAX_MS);
    expect(clampAnimDelayMs(60)).toBe(60);
  });
});

describe("coverRgbaToRgb565", () => {
  it("produz o tamanho RGB565 esperado", () => {
    const src = Buffer.alloc(8 * 8 * 4, 255);
    const raw = coverRgbaToRgb565(src, 8, 8, 120, 80);
    expect(raw.length).toBe(120 * 80 * 2);
    expect(raw[0]).toBe(0xff);
    expect(raw[1]).toBe(0xff);
  });
});

describe("extractGifFrames", () => {
  it("reconhece assinatura GIF", () => {
    expect(isGifSignature(GIF6)).toBe(true);
    expect(isGifSignature(Buffer.from([0xff, 0xd8]))).toBe(false);
  });

  it("extrai todos os frames quando abaixo do teto e clampa o delay", async () => {
    const out = await extractGifFrames(GIF6, MAX_ANIM_FRAMES, 12, 8);
    expect(out).not.toBeNull();
    expect(out!.frames.length).toBe(6);
    expect(out!.frames[0]!.length).toBe(12 * 8 * 2);
    expect(out!.delayMs).toBe(ANIM_DELAY_MAX_MS);
  });

  it("amostra 12 frames de um GIF com 16 e clampa delay curto", async () => {
    const out = await extractGifFrames(GIF16, MAX_ANIM_FRAMES, 4, 4);
    expect(out).not.toBeNull();
    expect(out!.frames.length).toBe(12);
    expect(out!.delayMs).toBe(ANIM_DELAY_MAX_MS);
  });
});
