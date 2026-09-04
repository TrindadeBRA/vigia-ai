import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../config.js";

const MAX_BYTES = 262144;

function boardPath(): string {
  return join(dataDir(), "board.json");
}

export async function createBoardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/board", async (request, reply) => {
    const p = boardPath();
    if (!existsSync(p)) {
      return reply.type("application/json").send("{}");
    }
    try {
      const data = readFileSync(p);
      return reply.type("application/json").send(data);
    } catch {
      return reply.type("application/json").send("{}");
    }
  });

  app.put("/api/board", async (request, reply) => {
    const body = (request as unknown as { body?: unknown }).body ?? (await getRawBody(request));
    // Fastify may have parsed body as object; we need raw bytes
    let raw: Buffer;
    if (Buffer.isBuffer(body)) raw = body;
    else if (typeof body === "string") raw = Buffer.from(body, "utf-8");
    else if (body !== null && typeof body === "object") raw = Buffer.from(JSON.stringify(body), "utf-8");
    else raw = Buffer.alloc(0);

    // If body was JSON parsed by Fastify, we already have stringified version; but we should get raw from request.rawBody if available
    // Fallback to request.body handling above is okay for size check
    // However to preserve exact bytes, we read rawBody from request if available
    const rawFromReq = (request as unknown as { rawBody?: Buffer }).rawBody;
    if (rawFromReq && Buffer.isBuffer(rawFromReq)) raw = rawFromReq;

    if (!raw || raw.length === 0) {
      return reply.code(400).send({ ok: false, error: "corpo vazio" });
    }
    if (raw.length > MAX_BYTES) {
      return reply.code(413).send({ ok: false, error: "grade grande demais" });
    }
    try {
      JSON.parse(raw.toString("utf-8"));
    } catch (e) {
      return reply.code(400).send({ ok: false, error: "JSON inválido" });
    }
    try {
      mkdirSync(dataDir(), { recursive: true });
      writeFileSync(pickTmp(boardPath()), raw);
      // atomic rename - we wrote to tmp already? Use rename via writeFileSync tmp then rename
      // To match python's write_bytes without tmp, we already wrote directly; but do tmp+rename for safety
      // Actually we wrote to tmp via pickTmp, need to rename
      const tmp = pickTmp(boardPath());
      // if we already wrote to tmp, rename
      // If we wrote directly, adjust: write to tmp then rename
      // Simplify: write to tmp then rename
      // We already did writeFileSync(tmp) above, now rename
      const { renameSync } = await import("node:fs");
      renameSync(tmp, boardPath());
    } catch {
      // fallback direct write
      try {
        mkdirSync(dataDir(), { recursive: true });
        writeFileSync(boardPath(), raw);
      } catch (err) {
        return reply.code(500).send({ ok: false, error: String(err) });
      }
    }
    return { ok: true };
  });

  app.delete("/api/board", async () => {
    try {
      unlinkSync(boardPath());
    } catch {}
    return { ok: true };
  });
}

function pickTmp(p: string): string {
  return p + ".tmp";
}

async function getRawBody(request: unknown): Promise<Buffer> {
  const req = request as { raw?: { read?: () => Buffer } };
  return Buffer.alloc(0);
}
