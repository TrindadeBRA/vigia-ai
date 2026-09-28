import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../config.js";
import {
    MonitorDeviceSchema,
    MonitorFileSchema,
    MonitorPatchSchema,
    MonitorRegisterSchema,
    type MonitorDevice,
    type MonitorFile,
} from "../schemas/monitors.js";

const MAX_META_BYTES = 8192;
const ONLINE_MS = 10 * 60 * 1000;
const ID_RE = /^[0-9a-f]{8}$/;

function monitorsPath(): string {
    return join(dataDir(), "monitors.json");
}

function themePath(id: string, orientation = "portrait"): string {
    // Retrato usa o arquivo sem sufixo (compat com v1); paisagem tem sufixo.
    return orientation === "landscape"
        ? join(dataDir(), `theme_monitor_${id}_landscape.json`)
        : join(dataDir(), `theme_monitor_${id}.json`);
}

function parseOrientation(request: unknown): "portrait" | "landscape" {
    const q = ((request as { query?: Record<string, string | undefined> }).query) ?? {};
    return q.orientation === "landscape" ? "landscape" : "portrait";
}

function orientationsOf(d: MonitorDevice) {
    const a = Math.min(d.screenW, d.screenH);
    const b = Math.max(d.screenW, d.screenH);
    return {
        portrait: { w: a, h: b },
        landscape: { w: b, h: a },
    };
}

function load(): MonitorFile {
    const p = monitorsPath();
    if (!existsSync(p)) return MonitorFileSchema.parse({});
    try {
        const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
        return MonitorFileSchema.parse(raw);
    } catch {
        return MonitorFileSchema.parse({});
    }
}

function save(file: MonitorFile): void {
    mkdirSync(dataDir(), { recursive: true });
    const p = monitorsPath();
    const tmp = p + ".tmp";
    writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n", "utf-8");
    renameSync(tmp, p);
}

function toPublic(d: MonitorDevice) {
    const online = Date.now() - Date.parse(d.lastSeen) < ONLINE_MS;
    return {
        id: d.id,
        label: d.label || d.model || d.id,
        model: d.model,
        brand: d.brand,
        screenW: d.screenW,
        screenH: d.screenH,
        portrait: orientationsOf(d).portrait,
        landscape: orientationsOf(d).landscape,
        appVersion: d.appVersion,
        lastSeen: d.lastSeen,
        online,
    };
}

function badId(reply: unknown, id: string): boolean {
    if (ID_RE.test(id)) return false;
    (reply as { code: (n: number) => { send: (b: unknown) => void } }).code(400).send({ ok: false, error: "id inválido" });
    return true;
}

async function selectedWallpaperOrig(): Promise<{ wid: string; buf: Buffer } | null> {
    try {
        const { load } = await import("../store.js");
        const cfg = load() as Record<string, unknown>;
        const wp = (cfg.wallpapers as Record<string, unknown>) ?? {};
        const wid = String(wp.selected_id ?? "").trim();
        if (!wid || wid.includes("/") || wid.includes("..")) return null;
        const dir = join(dataDir(), "wallpapers");
        for (const name of [`${wid}.orig`, `${wid}.jpg`, `${wid}.preview.jpg`]) {
            const p = join(dir, name);
            if (existsSync(p)) return { wid, buf: readFileSync(p) };
        }
        return null;
    } catch {
        return null;
    }
}

export async function createMonitorsRoutes(app: FastifyInstance): Promise<void> {
    // Auto-registro do app Vigia (upsert pela key estável do aparelho).
    app.post("/api/monitors/register", { schema: { tags: ["Monitores"] } }, async (request) => {
        const parsed = MonitorRegisterSchema.safeParse((request.body as Record<string, unknown>) ?? {});
        if (!parsed.success) return { ok: false as const, error: parsed.error.message };
        const file = load();
        const now = new Date().toISOString();
        const prev = file.devices.find((d) => d.key === parsed.data.key);
        if (prev) {
            const next = MonitorDeviceSchema.parse({ ...prev, ...parsed.data, id: prev.id, lastSeen: now });
            file.devices[file.devices.indexOf(prev)] = next;
            save(file);
            return { ok: true as const, id: next.id, isNew: false };
        }
        const item = MonitorDeviceSchema.parse({
            ...parsed.data,
            id: randomBytes(4).toString("hex"),
            lastSeen: now,
        });
        file.devices.push(item);
        save(file);
        return { ok: true as const, id: item.id, isNew: true };
    });

    app.get("/api/monitors", { schema: { tags: ["Monitores"] } }, async () => {
        return { monitors: load().devices.map(toPublic) };
    });

    app.patch("/api/monitors/:id", { schema: { tags: ["Monitores"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (badId(reply, id)) return;
        const parsed = MonitorPatchSchema.safeParse((request.body as Record<string, unknown>) ?? {});
        if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.message });
        const file = load();
        const dev = file.devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Aparelho não encontrado" });
        dev.label = parsed.data.label;
        save(file);
        return { ok: true, device: toPublic(dev) };
    });

    app.delete("/api/monitors/:id", { schema: { tags: ["Monitores"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (badId(reply, id)) return;
        const file = load();
        const idx = file.devices.findIndex((d) => d.id === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "Aparelho não encontrado" });
        file.devices.splice(idx, 1);
        save(file);
        try { unlinkSync(themePath(id, "portrait")); } catch {}
        try { unlinkSync(themePath(id, "landscape")); } catch {}
        return { ok: true };
    });

    // Tema do aparelho (canvas próprio; default continua sendo o da placa).
    app.get("/api/monitors/:id/theme", { schema: { tags: ["Monitores"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (badId(reply, id)) return;
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Aparelho não encontrado" });
        const orientation = parseOrientation(request);
        const p = themePath(id, orientation);
        let theme: string | null = null;
        if (existsSync(p)) {
            try { theme = readFileSync(p, "utf-8"); } catch { theme = null; }
        }
        const sel = await selectedWallpaperOrig();
        const dims = orientationsOf(dev)[orientation];
        return {
            active: theme !== null,
            theme,
            has_background: sel !== null,
            background_id: sel?.wid ?? null,
            orientation,
            screenW: dims.w,
            screenH: dims.h,
        };
    });

    app.post("/api/monitors/:id/theme/meta", { schema: { tags: ["Monitores"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (badId(reply, id)) return;
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Aparelho não encontrado" });
        const body = request.body;
        const buf = Buffer.isBuffer(body)
            ? body
            : typeof body === "string"
                ? Buffer.from(body, "utf-8")
                : Buffer.from(JSON.stringify(body ?? ""), "utf-8");
        if (buf.length === 0) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        if (buf.length > MAX_META_BYTES) return reply.code(413).send({ ok: false, error: "tema grande demais" });
        try {
            JSON.parse(buf.toString("utf-8"));
        } catch {
            return reply.code(400).send({ ok: false, error: "JSON inválido" });
        }
        try {
            mkdirSync(dataDir(), { recursive: true });
            const dest = themePath(id, parseOrientation(request));
            const tmp = dest + ".tmp";
            writeFileSync(tmp, buf);
            renameSync(tmp, dest);
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
        return { ok: true };
    });

    app.delete("/api/monitors/:id/theme", { schema: { tags: ["Monitores"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (badId(reply, id)) return;
        const orientation = parseOrientation(request);
        if (orientation === "landscape") {
            try { unlinkSync(themePath(id, "landscape")); } catch {}
        } else {
            try { unlinkSync(themePath(id, "portrait")); } catch {}
        }
        return { ok: true };
    });

    // Fundo convertido na hora para a tela do aparelho (metade da resolução,
    // igual à placa: o app desenha com upscale 2x nearest-neighbor).
    app.get("/api/monitors/:id/theme/background", { schema: { tags: ["Monitores"] } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (badId(reply, id)) return;
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Aparelho não encontrado" });
        const q = (request.query as Record<string, string | undefined>) ?? {};
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
        const fullW = clamp(parseInt(q.w ?? "", 10) || dev.screenW, 80, 2160);
        const fullH = clamp(parseInt(q.h ?? "", 10) || dev.screenH, 80, 3840);
        const tw = Math.max(40, Math.floor(fullW / 2));
        const th = Math.max(40, Math.floor(fullH / 2));
        const sel = await selectedWallpaperOrig();
        if (!sel) return reply.code(404).send({ ok: false, error: "nenhum papel de parede selecionado" });
        try {
            const { imageToRaw } = await import("./wallpapers/router.js");
            const raw = await (imageToRaw as (b: Buffer, w: number, h: number) => Promise<Buffer>)(sel.buf, tw, th);
            return reply
                .header("Content-Length", String(raw.length))
                .header("X-Vigia-Raw-W", String(tw))
                .header("X-Vigia-Raw-H", String(th))
                .type("application/octet-stream")
                .send(raw);
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
    });
}
