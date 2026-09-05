import type { FastifyInstance } from "fastify";
import { VERSION } from "../version.js";
import { panelLanUrl } from "../netutil.js";
import { formatSse, sseBytes } from "../hub.js";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function createUsageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (request, reply) => {
    const hub = (app as unknown as { hub?: { seconds: number } }).hub;
    const listenHost = (app as unknown as { listenHost?: string }).listenHost ?? "0.0.0.0";
    const listenPort = (app as unknown as { listenPort?: number }).listenPort ?? 8787;
    const intervalS = hub?.seconds ?? 60;
    return {
      ok: true,
      version: VERSION,
      panel: "/",
      panel_lan: panelLanUrl(listenPort),
      display: "/display",
      usage: "/usage",
      events: "/events",
      docs: "/docs",
      listen: { host: listenHost, port: listenPort },
      interval_s: intervalS,
    };
  });

  app.get("/usage", async (request, reply) => {
    const hub = (app as unknown as { hub?: { refresh: (opts: unknown) => Promise<unknown>; noteDevice: (ip: string | null, screen: string | null) => void } }).hub;
    // note device via headers
    const device = (request.headers["x-vigia-device"] as string | undefined) ?? (request.headers["X-Vigia-Device"] as string | undefined);
    if (device === "esp32" && hub) {
      const ip = request.ip;
      const screen = (request.headers["x-vigia-screen"] as string | undefined) ?? (request.headers["x-vigia-screen"] as string | undefined) ?? null;
      // Fastify lowercases headers, so check case-insensitive
      const screenHeader = (request.headers["x-vigia-screen"] as string | undefined) ?? null;
      hub.noteDevice(ip, screenHeader);
    }
    if (!hub) return reply.code(503).send({ ok: false, error: "hub not ready" });
    const payload = await hub.refresh({ forceQuota: true });
    return payload;
  });

  app.get("/events", async (request, reply) => {
    const hub = (app as unknown as { hub?: InstanceType<typeof import("../hub.js").UsageHub> }).hub;
    if (!hub) return reply.code(503).send({ ok: false, error: "hub not ready" });
    const device = (request.headers["x-vigia-device"] as string | undefined);
    if (device === "esp32") {
      const ip = request.ip;
      const screen = (request.headers["x-vigia-screen"] as string | undefined) ?? null;
      hub.noteDevice(ip, screen);
    }

    // hijack raw response for SSE
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, SSE_HEADERS);
    // ensure flush if available
    if (typeof (raw as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
      try { (raw as unknown as { flushHeaders: () => void }).flushHeaders(); } catch {}
    }

    // stream via generator
    const gen = sseBytes(hub);
    let closed = false;
    const onClose = () => { closed = true; };
    raw.on("close", onClose);
    raw.on("error", onClose);
    try {
      for await (const chunk of gen) {
        if (closed) break;
        if (!raw.writableEnded && !raw.destroyed) {
          raw.write(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array));
        } else break;
      }
    } catch {
      // ignore
    } finally {
      raw.off("close", onClose);
      try { raw.end(); } catch {}
    }
  });
}
