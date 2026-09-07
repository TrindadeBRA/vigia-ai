import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { dataDir } from "../config.js";
import {
  CameraConfigPatchSchema,
  CameraConfigSchema,
  type CameraConfig,
} from "../schemas/camera.js";

function cameraPath(): string {
  return join(dataDir(), "camera.json");
}

function load(): CameraConfig {
  const p = cameraPath();
  if (!existsSync(p)) return CameraConfigSchema.parse({});
  try {
    return CameraConfigSchema.parse(JSON.parse(readFileSync(p, "utf-8")));
  } catch {
    return CameraConfigSchema.parse({});
  }
}

function save(config: CameraConfig): void {
  mkdirSync(dataDir(), { recursive: true });
  const p = cameraPath();
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", "utf-8");
  renameSync(tmp, p);
}

function toPublic(config: CameraConfig) {
  const { password, ...rest } = config;
  return { ...rest, configured: Boolean(config.host.trim() && password.trim()) };
}

function rtspUrl(config: CameraConfig): string {
  const user = encodeURIComponent(config.username);
  const pass = encodeURIComponent(config.password);
  const path = config.path.replace(/^\/+/, "");
  return `rtsp://${user}:${pass}@${config.host}:${config.port}/${path}`;
}

// Cache curto: o board pode ter várias abas/instâncias pollando o mesmo
// snapshot — sem isso cada poll dispararia um ffmpeg novo (processo pesado,
// ~1-2s pra conectar + decodificar o primeiro keyframe H.265).
const SNAPSHOT_TTL_MS = 2000;
const SNAPSHOT_TIMEOUT_MS = 8000;
let cache: { at: number; jpeg: Buffer } | null = null;
let inFlight: Promise<Buffer> | null = null;

function grabSnapshot(config: CameraConfig): Promise<Buffer> {
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
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-",
    ];
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
const EOI = Buffer.from([0xff, 0xd9]);

// Vídeo ao vivo: mantém um ffmpeg rodando por conexão, decodificando o RTSP
// contínuo e escrevendo cada JPEG como uma parte de um multipart/x-mixed-replace
// — <img src="/api/camera/stream"> no browser já entende esse formato nativamente,
// sem precisar de player/WebRTC. Downscale + fps baixo pra caber num card do board
// sem pesar demais na CPU do coletor (um processo ffmpeg por viewer conectado).
function startStream(config: CameraConfig, onFrame: (jpeg: Buffer) => void, onEnd: (err: Error | null) => void): () => void {
  const url = rtspUrl(config);
  const args = [
    "-rtsp_transport", "udp",
    "-timeout", "8000000",
    "-i", url,
    "-an",
    "-vf", "scale=640:-2",
    "-r", "10",
    "-q:v", "6",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-",
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let buf = Buffer.alloc(0);
  let stderr = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const start = buf.indexOf(SOI);
      if (start === -1) { buf = Buffer.alloc(0); break; }
      const end = buf.indexOf(EOI, start + 2);
      if (end === -1) {
        if (start > 0) buf = buf.subarray(start);
        break;
      }
      onFrame(buf.subarray(start, end + 2));
      buf = buf.subarray(end + 2);
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

export async function createCameraRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/camera/config", async () => toPublic(load()));

  app.put("/api/camera/config", async (request, reply) => {
    const parsed = CameraConfigPatchSchema.safeParse((request.body as Record<string, unknown>) ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const next = CameraConfigSchema.parse({ ...load(), ...parsed.data });
    save(next);
    cache = null;
    return { ok: true, config: toPublic(next) };
  });

  app.get("/api/camera/snapshot", async (request, reply) => {
    const config = load();
    if (!config.host.trim()) {
      return reply.code(400).send({ ok: false, error: "Câmera não configurada — preencha o IP em Configurações." });
    }
    const now = Date.now();
    if (cache && now - cache.at < SNAPSHOT_TTL_MS) {
      return reply.type("image/jpeg").send(cache.jpeg);
    }
    try {
      if (!inFlight) {
        inFlight = grabSnapshot(config).finally(() => { inFlight = null; });
      }
      const jpeg = await inFlight;
      cache = { at: Date.now(), jpeg };
      return reply.type("image/jpeg").send(jpeg);
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/camera/stream", async (request, reply) => {
    const config = load();
    if (!config.host.trim()) {
      return reply.code(400).send({ ok: false, error: "Câmera não configurada — preencha o IP em Configurações." });
    }
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": `multipart/x-mixed-replace; boundary=${STREAM_BOUNDARY}`,
      "Cache-Control": "no-store",
      Connection: "close",
    });
    let ended = false;
    const stop = startStream(
      config,
      (jpeg) => {
        if (ended || res.destroyed) return;
        res.write(`--${STREAM_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
        res.write(jpeg);
        res.write("\r\n");
      },
      () => {
        if (ended) return;
        ended = true;
        res.end();
      },
    );
    request.raw.on("close", () => {
      ended = true;
      stop();
    });
  });
}
