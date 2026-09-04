import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { STATUS_CODES } from "node:http";
import { VERSION } from "./version.js";
import { lanIPv4 } from "./netutil.js";
import { load } from "./store.js";
import { createUsageRoutes } from "./routers/usage.js";
import { createConfigRoutes } from "./routers/config.js";
import { createAdsenseRoutes } from "./routers/adsense.js";
import { createThemeRoutes } from "./routers/theme.js";
import { createBoardRoutes } from "./routers/board.js";
import { createAlarmsRoutes } from "./alarms/router.js";
import { createTelegramRoutes } from "./telegram/router.js";
import { createWallpapersRoutes } from "./routers/wallpapers/router.js";
import { createWeatherRoutes } from "./routers/weather.js";
import { createCurrenciesRoutes } from "./routers/currencies.js";
import { UsageHub } from "./hub.js";
import { AlarmEngine } from "./alarms/engine.js";
import { TelegramPoller } from "./telegram/poller.js";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function frontendDist(): string | null {
  const override = (process.env.VIGIA_FRONTEND_DIST || "").trim();
  if (override) {
    const p = resolve(override.replace(/^~/, process.env.HOME || ""));
    if (existsSync(p) && statSync(p).isDirectory()) return p;
    return null;
  }
  // ../../frontend/dist relative to backend/dist
  const here = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));
  const dist = join(here, "frontend", "dist");
  if (existsSync(dist) && statSync(dist).isDirectory()) return dist;
  // when running via tsx, src is backend/src
  const srcHere = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));
  const alt = join(srcHere, "frontend", "dist");
  if (existsSync(alt) && statSync(alt).isDirectory()) return alt;
  return null;
}

export async function createApp() {
  const cfg = load();
  const host = process.env.HOST || String((cfg.listen as any)?.host || "0.0.0.0");
  const port = parseInt(process.env.PORT || String((cfg.listen as any)?.port || 8787), 10);

  const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
  const fastify = Fastify({
    logger: isTest ? false : { level: process.env.VIGIA_LOG_LEVEL || "info" },
    disableRequestLogging: !isTest,
    // Expor req.ip corretamente atrás de proxy/dev
    trustProxy: true,
  });

  await fastify.register(multipart, {
    limits: { fileSize: 15_000_000, files: 1 },
  });

  // FastAPI/Starlette liam o corpo cru independente do Content-Type; os
  // parsers padrão do Fastify só cobrem json e (via plugin) multipart, e
  // rejeitam qualquer outro tipo com 415 antes de chegar no handler. O
  // catch-all abaixo devolve Buffer bruto pros routers que fazem upload de
  // bytes (wallpapers RAW, theme, board) — mesma permissividade do Python.
  fastify.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });

  // Log de acesso no mesmo padrão do UPDATE (magenta) porém em verde — visível no ./dev up
  if (!isTest) {
    const GREEN = "\x1b[32m";
    const RESET = "\x1b[0m";
    const USE_COLOR = Boolean(process.stdout.isTTY);
    const PREFIX_WIDTH = 21;
    function requestPrefix(method: string): string {
      const prefix = `REQUEST - ${method}:`.padEnd(PREFIX_WIDTH, " ");
      return USE_COLOR ? `${GREEN}${prefix}${RESET}` : prefix;
    }
    fastify.addHook("onRequest", (request, _reply, done) => {
      (request as unknown as Record<string, unknown>).__startTime = performance.now();
      done();
    });
    fastify.addHook("onResponse", (request, reply, done) => {
      const ip = (request as unknown as { ip?: string }).ip ?? request.socket?.remoteAddress ?? "-";
      const port = request.socket?.remotePort ? `:${request.socket.remotePort}` : "";
      const start = (request as unknown as Record<string, unknown>).__startTime as number | undefined;
      const elapsedMs = start ? performance.now() - start : 0;
      const reason = (STATUS_CODES as Record<number, string>)[reply.statusCode] ?? "";
      const prefix = requestPrefix(request.method);
      const requestLine = `"${request.method} ${request.url} HTTP/1.1"`;
      // Mesmo formato do httpClient: prefix + host - requestLine status reason (elapsed)
      console.log(`${prefix}${ip}${port} - ${requestLine} ${reply.statusCode} ${reason} (${elapsedMs.toFixed(0)}ms)`);
      done();
    });
  }

  // SSE-aware headers: /events keep-alive, others close+no-store
  fastify.addHook("onSend", async (request, reply, payload) => {
    const path = request.url.split("?")[0].replace(/\/$/, "") || "/";
    if (path.endsWith("/events")) {
      reply.header("Content-Type", "text/event-stream");
      reply.header("Connection", "keep-alive");
      reply.header("Cache-Control", "no-cache");
      reply.header("X-Accel-Buffering", "no");
    } else {
      reply.header("Connection", "close");
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  const alarmEngine = new AlarmEngine();
  const hub = new UsageHub(undefined, (p: Record<string, unknown>) => alarmEngine.handlePayload(p));
  const telegramPoller = new TelegramPoller();

  (fastify as any).hub = hub;
  (fastify as any).telegramPoller = telegramPoller;
  (fastify as any).listenHost = host;
  (fastify as any).listenPort = port;

  await hub.start();
  await telegramPoller.start();

  fastify.addHook("onClose", async () => {
    await telegramPoller.stop();
    await hub.stop();
  });

  // OpenAPI / docs placeholder (fastify swagger could be added later)
  fastify.get("/openapi.json", async () => {
    return { openapi: "3.0.0", info: { title: "Vigia AI", version: VERSION } };
  });

  await fastify.register(createUsageRoutes, { prefix: "" });
  await fastify.register(createConfigRoutes, { prefix: "" });
  await fastify.register(createAdsenseRoutes, { prefix: "" });
  await fastify.register(createThemeRoutes, { prefix: "" });
  await fastify.register(createBoardRoutes, { prefix: "" });
  await fastify.register(createAlarmsRoutes, { prefix: "" });
  await fastify.register(createTelegramRoutes, { prefix: "" });
  await fastify.register(createWallpapersRoutes, { prefix: "" });
  await fastify.register(createWeatherRoutes, { prefix: "" });
  await fastify.register(createCurrenciesRoutes, { prefix: "" });

  const dist = frontendDist();
  if (dist) {
    const sendFile = (reply: any, file: string, ct?: string) => {
      const p = resolve(join(dist, file));
      if (!existsSync(p) || !statSync(p).isFile()) return reply.code(404).send({ ok: false, error: "not found" });
      const data = readFileSync(p);
      if (ct) reply.header("Content-Type", ct);
      else if (file.endsWith(".js")) reply.header("Content-Type", "application/javascript");
      else if (file.endsWith(".css")) reply.header("Content-Type", "text/css");
      else if (file.endsWith(".html")) reply.header("Content-Type", "text/html");
      else if (file.endsWith(".webmanifest")) reply.header("Content-Type", "application/manifest+json");
      return reply.send(data);
    };
    const serveIndex = (_req: any, reply: any) => {
      const p = join(dist, "index.html");
      if (!existsSync(p)) return reply.code(404).send({ ok: false, error: "not found" });
      const data = readFileSync(p);
      reply.header("Content-Type", "text/html");
      return reply.send(data);
    };
    fastify.get("/", serveIndex);
    fastify.get("/setup", serveIndex);
    fastify.get("/setup/", serveIndex);
    fastify.get("/display", serveIndex);
    fastify.get("/display/", serveIndex);
    fastify.get("/display/config", serveIndex);
    fastify.get("/display/config/", serveIndex);
    fastify.get("/display/setup", serveIndex);
    fastify.get("/display/setup/", serveIndex);
    fastify.get("/assets/*", async (req: any, reply: any) => {
      const path = (req.params as any)["*"] ? `assets/${(req.params as any)["*"]}` : req.url.slice(1).split("?")[0];
      const p = resolve(join(dist, path));
      const root = resolve(dist);
      if (!p.startsWith(root) || !existsSync(p) || !statSync(p).isFile()) return reply.code(404).send({ ok: false, error: "not found" });
      const data = readFileSync(p);
      if (path.endsWith(".js")) reply.header("Content-Type", "application/javascript");
      else if (path.endsWith(".css")) reply.header("Content-Type", "text/css");
      return reply.send(data);
    });
    fastify.get("/icons/*", async (req: any, reply: any) => {
      const path = (req.params as any)["*"] ? `icons/${(req.params as any)["*"]}` : req.url.slice(1).split("?")[0];
      const p = resolve(join(dist, path));
      const root = resolve(dist);
      if (!p.startsWith(root) || !existsSync(p) || !statSync(p).isFile()) return reply.code(404).send({ ok: false, error: "not found" });
      return reply.send(readFileSync(p));
    });
    fastify.get("/:staticName", async (req: any, reply: any) => {
      const name: string = req.params.staticName;
      if (!name || name.includes("/") || name.includes("\\") || name === "." || name === "..") {
        return reply.code(404).send({ ok: false, error: "not found" });
      }
      const p = resolve(join(dist, name));
      const root = resolve(dist);
      if (!p.startsWith(root) || !existsSync(p) || !statSync(p).isFile()) {
        return reply.code(404).send({ ok: false, error: "not found" });
      }
      const ct = name.endsWith(".webmanifest") ? "application/manifest+json" : undefined;
      const data = readFileSync(p);
      if (ct) reply.header("Content-Type", ct);
      return reply.send(data);
    });
    fastify.setNotFoundHandler((req, reply) => {
      const path = req.url.split("?")[0];
      if (dist && (path.startsWith("/display") || ["/", "/setup", "/setup/"].includes(path))) {
        const p = join(dist, "index.html");
        if (existsSync(p)) {
          reply.header("Content-Type", "text/html");
          return reply.send(readFileSync(p));
        }
      }
      return reply.code(404).send({ ok: false, error: "not found" });
    });
  } else {
    fastify.setNotFoundHandler((_req, reply) => reply.code(404).send({ ok: false, error: "not found" }));
  }

  return fastify;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const cfg = load();
  const host = process.env.HOST || String((cfg.listen as any)?.host || "0.0.0.0");
  const port = parseInt(process.env.PORT || String((cfg.listen as any)?.port || 8787), 10);
  const hosts = ["127.0.0.1", ...lanIPv4()];
  for (const item of hosts) {
    const label = item !== "127.0.0.1" ? "  (LAN — use este em outro aparelho)" : "";
    console.log(`painel     http://${item}:${port}/display/config${label}`);
    console.log(`mostrador  http://${item}:${port}/display${label}`);
    console.log(`usage      http://${item}:${port}/usage${label}`);
    console.log(`events     http://${item}:${port}/events${label}`);
    console.log(`swagger    http://${item}:${port}/docs${label}`);
  }
  console.log(`repo ${resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."))}`);
  const app = await createApp();
  // track open SSE sockets for graceful shutdown
  const sockets = new Set<any>();
  const server: any = await app.listen({ host, port });
  // Fastify's server is accessible via app.server
  const httpServer = (app as any).server;
  if (httpServer) {
    httpServer.on("connection", (socket: any) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    for (const sig of signals) {
      process.on(sig, async () => {
        const timeout = setTimeout(() => {
          for (const s of sockets) try { s.destroy(); } catch {}
        }, 3000);
        try { await app.close(); } finally { clearTimeout(timeout); for (const s of sockets) try { s.destroy(); } catch {} process.exit(0); }
      });
    }
  }
}
