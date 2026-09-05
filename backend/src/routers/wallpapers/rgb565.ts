// Conversão de imagem <-> RAW RGB565 (tela ESP32 240x160 / preview Wokwi 160x120).
// Usa Jimp (puro JS, sem módulo nativo — ver PLANO_NODE.md §2.3); a aritmética de
// empacotamento de bits é o que importa aqui, não a lib de imagem escolhida.
export async function imageToRaw(imageBytes: Buffer, targetW: number, targetH: number): Promise<Buffer> {
  let Jimp: unknown;
  try {
    const mod = await import("jimp");
    Jimp = (mod as Record<string, unknown>).default ?? mod;
  } catch {
    throw Object.assign(new Error("Jimp não instalado no coletor"), { statusCode: 500 });
  }
  const JimpClass = Jimp as unknown as { read: (b: Buffer) => Promise<unknown> };
  try {
    const img = await JimpClass.read(imageBytes);
    // cover crop: resize to cover target, then crop
    // Jimp has cover method
    const anyImg = img as unknown as { cover: (w: number, h: number) => unknown; bitmap: { width: number; height: number }; getPixelColor: (x: number, y: number) => number };
    if (typeof anyImg.cover === "function") {
      anyImg.cover(targetW, targetH);
    } else {
      // fallback manual
      const iw = anyImg.bitmap.width;
      const ih = anyImg.bitmap.height;
      const scale = Math.max(targetW / iw, targetH / ih);
      const nw = Math.round(iw * scale);
      const nh = Math.round(ih * scale);
      (img as unknown as { resize: (w: number, h: number) => void }).resize(nw, nh);
      const left = Math.floor((nw - targetW) / 2);
      const top = Math.floor((nh - targetH) / 2);
      (img as unknown as { crop: (x: number, y: number, w: number, h: number) => void }).crop(left, top, targetW, targetH);
    }
    const out = Buffer.alloc(targetW * targetH * 2);
    let idx = 0;
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const color = anyImg.getPixelColor(x, y);
        // Jimp color is 0xRRGGBBAA
        const r = (color >>> 24) & 0xff;
        const g = (color >>> 16) & 0xff;
        const b = (color >>> 8) & 0xff;
        const v = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
        out[idx] = v & 0xff;
        out[idx + 1] = (v >> 8) & 0xff;
        idx += 2;
      }
    }
    return out;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e;
    throw Object.assign(new Error(`falha ao converter imagem: ${e}`), { statusCode: 400 });
  }
}

export async function rawToPreview(rawBytes: Buffer, w: number, h: number): Promise<Buffer> {
  try {
    const mod = await import("jimp");
    const Jimp = (mod as Record<string, unknown>).default ?? mod as unknown as { create: (w: number, h: number) => Promise<unknown> };
    // Use Jimp constructor alternative: new Jimp(w,h)
    const JimpCtor = Jimp as unknown as new (w: number, h: number) => { bitmap: { data: Buffer }; setPixelColor: (c: number, x: number, y: number) => void; getBufferAsync: (mime: string) => Promise<Buffer> };
    let img: unknown;
    try {
      img = new JimpCtor(w, h);
    } catch {
      // alternative via Jimp.create
      const anyJimp = Jimp as unknown as { create: (w: number, h: number) => Promise<unknown> };
      if (typeof anyJimp.create === "function") img = await anyJimp.create(w, h);
      else return Buffer.alloc(0);
    }
    const anyImg = img as unknown as { setPixelColor: (c: number, x: number, y: number) => void; getBufferAsync: (mime: string) => Promise<Buffer> };
    let idx = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const lo = rawBytes[idx];
        const hi = rawBytes[idx + 1];
        const v = lo | (hi << 8);
        let r = (v >> 11) & 0x1f;
        let g = (v >> 5) & 0x3f;
        let b = v & 0x1f;
        r = (r << 3) | (r >> 2);
        g = (g << 2) | (g >> 4);
        b = (b << 3) | (b >> 2);
        // Jimp color: 0xRRGGBBAA, alpha 255
        const color = (r << 24) | (g << 16) | (b << 8) | 0xff;
        anyImg.setPixelColor(color >>> 0, x, y);
        idx += 2;
      }
    }
    const mime = "image/jpeg";
    const buf = await anyImg.getBufferAsync(mime as unknown as string);
    return Buffer.from(buf);
  } catch {
    return Buffer.alloc(0);
  }
}
