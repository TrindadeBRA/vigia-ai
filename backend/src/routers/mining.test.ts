import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../testUtils.js";

describe("mining router", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("has a disabled default config", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/api/mining/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      enabled: false,
      poolUrl: "public-pool.io",
      poolPort: 3333,
      btcWallet: "",
      workerName: "",
    });
  });

  it("saves a partial config patch", async () => {
    app = await createTestApp();
    const put = await app.inject({
      method: "PUT",
      url: "/api/mining/config",
      payload: { enabled: true, btcWallet: "bc1qexample" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().config).toMatchObject({ enabled: true, btcWallet: "bc1qexample" });

    const get = await app.inject({ method: "GET", url: "/api/mining/config" });
    expect(get.json()).toMatchObject({
      enabled: true,
      btcWallet: "bc1qexample",
      poolUrl: "public-pool.io",
    });
  });

  it("rejects an invalid config patch", async () => {
    app = await createTestApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/mining/config",
      payload: { poolPort: "not a number" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("has no report before the device sends one", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/api/mining/status" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("idle");
    expect(body.reportedAt).toBeNull();
    expect(body.stale).toBe(true);
  });

  it("roundtrips a report from the device", async () => {
    app = await createTestApp();
    const report = {
      status: "mining",
      hashrateCurrent: 42000,
      hashrateAvg: 40000,
      sharesAccepted: 3,
      sharesRejected: 0,
      bestDifficulty: 1234,
      blockHeight: 900000,
      uptimeS: 120,
      lastError: "",
    };
    const post = await app.inject({ method: "POST", url: "/api/mining/report", payload: report });
    expect(post.statusCode).toBe(200);

    const get = await app.inject({ method: "GET", url: "/api/mining/status" });
    const body = get.json();
    expect(body).toMatchObject(report);
    expect(body.reportedAt).not.toBeNull();
    expect(body.stale).toBe(false);
  });

  it("rejects a report missing the required status field", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "POST", url: "/api/mining/report", payload: { hashrateCurrent: 1 } });
    expect(res.statusCode).toBe(400);
  });
});
