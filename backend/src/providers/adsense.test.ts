import { describe, it, expect } from "vitest";
import { parseEstimatedEarnings, parsePaymentAmount, parseUnpaidPayments } from "./adsense.js";

describe("parsePaymentAmount", () => {
  it("parses BRL formatting (dot thousands, comma decimal)", () => {
    const [cents, cur] = parsePaymentAmount("R$1.234,57");
    expect(cents).toBe(123457);
    expect(cur).toBe("BRL");
  });

  it("parses USD formatting (comma thousands, dot decimal)", () => {
    const [cents, cur] = parsePaymentAmount("$1,234.57");
    expect(cents).toBe(123457);
    expect(cur).toBe("USD");
  });
});

describe("parseUnpaidPayments", () => {
  it("extracts amount and currency from the payments list", () => {
    const [cents, cur] = parseUnpaidPayments({
      payments: [{ name: "accounts/pub-1/payments/unpaid", amount: "R$56,78" }],
    });
    expect(cents).toBe(5678);
    expect(cur).toBe("BRL");
  });
});

describe("parseEstimatedEarnings", () => {
  it("reads totals.cells against the ESTIMATED_EARNINGS header", () => {
    const [cents, cur] = parseEstimatedEarnings({
      headers: [{ name: "ESTIMATED_EARNINGS", currencyCode: "BRL" }],
      totals: { cells: [{ value: "12.34" }] },
    });
    expect(cents).toBe(1234);
    expect(cur).toBe("BRL");
  });

  it("returns 0 for an empty report", () => {
    const [cents] = parseEstimatedEarnings({ headers: [], rows: [] });
    expect(cents).toBe(0);
  });
});
