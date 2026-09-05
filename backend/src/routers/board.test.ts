import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../testUtils.js";

describe("board router", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("is empty by default", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/api/board" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });

  it("roundtrips a board payload", async () => {
    app = await createTestApp();
    const payload = { boards: { "8": { size: { "claude:local": "md" }, pos: { "claude:local": { r: 0, c: 0 } } } } };
    const put = await app.inject({ method: "PUT", url: "/api/board", payload });
    expect(put.statusCode).toBe(200);
    expect(put.json().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/board" });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual(payload);
  });

  it("rejects invalid JSON", async () => {
    app = await createTestApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/board",
      payload: "not json",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("delete clears the board", async () => {
    app = await createTestApp();
    await app.inject({ method: "PUT", url: "/api/board", payload: { boards: { "4": { size: {}, pos: {} } } } });
    const del = await app.inject({ method: "DELETE", url: "/api/board" });
    expect(del.statusCode).toBe(200);
    const get = await app.inject({ method: "GET", url: "/api/board" });
    expect(get.json()).toEqual({});
  });
});
