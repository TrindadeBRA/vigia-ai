import { describe, it, expect, afterEach } from "vitest";
import { clearApodTranslateCache, mymemoryLangPair, splitForMyMemory, translateApodExplanation } from "./apodTranslate.js";

afterEach(() => {
  clearApodTranslateCache();
});

describe("mymemoryLangPair", () => {
  it("maps pt and es, skips english", () => {
    expect(mymemoryLangPair("pt")).toBe("en|pt-BR");
    expect(mymemoryLangPair("es")).toBe("en|es");
    expect(mymemoryLangPair("en")).toBeNull();
  });
});

describe("splitForMyMemory", () => {
  it("keeps short text in one chunk", () => {
    expect(splitForMyMemory("Hello world.")).toEqual(["Hello world."]);
  });

  it("splits long text on sentence boundaries", () => {
    const a = `${"Alpha. ".repeat(40)}End.`;
    const chunks = splitForMyMemory(a, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ").replace(/\s+/g, " ").trim().startsWith("Alpha.")).toBe(true);
    expect(chunks.every((c) => c.length <= 80)).toBe(true);
  });
});

describe("translateApodExplanation", () => {
  it("returns the original when lang is english", async () => {
    const text = "Nearby spiral galaxy.";
    await expect(translateApodExplanation(text, "en", async () => {
      throw new Error("should not fetch");
    })).resolves.toBe(text);
  });

  it("joins MyMemory chunks and caches the result", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response(JSON.stringify({
        responseStatus: 200,
        responseData: { translatedText: `ok-${calls}` },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const first = await translateApodExplanation("Hello. World.", "pt", fetcher);
    expect(first).toBe("ok-1");
    const second = await translateApodExplanation("Hello. World.", "pt", fetcher);
    expect(second).toBe("ok-1");
    expect(calls).toBe(1);
  });

  it("rejects MyMemory quota warnings", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      responseStatus: 200,
      responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" },
    }), { status: 200 });
    await expect(translateApodExplanation("Hello.", "pt", fetcher)).rejects.toThrow(/MYMEMORY WARNING/);
  });
});
