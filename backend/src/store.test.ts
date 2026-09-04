import { describe, it, expect } from "vitest";
import { defaultConfig, migrateLegacy } from "./store.js";

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
  });
});
