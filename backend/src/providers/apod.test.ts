import { describe, it, expect } from "vitest";
import { apodDateString, fetchApod } from "./apod.js";

describe("apodDateString", () => {
    it("returns YYYY-MM-DD format", () => {
        expect(apodDateString(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("steps back calendar days", () => {
        const today = apodDateString(0);
        const yesterday = apodDateString(1);
        const t = new Date(`${today}T12:00:00Z`).getTime();
        const y = new Date(`${yesterday}T12:00:00Z`).getTime();
        expect(Math.round((t - y) / 86400000)).toBe(1);
    });
});

describe("fetchApod", () => {
    it("fetches a recent APOD despite today failing on NASA side", async () => {
        const r = await fetchApod({ apod: { enabled: true, hidden: false, api_key: "" } });
        expect(r.ok, r.error ?? "unknown").toBe(true);
        expect(r.title).toBeTruthy();
        expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }, 30_000);
});
