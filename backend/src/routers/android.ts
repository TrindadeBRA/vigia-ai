import type { FastifyInstance } from "fastify";
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { dataDir } from "../config.js";
import {
    AndroidCreateSchema,
    AndroidDeviceSchema,
    AndroidFileSchema,
    AndroidInputSchema,
    type AndroidDevice,
    type AndroidFile,
} from "../schemas/android.js";

const execFileAsync = promisify(execFile);

function androidPath(): string {
    return join(dataDir(), "android.json");
}

function load(): AndroidFile {
    const p = androidPath();
    if (!existsSync(p)) return AndroidFileSchema.parse({});
    try {
        const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
        return AndroidFileSchema.parse(raw);
    } catch {
        return AndroidFileSchema.parse({});
    }
}

function save(config: AndroidFile): void {
    mkdirSync(dataDir(), { recursive: true });
    const p = androidPath();
    const tmp = p + ".tmp";
    writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", "utf-8");
    renameSync(tmp, p);
}

function toPublic(item: AndroidDevice, live?: Map<string, { state: string; model: string | null }>) {
    const info = live?.get(item.serial) || (item.host ? live?.get(`${item.host}:${item.port}`) : undefined);
    // Also try to match by host:port for TCP devices where serial == host:port
    const serialKey = item.serial || (item.host ? `${item.host}:${item.port}` : "");
    const liveInfo = live?.get(serialKey) || info;
    const online = liveInfo ? liveInfo.state === "device" : false;
    const state = liveInfo?.state || (online ? "device" : "offline");
    return {
        ...item,
        configured: Boolean(item.host.trim() || item.serial.trim()),
        online,
        state,
        model: liveInfo?.model ?? null,
    };
}

// ── ADB helpers ──

async function whichAdb(): Promise<string | null> {
    const env = (process.env.ADB || process.env.ANDROID_ADB || "").trim();
    if (env && existsSync(env)) return env;
    try {
        const { stdout } = await execFileAsync("which", ["adb"]);
        const p = stdout.trim().split("\n")[0]?.trim();
        if (p && existsSync(p)) return p;
    } catch { }
    // Try common paths
    for (const cand of ["/usr/bin/adb", "/usr/local/bin/adb", "/opt/homebrew/bin/adb", "/opt/android-sdk/platform-tools/adb", `${process.env.HOME}/Android/Sdk/platform-tools/adb`]) {
        if (existsSync(cand)) return cand;
    }
    // Fallback: try running `adb` directly (PATH)
    try {
        await execFileAsync("adb", ["version"]);
        return "adb";
    } catch { }
    return null;
}

async function runAdb(args: string[], timeoutMs = 8000): Promise<{ stdout: Buffer; stderr: string; code: number | null }> {
    const adb = (await whichAdb()) || "adb";
    return new Promise((resolve) => {
        const proc = spawn(adb, args, { stdio: ["ignore", "pipe", "pipe"] });
        const out: Buffer[] = [];
        let stderr = "";
        const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
        proc.stdout.on("data", (c: Buffer) => out.push(c));
        proc.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf-8"); });
        proc.on("error", (err) => {
            clearTimeout(timer);
            resolve({ stdout: Buffer.concat(out), stderr: err.message, code: null });
        });
        proc.on("close", (code) => {
            clearTimeout(timer);
            resolve({ stdout: Buffer.concat(out), stderr, code });
        });
    });
}

type LiveDevice = { state: string; model: string | null };

async function listLiveDevices(): Promise<Map<string, LiveDevice>> {
    const map = new Map<string, LiveDevice>();
    const res = await runAdb(["devices", "-l"], 5000);
    if (res.code !== 0 && res.code !== null) return map;
    const text = res.stdout.toString("utf-8");
    const lines = text.split("\n").slice(1); // skip header
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Format: serial state [key:value ...]
        // e.g. "14ed0a1e device usb:1-1 product:blueline model:Pixel_3 device:blueline transport_id:1"
        const parts = trimmed.split(/\s+/);
        const serial = parts[0];
        const state = parts[1] || "offline";
        let model: string | null = null;
        for (const p of parts.slice(2)) {
            if (p.startsWith("model:")) model = p.slice(6).replace(/_/g, " ");
        }
        if (serial) map.set(serial, { state, model });
    }
    // Enrich model via getprop if missing
    for (const [serial, info] of map) {
        if (!info.model && info.state === "device") {
            try {
                const r = await runAdb(["-s", serial, "shell", "getprop", "ro.product.model"], 3000);
                const m = r.stdout.toString("utf-8").trim();
                if (m) info.model = m;
            } catch { }
        }
    }
    return map;
}

async function getDeviceSize(serial: string): Promise<{ w: number; h: number } | null> {
    try {
        const r = await runAdb(["-s", serial, "shell", "wm", "size"], 4000);
        const txt = r.stdout.toString("utf-8");
        // "Physical size: 1080x2400" or "Override size: ..."
        const m = txt.match(/(\d+)x(\d+)/);
        if (m) return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
    } catch { }
    return null;
}

async function grabScreenshot(serial: string): Promise<Buffer> {
    // Use exec-out screencap -p (PNG). Timeout 8s.
    const r = await runAdb(["-s", serial, "exec-out", "screencap", "-p"], 8000);
    if (r.stdout.length < 100) {
        throw new Error(r.stderr.trim().split("\n").pop() || `adb screencap falhou (código ${r.code})`);
    }
    // adb exec-out may include \r\n -> \n conversion issues; PNG header check
    // PNG starts with 89 50 4E 47
    let buf = r.stdout;
    // Some adb versions prepend \r; find PNG header
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const idx = buf.indexOf(pngHeader);
    if (idx > 0) buf = buf.subarray(idx);
    if (buf.length < 100) throw new Error("screenshot vazio");
    return buf;
}

// Convert PNG to JPEG via Jimp if available, otherwise return PNG as-is
async function pngToJpeg(png: Buffer, quality = 75): Promise<Buffer> {
    try {
        const mod = await import("jimp") as unknown as Record<string, unknown>;
        const JimpAny = (mod.Jimp ?? mod.default ?? mod) as unknown as { read: (b: Buffer) => Promise<{ bitmap: { width: number }; resize: (opts: { w: number }) => void; quality: (q: number) => void; getBuffer: (mime: string) => Promise<Buffer> }> };
        const img = await JimpAny.read(png);
        // Scale down if huge (e.g. 1440x3120) to save bandwidth — max 720px wide
        const maxW = 720;
        if (img.bitmap.width > maxW) img.resize({ w: maxW });
        img.quality(quality);
        return await img.getBuffer("image/jpeg");
    } catch {
        // Fallback: return PNG (browser can display PNG in <img> and multipart)
        return png;
    }
}

// ── Stream fan-out (polling screencap) ──

const STREAM_INTERVAL_MS = 400; // ~2.5 fps — equilíbrio entre fluidez e CPU/adb
const STREAM_JPEG_QUALITY = 60;
const STOP_GRACE_MS = 5000;

type StreamSub = { onFrame: (jpeg: Buffer, w: number, h: number) => void; onEnd: (err: Error | null) => void };
type StreamEntry = { subs: Set<StreamSub>; timer: NodeJS.Timeout | null; stopTimer: NodeJS.Timeout | null; size: { w: number; h: number } | null };
const sharedStreams = new Map<string, StreamEntry>();

function killStream(deviceId: string): void {
    const entry = sharedStreams.get(deviceId);
    if (!entry) return;
    if (entry.timer) clearInterval(entry.timer);
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    sharedStreams.delete(deviceId);
}

function subscribeStream(deviceId: string, serial: string, sub: StreamSub): () => void {
    let entry = sharedStreams.get(deviceId);
    if (entry) {
        if (entry.stopTimer) {
            clearTimeout(entry.stopTimer);
            entry.stopTimer = null;
        }
    } else {
        const subs = new Set<StreamSub>();
        const created: StreamEntry = { subs, timer: null, stopTimer: null, size: null };
        // Poll loop
        const tick = async () => {
            if (subs.size === 0) return;
            try {
                const png = await grabScreenshot(serial);
                const jpeg = await pngToJpeg(png, STREAM_JPEG_QUALITY);
                // Try to get size once
                if (!created.size) {
                    try {
                        const mod2 = await import("jimp") as unknown as Record<string, unknown>;
                        const JimpAny2 = (mod2.Jimp ?? mod2.default ?? mod2) as unknown as { read: (b: Buffer) => Promise<{ bitmap: { width: number; height: number } }> };
                        const img2 = await JimpAny2.read(png);
                        created.size = { w: img2.bitmap.width, h: img2.bitmap.height };
                    } catch {
                        created.size = { w: 0, h: 0 };
                    }
                }
                for (const s of subs) s.onFrame(jpeg, created.size?.w ?? 0, created.size?.h ?? 0);
            } catch (e) {
                const err = e instanceof Error ? e : new Error(String(e));
                // If device offline, notify and stop
                for (const s of subs) s.onEnd(err);
                subs.clear();
                if (created.timer) clearInterval(created.timer);
                sharedStreams.delete(deviceId);
            }
        };
        // Immediate first frame, then interval
        void tick();
        created.timer = setInterval(() => { void tick(); }, STREAM_INTERVAL_MS);
        sharedStreams.set(deviceId, created);
        entry = created;
    }
    entry.subs.add(sub);
    return () => {
        const cur = sharedStreams.get(deviceId);
        if (!cur || cur !== entry) return;
        cur.subs.delete(sub);
        if (cur.subs.size === 0) {
            cur.stopTimer = setTimeout(() => {
                if (sharedStreams.get(deviceId) === cur && cur.subs.size === 0) {
                    if (cur.timer) clearInterval(cur.timer);
                    sharedStreams.delete(deviceId);
                }
            }, STOP_GRACE_MS);
        }
    };
}

// ── Routes ──

export async function createAndroidRoutes(app: FastifyInstance): Promise<void> {
    // Status do ADB
    app.get("/api/android/adb/status", async () => {
        const adb = await whichAdb();
        if (!adb) return { ok: false, adb: null, error: "adb não encontrado no PATH do coletor. Instale platform-tools (apt install adb / brew install android-platform-tools)." };
        const ver = await runAdb(["version"], 3000);
        const version = ver.stdout.toString("utf-8").split("\n")[0]?.trim() || ver.stderr.split("\n")[0]?.trim() || "adb";
        const live = await listLiveDevices();
        const devices = [...live.entries()].map(([serial, info]) => ({ serial, state: info.state, model: info.model }));
        return { ok: true, adb, version, devices };
    });

    // Conectar TCP/IP genérico (sem salvar)
    app.post("/api/android/adb/connect", async (request, reply) => {
        const body = (request.body as Record<string, unknown>) ?? {};
        const host = String((body as Record<string, unknown>).host || "").trim();
        const port = Number((body as Record<string, unknown>).port || 5555);
        if (!host) return reply.code(400).send({ ok: false, error: "host é obrigatório" });
        const target = `${host}:${port}`;
        const r = await runAdb(["connect", target], 8000);
        const out = r.stdout.toString("utf-8") + r.stderr;
        if (out.toLowerCase().includes("connected to") || out.toLowerCase().includes("already connected")) {
            return { ok: true, message: out.trim() };
        }
        return reply.code(502).send({ ok: false, error: out.trim() || `falha ao conectar em ${target}` });
    });

    app.post("/api/android/adb/disconnect", async (request) => {
        const body = (request.body as Record<string, unknown>) ?? {};
        const target = String((body as Record<string, unknown>).target || "").trim();
        const args = target ? ["disconnect", target] : ["disconnect"];
        const r = await runAdb(args, 5000);
        return { ok: true, message: (r.stdout.toString("utf-8") + r.stderr).trim() };
    });

    // CRUD de dispositivos salvos
    app.get("/api/android/devices", async () => {
        const file = load();
        const live = await listLiveDevices();
        return { devices: file.devices.map((d) => toPublic(d, live)) };
    });

    app.post("/api/android/devices", async (request, reply) => {
        const parsed = AndroidCreateSchema.safeParse((request.body as Record<string, unknown>) ?? {});
        if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.message });
        const file = load();
        const item = AndroidDeviceSchema.parse({ ...parsed.data, id: randomBytes(4).toString("hex") });
        file.devices.push(item);
        save(file);
        const live = await listLiveDevices();
        return { ok: true, device: toPublic(item, live) };
    });

    app.patch("/api/android/devices/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = AndroidDeviceSchema.omit({ id: true }).partial().safeParse((request.body as Record<string, unknown>) ?? {});
        if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.message });
        const file = load();
        const idx = file.devices.findIndex((d) => d.id === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        const prev = file.devices[idx];
        const next = AndroidDeviceSchema.parse({ ...prev, ...parsed.data, id });
        file.devices[idx] = next;
        save(file);
        // Se mudou serial/host, mata stream antigo
        if (prev.serial !== next.serial || prev.host !== next.host || prev.port !== next.port) killStream(id);
        const live = await listLiveDevices();
        return { ok: true, device: toPublic(next, live) };
    });

    app.delete("/api/android/devices/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const file = load();
        const idx = file.devices.findIndex((d) => d.id === id);
        if (idx === -1) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        file.devices.splice(idx, 1);
        save(file);
        killStream(id);
        return { ok: true };
    });

    // Conectar/desconectar dispositivo salvo (TCP)
    app.post("/api/android/devices/:id/connect", async (request, reply) => {
        const { id } = request.params as { id: string };
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        if (!dev.host.trim()) return reply.code(400).send({ ok: false, error: "Dispositivo USB não precisa de connect — conecte o cabo e autorize a depuração." });
        const target = `${dev.host}:${dev.port}`;
        const r = await runAdb(["connect", target], 8000);
        const out = (r.stdout.toString("utf-8") + r.stderr).trim();
        if (out.toLowerCase().includes("connected to") || out.toLowerCase().includes("already connected")) {
            return { ok: true, message: out };
        }
        return reply.code(502).send({ ok: false, error: out || `falha ao conectar em ${target}` });
    });

    app.post("/api/android/devices/:id/disconnect", async (request, reply) => {
        const { id } = request.params as { id: string };
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        const target = dev.host ? `${dev.host}:${dev.port}` : dev.serial;
        const r = await runAdb(["disconnect", target], 5000);
        killStream(id);
        return { ok: true, message: (r.stdout.toString("utf-8") + r.stderr).trim() };
    });

    // Info do dispositivo (tamanho, modelo, etc)
    app.get("/api/android/devices/:id/info", async (request, reply) => {
        const { id } = request.params as { id: string };
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        const serial = dev.serial || (dev.host ? `${dev.host}:${dev.port}` : "");
        if (!serial) return reply.code(400).send({ ok: false, error: "Dispositivo sem serial/host configurado" });
        const live = await listLiveDevices();
        const info = live.get(serial);
        if (!info || info.state !== "device") return reply.code(502).send({ ok: false, error: "Dispositivo offline — verifique cabo/adb connect e autorize a depuração USB." });
        const size = await getDeviceSize(serial);
        return { ok: true, serial, state: info.state, model: info.model, size };
    });

    // Screenshot único (PNG -> JPEG)
    app.get("/api/android/devices/:id/screenshot", async (request, reply) => {
        const { id } = request.params as { id: string };
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        const serial = dev.serial || (dev.host ? `${dev.host}:${dev.port}` : "");
        if (!serial) return reply.code(400).send({ ok: false, error: "Dispositivo sem serial/host configurado" });
        const live = await listLiveDevices();
        const info = live.get(serial);
        if (!info || info.state !== "device") return reply.code(502).send({ ok: false, error: "Dispositivo offline" });
        try {
            const png = await grabScreenshot(serial);
            const jpeg = await pngToJpeg(png, 75);
            const isJpeg = jpeg[0] === 0xff && jpeg[1] === 0xd8;
            return reply.type(isJpeg ? "image/jpeg" : "image/png").send(jpeg);
        } catch (e) {
            return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    });

    // Stream MJPEG (polling screencap) — inspirado no scrcpy, mas via adb screencap
    // Para scrcpy nativo (H.264), o usuário pode rodar `scrcpy --v4l2` externo; aqui
    // entregamos MJPEG leve que funciona sem scrcpy instalado.
    app.get("/api/android/devices/:id/stream", async (request, reply) => {
        const { id } = request.params as { id: string };
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        const serial = dev.serial || (dev.host ? `${dev.host}:${dev.port}` : "");
        if (!serial) return reply.code(400).send({ ok: false, error: "Dispositivo sem serial/host configurado" });
        const live = await listLiveDevices();
        const info = live.get(serial);
        if (!info || info.state !== "device") return reply.code(502).send({ ok: false, error: "Dispositivo offline" });

        const BOUNDARY = "vigia-android-frame";
        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, {
            "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
            "Cache-Control": "no-store",
            Connection: "close",
        });
        let ended = false;
        const unsubscribe = subscribeStream(id, serial, {
            onFrame: (jpeg) => {
                if (ended || res.destroyed) return;
                const isJpeg = jpeg[0] === 0xff && jpeg[1] === 0xd8;
                const ct = isJpeg ? "image/jpeg" : "image/png";
                res.write(`--${BOUNDARY}\r\nContent-Type: ${ct}\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
                res.write(jpeg);
                res.write("\r\n");
            },
            onEnd: (err) => {
                if (ended) return;
                ended = true;
                if (err) {
                    // Envia comentário no stream antes de fechar
                    try { res.write(`--${BOUNDARY}--\r\n`); } catch { }
                }
                res.end();
            },
        });
        request.raw.on("close", () => {
            ended = true;
            unsubscribe();
        });
    });

    // Input (toque, swipe, teclas) — espelhamento interativo
    app.post("/api/android/devices/:id/input", async (request, reply) => {
        const { id } = request.params as { id: string };
        const dev = load().devices.find((d) => d.id === id);
        if (!dev) return reply.code(404).send({ ok: false, error: "Dispositivo não encontrado" });
        const serial = dev.serial || (dev.host ? `${dev.host}:${dev.port}` : "");
        if (!serial) return reply.code(400).send({ ok: false, error: "Dispositivo sem serial/host configurado" });
        const parsed = AndroidInputSchema.safeParse((request.body as Record<string, unknown>) ?? {});
        if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.message });
        const { action, x, y, x2, y2, duration, keycode, text } = parsed.data;

        // Resolve coordenadas: frontend manda 0..1 normalizado ou pixels absolutos?
        // Aceitamos ambos: se <=1, tratamos como normalizado e convertemos via wm size.
        let args: string[] = [];
        if (action === "tap") {
            if (x == null || y == null) return reply.code(400).send({ ok: false, error: "tap precisa de x e y" });
            let px = x, py = y;
            if (x <= 1 && y <= 1) {
                const size = await getDeviceSize(serial);
                if (size) { px = Math.round(x * size.w); py = Math.round(y * size.h); }
                else { px = Math.round(x * 1080); py = Math.round(y * 2400); }
            }
            args = ["-s", serial, "shell", "input", "tap", String(Math.round(px)), String(Math.round(py))];
        } else if (action === "swipe") {
            if (x == null || y == null || x2 == null || y2 == null) return reply.code(400).send({ ok: false, error: "swipe precisa de x,y,x2,y2" });
            let px = x, py = y, px2 = x2, py2 = y2;
            if (x <= 1 && y <= 1 && x2 <= 1 && y2 <= 1) {
                const size = await getDeviceSize(serial);
                if (size) {
                    px = Math.round(x * size.w); py = Math.round(y * size.h);
                    px2 = Math.round(x2 * size.w); py2 = Math.round(y2 * size.h);
                }
            }
            const dur = duration != null ? String(Math.round(duration)) : "300";
            args = ["-s", serial, "shell", "input", "swipe", String(Math.round(px)), String(Math.round(py)), String(Math.round(px2)), String(Math.round(py2)), dur];
        } else if (action === "key") {
            if (keycode == null) return reply.code(400).send({ ok: false, error: "key precisa de keycode" });
            args = ["-s", serial, "shell", "input", "keyevent", String(keycode)];
        } else if (action === "text") {
            if (!text) return reply.code(400).send({ ok: false, error: "text precisa de text" });
            // Escapa espaços para `input text` (troca espaço por %s)
            const escaped = text.replace(/ /g, "%s").replace(/'/g, "\\'");
            args = ["-s", serial, "shell", "input", "text", escaped];
        } else if (action === "back") {
            args = ["-s", serial, "shell", "input", "keyevent", "4"];
        } else if (action === "home") {
            args = ["-s", serial, "shell", "input", "keyevent", "3"];
        } else if (action === "menu") {
            args = ["-s", serial, "shell", "input", "keyevent", "82"];
        } else if (action === "power") {
            args = ["-s", serial, "shell", "input", "keyevent", "26"];
        } else if (action === "wake") {
            args = ["-s", serial, "shell", "input", "keyevent", "224"];
        } else if (action === "sleep") {
            args = ["-s", serial, "shell", "input", "keyevent", "223"];
        }

        const r = await runAdb(args, 5000);
        if (r.code !== 0 && r.code !== null) {
            return reply.code(502).send({ ok: false, error: (r.stderr || r.stdout.toString("utf-8")).trim() || `input falhou (código ${r.code})` });
        }
        return { ok: true };
    });

    // Atalho: listar dispositivos ADB ao vivo (sem precisar salvar)
    app.get("/api/android/adb/devices", async () => {
        const live = await listLiveDevices();
        const devices = [...live.entries()].map(([serial, info]) => ({ serial, state: info.state, model: info.model }));
        // Tenta pegar tamanho de cada device online
        const enriched = await Promise.all(devices.map(async (d) => {
            if (d.state !== "device") return d;
            const size = await getDeviceSize(d.serial);
            return { ...d, size };
        }));
        return { devices: enriched };
    });
}
