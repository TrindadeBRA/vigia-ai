import { describe, it, expect } from "vitest";
import { isoBrt, telaBrt, fmtResetWhen, isoOrNone, parseWhen } from "./formatting.js";

describe("formatting — isoBrt / telaBrt (§4.1)", () => {
  it("isoBrt formata com offset -03:00 fixo", () => {
    // 2026-09-04 18:00 BRT = 2026-09-04T21:00Z
    const d = new Date("2026-09-04T21:00:00.000Z");
    expect(isoBrt(d)).toBe("2026-09-04T18:00:00-03:00");
  });
  it("telaBrt formata DD/MM HHhMM", () => {
    const d = new Date("2026-09-04T21:00:00.000Z");
    expect(telaBrt(d)).toBe("04/09 18h00");
  });
  it("fmtResetWhen fast-path para tela format", () => {
    expect(fmtResetWhen("04/09 03h45")).toBe("04/09 03h45");
    expect(fmtResetWhen("15/09")).toBe("15/09");
  });
  it("fmtResetWhen converte ISO para tela", () => {
    expect(fmtResetWhen("2026-09-04T03:45:00-03:00")).toBe("04/09 03h45");
  });
  it("isoBrt timezone fixo America/Sao_Paulo, não UTC", () => {
    const d = new Date("2026-01-01T00:00:00.000Z"); // verão pode ser -02, mas BRT fixo -03
    const s = isoBrt(d);
    expect(s).toMatch(/-03:00$/);
  });
});

describe("formatting — parse_when / iso_or_none (port de test_parsers.py)", () => {
  it("isoOrNone mantém ano", () => {
    const out = isoOrNone("2026-09-30T01:09:01Z");
    expect(out).not.toBeNull();
    expect(out!.startsWith("2026-09-")).toBe(true);
  });

  it("parseWhen millis string (Connect RPC)", () => {
    const dt = parseWhen("1790816941000");
    expect(dt).not.toBeNull();
    expect(dt!.getFullYear()).toBe(2026);
    const iso = isoOrNone("1790816941000");
    expect(iso).not.toBeNull();
    expect(iso!.startsWith("2026-09-30")).toBe(true);
  });

  it("parseWhen protobuf timestamp", () => {
    const dt = parseWhen({ seconds: 1790816941, nanos: 0 });
    expect(dt).not.toBeNull();
    expect(Math.round(dt!.getTime() / 1000)).toBe(1790816941);
  });

  it("fmtResetWhen tela format direto", () => {
    expect(fmtResetWhen("04/09 03h45")).toBe("04/09 03h45");
    expect(fmtResetWhen("15/09")).toBe("15/09");
  });

  it("fmtResetWhen ISO", () => {
    expect(fmtResetWhen("2026-09-04T03:45:00-03:00")).toBe("04/09 03h45");
  });
});
