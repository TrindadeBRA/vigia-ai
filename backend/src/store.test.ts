import { describe, it, expect } from "vitest";
import { defaultConfig, migrateLegacy, _normalize, updateSync } from "./store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("migrateLegacy", () => {
  it("migrates flat env vars into the v1 shape", () => {
    const cfg = migrateLegacy({
      HOST: "0.0.0.0",
      PORT: "8787",
      COLLECTOR_MOCK: "1",
      CLAUDE_HIDDEN: "1",
      CLAUDE_LOCAL_LABEL: "Pessoal",
      CLAUDE_OAUTH_TOKEN: "secret-token-xxxx",
      CLAUDE_ACCOUNTS: '[{"id":"a1","label":"Empresa","token":"tok-emp"}]',
      OPENROUTER_API_KEY: "sk-or-v1-abc",
    }) as Record<string, any>;

    expect(cfg.version).toBe(1);
    expect(cfg.mock).toBe(true);
    expect(cfg.providers.claude.hidden).toBe(true);
    expect(cfg.providers.claude.local_label).toBe("Pessoal");
    expect(cfg.providers.claude.paste_secret).toBe("secret-token-xxxx");
    expect(cfg.providers.claude.accounts[0].id).toBe("a1");
    expect(cfg.providers.claude.accounts[0].secret).toBe("tok-emp");
    expect(cfg.providers.openrouter.paste_secret).toBe("sk-or-v1-abc");
  });
});

describe("defaultConfig", () => {
  it("includes gpt provider with empty codex_auth path", () => {
    const cfg = defaultConfig() as Record<string, any>;
    expect(cfg.providers.gpt).toBeDefined();
    expect(cfg.providers.gpt.hidden).toBe(false);
    expect(cfg.paths.codex_auth).toBe("");
    expect(cfg.firmware.wifi_ssid).toBe("");
    expect(cfg.firmware.wifi_password).toBe("");
  });
});

describe("_normalize apod", () => {
  it("preserves apod enabled/hidden and api_key from raw config", () => {
    const cfg = _normalize({
      version: 1,
      providers: {},
      apod: { enabled: true, hidden: false, api_key: "NASA-KEY-123" },
    }) as Record<string, any>;
    expect(cfg.apod.enabled).toBe(true);
    expect(cfg.apod.hidden).toBe(false);
    expect(cfg.apod.api_key).toBe("NASA-KEY-123");
  });
});

describe("updateSync apod", () => {
  it("persists apod settings through update and reload", () => {
    const dir = mkdtempSync(join(tmpdir(), "vigia-apod-"));
    const prev = process.env.VIGIA_DATA;
    process.env.VIGIA_DATA = dir;
    try {
      updateSync((cfg) => {
        const apod = (cfg.apod ?? {}) as Record<string, unknown>;
        apod.enabled = true;
        apod.hidden = false;
        apod.api_key = "my-nasa-key";
        cfg.apod = apod;
      });
      const reloaded = updateSync(() => {}) as Record<string, any>;
      expect(reloaded.apod.enabled).toBe(true);
      expect(reloaded.apod.hidden).toBe(false);
      expect(reloaded.apod.api_key).toBe("my-nasa-key");
    } finally {
      if (prev === undefined) delete process.env.VIGIA_DATA;
      else process.env.VIGIA_DATA = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
