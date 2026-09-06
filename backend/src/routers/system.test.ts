import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "../testUtils.js";

describe("system router", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("reports process health and last cycle info", async () => {
    app = await createTestApp();
    const hub = (app as unknown as { hub: { refresh: () => Promise<unknown> } }).hub;
    await hub.refresh();

    const res = await app.inject({ method: "GET", url: "/api/system" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.uptime_s).toBe("number");
    expect(typeof body.memory.rss_mb).toBe("number");
    expect(typeof body.cpu.cores).toBe("number");
    expect(body.last_cycle.ok).toBe(true);
    expect(typeof body.last_cycle.duration_ms).toBe("number");
  });
});
