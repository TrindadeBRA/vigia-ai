import net from "node:net";
import fs from "node:fs";
import { VERSION } from "./version.js";
import { dataDir } from "./config.js";
import { lanIPv4 } from "./netutil.js";
import { load } from "./store.js";
import { createApp } from "./main.js";

const EXIT_PORT_IN_USE = 3;
const EXIT_BIND_FAILED = 4;
const EXIT_STARTUP_FAILED = 5;

const READY_PREFIX = "VIGIA_READY ";
const ERROR_PREFIX = "VIGIA_ERROR ";

function emit(prefix: string, payload: Record<string, unknown>) {
  process.stdout.write(prefix + JSON.stringify(payload) + "\n");
}

function isParentPipe(): boolean {
  if ((process.env.VIGIA_WATCH_STDIN || "").trim() === "0") return false;
  try {
    const stat = fs.fstatSync(0);
    return stat.isFIFO() || stat.isSocket();
  } catch {
    return false;
  }
}

async function bind(host: string, port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (err: any) => {
      const msg = String(err.message || err).toLowerCase();
      const inUse = err.code === "EADDRINUSE" || msg.includes("in use") || [48, 98, 10048].includes(err.errno);
      emit(ERROR_PREFIX, {
        code: inUse ? "port_in_use" : "bind_failed",
        host,
        port,
        detail: String(err.message || err),
      });
      server.close();
      process.exit(inUse ? EXIT_PORT_IN_USE : EXIT_BIND_FAILED);
      reject(err);
    });
    server.listen(port, host, () => resolve(server));
  });
}

async function main() {
  const cfg = load();
  const host = process.env.HOST || String((cfg.listen as any)?.host || "127.0.0.1");
  const port = parseInt(process.env.PORT || String((cfg.listen as any)?.port || 8787), 10);

  const tcpServer = await bind(host, port);
  const addr = tcpServer.address() as net.AddressInfo;
  const boundHost = addr.address;
  const boundPort = addr.port;

  const app = await createApp();
  // Override listen host/port seen by /health
  (app as any).listenHost = host;
  (app as any).listenPort = boundPort;

  // Fastify listen via the already-bound server: we hijack
  // Instead of app.listen, we pass server to Fastify via http server reuse:
  // Simplest: close temp server and let Fastify bind same port quickly, but to preserve exact semantics
  // we close temp and listen via Fastify on same host/port.
  await new Promise<void>((res) => tcpServer.close(() => res()));

  let httpServer: any;
  try {
    await app.listen({ host, port: boundPort });
    httpServer = (app as any).server;
  } catch (err: any) {
    emit(ERROR_PREFIX, { code: "startup_failed", detail: String(err?.message || err) });
    process.exit(EXIT_STARTUP_FAILED);
  }

  emit(READY_PREFIX, {
    version: VERSION,
    host: boundHost,
    port: boundPort,
    lan: lanIPv4(),
    data_dir: String(dataDir()),
    pid: process.pid,
  });

  if (isParentPipe()) {
    process.stdin.resume();
    process.stdin.on("end", async () => {
      try { await app.close(); } finally { process.exit(0); }
    });
    process.stdin.on("close", async () => {
      try { await app.close(); } finally { process.exit(0); }
    });
  }

  // Track open SSE sockets for graceful shutdown (PLANO_NODE.md §6.1)
  const sockets = new Set<any>();
  if (httpServer) {
    httpServer.on("connection", (s: any) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
  }
  const shutdown = async () => {
    const t = setTimeout(() => {
      for (const s of sockets) try { s.destroy(); } catch {}
    }, 3000);
    try { await app.close(); } finally { clearTimeout(t); for (const s of sockets) try { s.destroy(); } catch {} process.exit(0); }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("desktop.js") || process.argv[1]?.endsWith("desktop.ts")) {
  main().catch((err) => {
    emit(ERROR_PREFIX, { code: "startup_failed", detail: String(err?.message || err) });
    process.exit(EXIT_STARTUP_FAILED);
  });
}
