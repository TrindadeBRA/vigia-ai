import { describe, it, expect, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "../testUtils.js";
import * as apodTranslate from "../providers/apodTranslate.js";

describe("apod translate router", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    vi.restoreAllMocks();
    apodTranslate.clearApodTranslateCache();
    await app?.close();
  });

  it("rejects missing text or english lang", async () => {
    app = await createTestApp();
    const empty = await app.inject({ method: "POST", url: "/api/apod/translate", payload: { lang: "pt", text: "" } });
    expect(empty.statusCode).toBe(400);
    const en = await app.inject({ method: "POST", url: "/api/apod/translate", payload: { lang: "en", text: "Hello." } });
    expect(en.statusCode).toBe(400);
  });

  it("returns a Portuguese translation", async () => {
    vi.spyOn(apodTranslate, "translateApodExplanation").mockResolvedValue("Galáxia espiral próxima.");
    app = await createTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/apod/translate",
      payload: { lang: "pt", text: "Nearby spiral galaxy." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      lang: "pt",
      translated: "Galáxia espiral próxima.",
      error: null,
    });
  });
});
