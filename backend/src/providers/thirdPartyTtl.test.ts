import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpError } from "../httpClient.js";

vi.mock("../httpClient.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../httpClient.js")>();
  return { ...actual, httpJson: vi.fn() };
});

import { httpJson } from "../httpClient.js";
import * as coingecko from "./coingecko.js";
import * as bitcoin from "./bitcoin.js";
import * as currencies from "./currencies.js";

const mockedHttpJson = vi.mocked(httpJson);

beforeEach(() => {
  coingecko.reset();
  currencies.resetForexCache();
  mockedHttpJson.mockReset();
});

afterEach(() => {
  coingecko.reset();
  currencies.resetForexCache();
  vi.restoreAllMocks();
});

describe("third party TTL", () => {
  it("coingecko TTL one http (cache por query ordenada)", async () => {
    let now = 5_000_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    let calls = 0;
    mockedHttpJson.mockImplementation(async (url: string) => {
      calls++;
      expect(url).toContain("simple/price");
      return { bitcoin: { usd: 65000.0, brl: 330000.0 } };
    });

    const a = await coingecko.fetchSimplePrice(["bitcoin"], ["usd", "brl"]);
    const b = await coingecko.fetchSimplePrice(["bitcoin"], ["brl", "usd"]);
    expect(a).toEqual(b);
    expect(calls).toBe(1);
    now += 299_000;
    await coingecko.fetchSimplePrice(["bitcoin"], ["usd", "brl"]);
    expect(calls).toBe(1);
    now += 2_000;
    await coingecko.fetchSimplePrice(["bitcoin"], ["usd", "brl"]);
    expect(calls).toBe(2);

    dateNowSpy.mockRestore();
  });

  it("coingecko 429 retorna stale", async () => {
    let now = 5_000_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const payload = { bitcoin: { usd: 1.0, brl: 5.0 } };
    let n = 0;
    mockedHttpJson.mockImplementation(async () => {
      if (n === 0) { n = 1; return payload; }
      throw new HttpError("HTTP 429 GET https://api.coingecko.com/x: slow down", { status: 429 });
    });

    expect(await coingecko.fetchSimplePrice(["bitcoin"], ["usd"])).toEqual(payload);
    now += 400_000;
    expect(await coingecko.fetchSimplePrice(["bitcoin"], ["usd"])).toEqual(payload);

    dateNowSpy.mockRestore();
  });

  it("coingecko parallel coalesces (Promise.all)", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });

    mockedHttpJson.mockImplementation(async () => {
      calls++;
      await gate;
      return { bitcoin: { usd: 10.0 } };
    });

    const p1 = coingecko.fetchSimplePrice(["bitcoin"], ["usd"]);
    const p2 = coingecko.fetchSimplePrice(["bitcoin"], ["usd"]);
    // both started before release
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(r1).toEqual({ bitcoin: { usd: 10.0 } });
    expect(r2).toEqual({ bitcoin: { usd: 10.0 } });
  });

  it("bitcoin one price two wallets", async () => {
    const urls: string[] = [];
    mockedHttpJson.mockImplementation(async (url: string) => {
      urls.push(url);
      if (url.includes("blockstream")) {
        return { chain_stats: { funded_txo_sum: 100_000_000, spent_txo_sum: 0 }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 } };
      }
      if (url.includes("coingecko")) {
        return { bitcoin: { usd: 65000.12, brl: 330000.55 } };
      }
      throw new Error(url);
    });

    const cfg = {
      providers: {
        bitcoin: {
          hidden: false,
          accounts: [
            { id: "a", label: "um", secret: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
            { id: "b", label: "dois", secret: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2" },
          ],
        },
      },
    };
    const out = await bitcoin.fetchBitcoinAccounts(cfg as Record<string, unknown>);
    expect(out.length).toBe(2);
    expect(out.every((acc) => acc.ok)).toBe(true);
    const gecko = urls.filter((u) => u.includes("coingecko"));
    const chain = urls.filter((u) => u.includes("blockstream"));
    expect(gecko.length).toBe(1);
    expect(chain.length).toBe(2);
  });

  it("forex TTL", async () => {
    let now = 8_000_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    let calls = 0;
    mockedHttpJson.mockImplementation(async (url: string) => {
      calls++;
      if (url.includes("er-api")) {
        return { result: "success", rates: { USD: 0.2, BRL: 1.0 } };
      }
      throw new Error(url);
    });

    // Mock fetchSimplePrice to no-op for crypto part (currencies calls it internally but our cfg has only fiat)
    // Need to also mock coingecko fetchSimplePrice when currencies calls it for crypto — but our cfg has only fiat, so not needed
    const originalFetchSimplePrice = coingecko.fetchSimplePrice;
    // currencies calls fetchSimplePrice for crypto; we ensure it returns {} if called
    vi.spyOn(coingecko, "fetchSimplePrice").mockImplementation(async () => ({}));

    const cfg = { base: "BRL", items: [{ id: "usd", kind: "fiat", code: "USD", label: "Dólar" }] };
    const a = await currencies.fetchCurrencyQuotes(cfg as Record<string, unknown>);
    const b = await currencies.fetchCurrencyQuotes(cfg as Record<string, unknown>);
    expect((a.items as Array<Record<string, unknown>>)[0].ok).toBe(true);
    expect((b.items as Array<Record<string, unknown>>)[0].price).toBeCloseTo(5.0);
    expect(calls).toBe(1);
    now += 3601_000;
    await currencies.fetchCurrencyQuotes(cfg as Record<string, unknown>);
    expect(calls).toBe(2);

    dateNowSpy.mockRestore();
    vi.mocked(coingecko.fetchSimplePrice).mockRestore();
  });
});
