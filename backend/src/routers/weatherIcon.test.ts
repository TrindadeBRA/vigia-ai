import { describe, expect, it } from "vitest";
import { imageToRaw } from "./wallpapers/rgb565.js";
import { twemojiForWmo } from "./weather.js";

async function pngWithAlpha(): Promise<Buffer> {
  const mod = await import("jimp");
  const Jimp = ((mod as Record<string, unknown>).default ?? mod) as unknown as {
    new (w: number, h: number, bg: number): { getBufferAsync: (mime: string) => Promise<Buffer> } & {
      setPixelColor: (c: number, x: number, y: number) => void;
    };
  };
  // 2x1: esquerda transparente, direita vermelho opaco
  const img = new Jimp(2, 1, 0x00000000);
  img.setPixelColor(0xff0000ff >>> 0, 1, 0);
  return img.getBufferAsync("image/png");
}

describe("ícone do clima", () => {
  it("mapeia código WMO pro arquivo do Twemoji, com fallback", () => {
    expect(twemojiForWmo(0)).toBe("2600");
    expect(twemojiForWmo(3)).toBe("2601");
    expect(twemojiForWmo(95)).toBe("26c8");
    expect(twemojiForWmo(1234)).toBe("1f321");
    expect(twemojiForWmo(null)).toBe("1f321");
  });

  it("pixel transparente vira a cor-chave; opaco mantém a cor", async () => {
    const raw = await imageToRaw(await pngWithAlpha(), 2, 1, { transparentKey: 0x1904 });
    expect(raw.readUInt16LE(0)).toBe(0x1904);
    expect(raw.readUInt16LE(2)).toBe(0xf800);
  });
});
