import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock node:os before importing modules that use platform/homedir
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, platform: vi.fn(() => "darwin"), homedir: vi.fn(() => actual.homedir()), networkInterfaces: vi.fn(actual.networkInterfaces) };
});
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});

import * as os from "node:os";
import * as childProcess from "node:child_process";
import * as claudeOauth from "./claudeOauth.js";
import * as cursorState from "./cursorState.js";
import * as gptOauth from "./gptOauth.js";

let tmpDirs: string[] = [];

function makeTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "vigia-plat-"));
  tmpDirs.push(d);
  return d;
}

beforeEach(() => {
  vi.mocked(os.platform).mockReset();
  vi.mocked(os.platform).mockReturnValue("darwin" as NodeJS.Platform);
  // reset homedir to real
  const realOs = awaitRealHomedir();
  vi.mocked(os.homedir).mockReturnValue(realOs);
  // reset claude cache
  claudeOauth._resetClaudeOauthCache();
  cursorState._resetCursorStateCache();
  vi.mocked(childProcess.spawnSync).mockReset();
  delete process.env.CLAUDE_CREDENTIALS_PATH;
  delete process.env.CURSOR_STATE_DB;
  delete process.env.APPDATA;
  delete process.env.CODEX_AUTH_PATH;
  delete process.env.CODEX_HOME;
});

function awaitRealHomedir(): string {
  // get real homedir without mock (call original via require)
  // vitest mock preserves actual.homedir reference
  const orig = (os.homedir as unknown as { _orig?: () => string });
  // fallback: use tmpdir's parent? but we stored real before mock
  // Instead, use process.env.HOME
  return process.env.HOME || "/tmp";
}

afterEach(() => {
  for (const d of tmpDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  tmpDirs = [];
  vi.mocked(childProcess.spawnSync).mockReset();
  delete process.env.CLAUDE_CREDENTIALS_PATH;
  delete process.env.CURSOR_STATE_DB;
  delete process.env.APPDATA;
  delete process.env.CODEX_AUTH_PATH;
  delete process.env.CODEX_HOME;
  claudeOauth._resetClaudeOauthCache();
  cursorState._resetCursorStateCache();
});

describe("claude keychain fora do macOS", () => {
  it.each(["win32", "linux"] as const)("não quebra em %s", (plat) => {
    vi.mocked(os.platform).mockReturnValue(plat as NodeJS.Platform);
    vi.mocked(childProcess.spawnSync).mockImplementation(() => {
      throw new Error("não pode chamar `security` fora do macOS");
    });
    expect(claudeOauth.fromMacosKeychain()).toEqual([null, null, null]);
  });

  it("candidatos usam arquivo fora do macOS", () => {
    vi.mocked(os.platform).mockReturnValue("win32" as NodeJS.Platform);
    const tmp = makeTmp();
    const creds = join(tmp, ".credentials.json");
    writeFileSync(creds, JSON.stringify({ claudeAiOauth: { accessToken: "tok-abc", expiresAt: 9999999999000 } }));
    process.env.CLAUDE_CREDENTIALS_PATH = creds;

    const found = claudeOauth.claudeTokenCandidates();
    expect(found.map(([src, tok]) => [src, tok])).toEqual([["credentials", "tok-abc"]]);
  });

  it("hint sem login específico por plataforma", () => {
    const tmp = makeTmp();
    const fakePath = join(tmp, ".credentials.json");
    process.env.CLAUDE_CREDENTIALS_PATH = fakePath;

    vi.mocked(os.platform).mockReturnValue("linux" as NodeJS.Platform);
    claudeOauth._resetClaudeOauthCache();
    const hintLinux = claudeOauth.missingLoginHint();
    expect(hintLinux).not.toContain("Mac");
    expect(hintLinux).toContain(tmp);

    vi.mocked(os.platform).mockReturnValue("darwin" as NodeJS.Platform);
    claudeOauth._resetClaudeOauthCache();
    const hintDarwin = claudeOauth.missingLoginHint();
    expect(hintDarwin).toContain("Mac");
  });
});

describe("state.vscdb caminhos por plataforma", () => {
  it.each([
    ["darwin", join("Library", "Application Support")],
    ["linux", ".config"],
    ["win32", "AppData"],
  ] as const)("prioriza caminho do SO %s", (plat, trecho) => {
    vi.mocked(os.platform).mockReturnValue(plat as NodeJS.Platform);
    const tmp = makeTmp();
    vi.mocked(os.homedir).mockReturnValue(tmp);

    const candidates = cursorState.stateDbCandidates();
    expect(candidates[0]).toContain(trecho);
    expect(cursorState.stateDbPath()).toContain(trecho);
  });

  it("respeita APPDATA no Windows", () => {
    vi.mocked(os.platform).mockReturnValue("win32" as NodeJS.Platform);
    const tmp = makeTmp();
    const roaming = join(tmp, "Roaming");
    process.env.APPDATA = roaming;
    vi.mocked(os.homedir).mockReturnValue(tmp);

    const first = cursorState.stateDbCandidates()[0];
    expect(first).toBe(join(roaming, "Cursor", "User", "globalStorage", "state.vscdb"));
  });
});

describe("codex auth.json cross-platform", () => {
  it("é cross platform", () => {
    const tmp = makeTmp();
    vi.mocked(os.homedir).mockReturnValue(tmp);
    expect(gptOauth.authPath()).toBe(join(tmp, ".codex", "auth.json"));
  });
});
