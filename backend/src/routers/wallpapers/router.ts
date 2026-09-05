import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../../config.js";
import { load, updateSync as update } from "../../store.js";
import { imageToRaw, rawToPreview } from "./rgb565.js";
import { downloadImage, httpJson } from "./ssrfGuard.js";

export { imageToRaw, rawToPreview } from "./rgb565.js";
export { downloadImage, httpJson, isBlockedHost, isBlockedIp, validatePublicUrl } from "./ssrfGuard.js";

const MAX_BG_BYTES = 400_000;

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
  } catch { }
  return { wallpapers: [] };
}
function saveMeta(meta: Record<string, unknown>): void {
  mkdirSync(dataDir(), { recursive: true });
  const p = wallpapersMetaPath();
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  renameSync(tmp, p);
  try { chmodSync(p, 0o600); } catch { }
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
    giphy_key: String(prov.giphy_key ?? ""),
  };
}
function providerStatus(): Record<string, unknown> {
  const keys = getProviderKeys();
  return {
    pexels: { configured: Boolean(keys.pexels_key.trim()), needs_key: true },
    unsplash: { configured: Boolean(keys.unsplash_key.trim()), needs_key: true },
    wallhaven: { configured: true, has_key: Boolean(keys.wallhaven_key.trim()), needs_key: false },
    giphy: { configured: Boolean(keys.giphy_key.trim()), needs_key: true },
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
  } catch { }
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
    const giphyKey = body.giphy_key as unknown;
    for (const [k, v] of [["pexels_key", pexelsKey], ["unsplash_key", unsplashKey], ["wallhaven_key", wallhavenKey], ["giphy_key", giphyKey]] as const) {
      if (v !== null && v !== undefined && typeof v !== "string") return reply.code(400).send({ ok: false, error: `${k} deve ser string` });
      if (typeof v === "string" && v.trim() === "********") {
        if (k === "pexels_key") (body as Record<string, unknown>).pexels_key = null;
        else if (k === "unsplash_key") (body as Record<string, unknown>).unsplash_key = null;
        else if (k === "wallhaven_key") (body as Record<string, unknown>).wallhaven_key = null;
        else if (k === "giphy_key") (body as Record<string, unknown>).giphy_key = null;
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
      if (giphyKey !== null && giphyKey !== undefined && typeof giphyKey === "string" && giphyKey.trim() !== "********") prov.giphy_key = String(giphyKey).trim();
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
        const rawWokwi = await imageToRaw(preview, 160, 120);
        writeFileSync(wallpaperRawPath(wid, "_wokwi"), rawWokwi);
      } else if (rawBytes.length === 160 * 120 * 2) {
        writeFileSync(wallpaperRawPath(wid, "_wokwi"), rawBytes);
        // upscale to 240x160
        const preview = await rawToPreview(rawBytes, 160, 120);
        const rawHw = await imageToRaw(preview, 240, 160);
        writeFileSync(wallpaperRawPath(wid), rawHw);
      }
    } catch { }
    if (previewBytes && previewBytes.length) writeFileSync(wallpaperPreviewPath(wid), previewBytes);
    const effectiveScope = scopeParam && ["theme", "grid"].includes(scopeParam) ? scopeParam : "theme";
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
      try { unlinkSync(p); } catch { }
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
      if (raw.length === 240 * 160 * 2) { const jpg = await rawToPreview(raw, 240, 160); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
      if (raw.length === 160 * 120 * 2) { const jpg = await rawToPreview(raw, 160, 120); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
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
      if (raw.length === 240 * 160 * 2) { const jpg = await rawToPreview(raw, 240, 160); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
      if (raw.length === 160 * 120 * 2) { const jpg = await rawToPreview(raw, 160, 120); if (jpg.length) return reply.type("image/jpeg").send(jpg); }
    }
    const orig = wallpaperOrigPath(wid);
    if (existsSync(orig)) {
      const data = readFileSync(orig);
      if (data[0] === 0xff && data[1] === 0xd8) return reply.type("image/jpeg").send(data);
      if (data[0] === 0x89) return reply.type("image/png").send(data);
    }
    return reply.code(404).send({ ok: false, error: "preview não encontrado" });
  });

  app.get("/api/wallpapers/:wid/raw", async (request, reply) => {
    const { wid } = request.params as { wid: string };
    if (!wid || wid.includes("/") || wid.includes("\\")) return reply.code(400).send({ ok: false, error: "id inválido" });
    const query = (request.query ?? {}) as Record<string, string>;
    let target: string | null = null;
    if (query.w && query.h) {
      const wi = parseInt(query.w, 10), hi = parseInt(query.h, 10);
      if (wi === 160 && hi === 120) target = "_wokwi"; else if (wi === 240 && hi === 160) target = "";
    }
    if (target === null) {
      const screen = String((request.headers["x-vigia-screen"] ?? request.headers["X-Vigia-Screen"] ?? ""));
      if (screen && screen.includes("x")) {
        const [ws, , hs] = screen.split("x");
        const wi = parseInt(ws, 10), hi = parseInt(hs, 10);
        if (wi === 320 && hi === 240) target = "_wokwi"; else if (wi === 480 && hi === 320) target = "";
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
      const tw = target === "_wokwi" ? 160 : 240, th = target === "_wokwi" ? 120 : 160;
      try { const raw = await imageToRaw(data, tw, th); return reply.type("application/octet-stream").send(raw); } catch (e) { return reply.code(500).send({ ok: false, error: String(e) }); }
    }
    return reply.code(404).send({ ok: false, error: "wallpaper não encontrado" });
  });

  app.get("/api/wallpapers/search/:provider", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const prov = provider.toLowerCase().trim();
    if (!["pexels", "wallhaven", "unsplash", "giphy"].includes(prov)) return reply.code(400).send({ ok: false, error: "provider deve ser pexels, wallhaven, unsplash ou giphy" });
    const query = (request.query ?? {}) as Record<string, string>;
    const q = query.q ?? query.query ?? "";
    const pageS = query.page ?? "1", perPageS = query.per_page ?? "15";
    let page = parseInt(pageS, 10); if (Number.isNaN(page) || page < 1) page = 1;
    let perPage = parseInt(perPageS, 10); if (Number.isNaN(perPage) || perPage < 1) perPage = 15; perPage = Math.min(30, perPage);
    if (!q.trim() && prov !== "wallhaven") return reply.code(400).send({ ok: false, error: "query q obrigatória" });
    const keys = getProviderKeys();
    try {
      if (prov === "pexels") {
        const key = keys.pexels_key.trim();
        if (!key) return reply.code(400).send({ ok: false, error: "Pexels precisa de API key configurada" });
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}&orientation=landscape`;
        const data = await httpJson(url, { Authorization: key }) as Record<string, unknown>;
        const photos = (data.photos ?? []) as Array<Record<string, unknown>>;
        const results = photos.map((p) => {
          const src = (p.src ?? {}) as Record<string, unknown>;
          return { id: String(p.id), provider: "pexels", width: p.width, height: p.height, url: p.url, photographer: p.photographer, thumb: src.medium ?? src.small ?? src.tiny, full: src.large2x ?? src.large ?? src.original, preview: src.medium };
        });
        return { provider: "pexels", query: q, page, per_page: perPage, total: data.total_results, results };
      } else if (prov === "wallhaven") {
        const key = keys.wallhaven_key.trim();
        // --- Wallhaven advanced filters (https://wallhaven.cc/help/api) ---
        const ALLOWED_SORTING = new Set(["date_added", "relevance", "random", "views", "favorites", "toplist"]);
        const ALLOWED_ORDER = new Set(["desc", "asc"]);
        const ALLOWED_TOPRANGE = new Set(["1d", "3d", "1w", "1M", "3M", "6M", "1y"]);
        const rawCategories = String(query.categories ?? "111").trim();
        const rawPurity = String(query.purity ?? "100").trim();
        const rawSorting = String(query.sorting ?? "relevance").trim();
        const rawOrder = String(query.order ?? "desc").trim();
        const rawTopRange = String(query.topRange ?? query.top_range ?? "1M").trim();
        const rawAtleast = String(query.atleast ?? "").trim();
        const rawResolutions = String(query.resolutions ?? "").trim();
        const rawRatios = String(query.ratios ?? "").trim();
        const rawColors = String(query.colors ?? query.color ?? "").trim();
        const rawSeed = String(query.seed ?? "").trim();

        const categories = /^[01]{3}$/.test(rawCategories) ? rawCategories : "111";
        const purity = /^[01]{3}$/.test(rawPurity) ? rawPurity : "100";
        const sorting = ALLOWED_SORTING.has(rawSorting) ? rawSorting : "relevance";
        const order = ALLOWED_ORDER.has(rawOrder) ? rawOrder : "desc";
        const topRange = ALLOWED_TOPRANGE.has(rawTopRange) ? rawTopRange : "1M";
        const atleast = /^\d+x\d+$/.test(rawAtleast) ? rawAtleast : "";
        const resolutions = rawResolutions
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^\d+x\d+$/.test(s))
          .join(",");
        const ratios = rawRatios
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^\d+x\d+$/.test(s))
          .join(",");
        const colors = /^[0-9a-fA-F]{6}$/.test(rawColors) ? rawColors.toLowerCase() : "";
        const seed = /^[a-zA-Z0-9]{6}$/.test(rawSeed) ? rawSeed : "";

        const params: Record<string, string> = { page: String(page), categories, purity, sorting, order };
        if (q.trim()) params.q = q.trim();
        if (sorting === "toplist") params.topRange = topRange;
        if (atleast) params.atleast = atleast;
        if (resolutions) params.resolutions = resolutions;
        if (ratios) params.ratios = ratios;
        if (colors) params.colors = colors;
        if (sorting === "random" && seed) params.seed = seed;
        // default atleast if nothing else narrows resolution — keep previous default only when no explicit resolution filter
        if (!atleast && !resolutions && !params.atleast) {
          // keep empty to allow any resolution; frontend will send atleast when user wants it
        }
        const qs = new URLSearchParams(params).toString();
        const url = `https://wallhaven.cc/api/v1/search?${qs}`;
        const headers: Record<string, string> = {}; if (key) headers["X-API-Key"] = key;
        const data = await httpJson(url, headers) as Record<string, unknown>;
        const items = (data.data ?? []) as Array<Record<string, unknown>>;
        let results = items.map((it) => ({ id: String(it.id), provider: "wallhaven", width: it.dimension_x, height: it.dimension_y, url: it.url, thumb: (it.thumbs as Record<string, unknown> | undefined)?.small ?? (it.thumbs as Record<string, unknown> | undefined)?.large, full: it.path, preview: (it.thumbs as Record<string, unknown> | undefined)?.large, resolution: it.resolution }));
        // Wallhaven sempre retorna 24 por página; respeita per_page solicitado fatiando
        if (perPage < results.length) results = results.slice(0, perPage);
        const meta = (data.meta ?? {}) as Record<string, unknown>;
        return { provider: "wallhaven", query: q, page, per_page: perPage, total: meta.total, results, filters: { categories, purity, sorting, order, topRange: sorting === "toplist" ? topRange : undefined, atleast: atleast || undefined, resolutions: resolutions || undefined, ratios: ratios || undefined, colors: colors || undefined, seed: seed || undefined } };
      } else if (prov === "giphy") {
        const key = keys.giphy_key.trim();
        if (!key) return reply.code(400).send({ ok: false, error: "Giphy precisa de API key configurada" });
        const offset = (page - 1) * perPage;
        const params = { api_key: key, q, limit: String(perPage), offset: String(offset), rating: "pg", lang: "pt" };
        const qs = new URLSearchParams(params).toString();
        const url = `https://api.giphy.com/v1/gifs/search?${qs}`;
        const data = await httpJson(url, {}) as Record<string, unknown>;
        const items = (data.data ?? []) as Array<Record<string, unknown>>;
        const pagination = (data.pagination ?? {}) as Record<string, unknown>;
        const results = items.map((it) => {
          const images = (it.images ?? {}) as Record<string, unknown>;
          const orig = (images.original ?? {}) as Record<string, unknown>;
          const fixed = (images.fixed_width ?? {}) as Record<string, unknown>;
          const downsized = (images.downsized ?? {}) as Record<string, unknown>;
          return { id: String(it.id), provider: "giphy", width: orig.width ?? fixed.width, height: orig.height ?? fixed.height, url: it.url, title: it.title, thumb: fixed.url ?? downsized.url ?? orig.url, full: orig.url ?? fixed.url, preview: fixed.url ?? downsized.url, type: "gif" };
        });
        return { provider: "giphy", query: q, page, per_page: perPage, total: pagination.total_count ?? results.length, results };
      } else {
        const key = keys.unsplash_key.trim();
        if (!key) return reply.code(400).send({ ok: false, error: "Unsplash precisa de API key configurada" });
        const params = { query: q, page: String(page), per_page: String(perPage), orientation: "landscape" };
        const qs = new URLSearchParams(params).toString();
        const url = `https://api.unsplash.com/search/photos?${qs}`;
        const headers = { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" };
        const data = await httpJson(url, headers) as Record<string, unknown>;
        const items = (data.results ?? []) as Array<Record<string, unknown>>;
        const results = items.map((it) => {
          const urls = (it.urls ?? {}) as Record<string, unknown>;
          const links = (it.links ?? {}) as Record<string, unknown>;
          const user = (it.user ?? {}) as Record<string, unknown>;
          return { id: String(it.id), provider: "unsplash", width: it.width, height: it.height, url: links.html ?? `https://unsplash.com/photos/${it.id}`, photographer: user.name, thumb: urls.small ?? urls.thumb, full: urls.regular ?? urls.full ?? urls.raw, preview: urls.small, color: it.color };
        });
        return { provider: "unsplash", query: q, page, per_page: perPage, total: data.total, results };
      }
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.code(err.statusCode ?? 502).send({ ok: false, error: err.message ?? String(e) });
    }
  });

  app.post("/api/wallpapers/import", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "JSON inválido" });
    const query = (request.query ?? {}) as Record<string, string>;
    let scopeParam: string | null = query.scope ?? null;
    if (scopeParam !== "theme" && scopeParam !== "grid") {
      scopeParam = String(body.scope ?? "").trim();
      if (scopeParam !== "theme" && scopeParam !== "grid") scopeParam = null;
    }
    const effectiveScope: string = scopeParam && ["theme", "grid"].includes(scopeParam) ? scopeParam : "theme";
    const provider = String(body.provider ?? "").toLowerCase().trim();
    const externalId = String(body.id ?? body.external_id ?? "").trim();
    let imageUrl = String(body.image_url ?? body.full ?? body.url ?? "").trim();
    const thumbUrl = String(body.thumb ?? body.preview ?? "").trim();
    if (!["pexels", "wallhaven", "unsplash", "giphy"].includes(provider)) return reply.code(400).send({ ok: false, error: "provider deve ser pexels, wallhaven, unsplash ou giphy" });
    if (!imageUrl) return reply.code(400).send({ ok: false, error: "image_url obrigatório" });
    const keys = getProviderKeys();
    if (provider === "pexels" && !keys.pexels_key.trim()) return reply.code(400).send({ ok: false, error: "Pexels precisa de API key" });
    if (provider === "unsplash" && !keys.unsplash_key.trim()) return reply.code(400).send({ ok: false, error: "Unsplash precisa de API key" });
    if (provider === "giphy" && !keys.giphy_key.trim()) return reply.code(400).send({ ok: false, error: "Giphy precisa de API key" });
    if (provider === "unsplash" && imageUrl.includes("images.unsplash.com") && !imageUrl.includes("w=")) {
      const sep = imageUrl.includes("?") ? "&" : "?";
      imageUrl = `${imageUrl}${sep}w=1920&h=1080&fit=crop`;
    }
    let imageBytes: Buffer;
    try { imageBytes = await downloadImage(imageUrl); } catch (e: unknown) { const err = e as { statusCode?: number; message?: string }; return reply.code(err.statusCode ?? 502).send({ ok: false, error: err.message ?? String(e) }); }
    if (imageBytes.length < 100) return reply.code(400).send({ ok: false, error: "imagem baixada muito pequena" });
    const wid = randomBytes(4).toString("hex");
    mkdirSync(wallpapersDir(), { recursive: true });
    writeFileSync(wallpaperOrigPath(wid), imageBytes);
    let rawHw: Buffer, rawWokwi: Buffer;
    try { rawHw = await imageToRaw(imageBytes, 240, 160); rawWokwi = await imageToRaw(imageBytes, 160, 120); } catch (e: unknown) { const err = e as { statusCode?: number }; return reply.code(err.statusCode ?? 400).send({ ok: false, error: String(e) }); }
    writeFileSync(wallpaperRawPath(wid), rawHw);
    writeFileSync(wallpaperRawPath(wid, "_wokwi"), rawWokwi);
    // preview
    try {
      const preview = await rawToPreview(rawHw, 240, 160);
      if (preview.length) writeFileSync(wallpaperPreviewPath(wid), preview);
    } catch { }
    const meta = loadMeta();
    (meta.wallpapers as Array<Record<string, unknown>>).push({ id: wid, source: "provider", provider, external_id: externalId, preview_url: thumbUrl || imageUrl, created_at: new Date().toISOString(), original_url: imageUrl, scope: effectiveScope });
    saveMeta(meta);
    if (effectiveScope === "grid") setGridSelectedId(wid); else setSelectedId(wid);
    return { ok: true, id: wid, provider };
  });

  app.get("/api/wallpapers/grid/selected", async () => {
    let wid = getGridSelectedId();
    if (wid && !listWallpapers().some((w) => String(w.id) === wid)) { wid = null; setGridSelectedId(null); }
    return { grid_selected_id: wid };
  });

  app.put("/api/wallpapers/grid/selected", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) return reply.code(400).send({ ok: false, error: "JSON inválido" });
    const wid = body.id as unknown;
    if (wid !== null && wid !== undefined && typeof wid !== "string") return reply.code(400).send({ ok: false, error: "id deve ser string" });
    const idStr = wid ? String(wid) : null;
    if (idStr) {
      const existingGrid = new Set(listWallpapers("grid").map((w) => String(w.id)));
      const existingAll = new Set(listWallpapers().map((w) => String(w.id)));
      if (!existingGrid.has(idStr) && !existingAll.has(idStr)) return reply.code(400).send({ ok: false, error: "wallpaper id inválido" });
      setGridSelectedId(idStr);
    } else setGridSelectedId(null);
    return { ok: true, grid_selected_id: getGridSelectedId() };
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
