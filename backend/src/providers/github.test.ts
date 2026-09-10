import { describe, expect, it } from "vitest";
import { describeGithubError, describeGithubHttpError, githubSectionFlags } from "./github.js";

describe("githubSectionFlags", () => {
  it("config antiga (só enabled) liga os dois", () => {
    expect(githubSectionFlags({ enabled: true, hidden: false })).toEqual({ repos: true, profiles: true });
    expect(githubSectionFlags({ enabled: false, hidden: true })).toEqual({ repos: false, profiles: false });
  });

  it("toggles novos são independentes", () => {
    expect(githubSectionFlags({ enabled: true, hidden: false, reposEnabled: true, profilesEnabled: false }))
      .toEqual({ repos: true, profiles: false });
    expect(githubSectionFlags({ enabled: true, hidden: false, reposEnabled: false, profilesEnabled: true }))
      .toEqual({ repos: false, profiles: true });
  });
});

describe("describeGithubError", () => {
  it("traduz TypeError fetch failed com ENOTFOUND", () => {
    const err = new TypeError("fetch failed");
    (err as Error & { cause: Error }).cause = Object.assign(new Error("getaddrinfo ENOTFOUND api.github.com"), { code: "ENOTFOUND" });
    expect(describeGithubError(err)).toBe("Não foi possível conectar ao GitHub");
  });

  it("traduz timeout", () => {
    const err = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    expect(describeGithubError(err)).toBe("O GitHub demorou demais para responder");
  });

  it("não deixa TypeError: fetch failed vazar cru", () => {
    expect(describeGithubError(new TypeError("fetch failed"))).toBe("Não foi possível conectar ao GitHub");
  });
});

describe("describeGithubHttpError", () => {
  it("mapeia 404/429/5xx", () => {
    expect(describeGithubHttpError(404, "repo")).toBe("Repositório não encontrado");
    expect(describeGithubHttpError(404, "user")).toBe("Usuário não encontrado");
    expect(describeGithubHttpError(429)).toMatch(/Limite de requisições/);
    expect(describeGithubHttpError(503)).toBe("O GitHub está indisponível no momento");
  });
});
