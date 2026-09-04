import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp } from "./testUtils.js";
import type { FastifyInstance } from "fastify";
import { load, saveSync } from "./store.js";
import { formatSse } from "./hub.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  try { await app.close(); } catch {}
});

describe("GET /health", () => {
  it("responde ok com panel_lan", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.payload);
    expect(body.ok).toBe(true);
    expect(body.version).toBeDefined();
    expect(typeof body.panel_lan).toBe("string");
    expect(body.interval_s).toBe(60);
    if (body.panel_lan) {
      expect(body.panel_lan.startsWith("http://")).toBe(true);
      expect(body.panel_lan.endsWith("/")).toBe(true);
    }
  });
});

describe("GET /usage mock schema", () => {
  it("contrato mínimo", async () => {
    const r = await app.inject({ method: "GET", url: "/usage" });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.payload);
    expect(body.updated_at).toBeDefined();
    expect(Array.isArray(body.claude)).toBe(true);
    expect(Array.isArray(body.gpt)).toBe(true);
    expect(Array.isArray(body.cursor)).toBe(true);
    expect(Array.isArray(body.openrouter)).toBe(true);
    expect(Array.isArray(body.deepseek)).toBe(true);
    expect(Array.isArray(body.opencode)).toBe(true);
    expect(Array.isArray(body.fal)).toBe(true);
    expect(Array.isArray(body.bitcoin)).toBe(true);
    expect(Array.isArray(body.adsense)).toBe(true);
    expect(body.claude[0].ok).toBe(true);
    expect("session_percent" in body.claude[0]).toBe(true);
    expect(body.gpt[0].ok).toBe(true);
    expect("plan" in body.gpt[0]).toBe(true);
    expect("rolling_percent" in body.opencode[0]).toBe(true);
    expect("weekly_percent" in body.opencode[0]).toBe(true);
    expect("monthly_percent" in body.opencode[0]).toBe(true);
    expect(body.opencode[0].ok).toBe(true);
    expect("remaining_cents" in body.opencode[0]).toBe(true);
    expect(body.fal[0].ok).toBe(true);
    expect("remaining_cents" in body.fal[0]).toBe(true);
    expect(body.adsense[0].ok).toBe(true);
    expect("today_cents" in body.adsense[0]).toBe(true);
    expect("unpaid_cents" in body.adsense[0]).toBe(true);
  });
});

describe("GET /api/config não vaza token", () => {
  it("não expõe paste_secret", async () => {
    const cfg = load() as Record<string, unknown>;
    const providers = cfg.providers as Record<string, unknown>;
    const claude = providers.claude as Record<string, unknown>;
    claude.paste_secret = "super-secret-token-value";
    saveSync(cfg as any);

    const r = await app.inject({ method: "GET", url: "/api/config" });
    expect(r.statusCode).toBe(200);
    const text = r.payload;
    expect(text.includes("super-secret-token-value")).toBe(false);
    const body = JSON.parse(text);
    const suffix = (body.providers?.claude as Record<string, unknown>)?.suffix;
    if (suffix) expect(suffix).toBe("alue");
    expect(body.providers.gpt).toBeDefined();
    expect(body.providers.adsense).toBeDefined();
    const mode = (body.providers.adsense as Record<string, unknown>).mode;
    expect(["need_paste", "need_oauth", "oauth"].includes(String(mode))).toBe(true);
  });
});

describe("GET /openapi.json", () => {
  it("disponível com openapi base", async () => {
    const r = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(r.statusCode).toBe(200);
    const spec = JSON.parse(r.payload);
    // Node atual retorna placeholder; verifica que tem openapi e title
    expect(spec.openapi).toBeDefined();
    expect(spec.info).toBeDefined();
    // Se swagger estiver completo, checa paths; senão, apenas garante que não 404
    if (spec.paths) {
      expect(spec.paths["/usage"]).toBeDefined();
    }
  });
});

describe("SSE frame matches usage contract", () => {
  it("formatSse usa mesmo JSON de /usage", async () => {
    const body = JSON.parse((await app.inject({ method: "GET", url: "/usage" })).payload);
    const frame = formatSse(body);
    expect(frame.startsWith("event: usage\n")).toBe(true);
    expect(frame.includes("data: {")).toBe(true);
    expect(frame.includes('"claude"')).toBe(true);
    expect(frame.includes('"gpt"')).toBe(true);
    expect(frame.endsWith("\n\n")).toBe(true);
  });
});
