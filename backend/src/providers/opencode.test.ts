import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../httpClient.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../httpClient.js")>();
  return { ...actual, httpJson: vi.fn() };
});

vi.mock("../local/opencodeAuth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../local/opencodeAuth.js")>();
  return { ...actual, opencodeTokenCandidates: vi.fn() };
});

import { httpJson } from "../httpClient.js";
import { opencodeTokenCandidates } from "../local/opencodeAuth.js";
import { fetchOpencodeAccounts } from "./opencode.js";

const mockedHttpJson = vi.mocked(httpJson);
const mockedLocal = vi.mocked(opencodeTokenCandidates);

const KEY = "sk-opencode-testkey";

function cfg(partial: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    providers: {
      opencode: {
        hidden: false,
        local_label: "",
        paste_secret: "",
        accounts: [],
        ...partial,
      },
    },
  };
}

beforeEach(() => {
  mockedHttpJson.mockReset();
  mockedLocal.mockReset();
  mockedLocal.mockReturnValue([]);
  mockedHttpJson.mockImplementation(async (url: string) => {
    if (String(url).includes("/go/")) {
      return {
        usage: {
          rolling: { percent: 10, resetsAt: "2026-09-05T00:00:00Z" },
          weekly: { percent: 5, resetsAt: null },
          monthly: { percent: 2, resetsAt: null },
        },
      };
    }
    return { remaining_cents: 1500 };
  });
});

describe("fetchOpencodeAccounts", () => {
  it("hidden esconde local, key colada e extras", async () => {
    mockedLocal.mockReturnValue([["auth", KEY]]);
    const accounts = await fetchOpencodeAccounts(
      cfg({ hidden: true, paste_secret: KEY, accounts: [{ id: "extra", label: "Empresa", secret: KEY }] }),
    );
    expect(accounts).toEqual([]);
    expect(mockedHttpJson).not.toHaveBeenCalled();
  });

  it("não duplica auth.json + a mesma key colada", async () => {
    mockedLocal.mockReturnValue([["auth", KEY]]);
    const accounts = await fetchOpencodeAccounts(cfg({ paste_secret: KEY }));
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("local");
  });

  it("key colada vira um card só quando não há login local", async () => {
    const accounts = await fetchOpencodeAccounts(cfg({ paste_secret: KEY }));
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("legacy");
    expect(accounts[0].ok).toBe(true);
  });

  it("pula extra com a mesma key do login local", async () => {
    mockedLocal.mockReturnValue([["auth", KEY]]);
    const accounts = await fetchOpencodeAccounts(
      cfg({ accounts: [{ id: "dup", label: "Mesma", secret: KEY }] }),
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("local");
  });
});
