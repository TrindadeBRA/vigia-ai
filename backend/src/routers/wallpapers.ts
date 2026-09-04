import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, renameSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { dataDir } from "../config.js";
import { load, updateSync as update } from "../store.js";

const MAX_BG_BYTES = 400_000;
const MAX_PREVIEW_BYTES = 500_000;
const MAX_DOWNLOAD_BYTES = 10_000_000;

// ---------- paths ----------
function wallpapersDir(): string { return join(dataDir(), "wallpapers"); }
function wallpapersMetaPath(): string { return join(dataDir(), "wallpapers.json"); }
function wallpaperRawPath(wid: string, suffix = ""): string {
  if (suffix) return join(wallpapersDir(), `${wid}${suffix}.raw`);
  return join(wallpapersDir(), `${wid}.raw`);
}
function wallpaperPreviewPath(wid: string): string { return join(wallpapersDir(), `${wid}.jpg`); }
function wallpaperOrigPath(wid: string): string { return join(wallpapersDir(), `${wid}.orig`); }

function loadMeta(): Record<string, unknown> {
  const p = wallpapersMetaPath();
  if (!existsSync(p)) return { wallpapers: [] };
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
    if (Array.isArray(raw.wallpapers)) return raw;
  } catch {}
  return { wallpapers: [] };
}
function saveMeta(meta: Record<string, unknown>): void {
  mkdirSync(dataDir(), { recursive: true });
  const p = wallpapersMetaPath();
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  renameSync(tmp, p);
  try { chmodSync(p, 0o600); } catch {}
}
function listWallpapers(scope: string | null = null): Array<Record<string, unknown>> {
  const meta = loadMeta();
  const out: Array<Record<string, unknown>> = [];
  for (const w of (meta.wallpapers ?? []) as Array<Record<string, unknown>>) {
    if (!w || typeof w !== "object" || !w.id) continue;
    const wid = String(w.id);
    const wScope = String(w.scope ?? "theme").trim() || "theme";
    if (scope && wScope !== scope) continue;
    if (!existsSync(wallpaperRawPath(wid)) && !existsSync(wallpaperRawPath(wid, "_wokwi")) && !existsSync(wallpaperPreviewPath(wid))) {
      if (!existsSync(wallpaperOrigPath(wid))) continue;
    }
    out.push({
      id: wid,
      source: w.source ?? "upload",
      provider: w.provider ?? null,
      external_id: w.external_id ?? null,
      preview_url: w.preview_url ?? null,
      created_at: w.created_at ?? null,
      has_preview: existsSync(wallpaperPreviewPath(wid)),
      scope: wScope,
    });
  }
  return out;
}
function getSelectedId(): string | null {
  const ids = listWallpapers("theme").map((w) => String(w.id));
  if (ids.length === 0) {
    const idsAll = listWallpapers().map((w) => String(w.id));
    if (idsAll.length === 0) return null;
    const cfg = load() as Record<string, unknown>;
    const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
    const selected = String(wp.selected_id ?? "").trim();
    if (selected && idsAll.includes(selected)) return selected;
    return idsAll[0] ?? null;
  }
  const cfg = load() as Record<string, unknown>;
  const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
  const selected = String(wp.selected_id ?? "").trim();
  if (selected && ids.includes(selected)) return selected;
  return ids[0];
}
function setSelectedId(wid: string | null): void {
  update((cfg: Record<string, unknown>) => {
    const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
    if (!cfg.wallpapers) cfg.wallpapers = wp;
    wp.selected_id = String(wid ?? "");
  });
  patchThemeBackgroundType(wid ? "image" : "color");
}
function getGridSelectedId(): string | null {
  const cfg = load() as Record<string, unknown>;
  const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
  const gridId = String(wp.grid_selected_id ?? "").trim();
  if (gridId) {
    if (listWallpapers().some((w) => String(w.id) === gridId)) return gridId;
    return null;
  }
  return null;
}
function setGridSelectedId(wid: string | null): void {
  update((cfg: Record<string, unknown>) => {
    const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
    if (!cfg.wallpapers) cfg.wallpapers = wp;
    wp.grid_selected_id = String(wid ?? "");
  });
}
function getProviderKeys(): Record<string, string> {
  const cfg = load() as Record<string, unknown>;
  const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
  const prov = (wp.providers ?? {}) as Record<string, unknown>;
  return {
    pexels_key: String(prov.pexels_key ?? ""),
    unsplash_key: String(prov.unsplash_key ?? ""),
    wallhaven_key: String(prov.wallhaven_key ?? ""),
  };
}
function providerStatus(): Record<string, unknown> {
  const keys = getProviderKeys();
  return {
    pexels: { configured: Boolean(keys.pexels_key.trim()), needs_key: true },
    unsplash: { configured: Boolean(keys.unsplash_key.trim()), needs_key: true },
    wallhaven: { configured: true, has_key: Boolean(keys.wallhaven_key.trim()), needs_key: false },
  };
}
function patchThemeBackgroundType(kind: string): void {
  const p = join(dataDir(), "theme.json");
  if (!existsSync(p)) return;
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return;
    const bg = raw.background as Record<string, unknown> | undefined;
    if (!bg || typeof bg !== "object") raw.background = { type: kind, color: "#0f0f0f" };
    else { bg.type = kind; raw.background = bg; }
    const tmp = p + ".tmp";
    writeFileSync(tmp, JSON.stringify(raw) + "\n", "utf-8");
    renameSync(tmp, p);
  } catch {}
}

// ---------- SSRF guard ----------
async function isBlockedHost(hostname: string): Promise<boolean> {
  const host = (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost") return true;
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return true;
  }
  for (const info of addresses) {
    const rawIp = info.address.split("%")[0];
    const fam = isIP(rawIp);
    if (!fam) return true;
    if (isBlockedIp(rawIp)) return true;
  }
  return false;
}
function isBlockedIp(ip: string): boolean {
  // IPv4 checks
  if (isIP(ip) === 4) {
    const parts = ip.split(".").map((x) => parseInt(x, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    // private 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // loopback 127.0.0.0/8
    if (a === 127) return true;
    // link-local 169.254.0.0/16
    if (a === 169 && b === 254) return true;
    // unspecified 0.0.0.0/8
    if (a === 0) return true;
    // multicast 224.0.0.0/4
    if (a >= 224 && a <= 239) return true;
    // reserved 240.0.0.0/4
    if (a >= 240) return true;
    // broadcast 255.255.255.255
    if (ip === "255.255.255.255") return true;
    return false;
  }
  if (isIP(ip) === 6) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fe80:")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique local
    if (low.startsWith("ff")) return true; // multicast
    if (low === "::ffff:127.0.0.1") return true;
    // unspecified :: already handled
    return false;
  }
  return true;
}
async function validatePublicUrl(url: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw Object.assign(new Error("URL deve ser http:// ou https://"), { statusCode: 400 }); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw Object.assign(new Error("URL deve ser http:// ou https://"), { statusCode: 400 });
  if (!parsed.hostname || await isBlockedHost(parsed.hostname)) throw Object.assign(new Error("host da URL não permitido"), { statusCode: 400 });
}

// fetch with manual redirect revalidation per hop and 10MB limit via stream truncation
async function downloadImage(url: string, timeout = 15_000): Promise<Buffer> {
  await validatePublicUrl(url);
  let current = url;
  let redirects = 0;
  const maxRedirects = 5;
  while (true) {
    const resp = await fetch(current, {
      headers: { "User-Agent": "Mozilla/5.0 (VigiaAI/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) throw Object.assign(new Error(`falha ao baixar imagem: redirect sem location`), { statusCode: 502 });
      const next = new URL(loc, current).toString();
      await validatePublicUrl(next);
      current = next;
      redirects++;
      if (redirects > maxRedirects) throw Object.assign(new Error("muitos redirects"), { statusCode: 502 });
      continue;
    }
    if (!resp.ok) {
      throw Object.assign(new Error(`falha ao baixar imagem: HTTP ${resp.status}`), { statusCode: 502 });
    }
    // 10MB limit via stream truncation: check content-length then read
    const cl = resp.headers.get("content-length");
    if (cl && parseInt(cl, 10) > MAX_DOWNLOAD_BYTES) throw Object.assign(new Error("imagem muito grande"), { statusCode: 413 });
    // read with limit
    const reader = resp.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_DOWNLOAD_BYTES) throw Object.assign(new Error("imagem muito grande"), { statusCode: 413 });
          chunks.push(value);
        }
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      return buf;
    } else {
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.byteLength > MAX_DOWNLOAD_BYTES) throw Object.assign(new Error("imagem muito grande"), { statusCode: 413 });
      return buf;
    }
  }
}
async function httpJson(url: string, headers: Record<string, string> = {}, timeout = 15_000): Promise<unknown> {
  await validatePublicUrl(url);
  let current = url;
  let redirects = 0;
  while (true) {
    const resp = await fetch(current, {
      headers: { ...headers, "User-Agent": headers["User-Agent"] ?? "Mozilla/5.0 (VigiaAI/1.0)" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) throw new Error(`redirect sem location`);
      const next = new URL(loc, current).toString();
      await validatePublicUrl(next);
      current = next;
      redirects++;
      if (redirects > 5) throw new Error("muitos redirects");
      continue;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw Object.assign(new Error(`API erro ${resp.status}: ${body.slice(0, 500)}`), { statusCode: resp.status });
    }
    const raw = await resp.text();
    try { return JSON.parse(raw); } catch (e) { throw Object.assign(new Error(`API JSON inválido: ${e}`), { statusCode: 502 }); }
  }
}

// ---------- image conversion ----------
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

export async function createWallpapersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/wallpapers", async (request) => {
    const query = (request.query ?? {}) as Record<string, string>;
    let scope: string | null = query.scope ?? null;
    if (scope !== "theme" && scope !== "grid") scope = null;
    const wallpapers = listWallpapers(scope);
    const providers = providerStatus();
    return { wallpapers, selected_id: getSelectedId(), grid_selected_id: getGridSelectedId(), providers, count: wallpapers.length, scope };
  });

  app.get("/api/wallpapers/selected", async () => ({ selected_id: getSelectedId() }));

  app.put("/api/wallpapers/selected", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "JSON inválido" });
    const wid = body.id as unknown;
    if (wid !== null && wid !== undefined && typeof wid !== "string") return reply.code(400).send({ ok: false, error: "id deve ser string" });
    const idStr = wid ? String(wid) : null;
    if (idStr) {
      const existing = new Set(listWallpapers("theme").map((w) => String(w.id)));
      if (!existing.has(idStr) && !listWallpapers().some((w) => String(w.id) === idStr)) return reply.code(400).send({ ok: false, error: "wallpaper id inválido" });
      setSelectedId(idStr);
    } else setSelectedId(null);
    return { ok: true, selected_id: getSelectedId() };
  });

  app.get("/api/wallpapers/providers", async () => providerStatus());

  app.put("/api/wallpapers/providers", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "JSON inválido" });
    const pexelsKey = body.pexels_key as unknown;
    const unsplashKey = body.unsplash_key as unknown;
    const wallhavenKey = body.wallhaven_key as unknown;
    for (const [k, v] of [["pexels_key", pexelsKey], ["unsplash_key", unsplashKey], ["wallhaven_key", wallhavenKey]] as const) {
      if (v !== null && v !== undefined && typeof v !== "string") return reply.code(400).send({ ok: false, error: `${k} deve ser string` });
      if (typeof v === "string" && v.trim() === "********") {
        if (k === "pexels_key") (body as Record<string, unknown>).pexels_key = null;
        else if (k === "unsplash_key") (body as Record<string, unknown>).unsplash_key = null;
        else if (k === "wallhaven_key") (body as Record<string, unknown>).wallhaven_key = null;
      }
    }
    update((cfg: Record<string, unknown>) => {
      const wp = (cfg.wallpapers ?? {}) as Record<string, unknown>;
      if (!cfg.wallpapers) cfg.wallpapers = wp;
      const prov = (wp.providers ?? {}) as Record<string, unknown>;
      if (!wp.providers) wp.providers = prov;
      if (pexelsKey !== null && pexelsKey !== undefined && typeof pexelsKey === "string" && pexelsKey.trim() !== "********") prov.pexels_key = String(pexelsKey).trim();
      if (unsplashKey !== null && unsplashKey !== undefined && typeof unsplashKey === "string" && unsplashKey.trim() !== "********") prov.unsplash_key = String(unsplashKey).trim();
      if (wallhavenKey !== null && wallhavenKey !== undefined && typeof wallhavenKey === "string" && wallhavenKey.trim() !== "********") prov.wallhaven_key = String(wallhavenKey).trim();
    });
    return { ok: true, ...providerStatus() };
  });

  app.post("/api/wallpapers/upload", async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string>;
    let scopeParam: string | null = query.scope ?? null;
    if (scopeParam !== "theme" && scopeParam !== "grid") scopeParam = null;
    // try to get file from multipart - Fastify may have parsed as object with file field
    const contentType = String((request.headers["content-type"] ?? ""));
    let wid = randomBytes(4).toString("hex");
    const targetW = 240, targetH = 160;
    let rawBytes: Buffer | null = null;
    let previewBytes: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Campo "file", "bg" (compat tema) ou "image"; "scope" pode vir no form também.
      let fileBuf: Buffer | null = null;
      let formScope: string | null = null;
      const anyRequest = request as unknown as {
        parts: () => AsyncIterableIterator<
          | { type: "file"; fieldname: string; toBuffer: () => Promise<Buffer> }
          | { type: "field"; fieldname: string; value: unknown }
        >;
      };
      for await (const part of anyRequest.parts()) {
        if (part.type === "file") {
          if (!fileBuf && ["file", "bg", "image"].includes(part.fieldname)) {
            fileBuf = await part.toBuffer();
          } else {
            await part.toBuffer();
          }
        } else if (part.fieldname === "scope") {
          formScope = String(part.value ?? "").trim();
        }
      }
      if (!scopeParam && (formScope === "theme" || formScope === "grid")) scopeParam = formScope;
      if (!fileBuf || fileBuf.length === 0) return reply.code(400).send({ ok: false, error: "campo file/bg/image obrigatório" });
      try {
        rawBytes = await imageToRaw(fileBuf, targetW, targetH);
        previewBytes = await rawToPreview(rawBytes, targetW, targetH);
        mkdirSync(wallpapersDir(), { recursive: true });
        writeFileSync(wallpaperOrigPath(wid), fileBuf);
      } catch (e) {
        return reply.code(400).send({ ok: false, error: `imagem inválida: ${e}` });
      }
    } else {
      // raw bytes
      const bodyBuf = await getRawBody(request);
      if (!bodyBuf || bodyBuf.length === 0) return reply.code(400).send({ ok: false, error: "corpo vazio" });
      if (bodyBuf.length > MAX_BG_BYTES) return reply.code(413).send({ ok: false, error: "imagem grande demais" });
      // If bytes length matches RAW sizes, treat as RAW
      if (bodyBuf.length === 240 * 160 * 2 || bodyBuf.length === 160 * 120 * 2) {
        rawBytes = bodyBuf;
        previewBytes = await rawToPreview(rawBytes, rawBytes.length === 76800 ? 240 : 160, rawBytes.length === 76800 ? 160 : 120);
      } else {
        // Assume image
        try {
          rawBytes = await imageToRaw(bodyBuf, targetW, targetH);
          previewBytes = await rawToPreview(rawBytes, targetW, targetH);
          mkdirSync(wallpapersDir(), { recursive: true });
          writeFileSync(wallpaperOrigPath(wid), bodyBuf);
        } catch (e) {
          return reply.code(400).send({ ok: false, error: `imagem inválida: ${e}` });
        }
      }
    }
    if (!rawBytes) return reply.code(400).send({ ok: false, error: "falha ao processar wallpaper" });
    mkdirSync(wallpapersDir(), { recursive: true });
    writeFileSync(wallpaperRawPath(wid), rawBytes);
    // generate wokwi version
    try {
      if (rawBytes.length === 240 * 160 * 2) {
        // downscale to 160x120 via rawToPreview then imageToRaw or direct via Jimp resize
        const preview = await rawToPreview(rawBytes, 240, 160);
        // Use Jimp to resize preview to 160x120 then back to raw
        const mod = await import("jimp");
        const Jimp = (mod as Record<string, unknown>).default ?? mod as unknown as { read: (b: Buffer) => Promise<unknown> };
        const img = await (Jimp as unknown as { read: (b: Buffer) => Promise<{ resize: (w:number,h:number)=>void; getPixelColor:(x:number,y:number)=>number; bitmap:{width:number,height:number} }> }).read(preview);
        // Already covered by simple method: convert raw 240x160 to 160x120 via image steps earlier
        // For simplicity, generate via imageToRaw from preview buffer resized
        // We'll just use direct conversion via Jimp cover from preview
        const rawWokwi = await imageToRaw(preview, 160, 120);
        writeFileSync(wallpaperRawPath(wid, "_wokwi"), rawWokwi);
      } else if (rawBytes.length === 160 * 120 * 2) {
        writeFileSync(wallpaperRawPath(wid, "_wokwi"), rawBytes);
        // upscale to 240x160
        const preview = await rawToPreview(rawBytes, 160, 120);
        const rawHw = await imageToRaw(preview, 240, 160);
        writeFileSync(wallpaperRawPath(wid), rawHw);
      }
    } catch {}
    if (previewBytes && previewBytes.length) writeFileSync(wallpaperPreviewPath(wid), previewBytes);
    const effectiveScope = scopeParam && ["theme","grid"].includes(scopeParam) ? scopeParam : "theme";
    const meta = loadMeta();
    (meta.wallpapers as Array<Record<string, unknown>>).push({
      id: wid, source: "upload", provider: null, external_id: null, preview_url: null, created_at: new Date().toISOString(), scope: effectiveScope,
    });
    saveMeta(meta);
    if (effectiveScope === "grid") setGridSelectedId(wid); else setSelectedId(wid);
    return { ok: true, id: wid, scope: effectiveScope };
  });

  app.delete("/api/wallpapers/:wid", async (request, reply) => {
    const { wid } = request.params as { wid: string };
    if (!wid || wid.includes("/") || wid.includes("\\") || wid.includes("..")) return reply.code(400).send({ ok: false, error: "id inválido" });
    const meta = loadMeta();
    let found = false;
    const newList: Array<Record<string, unknown>> = [];
    for (const w of (meta.wallpapers ?? []) as Array<Record<string, unknown>>) {
      if (String(w.id) === wid) found = true; else newList.push(w);
    }
    if (!found && !existsSync(wallpaperRawPath(wid)) && !existsSync(wallpaperPreviewPath(wid))) return reply.code(404).send({ ok: false, error: "wallpaper não encontrado" });
    meta.wallpapers = newList;
    saveMeta(meta);
    for (const p of [wallpaperRawPath(wid), wallpaperRawPath(wid, "_wokwi"), wallpaperPreviewPath(wid), wallpaperOrigPath(wid)]) {
      try { unlinkSync(p); } catch {}
    }
    const remainingTheme = listWallpapers("theme").map((w) => String(w.id));
    const selected = String(((load() as Record<string, unknown>).wallpapers as Record<string, unknown> | undefined)?.selected_id ?? "");
    if (selected === wid || (selected && !listWallpapers().some((w) => String(w.id) === selected))) {
      if (remainingTheme.length) setSelectedId(remainingTheme[0]); else if (selected === wid) setSelectedId(null);
    }
    const gridSelected = String(((load() as Record<string, unknown>).wallpapers as Record<string, unknown> | undefined)?.grid_selected_id ?? "");
    if (gridSelected === wid) setGridSelectedId(null);
    return { ok: true };
  });

  app.get("/api/wallpapers/:wid/original", async (request, reply) => {
    const { wid } = request.params as { wid: string };
    if (!wid || wid.includes("/") || wid.includes("\\")) return reply.code(400).send({ ok: false, error: "id inválido" });
    const orig = wallpaperOrigPath(wid);
    if (existsSync(orig)) {
      const data = readFileSync(orig);
      if (data[0] === 0xff && data[1] === 0xd8) return reply.type("image/jpeg").send(data);
      if (data[0] === 0x89 && data[1] === 0x50) return reply.type("image/png").send(data);
      return reply.type("image/jpeg").send(data);
    }
    const preview = wallpaperPreviewPath(wid);
    if (existsSync(preview)) return reply.type("image/jpeg").send(readFileSync(preview));
    const rawP = wallpaperRawPath(wid);
    if (existsSync(rawP)) {
      const raw = readFileSync(rawP);
      if (raw.length === 240*160*2) { const jpg = await rawToPreview(raw,240,160); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
      if (raw.length === 160*120*2) { const jpg = await rawToPreview(raw,160,120); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
    }
    return reply.code(404).send({ ok: false, error: "original não encontrado" });
  });

  app.get("/api/wallpapers/:wid/preview", async (request, reply) => {
    const { wid } = request.params as { wid: string };
    if (!wid || wid.includes("/") || wid.includes("\\")) return reply.code(400).send({ ok: false, error: "id inválido" });
    const p = wallpaperPreviewPath(wid);
    if (existsSync(p)) return reply.type("image/jpeg").send(readFileSync(p));
    const rawP = wallpaperRawPath(wid);
    if (existsSync(rawP)) {
      const raw = readFileSync(rawP);
      if (raw.length === 240*160*2) { const jpg = await rawToPreview(raw,240,160); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
      if (raw.length === 160*120*2) { const jpg = await rawToPreview(raw,160,120); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
    }
    const orig = wallpaperOrigPath(wid);
    if (existsSync(orig)) {
      const data = readFileSync(orig);
      if (data[0]===0xff && data[1]===0xd8) return reply.type("image/jpeg").send(data);
      if (data[0]===0x89) return reply.type("image/png").send(data);
    }
    return reply.code(404).send({ ok: false, error: "preview não encontrado" });
  });

  app.get("/api/wallpapers/:wid/raw", async (request, reply) => {
    const { wid } = request.params as { wid: string };
    if (!wid || wid.includes("/") || wid.includes("\\")) return reply.code(400).send({ ok: false, error: "id inválido" });
    const query = (request.query ?? {}) as Record<string, string>;
    let target: string | null = null;
    if (query.w && query.h) {
      const wi = parseInt(query.w,10), hi=parseInt(query.h,10);
      if (wi===160 && hi===120) target="_wokwi"; else if (wi===240 && hi===160) target="";
    }
    if (target === null) {
      const screen = String((request.headers["x-vigia-screen"] ?? request.headers["X-Vigia-Screen"] ?? ""));
      if (screen && screen.includes("x")) {
        const [ws, , hs] = screen.split("x");
        const wi=parseInt(ws,10), hi=parseInt(hs,10);
        if (wi===320 && hi===240) target="_wokwi"; else if (wi===480 && hi===320) target="";
      }
    }
    if (target === "_wokwi") {
      const p = wallpaperRawPath(wid, "_wokwi");
      if (existsSync(p)) return reply.type("application/octet-stream").send(readFileSync(p));
    }
    const p = wallpaperRawPath(wid);
    if (existsSync(p)) return reply.type("application/octet-stream").send(readFileSync(p));
    const orig = wallpaperOrigPath(wid);
    if (existsSync(orig)) {
      const data = readFileSync(orig);
      const tw = target==="_wokwi"?160:240, th=target==="_wokwi"?120:160;
      try { const raw = await imageToRaw(data, tw, th); return reply.type("application/octet-stream").send(raw); } catch (e) { return reply.code(500).send({ ok:false, error: String(e) }); }
    }
    return reply.code(404).send({ ok: false, error: "wallpaper não encontrado" });
  });

  app.get("/api/wallpapers/search/:provider", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const prov = provider.toLowerCase().trim();
    if (!["pexels","wallhaven","unsplash"].includes(prov)) return reply.code(400).send({ ok:false, error:"provider deve ser pexels, wallhaven ou unsplash"});
    const query = (request.query ?? {}) as Record<string, string>;
    const q = query.q ?? query.query ?? "";
    const pageS = query.page ?? "1", perPageS = query.per_page ?? "15";
    let page = parseInt(pageS,10); if (Number.isNaN(page)||page<1) page=1;
    let perPage = parseInt(perPageS,10); if (Number.isNaN(perPage)||perPage<1) perPage=15; perPage=Math.min(30, perPage);
    if (!q.trim()) return reply.code(400).send({ ok:false, error:"query q obrigatória"});
    const keys = getProviderKeys();
    try {
      if (prov==="pexels") {
        const key = keys.pexels_key.trim();
        if (!key) return reply.code(400).send({ ok:false, error:"Pexels precisa de API key configurada"});
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}&orientation=landscape`;
        const data = await httpJson(url, { Authorization: key }) as Record<string, unknown>;
        const photos = (data.photos ?? []) as Array<Record<string, unknown>>;
        const results = photos.map((p) => {
          const src = (p.src ?? {}) as Record<string, unknown>;
          return { id: String(p.id), provider:"pexels", width:p.width, height:p.height, url:p.url, photographer:p.photographer, thumb: src.medium ?? src.small ?? src.tiny, full: src.large2x ?? src.large ?? src.original, preview: src.medium };
        });
        return { provider:"pexels", query:q, page, per_page:perPage, total: data.total_results, results };
      } else if (prov==="wallhaven") {
        const key = keys.wallhaven_key.trim();
        const params = { q, page:String(page), categories:"111", purity:"100", sorting:"relevance", order:"desc", atleast:"1920x1080" };
        const qs = new URLSearchParams(params).toString();
        const url = `https://wallhaven.cc/api/v1/search?${qs}`;
        const headers: Record<string,string> = {}; if (key) headers["X-API-Key"]=key;
        const data = await httpJson(url, headers) as Record<string, unknown>;
        const items = (data.data ?? []) as Array<Record<string, unknown>>;
        const results = items.map((it) => ({ id:String(it.id), provider:"wallhaven", width:it.dimension_x, height:it.dimension_y, url:it.url, thumb:(it.thumbs as Record<string,unknown> | undefined)?.small ?? (it.thumbs as Record<string,unknown> | undefined)?.large, full:it.path, preview:(it.thumbs as Record<string,unknown> | undefined)?.large, resolution:it.resolution }));
        const meta = (data.meta ?? {}) as Record<string, unknown>;
        return { provider:"wallhaven", query:q, page, per_page:24, total: meta.total, results };
      } else {
        const key = keys.unsplash_key.trim();
        if (!key) return reply.code(400).send({ ok:false, error:"Unsplash precisa de API key configurada"});
        const params = { query:q, page:String(page), per_page:String(perPage), orientation:"landscape" };
        const qs = new URLSearchParams(params).toString();
        const url = `https://api.unsplash.com/search/photos?${qs}`;
        const headers = { Authorization: `Client-ID ${key}`, "Accept-Version":"v1" };
        const data = await httpJson(url, headers) as Record<string, unknown>;
        const items = (data.results ?? []) as Array<Record<string, unknown>>;
        const results = items.map((it) => {
          const urls = (it.urls ?? {}) as Record<string,unknown>;
          const links = (it.links ?? {}) as Record<string,unknown>;
          const user = (it.user ?? {}) as Record<string,unknown>;
          return { id:String(it.id), provider:"unsplash", width:it.width, height:it.height, url: links.html ?? `https://unsplash.com/photos/${it.id}`, photographer:user.name, thumb: urls.small ?? urls.thumb, full: urls.regular ?? urls.full ?? urls.raw, preview: urls.small, color: it.color };
        });
        return { provider:"unsplash", query:q, page, per_page:perPage, total: data.total, results };
      }
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.code(err.statusCode ?? 502).send({ ok:false, error: err.message ?? String(e) });
    }
  });

  app.post("/api/wallpapers/import", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok:false, error:"JSON inválido"});
    const query = (request.query ?? {}) as Record<string, string>;
    let scopeParam: string | null = query.scope ?? null;
    if (scopeParam !== "theme" && scopeParam !== "grid") {
      scopeParam = String(body.scope ?? "").trim();
      if (scopeParam !== "theme" && scopeParam !== "grid") scopeParam = null;
    }
    const effectiveScope: string = scopeParam && ["theme","grid"].includes(scopeParam) ? scopeParam : "theme";
    const provider = String(body.provider ?? "").toLowerCase().trim();
    const externalId = String(body.id ?? body.external_id ?? "").trim();
    let imageUrl = String(body.image_url ?? body.full ?? body.url ?? "").trim();
    const thumbUrl = String(body.thumb ?? body.preview ?? "").trim();
    if (!["pexels","wallhaven","unsplash"].includes(provider)) return reply.code(400).send({ ok:false, error:"provider deve ser pexels, wallhaven ou unsplash"});
    if (!imageUrl) return reply.code(400).send({ ok:false, error:"image_url obrigatório"});
    const keys = getProviderKeys();
    if (provider==="pexels" && !keys.pexels_key.trim()) return reply.code(400).send({ ok:false, error:"Pexels precisa de API key"});
    if (provider==="unsplash" && !keys.unsplash_key.trim()) return reply.code(400).send({ ok:false, error:"Unsplash precisa de API key"});
    if (provider==="unsplash" && imageUrl.includes("images.unsplash.com") && !imageUrl.includes("w=")) {
      const sep = imageUrl.includes("?") ? "&" : "?";
      imageUrl = `${imageUrl}${sep}w=1920&h=1080&fit=crop`;
    }
    let imageBytes: Buffer;
    try { imageBytes = await downloadImage(imageUrl); } catch (e: unknown) { const err=e as {statusCode?:number; message?:string}; return reply.code(err.statusCode ?? 502).send({ ok:false, error: err.message ?? String(e)}); }
    if (imageBytes.length < 100) return reply.code(400).send({ ok:false, error:"imagem baixada muito pequena"});
    const wid = randomBytes(4).toString("hex");
    mkdirSync(wallpapersDir(), { recursive:true });
    writeFileSync(wallpaperOrigPath(wid), imageBytes);
    let rawHw: Buffer, rawWokwi: Buffer;
    try { rawHw = await imageToRaw(imageBytes,240,160); rawWokwi = await imageToRaw(imageBytes,160,120); } catch (e: unknown) { const err=e as {statusCode?:number}; return reply.code(err.statusCode ?? 400).send({ ok:false, error: String(e)}); }
    writeFileSync(wallpaperRawPath(wid), rawHw);
    writeFileSync(wallpaperRawPath(wid, "_wokwi"), rawWokwi);
    // preview
    try {
      const mod = await import("jimp");
      const Jimp = (mod as Record<string,unknown>).default ?? mod as unknown as { read:(b:Buffer)=>Promise<unknown>};
      const img = await (Jimp as unknown as { read:(b:Buffer)=>Promise<{ thumbnail:(w:number,h:number)=>void; getBufferAsync:(m:string)=>Promise<Buffer> }> }).read(imageBytes);
      // thumbnail via cover? Use resize
      // For preview just use rawToPreview or thumbnail
      const preview = await rawToPreview(rawHw,240,160);
      if (preview.length) writeFileSync(wallpaperPreviewPath(wid), preview);
    } catch {}
    const meta = loadMeta();
    (meta.wallpapers as Array<Record<string,unknown>>).push({ id:wid, source:"provider", provider, external_id: externalId, preview_url: thumbUrl || imageUrl, created_at: new Date().toISOString(), original_url: imageUrl, scope: effectiveScope });
    saveMeta(meta);
    if (effectiveScope==="grid") setGridSelectedId(wid); else setSelectedId(wid);
    return { ok:true, id:wid, provider };
  });

  app.get("/api/wallpapers/grid/selected", async () => {
    let wid = getGridSelectedId();
    if (wid && !listWallpapers().some((w)=>String(w.id)===wid)) { wid=null; setGridSelectedId(null); }
    return { grid_selected_id: wid };
  });

  app.put("/api/wallpapers/grid/selected", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok:false, error:"JSON inválido"});
    const wid = body.id as unknown;
    if (wid !== null && wid !== undefined && typeof wid !== "string") return reply.code(400).send({ ok:false, error:"id deve ser string"});
    const idStr = wid ? String(wid) : null;
    if (idStr) {
      const existingGrid = new Set(listWallpapers("grid").map((w)=>String(w.id)));
      const existingAll = new Set(listWallpapers().map((w)=>String(w.id)));
      if (!existingGrid.has(idStr) && !existingAll.has(idStr)) return reply.code(400).send({ ok:false, error:"wallpaper id inválido"});
      setGridSelectedId(idStr);
    } else setGridSelectedId(null);
    return { ok:true, grid_selected_id: getGridSelectedId() };
  });

  app.get("/api/wallpapers/providers/status", async () => providerStatus());
}

async function getRawBody(request: unknown): Promise<Buffer> {
  const anyReq = request as unknown as { body?: unknown; rawBody?: Buffer };
  if (Buffer.isBuffer(anyReq.body)) return anyReq.body as Buffer;
  if (typeof anyReq.body === "string") return Buffer.from(anyReq.body as string);
  if (anyReq.body !== null && typeof anyReq.body === "object") {
    // if body is JSON object, stringify
    try { return Buffer.from(JSON.stringify(anyReq.body)); } catch { return Buffer.alloc(0); }
  }
  return Buffer.alloc(0);
}
