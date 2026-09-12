import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../testUtils.js";

describe("spotify router", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("GET /api/spotify sem login devolve configured=false", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/api/spotify" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, configured: false, track: null });
  });

  it("GET /api/spotify/cover sem login devolve 404", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/api/spotify/cover?size=48" });
    expect(res.statusCode).toBe(404);
    expect(res.json().ok).toBe(false);
  });

  it("POST /api/spotify/play sem login devolve erro amigável", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "POST", url: "/api/spotify/play" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false });
    expect(String(res.json().error)).toMatch(/conecte/i);
  });
});
