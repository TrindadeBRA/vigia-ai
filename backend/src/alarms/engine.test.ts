import { describe, it, expect } from "vitest";
import { evaluate, formatAlarmNotification } from "./engine.js";

function payload(claudePercent: number, ok = true): Record<string, unknown> {
  return {
    claude: [{ id: "local", label: "", ok, error: null, session_percent: claudePercent }],
    fal: [{ id: "legacy", label: "", ok: true, error: null, remaining_cents: 500 }],
  };
}

function rule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const r: Record<string, unknown> = {
    id: "r1",
    provider: "claude",
    account_id: "*",
    metric: "session_percent",
    threshold: 80.0,
    enabled: true,
    label: "",
  };
  Object.assign(r, overrides);
  return r;
}

describe("alarms evaluate", () => {
  it("fires once on crossing", () => {
    const armed: Record<string, boolean> = {};
    const rules = [rule()];
    let events = evaluate(payload(42.0), rules, armed);
    expect(events).toEqual([]);
    events = evaluate(payload(85.0), rules, armed);
    expect(events.length).toBe(1);
    expect(events[0].value).toBe(85.0);
    events = evaluate(payload(90.0), rules, armed);
    expect(events).toEqual([]);
  });

  it("rearms after dropping below", () => {
    const armed: Record<string, boolean> = {};
    const rules = [rule()];
    evaluate(payload(85.0), rules, armed);
    let events = evaluate(payload(50.0), rules, armed);
    expect(events).toEqual([]);
    events = evaluate(payload(85.0), rules, armed);
    expect(events.length).toBe(1);
  });

  it("disabled rule never fires", () => {
    const armed: Record<string, boolean> = {};
    const rules = [rule({ enabled: false })];
    const events = evaluate(payload(99.0), rules, armed);
    expect(events).toEqual([]);
  });

  it("failed account is ignored", () => {
    const armed: Record<string, boolean> = {};
    const rules = [rule()];
    const events = evaluate(payload(99.0, false), rules, armed);
    expect(events).toEqual([]);
  });

  it("none metric is ignored", () => {
    const armed: Record<string, boolean> = {};
    const pl = { claude: [{ id: "local", label: "", ok: true, error: null, session_percent: null }] };
    const events = evaluate(pl as Record<string, unknown>, [rule()], armed);
    expect(events).toEqual([]);
  });

  it("cents metric fires when balance drops", () => {
    const armed: Record<string, boolean> = {};
    const rules = [rule({ provider: "fal", metric: "remaining_cents", threshold: 1000.0 })];
    let events = evaluate(payload(0.0), rules, armed);
    expect(events.length).toBe(1);
    events = evaluate(payload(0.0), rules, armed);
    expect(events).toEqual([]);
  });

  it("evaluate includes resets_at", () => {
    const armed: Record<string, boolean> = {};
    const pl = {
      claude: [{ id: "local", label: "", ok: true, error: null, weekly_percent: 37.0, weekly_resets_at: "04/09 03h45" }],
    };
    const events = evaluate(pl as Record<string, unknown>, [rule({ metric: "weekly_percent", threshold: 25.0 })], armed);
    expect(events.length).toBe(1);
    expect(events[0].resets_at).toBe("04/09 03h45");
  });
});

describe("formatAlarmNotification", () => {
  it("percent", () => {
    const event = {
      rule: rule({ threshold: 25.0, metric: "weekly_percent", label: "Claude quase no teto" }),
      provider: "claude",
      account_id: "local",
      account_label: "Pessoal",
      value: 37.0,
      resets_at: "04/09 03h45",
    };
    expect(formatAlarmNotification(event as Record<string, unknown>)).toBe(
      "⚠️ <b>Claude</b>\n\n📊 Uso de <b>25% da cota Semana</b>\n🕐 Reset em <b>04/09 03h45</b>",
    );
  });

  it("without reset", () => {
    const event = {
      rule: rule({ threshold: 25.0, metric: "weekly_percent" }),
      provider: "claude",
      account_id: "local",
      account_label: "",
      value: 37.0,
    };
    expect(formatAlarmNotification(event as Record<string, unknown>)).toBe(
      "⚠️ <b>Claude</b>\n\n📊 Uso de <b>25% da cota Semana</b>",
    );
  });

  it("balance", () => {
    const event = {
      rule: { id: "r2", provider: "fal", account_id: "*", metric: "remaining_cents", threshold: 1000.0, enabled: true, label: "" },
      provider: "fal",
      account_id: "legacy",
      account_label: "",
      value: 500.0,
    };
    expect(formatAlarmNotification(event as Record<string, unknown>)).toBe(
      "⚠️ <b>fal.ai</b>\n\n💰 Saldo de <b>$10.00 da cota Saldo restante</b>",
    );
  });

  it("escapes html", () => {
    const event = {
      rule: rule({ provider: "cursor", metric: "percent", label: "<script>", threshold: 10.0 }),
      provider: "cursor",
      account_id: "local",
      account_label: "A & B",
      value: 5.0,
    };
    const text = formatAlarmNotification(event as Record<string, unknown>);
    expect(text).toBe("⚠️ <b>Cursor</b>\n\n📊 Uso de <b>10% da cota Uso do plano</b>");
    expect(text).not.toContain("<script>");
  });
});
