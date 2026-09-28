import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../testUtils.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  try { await app.close(); } catch {}
});

describe("GET /api/android/setup", () => {
  it("retorna página HTML com link do APK e host/porta", async () => {
    const r = await app.inject({ method: "GET", url: "/api/android/setup?host=192.168.1.20&port=8787" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/html");
    expect(r.payload).toContain("/api/android/apk");
    expect(r.payload).toContain("192.168.1.20");
    expect(r.payload).toContain("8787");
  });

  it("escapa host malicioso (sem XSS)", async () => {
    const r = await app.inject({ method: "GET", url: "/api/android/setup?host=%3Cscript%3Ealert(1)" });
    expect(r.statusCode).toBe(200);
    expect(r.payload).not.toContain("<script>alert");
    expect(r.payload).toContain("&lt;script&gt;");
  });
});

describe("GET /api/android/apk", () => {
  it("serve o APK local ou redireciona ao GitHub", async () => {
    const r = await app.inject({ method: "GET", url: "/api/android/apk" });
    expect([200, 302]).toContain(r.statusCode);
    if (r.statusCode === 200) {
      expect(String(r.headers["content-type"])).toContain("android.package-archive");
      expect(String(r.headers["content-disposition"])).toContain("vigia-monitor.apk");
    } else {
      expect(String(r.headers.location)).toContain("github.com");
    }
  });
});
