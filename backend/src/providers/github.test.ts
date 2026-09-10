import { describe, expect, it } from "vitest";
import { githubSectionFlags } from "./github.js";

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
