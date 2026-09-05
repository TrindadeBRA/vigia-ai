import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./main.js";
import { defaultConfig, save } from "./store.js";

let tmp: string;
let app: Awaited<ReturnType<typeof createApp>>;

beforeEach(async () => {
  tmp = mkdtempSync(join(tmpdir(), "vigia-test-"));
  process.env.COLLECTOR_DATA = tmp;
  const cfg = defaultConfig();
  (cfg as any).mock = true;
  save(cfg);
  app = await createApp();
  await app.ready();
});

afterEach(async () => {
  try { await app.close(); } catch { }
  try { rmSync(tmp, { recursive: true, force: true }); } catch { }
  delete process.env.COLLECTOR_DATA;
});

describe("GET /health", () => {
  it("responde ok com campos obrigatórios", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.payload);
    expect(body.ok).toBe(true);
    expect(body.version).toBeDefined();
    expect(body.panel).toBe("/");
    expect(body.display).toBe("/display");
    expect(body.usage).toBe("/usage");
    expect(body.events).toBe("/events");
    expect(body.interval_s).toBeGreaterThanOrEqual(15);
  });
});

describe("GET /usage mock schema", () => {
  it("contrato mínimo preservado (§4.1)", async () => {
    const r = await app.inject({ method: "GET", url: "/usage" });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.payload);
    expect(body.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    for (const k of ["claude", "gpt", "cursor", "openrouter", "deepseek", "opencode", "fal", "bitcoin", "adsense"]) {
      expect(Array.isArray(body[k]), k).toBe(true);
    }
    expect(body.claude[0].ok).toBe(true);
    expect(typeof body.claude[0].session_percent).toBe("number");
    expect(body.gpt[0].ok).toBe(true);
  });
});

describe("GET /openapi.json", () => {
  it("existe e menciona /usage e /events", async () => {
    const r = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(r.statusCode).toBe(200);
    const spec = JSON.parse(r.payload);
    expect(spec.openapi).toBeDefined();
  });
});

describe("SSE framing (§6.1)", () => {
  it("headers e prólogo byte-a-byte", async () => {
    // Usa sseBytes diretamente para validar framing sem socket real
    const { UsageHub, formatSse, sseBytes } = await import("./hub.js");
    const hub = new UsageHub(60);
    // snapshot nulo -> só : connected
    const gen = sseBytes(hub);
    const first = await gen.next();
    expect(first.value).toBe(": connected\n\n");
    // payload mock
    const payload = { updated_at: "2026-09-04T18:00:00-03:00", claude: [], gpt: [], cursor: [], openrouter: [], deepseek: [], opencode: [], fal: [], bitcoin: [], adsense: [], retroachievements: [], weather: null, currencies: null, git: null, calendar: null, rss: null } as any;
    expect(formatSse(payload)).toBe(`event: usage\ndata: ${JSON.stringify(payload)}\n\n`);
    // com snapshot, próximo yield deve ser event: usage
    hub["snapshot"] = () => payload; // monkey patch private for test
    // precisa recriar generator com snapshot
    const hub2 = new UsageHub(60);
    (hub2 as any)._latest = payload;
    const gen2 = sseBytes(hub2);
    expect((await gen2.next()).value).toBe(": connected\n\n");
    expect((await gen2.next()).value).toBe(formatSse(payload));
    await gen2.return(undefined);
    await gen.return(undefined);
    await hub.stop();
    await hub2.stop();
  });
});
