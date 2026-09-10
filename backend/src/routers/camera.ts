import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dataDir } from "../config.js";
import {
  CameraCreateSchema,
  CameraItemSchema,
  CameraPatchSchema,
  CamerasFileSchema,
  RTSP_FIELDS,
  type CameraItem,
  type CamerasFile,
} from "../schemas/camera.js";
import { invalidatePtzCache, sendPtz, type PtzAction } from "../providers/onvifPtz.js";

function cameraPath(): string {
  return join(dataDir(), "camera.json");
}

// Migra o formato antigo (uma câmera única, campos no topo do arquivo) pra
// `{ cameras: [...] }` na primeira leitura — usuários que já tinham uma
// câmera configurada não perdem a config.
function migrateLegacy(raw: Record<string, unknown>): CamerasFile | null {
  if ("cameras" in raw) return null;
  if (!("host" in raw)) return null;
  const legacy = CameraItemSchema.omit({ id: true, label: true, ptzEnabled: true, onvifPort: true }).partial().parse(raw);
  const item = CameraItemSchema.parse({ ...legacy, id: randomBytes(4).toString("hex"), label: "Câmera" });
  return { cameras: [item] };
}

function load(): CamerasFile {
  const p = cameraPath();
  if (!existsSync(p)) return CamerasFileSchema.parse({});
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
    const migrated = migrateLegacy(raw);
    if (migrated) {
      save(migrated);
      return migrated;
    }
    return CamerasFileSchema.parse(raw);
  } catch {
    return CamerasFileSchema.parse({});
  }
}

function save(config: CamerasFile): void {
  mkdirSync(dataDir(), { recursive: true });
  const p = cameraPath();
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", "utf-8");
  renameSync(tmp, p);
}

function toPublic(item: CameraItem) {
  const { password, ...rest } = item;
  return { ...rest, configured: Boolean(item.host.trim() && password.trim()) };
}

function rtspUrl(config: CameraItem): string {
  const user = encodeURIComponent(config.username);
  const pass = encodeURIComponent(config.password);
  const path = config.path.replace(/^\/+/, "");
  return `rtsp://${user}:${pass}@${config.host}:${config.port}/${path}`;
}

// Cache curto: o board pode ter várias abas/instâncias pollando o mesmo
// snapshot — sem isso cada poll dispararia um ffmpeg novo (processo pesado,
// ~1-2s pra conectar + decodificar o primeiro keyframe H.265). Uma entrada
// por câmera (chave = id da câmera).
const SNAPSHOT_TTL_MS = 2000;
const SNAPSHOT_TIMEOUT_MS = 8000;
const snapshotCache = new Map<string, { at: number; jpeg: Buffer }>();
const snapshotInFlight = new Map<string, Promise<Buffer>>();

function snapshotCacheKey(id: string, width: number): string {
  return `${id}:${width}`;
}

function parseSnapshotWidth(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 0;
  if (!Number.isFinite(n)) return 0;
  const w = Math.round(n);
  if (w < 80 || w > 640) return 0;
  return w;
}

function grabSnapshot(config: CameraItem, width = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = rtspUrl(config);
    // UDP em vez de TCP: várias câmeras clone (HiIP/Yoosee) devolvem o
    // Transport header sem "/TCP" explícito no SETUP e o ffmpeg recusa por
    // "Nonmatching transport" — UDP nessas placas não tem esse bug.
    const args = [
      "-rtsp_transport", "udp",
      "-timeout", String(SNAPSHOT_TIMEOUT_MS * 1000),
      "-y", "-i", url,
      "-frames:v", "1",
    ];
    // A placa (ESP32) pede `?w=` pra caber JPEG pequeno na RAM e no SPI da
    // TFT; o board web continua no tamanho nativo da câmera (width=0).
    if (width > 0) {
      args.push("-vf", `scale=${width}:-2`);
    }
    args.push(
      "-q:v", width > 0 ? "8" : "3",
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-",
    );
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    const killTimer = setTimeout(() => proc.kill("SIGKILL"), SNAPSHOT_TIMEOUT_MS);
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf-8"); });
    proc.on("error", (err) => {
      clearTimeout(killTimer);
      reject(err.message.includes("ENOENT") ? new Error("ffmpeg não encontrado no PATH do coletor") : err);
    });
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      const jpeg = Buffer.concat(chunks);
      if (jpeg.length === 0) {
        reject(new Error(stderr.trim().split("\n").pop() || `ffmpeg saiu com código ${code} sem imagem`));
        return;
      }
      resolve(jpeg);
    });
  });
}

const STREAM_BOUNDARY = "vigiaframe";
const SOI = Buffer.from([0xff, 0xd8]);

// MJPEG do ffmpeg é JPEG concatenado. Não use indexOf(EOI): APP1/EXIF
// traz um JPEG aninhado com seu próprio FF D9 e o primeiro "frame" sai
// truncado — a placa desenha 1 quadro e os seguintes falham o decode.
function nextCompleteJpeg(buf: Buffer): { jpeg: Buffer; rest: Buffer } | null {
  const start = buf.indexOf(SOI);
  if (start < 0) return null;
  let i = start + 2;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd9) {
      // EOI só vale depois do SOS. Antes disso é JPEG aninhado (EXIF).
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      if (i + 3 >= buf.length) return null;
      const sosLen = buf.readUInt16BE(i + 2);
      i += 2 + sosLen;
      while (i + 1 < buf.length) {
        if (buf[i] === 0xff && buf[i + 1] !== 0x00) {
          const m = buf[i + 1];
          if (m === 0xd9) {
            const end = i + 2;
            return { jpeg: buf.subarray(start, end), rest: buf.subarray(end) };
          }
          if (m >= 0xd0 && m <= 0xd7) {
            i += 2;
            continue;
          }
        }
        i++;
      }
      return null;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 3 >= buf.length) return null;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

type StreamFit = "cover" | "contain";

function parseStreamFit(raw: unknown): StreamFit {
  return raw === "contain" ? "contain" : "cover";
}

function boardScaleFilter(size: { w: number; h: number }, fit: StreamFit): string {
  const { w, h } = size;
  if (fit === "contain") {
    return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
  }
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
}

function spawnFfmpegStream(
  config: CameraItem,
  onFrame: (jpeg: Buffer) => void,
  onEnd: (err: Error | null) => void,
  size?: { w: number; h: number },
  fit: StreamFit = "cover",
): () => void {
  const url = rtspUrl(config);
  // Board web: 640 @ 10fps. Firmware (size): baixa latência — sem -r (o
  // filtro fps do ffmpeg empilha frames) e com nobuffer/low_delay pra o
  // RTSP não ficar segundos atrás do relógio da câmera.
  const forBoard = Boolean(size);
  const vf = forBoard ? boardScaleFilter(size!, fit) : "scale=640:-2";
  const args = [
    ...(forBoard
      ? [
          "-fflags", "nobuffer+discardcorrupt",
          "-flags", "low_delay",
          "-probesize", "32",
          "-analyzeduration", "0",
          "-max_delay", "0",
        ]
      : []),
    "-rtsp_transport", "udp",
    "-timeout", "8000000",
    "-i", url,
    "-an",
    "-vf", vf,
    // Sem "-r", com probesize/analyzeduration mínimos o ffmpeg costuma
    // inferir um fps de saída errado (do tbr do RTSP) e duplica o último
    // frame decodificado pra "completar" a taxa — a placa recebe bytes e
    // desenha normal (nada acusa erro), mas é sempre a MESMA imagem: parece
    // travado no primeiro frame. "passthrough" manda só frame decodificado
    // de verdade, sem duplicar/dropar pra bater timing nenhum.
    ...(forBoard ? ["-fps_mode", "passthrough"] : ["-r", "10"]),
    "-q:v", forBoard ? "16" : "6",
    "-f", "mjpeg",
    "-flush_packets", "1",
    "-",
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let buf = Buffer.alloc(0);
  let stderr = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const parsed = nextCompleteJpeg(buf);
      if (!parsed) {
        if (buf.length > 512 * 1024) buf = Buffer.alloc(0);
        break;
      }
      onFrame(parsed.jpeg);
      buf = Buffer.from(parsed.rest);
    }
  });
  proc.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf-8");
    if (stderr.length > 4000) stderr = stderr.slice(-4000);
  });
  proc.on("error", (err) => {
    onEnd(err.message.includes("ENOENT") ? new Error("ffmpeg não encontrado no PATH do coletor") : err);
  });
  proc.on("close", (code) => {
    if (code && code !== 0 && code !== 255) {
      onEnd(new Error(stderr.trim().split("\n").pop() || `ffmpeg saiu com código ${code}`));
    } else {
      onEnd(null);
    }
  });
  return () => { if (!proc.killed) proc.kill("SIGKILL"); };
}

// Fan-out: um único ffmpeg compartilhado entre todos os viewers conectados de
// uma mesma câmera (a câmera vê só 1 conexão RTSP, a CPU decodifica 1 vez),
// em vez de um processo por aba/tela aberta. Nasce sob demanda no primeiro
// assinante e morre STOP_GRACE_MS depois do último sair — o delay evita
// reabrir o ffmpeg (handshake RTSP + primeiro keyframe H.265, ~1-2s) quando o
// próprio frontend reconecta rapidinho (ex.: troca de aba, ou o retry de erro
// do CameraCard.tsx). Uma entrada por câmera (chave = id da câmera).
type StreamSub = { onFrame: (jpeg: Buffer) => void; onEnd: (err: Error | null) => void };
const STOP_GRACE_MS = 5000;
// Câmeras clone (Yoosee/HiIP) só aceitam RTSP em UDP (ver grabSnapshot) — sem
// retransmissão, um pacote perdido no Wi-Fi desincroniza o parser H.264 do
// ffmpeg. Com -fflags discardcorrupt+nobuffer ele não erroriza nem sai: só
// para de emitir frame silenciosamente e fica preso assim até o próximo
// keyframe (pode nunca vir). Sem isso, o viewer trava pra sempre no último
// JPEG. STALL_MS dá folga pro handshake RTSP + 1º keyframe (~1-2s).
const STALL_MS = 6000;
const WATCHDOG_INTERVAL_MS = 2000;
type StreamEntry = {
  stop: () => void;
  subs: Set<StreamSub>;
  stopTimer: NodeJS.Timeout | null;
  watchdog: NodeJS.Timeout | null;
  lastFrameAt: number;
};
const sharedStreams = new Map<string, StreamEntry>();

function streamMapKey(cameraId: string, size?: { w: number; h: number }, fit: StreamFit = "cover"): string {
  return size ? `${cameraId}:${size.w}x${size.h}:${fit}` : cameraId;
}

function killStream(cameraId: string): void {
  for (const [key, entry] of [...sharedStreams.entries()]) {
    if (key !== cameraId && !key.startsWith(`${cameraId}:`)) continue;
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    if (entry.watchdog) clearInterval(entry.watchdog);
    entry.stop();
    sharedStreams.delete(key);
  }
}

function startStreamEntry(
  key: string,
  config: CameraItem,
  subs: Set<StreamSub>,
  size?: { w: number; h: number },
  fit: StreamFit = "cover",
): StreamEntry {
  const entry: StreamEntry = { subs, stopTimer: null, stop: () => {}, watchdog: null, lastFrameAt: Date.now() };
  let restarting = false;
  const spawnOne = () => {
    entry.lastFrameAt = Date.now();
    const kill = spawnFfmpegStream(
      config,
      (jpeg) => {
        entry.lastFrameAt = Date.now();
        for (const s of subs) s.onFrame(jpeg);
      },
      (err) => {
        if (restarting) {
          restarting = false;
          return;
        }
        for (const s of subs) s.onEnd(err);
        subs.clear();
        if (entry.watchdog) clearInterval(entry.watchdog);
        if (sharedStreams.get(key) === entry) sharedStreams.delete(key);
      },
      size,
      fit,
    );
    entry.stop = kill;
  };
  entry.watchdog = setInterval(() => {
    if (subs.size === 0 || Date.now() - entry.lastFrameAt < STALL_MS) return;
    restarting = true;
    entry.stop();
    spawnOne();
  }, WATCHDOG_INTERVAL_MS);
  spawnOne();
  return entry;
}

function subscribeStream(
  cameraId: string,
  config: CameraItem,
  sub: StreamSub,
  size?: { w: number; h: number },
  fit: StreamFit = "cover",
): () => void {
  const key = streamMapKey(cameraId, size, fit);
  let entry = sharedStreams.get(key);
  if (entry) {
    if (entry.stopTimer) {
      clearTimeout(entry.stopTimer);
      entry.stopTimer = null;
    }
  } else {
    entry = startStreamEntry(key, config, new Set<StreamSub>(), size, fit);
    sharedStreams.set(key, entry);
  }
  entry.subs.add(sub);
  return () => {
    const cur = sharedStreams.get(key);
    if (!cur || cur !== entry) return;
    cur.subs.delete(sub);
    if (cur.subs.size === 0) {
      cur.stopTimer = setTimeout(() => {
        if (sharedStreams.get(key) === cur && cur.subs.size === 0) {
          if (cur.watchdog) clearInterval(cur.watchdog);
          cur.stop();
          sharedStreams.delete(key);
        }
      }, STOP_GRACE_MS);
    }
  };
}

function rtspFieldsChanged(a: CameraItem, b: CameraItem): boolean {
  return RTSP_FIELDS.some((f) => a[f] !== b[f]);
}

export async function createCameraRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/camera/cameras", { schema: { tags: ["Câmeras"] } }, async () => ({ cameras: load().cameras.map(toPublic) }));

  app.post("/api/camera/cameras", { schema: { tags: ["Câmeras"] } }, async (request, reply) => {
    const parsed = CameraCreateSchema.safeParse((request.body as Record<string, unknown>) ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const file = load();
    const item = CameraItemSchema.parse({ ...parsed.data, id: randomBytes(4).toString("hex") });
    file.cameras.push(item);
    save(file);
    return { ok: true, camera: toPublic(item) };
  });

  app.patch("/api/camera/cameras/:id", { schema: { tags: ["Câmeras"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = CameraPatchSchema.safeParse((request.body as Record<string, unknown>) ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const file = load();
    const idx = file.cameras.findIndex((c) => c.id === id);
    if (idx === -1) return reply.code(404).send({ ok: false, error: "Câmera não encontrada" });
    const prev = file.cameras[idx];
    const next = CameraItemSchema.parse({ ...prev, ...parsed.data, id });
    file.cameras[idx] = next;
    save(file);
    if (rtspFieldsChanged(prev, next)) {
      killStream(id);
      for (const key of [...snapshotCache.keys()]) {
        if (key.startsWith(`${id}:`)) snapshotCache.delete(key);
      }
      for (const key of [...snapshotInFlight.keys()]) {
        if (key.startsWith(`${id}:`)) snapshotInFlight.delete(key);
      }
    }
    if (prev.host !== next.host || prev.username !== next.username || prev.password !== next.password || prev.onvifPort !== next.onvifPort) {
      invalidatePtzCache(id);
    }
    return { ok: true, camera: toPublic(next) };
  });

  app.delete("/api/camera/cameras/:id", { schema: { tags: ["Câmeras"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = load();
    const idx = file.cameras.findIndex((c) => c.id === id);
    if (idx === -1) return reply.code(404).send({ ok: false, error: "Câmera não encontrada" });
    file.cameras.splice(idx, 1);
    save(file);
    killStream(id);
    for (const key of [...snapshotCache.keys()]) {
      if (key.startsWith(`${id}:`)) snapshotCache.delete(key);
    }
    for (const key of [...snapshotInFlight.keys()]) {
      if (key.startsWith(`${id}:`)) snapshotInFlight.delete(key);
    }
    invalidatePtzCache(id);
    return { ok: true };
  });

  app.get("/api/camera/cameras/:id/snapshot", { schema: { tags: ["Câmeras"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const width = parseSnapshotWidth((request.query as { w?: string }).w);
    const config = load().cameras.find((c) => c.id === id);
    if (!config) return reply.code(404).send({ ok: false, error: "Câmera não encontrada" });
    if (!config.host.trim()) {
      return reply.code(400).send({ ok: false, error: "Câmera não configurada — preencha o IP em Configurações." });
    }
    const key = snapshotCacheKey(id, width);
    const now = Date.now();
    const cached = snapshotCache.get(key);
    if (cached && now - cached.at < SNAPSHOT_TTL_MS) {
      return reply.type("image/jpeg").send(cached.jpeg);
    }
    try {
      let inFlight = snapshotInFlight.get(key);
      if (!inFlight) {
        inFlight = grabSnapshot(config, width).finally(() => { snapshotInFlight.delete(key); });
        snapshotInFlight.set(key, inFlight);
      }
      const jpeg = await inFlight;
      snapshotCache.set(key, { at: Date.now(), jpeg });
      return reply.type("image/jpeg").send(jpeg);
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/camera/cameras/:id/stream", { schema: { tags: ["Câmeras"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { w?: string; h?: string; fit?: string };
    const sw = parseSnapshotWidth(q.w);
    const sh = parseSnapshotWidth(q.h);
    const size = sw && sh ? { w: sw, h: sh } : undefined;
    const fit = parseStreamFit(q.fit);
    const config = load().cameras.find((c) => c.id === id);
    if (!config) return reply.code(404).send({ ok: false, error: "Câmera não encontrada" });
    if (!config.host.trim()) {
      return reply.code(400).send({ ok: false, error: "Câmera não configurada — preencha o IP em Configurações." });
    }
    reply.hijack();
    const res = reply.raw;
    const sock = res.socket;
    sock?.setNoDelay(true);
    const raw = Boolean(size);
    // HTTP/1.1 + writeHead sem Content-Length vira chunked (hex + CRLF no
    // meio do JPEG). A placa congela no 1º quadro. HTTP/1.0 no socket evita isso.
    if (raw && sock) {
      sock.write(
        "HTTP/1.0 200 OK\r\nContent-Type: application/octet-stream\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
      );
    } else {
      res.chunkedEncoding = false;
      res.writeHead(200, {
        "Content-Type": `multipart/x-mixed-replace; boundary=${STREAM_BOUNDARY}`,
        "Cache-Control": "no-store",
        Connection: "close",
      });
    }
    let ended = false;
    const unsubscribe = subscribeStream(id, config, {
      onFrame: (jpeg) => {
        if (ended) return;
        if (raw) {
          if (!sock || sock.destroyed) return;
          sock.write(jpeg);
          return;
        }
        if (res.destroyed) return;
        res.write(`--${STREAM_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
        res.write(jpeg);
        res.write("\r\n");
      },
      onEnd: (err) => {
        if (ended) return;
        ended = true;
        // Sem isso o erro (ex.: ffmpeg ENOENT por PATH incompleto no app
        // empacotado) morria em silêncio — a conexão só fechava sem frame
        // nenhum, sem pista nenhuma no log do coletor.
        if (err) request.log.warn({ cameraId: id, err: err.message }, "câmera: stream encerrado com erro");
        if (raw) sock?.end();
        else res.end();
      },
    }, size, fit);
    request.raw.on("close", () => {
      ended = true;
      unsubscribe();
    });
  });

  app.post("/api/camera/cameras/:id/ptz", { schema: { tags: ["Câmeras"] } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const config = load().cameras.find((c) => c.id === id);
    if (!config) return reply.code(404).send({ ok: false, error: "Câmera não encontrada" });
    if (!config.ptzEnabled) return reply.code(400).send({ ok: false, error: "PTZ não habilitado nessa câmera" });
    const body = (request.body as Record<string, unknown>) ?? {};
    const action = body.action as PtzAction | undefined;
    const valid: PtzAction[] = ["up", "down", "left", "right", "zoom_in", "zoom_out", "stop"];
    if (!action || !valid.includes(action)) {
      return reply.code(400).send({ ok: false, error: "action inválida" });
    }
    try {
      await sendPtz(config, action);
      return { ok: true };
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
