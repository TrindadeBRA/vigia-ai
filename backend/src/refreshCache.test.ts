import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RefreshCache, fingerprint, FORCEABLE, TTL_S } from "./refreshCache.js";
import { HttpError } from "./httpClient.js";

describe("refreshCache", () => {
  let clockMs = 1_000_000;

  beforeEach(() => {
    clockMs = 1_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => clockMs);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function advance(s: number) {
    clockMs += s * 1000;
  }

  it("due até TTL", () => {
    const c = new RefreshCache();
    expect(c.due("adsense", { fingerprint: "a" })).toBe(true);
    c.store("adsense", [{ ok: true }], { fingerprint: "a" });
    expect(c.due("adsense", { fingerprint: "a" })).toBe(false);
    advance(299);
    expect(c.due("adsense", { fingerprint: "a" })).toBe(false);
    advance(2);
    expect(c.due("adsense", { fingerprint: "a" })).toBe(true);
  });

  it("fingerprint change força fetch", () => {
    const c = new RefreshCache();
    c.store("bitcoin", [{ ok: true }], { fingerprint: "old" });
    expect(c.due("bitcoin", { fingerprint: "old" })).toBe(false);
    expect(c.due("bitcoin", { fingerprint: "new-wallet" })).toBe(true);
  });

  it("force quota skips market", () => {
    const c = new RefreshCache();
    c.store("claude", [{ ok: true }], { fingerprint: "x" });
    c.store("bitcoin", [{ ok: true }], { fingerprint: "x" });
    expect(FORCEABLE.has("claude")).toBe(true);
    expect(FORCEABLE.has("bitcoin")).toBe(false);
    expect(c.due("claude", { fingerprint: "x", force: true })).toBe(true);
    expect(c.due("bitcoin", { fingerprint: "x", force: true })).toBe(false);
  });

  it("429 keeps last good", () => {
    const c = new RefreshCache();
    const good = [{ id: "legacy", ok: true, error: null }];
    c.store("bitcoin", good, { fingerprint: "fp" });
    const err = new HttpError("HTTP 429 GET https://api.coingecko.com/x retry-after=90: nah", { status: 429, retryAfterS: 90 });
    const bad = [{ id: "legacy", ok: false, error: String(err) }];
    const got = c.take("bitcoin", bad, { fingerprint: "fp", error: err });
    expect(got).toEqual(good);
    expect(c.get("bitcoin")).toEqual(good);
    expect(c.due("bitcoin", { fingerprint: "fp" })).toBe(false);
    advance(89);
    expect(c.due("bitcoin", { fingerprint: "fp" })).toBe(false);
    advance(2);
    expect(c.due("bitcoin", { fingerprint: "fp" })).toBe(true);
  });

  it("429 sem cache expõe erro", () => {
    const c = new RefreshCache();
    const err = new HttpError("HTTP 429 GET https://example/x: nah", { status: 429 });
    const bad = [{ ok: false, error: String(err) }];
    const got = c.take("bitcoin", bad, { fingerprint: "fp", error: err });
    expect(got).toEqual(bad);
    expect(c.get("bitcoin")).toEqual(bad);
  });

  it("fingerprint estável para mesma cfg", () => {
    const cfg = { providers: { bitcoin: { accounts: [{ id: "a", secret: "bc1q" }], hidden: false } } };
    expect(fingerprint(cfg as Record<string, unknown>, "bitcoin")).toBe(fingerprint(cfg as Record<string, unknown>, "bitcoin"));
    const cfg2 = { providers: { bitcoin: { accounts: [{ id: "a", secret: "bc1z" }], hidden: false } } };
    expect(fingerprint(cfg as Record<string, unknown>, "bitcoin")).not.toBe(fingerprint(cfg2 as Record<string, unknown>, "bitcoin"));
  });

  it("TTL_S tem valores esperados", () => {
    expect(TTL_S.adsense).toBe(300);
    expect(TTL_S.weather).toBe(600);
  });
});
