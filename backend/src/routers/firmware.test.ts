import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { parseSecretsH, renderSecretsH } from "../firmware.js";
import { load } from "../store.js";
import { createTestApp } from "../testUtils.js";

describe("secrets.h", () => {
  it("round-trips ssid, password and usage url", () => {
    const src = renderSecretsH('casa "norte"', "p\\ass", "http://10.0.0.2:8787/usage");
    const parsed = parseSecretsH(src);
    expect(parsed.ssid).toBe('casa "norte"');
    expect(parsed.password).toBe("p\\ass");
    expect(parsed.usageUrl).toBe("http://10.0.0.2:8787/usage");
  });
});

describe("firmware router", () => {
  let app: FastifyInstance;
  const prevDir = process.env.VIGIA_FIRMWARE_DIR;

  afterEach(async () => {
    await app?.close();
    if (prevDir === undefined) delete process.env.VIGIA_FIRMWARE_DIR;
    else process.env.VIGIA_FIRMWARE_DIR = prevDir;
  });

  it("GET /api/firmware devolve SSID e senha da Wi-Fi já gravados", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vigia-fw-"));
    process.env.VIGIA_FIRMWARE_DIR = dir;
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "platformio.ini"), "[env]\n");
    app = await createTestApp((cfg) => {
      cfg.firmware = { wifi_ssid: "MinhaRede", wifi_password: "segredo-wifi" };
    });
    const r = await app.inject({ method: "GET", url: "/api/firmware" });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.wifi_ssid).toBe("MinhaRede");
    expect(body.wifi_password).toBe("segredo-wifi");
    expect(body.wifi_password_set).toBe(true);
    expect(body.can_write).toBe(true);
  });

  it("PUT grava secrets.h no checkout e guarda a senha só no config.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vigia-fw-"));
    process.env.VIGIA_FIRMWARE_DIR = dir;
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "platformio.ini"), "[env]\n");
    app = await createTestApp();
    const put = await app.inject({
      method: "PUT",
      url: "/api/firmware",
      payload: { wifi_ssid: "RedeCasa", wifi_password: "senha-12345" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().ok).toBe(true);
    expect(put.json().wrote_secrets).toBe(true);
    expect(put.json().firmware.wifi_password).toBe("senha-12345");
    const file = readFileSync(join(dir, "src", "secrets.h"), "utf8");
    expect(file).toContain('#define WIFI_SSID "RedeCasa"');
    expect(file).toContain('#define WIFI_PASSWORD "senha-12345"');
    expect(file).toContain("#define USAGE_URL");
    const cfg = load() as Record<string, Record<string, string>>;
    expect(cfg.firmware.wifi_password).toBe("senha-12345");
  });

  it("POST /api/firmware/file devolve o arquivo com a senha só nessa resposta", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vigia-fw-"));
    process.env.VIGIA_FIRMWARE_DIR = dir;
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "platformio.ini"), "[env]\n");
    app = await createTestApp();
    const r = await app.inject({
      method: "POST",
      url: "/api/firmware/file",
      payload: { wifi_ssid: "X", wifi_password: "abc" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/plain/);
    expect(r.payload).toContain('#define WIFI_PASSWORD "abc"');
  });

  it("POST flash sem árvore do firmware falha em JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vigia-fw-empty-"));
    process.env.VIGIA_FIRMWARE_DIR = dir;
    app = await createTestApp();
    const r = await app.inject({
      method: "POST",
      url: "/api/firmware/flash",
      payload: { wifi_ssid: "X", wifi_password: "abc" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().ok).toBe(false);
    expect(String(r.json().error)).toMatch(/firmware|Docker|PlatformIO|pio|checkout/i);
  });
});
