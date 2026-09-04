import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../config.js";

const MAX_META_BYTES = 8192;

function metaPath(): string {
  return join(dataDir(), "theme.json");
}
function wallpapersDir(): string {
  return join(dataDir(), "wallpapers");
}
function wallpaperRawPath(wid: string, suffix = ""): string {
  if (suffix) return join(wallpapersDir(), `${wid}${suffix}.raw`);
  return join(wallpapersDir(), `${wid}.raw`);
}

function screenSuffix(request: unknown): string {
  const req = request as { headers: Record<string, string | undefined>; query: Record<string, string | undefined> };
  const headers = req.headers ?? {};
  const screen = headers["x-vigia-screen"] ?? headers["X-Vigia-Screen"] ?? "";
  let suffix = "";
  if (screen && screen.includes("x")) {
    try {
      const [ws, , hs] = partition(screen, "x");
      const wi = parseInt(ws, 10);
      const hi = parseInt(hs, 10);
      if (wi === 320 && hi === 240) suffix = "_wokwi";
    } catch {}
  }
  const w = req.query?.w;
  const h = req.query?.h;
  if (w && h) {
    try {
      const wi = parseInt(w, 10);
      const hi = parseInt(h, 10);
      if (wi === 160 && hi === 120) suffix = "_wokwi";
      else if (wi === 240 && hi === 160) suffix = "";
    } catch {}
  }
  return suffix;
}

function partition(s: string, sep: string): [string, string, string] {
  const idx = s.indexOf(sep);
  if (idx === -1) return [s, "", ""];
  return [s.slice(0, idx), sep, s.slice(idx + sep.length)];
}

export async function createThemeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/theme", async () => {
    let theme: string | null = null;
    const p = metaPath();
    if (existsSync(p)) {
      try {
        theme = readFileSync(p, "utf-8");
      } catch {}
    }
    // get selected id via wallpapers helper if available
    let selectedId: string | null = null;
    try {
      const wallpapers = await import("./wallpapers/router.js");
      // wallpapers module may expose _getSelectedId equivalent; try to call internal helper via reading config
      const { load } = await import("../store.js");
      const cfg = load() as Record<string, unknown>;
      const wp = (cfg.wallpapers as Record<string, unknown>) ?? {};
      selectedId = String(wp.selected_id ?? "").trim() || null;
      // verify file exists else null
      if (selectedId) {
        // check if wallpaper exists via meta
        const { existsSync: es } = await import("node:fs");
        const { join: j } = await import("node:path");
        const { dataDir: dd } = await import("../config.js");
        const metaFile = j(dd(), "wallpapers.json");
        if (es(metaFile)) {
          try {
            const raw = JSON.parse(readFileSync(metaFile, "utf-8")) as Record<string, unknown>;
            const list = (raw.wallpapers ?? []) as Array<Record<string, unknown>>;
            const found = list.some((w) => String(w.id) === selectedId);
            if (!found) {
              // fallback: check raw file existence
              const rawPath = j(dd(), "wallpapers", `${selectedId}.raw`);
              if (!es(rawPath) && !es(j(dd(), "wallpapers", `${selectedId}_wokwi.raw`))) selectedId = null;
            }
          } catch { selectedId = null; }
        }
      }
    } catch {}
    return {
      active: theme !== null,
      theme,
      has_background: selectedId !== null,
      background_id: selectedId,
    };
  });

  app.post("/api/theme/meta", async (request, reply) => {
    const body = await getRawBody(request);
    if (!body || body.length === 0) return reply.code(400).send({ ok: false, error: "corpo vazio" });
    if (body.length > MAX_META_BYTES) return reply.code(413).send({ ok: false, error: "tema grande demais" });
    try {
      mkdirSync(dataDir(), { recursive: true });
      const tmp = metaPath() + ".tmp";
      writeFileSync(tmp, body);
      const { renameSync, chmodSync } = await import("node:fs");
      renameSync(tmp, metaPath());
      try { chmodSync(metaPath(), 0o600); } catch {}
    } catch (e) {
      return reply.code(500).send({ ok: false, error: String(e) });
    }
    return { ok: true };
  });

  app.get("/api/theme/background", async (request, reply) => {
    // dynamic import wallpapers helpers
    const wid = await resolveSelectedId();
    if (!wid) return reply.code(404).send({ ok: false, error: "nenhum papel de parede selecionado" });
    const suffix = screenSuffix(request);
    let p = wallpaperRawPath(wid, suffix);
    if (existsSync(p)) {
      const data = readFileSync(p);
      return reply.type("application/octet-stream").send(data);
    }
    p = wallpaperRawPath(wid);
    if (existsSync(p)) {
      const data = readFileSync(p);
      return reply.type("application/octet-stream").send(data);
    }
    const orig = join(wallpapersDir(), `${wid}.orig`);
    if (existsSync(orig)) {
      try {
        const bytes = readFileSync(orig);
        const { imageToRaw } = await import("./wallpapers/router.js");
        const tw = suffix === "_wokwi" ? 160 : 240;
        const th = suffix === "_wokwi" ? 120 : 160;
        const raw = await (imageToRaw as (b: Buffer, w: number, h: number) => Promise<Buffer>)(bytes, tw, th);
        return reply.type("application/octet-stream").send(raw);
      } catch {}
    }
    return reply.code(404).send({ ok: false, error: "papel de parede não encontrado" });
  });

  app.get("/api/theme/background/index", async () => {
    const wid = await resolveSelectedId();
    return { enabled: false, index: 0, count: wid ? 1 : 0, interval: 0, current_id: wid };
  });

  app.delete("/api/theme", async () => {
    try { unlinkSync(metaPath()); } catch {}
    return { ok: true };
  });
}

async function resolveSelectedId(): Promise<string | null> {
  try {
    const { load } = await import("../store.js");
    const cfg = load() as Record<string, unknown>;
    const wp = (cfg.wallpapers as Record<string, unknown>) ?? {};
    const selected = String(wp.selected_id ?? "").trim();
    if (!selected) return null;
    // validate existence via wallpapers.json or raw
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { dataDir: dd } = await import("../config.js");
    const raw1 = join(dd(), "wallpapers", `${selected}.raw`);
    const raw2 = join(dd(), "wallpapers", `${selected}_wokwi.raw`);
    const preview = join(dd(), "wallpapers", `${selected}.jpg`);
    const orig = join(dd(), "wallpapers", `${selected}.orig`);
    if (existsSync(raw1) || existsSync(raw2) || existsSync(preview) || existsSync(orig)) return selected;
    // fallback to first wallpaper if any
    const metaPath2 = join(dd(), "wallpapers.json");
    if (existsSync(metaPath2)) {
      try {
        const data = JSON.parse(readFileSync(metaPath2, "utf-8")) as Record<string, unknown>;
        const list = (data.wallpapers ?? []) as Array<Record<string, unknown>>;
        if (list.length > 0) return String(list[0].id);
      } catch {}
    }
    return null;
  } catch { return null; }
}

async function getRawBody(request: unknown): Promise<Buffer> {
  const anyReq = request as unknown as { raw?: { read?: () => unknown }; body?: unknown };
  if (Buffer.isBuffer(anyReq.body)) return anyReq.body as Buffer;
  if (typeof anyReq.body === "string") return Buffer.from(anyReq.body as string, "utf-8");
  if (anyReq.body !== null && typeof anyReq.body === "object") {
    // Check if it's already a buffer-like from multipart? Return JSON string
    try { return Buffer.from(JSON.stringify(anyReq.body), "utf-8"); } catch { return Buffer.alloc(0); }
  }
  // Try reading raw stream
  try {
    const raw = (request as unknown as { raw?: { read: () => Buffer } }).raw;
    if (raw && typeof raw.read === "function") {
      const data = raw.read();
      if (Buffer.isBuffer(data) && data.length) return data;
    }
  } catch {}
  return Buffer.alloc(0);
}
