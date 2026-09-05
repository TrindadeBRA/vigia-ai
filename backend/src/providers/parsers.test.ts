import { describe, it, expect } from "vitest";
import { parseClaudePayload } from "./claude.js";
import { parseGptPayload } from "./gpt.js";
import { parseCursorDashboard } from "./cursor.js";
import { parseOpenrouterPayload } from "./openrouter.js";
import { parseDeepseekPayload } from "./deepseek.js";
import { parseFalPayload } from "./fal.js";
import { parseAuthBlob } from "../local/gptOauth.js";

describe("parsers — claude", () => {
  it("windows", () => {
    const parsed = parseClaudePayload({
      five_hour: { utilization: 0.42, resets_at: "2026-08-31T04:00:00-03:00" },
      seven_day: { utilization: 18.5, resets_at: "2026-09-04T03:00:00-03:00" },
    } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.session_percent).toBe(42.0);
    expect(parsed.weekly_percent).toBe(18.5);
  });

  it("five_hour utilization 1 é 1%", () => {
    const parsed = parseClaudePayload({
      five_hour: { utilization: 1, resets_at: "2026-08-31T04:55:26-03:00" },
      seven_day: { utilization: 37, resets_at: "2026-09-04T03:45:26-03:00" },
    } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.session_percent).toBe(1.0);
    expect(parsed.weekly_percent).toBe(37.0);
  });

  it("limits percent já 0-100", () => {
    const parsed = parseClaudePayload({
      limits: [
        { kind: "session", percent: 1, resets_at: "2026-08-31T04:55:26-03:00" },
        { kind: "weekly_all", percent: 27, resets_at: "2026-09-04T03:45:26-03:00" },
      ],
    } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.session_percent).toBe(1.0);
    expect(parsed.weekly_percent).toBe(27.0);
  });
});

describe("parsers — gpt", () => {
  it("plus windows", () => {
    const parsed = parseGptPayload({
      plan_type: "plus",
      rate_limit: {
        primary_window: { used_percent: 42.0, limit_window_seconds: 18000, reset_at: 1780000000 },
        secondary_window: { used_percent: 8.5, limit_window_seconds: 604800, reset_at: 1780500000 },
      },
    } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.session_percent).toBe(42.0);
    expect(parsed.weekly_percent).toBe(8.5);
    expect(parsed.plan).toBe("plus");
    expect(parsed.session_resets_at).toBeTruthy();
    expect(parsed.weekly_resets_at).toBeTruthy();
  });

  it("free monthly only", () => {
    const parsed = parseGptPayload({
      plan_type: "free",
      rate_limit: {
        primary_window: { used_percent: 0, limit_window_seconds: 2592000, reset_at: 1790795505 },
        secondary_window: null,
      },
    } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.session_percent).toBeNull();
    expect(parsed.weekly_percent).toBe(0.0);
    expect(parsed.plan).toBe("free");
  });

  it("used_percent já 0-100", () => {
    const parsed = parseGptPayload({
      rate_limit: {
        primary_window: { used_percent: 0.5, limit_window_seconds: 18000, reset_at: 1780000000 },
      },
    } as Record<string, unknown>);
    expect(parsed.session_percent).toBe(0.5);
  });

  it("parse codex auth blob", () => {
    const [token, accountId] = parseAuthBlob({ tokens: { access_token: "tok-abc", account_id: "acct-1", refresh_token: "nope" } });
    expect(token).toBe("tok-abc");
    expect(accountId).toBe("acct-1");
  });
});

describe("parsers — cursor", () => {
  it("dashboard básico", () => {
    const parsed = parseCursorDashboard(
      { planUsage: { autoPercentUsed: 35, apiPercentUsed: 12 }, spendLimitUsage: { individualLimit: 2000, individualRemaining: 1300 }, membershipType: "pro" } as Record<string, unknown>,
      "pro",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.ok).toBe(true);
    expect(parsed!.percent).toBe(35.0);
    expect(parsed!.used_cents).toBe(700);
    expect(parsed!.plan).toBe("pro");
  });

  it("new cycle 1 percent", () => {
    const parsed = parseCursorDashboard(
      { planUsage: { autoPercentUsed: 1, apiPercentUsed: 0, totalPercentUsed: 1 }, spendLimitUsage: { individualLimit: 1000, individualRemaining: 1000 }, billingCycleEnd: "2026-10-01T00:00:00Z", membershipType: "pro" } as Record<string, unknown>,
      "pro",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.percent).toBe(1.0);
    expect(parsed!.other_percent).toBe(0.0);
  });

  it("zero not total fallback", () => {
    const parsed = parseCursorDashboard(
      { planUsage: { autoPercentUsed: 0, apiPercentUsed: 0, totalPercentUsed: 100 }, spendLimitUsage: { individualLimit: 1000, individualRemaining: 1000 }, membershipType: "pro" } as Record<string, unknown>,
      "pro",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.percent).toBe(0.0);
    expect(parsed!.other_percent).toBe(0.0);
  });

  it("omitted zero fields", () => {
    const parsed = parseCursorDashboard(
      { planUsage: { totalSpend: 0, includedSpend: 0 }, spendLimitUsage: { individualLimit: 1000, individualRemaining: 1000 }, billingCycleEnd: "2026-10-01T00:00:00Z", membershipType: "pro" } as Record<string, unknown>,
      "pro",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.percent).toBe(0.0);
    expect(parsed!.other_percent).toBe(0.0);
  });

  it("millis cycle_end", () => {
    const parsed = parseCursorDashboard(
      { billingCycleStart: "1788224941000", billingCycleEnd: "1790816941000", planUsage: { autoPercentUsed: 26.28, apiPercentUsed: 23.16, bonusSpend: 10868 }, spendLimitUsage: { individualLimit: 1000, individualRemaining: 1000 }, membershipType: "pro" } as Record<string, unknown>,
      "pro",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.percent).toBe(26.3);
    expect(parsed!.other_percent).toBe(23.2);
    expect(parsed!.bonus_cents).toBe(10868);
    expect(parsed!.cycle_end).not.toBeNull();
    expect(String(parsed!.cycle_end)).toContain("2026");
    expect(String(parsed!.cycle_end).startsWith("2026-09-30")).toBe(true);
  });
});

describe("parsers — openrouter / deepseek / fal", () => {
  it("openrouter credits", () => {
    const parsed = parseOpenrouterPayload({ data: { total_credits: 10.0, total_usage: 6.66 } } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.limit_cents).toBe(1000);
    expect(parsed.used_cents).toBe(666);
    expect(parsed.remaining_cents).toBe(334);
  });

  it("deepseek balance", () => {
    const parsed = parseDeepseekPayload({ balance_infos: [{ currency: "USD", total_balance: 7.5 }] } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.remaining_cents).toBe(750);
    expect(parsed.percent).toBeNull();
  });

  it("fal billing", () => {
    const parsed = parseFalPayload({ username: "my-team", credits: { current_balance: 24.5, currency: "USD" } } as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    expect(parsed.remaining_cents).toBe(2450);
    expect(parsed.percent).toBeNull();
  });

  it("fal billing missing credits", () => {
    const parsed = parseFalPayload({ username: "my-team" } as Record<string, unknown>);
    expect(parsed.ok).toBe(false);
  });
});
