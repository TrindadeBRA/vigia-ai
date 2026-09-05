import { z } from "zod";
import { CalendarPayloadSchema } from "./calendar.js";
import { CurrenciesPayloadSchema } from "./currencies.js";
import { GitPayloadSchema } from "./git.js";
import { RetroAchievementsAccountSchema } from "./retroachievements.js";
import { RssPayloadSchema } from "./rss.js";
import { WeatherPayloadSchema } from "./weather.js";

export const ProviderIdSchema = z.enum([
  "claude",
  "gpt",
  "cursor",
  "openrouter",
  "deepseek",
  "opencode",
  "fal",
  "bitcoin",
  "adsense",
  "retroachievements",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const USAGE_EXAMPLE = {
  updated_at: "2026-08-31T14:00:00-03:00",
  claude: [
    {
      id: "local",
      label: "Pessoal",
      ok: true,
      error: null,
      session_percent: 42.0,
      session_resets_at: "31/08 18h00",
      weekly_percent: 18.5,
      weekly_resets_at: "04/09 03h00",
      sonnet_percent: null,
      sonnet_resets_at: null,
      opus_percent: null,
      opus_resets_at: null,
    },
  ],
  gpt: [
    {
      id: "local",
      label: "",
      ok: true,
      error: null,
      session_percent: 12.0,
      session_resets_at: "31/08 21h00",
      weekly_percent: 8.0,
      weekly_resets_at: "04/09 03h00",
      plan: "plus",
    },
  ],
  cursor: [
    {
      id: "local",
      label: "Pessoal",
      ok: true,
      error: null,
      percent: 35.0,
      other_percent: 12.0,
      used_cents: 700,
      limit_cents: 2000,
      remaining_cents: 1300,
      bonus_cents: 0,
      cycle_end: "15/09",
      plan: "pro",
      requests_used: null,
      requests_limit: null,
    },
  ],
  openrouter: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      percent: 66.6,
      limit_cents: 1000,
      used_cents: 666,
      remaining_cents: 334,
    },
  ],
  deepseek: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      percent: 25.0,
      limit_cents: 1000,
      used_cents: 250,
      remaining_cents: 750,
    },
  ],
  opencode: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      rolling_percent: 40.0,
      rolling_resets_at: "31/08 18h00",
      weekly_percent: 20.0,
      weekly_resets_at: "04/09 03h00",
      monthly_percent: 10.0,
      monthly_resets_at: "01/09 03h00",
      percent: null,
      limit_cents: null,
      used_cents: null,
      remaining_cents: 1500,
    },
  ],
  fal: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      percent: null,
      limit_cents: null,
      used_cents: null,
      remaining_cents: 2450,
    },
  ],
  bitcoin: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      balance_btc: 0.00123456,
      price_usd_cents: 6500000,
      price_brl_cents: 33000000,
      value_usd_cents: 8025,
      value_brl_cents: 40740,
    },
  ],
  adsense: [
    {
      id: "legacy",
      label: "",
      ok: true,
      error: null,
      currency: "BRL",
      today_cents: 1234,
      unpaid_cents: 56789,
      account_name: "pub-1234",
    },
  ],
} as const;

export const SSE_WIRE_EXAMPLE =
  ": connected\n\n" +
  "event: usage\n" +
  'data: {"updated_at":"2026-08-31T14:00:00-03:00","claude":[],"gpt":[],"cursor":[],"openrouter":[],"deepseek":[],"opencode":[],"fal":[],"bitcoin":[],"adsense":[]}\n\n' +
  ": ping\n\n";

// ----- Base -----
export const AccountBaseSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  ok: z.boolean(),
  error: z.string().nullable().default(null),
});
export type AccountBase = z.infer<typeof AccountBaseSchema>;

export const ClaudeAccountSchema = AccountBaseSchema.extend({
  session_percent: z.number().nullable().default(null),
  session_resets_at: z.string().nullable().default(null),
  weekly_percent: z.number().nullable().default(null),
  weekly_resets_at: z.string().nullable().default(null),
  sonnet_percent: z.number().nullable().default(null),
  sonnet_resets_at: z.string().nullable().default(null),
  opus_percent: z.number().nullable().default(null),
  opus_resets_at: z.string().nullable().default(null),
});
export type ClaudeAccount = z.infer<typeof ClaudeAccountSchema>;

export const GptAccountSchema = AccountBaseSchema.extend({
  session_percent: z.number().nullable().default(null),
  session_resets_at: z.string().nullable().default(null),
  weekly_percent: z.number().nullable().default(null),
  weekly_resets_at: z.string().nullable().default(null),
  plan: z.string().nullable().default(null),
});
export type GptAccount = z.infer<typeof GptAccountSchema>;

export const CursorAccountSchema = AccountBaseSchema.extend({
  percent: z.number().nullable().default(null),
  other_percent: z.number().nullable().default(null),
  used_cents: z.number().int().nullable().default(null),
  limit_cents: z.number().int().nullable().default(null),
  remaining_cents: z.number().int().nullable().default(null),
  bonus_cents: z.number().int().nullable().default(null),
  cycle_end: z.string().nullable().default(null),
  plan: z.string().nullable().default(null),
  requests_used: z.number().int().nullable().default(null),
  requests_limit: z.number().int().nullable().default(null),
});
export type CursorAccount = z.infer<typeof CursorAccountSchema>;

export const CreditsAccountSchema = AccountBaseSchema.extend({
  percent: z.number().nullable().default(null),
  limit_cents: z.number().int().nullable().default(null),
  used_cents: z.number().int().nullable().default(null),
  remaining_cents: z.number().int().nullable().default(null),
});
export type CreditsAccount = z.infer<typeof CreditsAccountSchema>;

export const BitcoinAccountSchema = AccountBaseSchema.extend({
  address: z.string().nullable().default(null),
  balance_btc: z.number().nullable().default(null),
  price_usd_cents: z.number().int().nullable().default(null),
  price_brl_cents: z.number().int().nullable().default(null),
  value_usd_cents: z.number().int().nullable().default(null),
  value_brl_cents: z.number().int().nullable().default(null),
});
export type BitcoinAccount = z.infer<typeof BitcoinAccountSchema>;

export const AdsenseAccountSchema = AccountBaseSchema.extend({
  currency: z.string().nullable().default(null),
  today_cents: z.number().int().nullable().default(null),
  unpaid_cents: z.number().int().nullable().default(null),
  account_name: z.string().nullable().default(null),
});
export type AdsenseAccount = z.infer<typeof AdsenseAccountSchema>;

export const OpenCodeAccountSchema = AccountBaseSchema.extend({
  rolling_percent: z.number().nullable().default(null),
  rolling_resets_at: z.string().nullable().default(null),
  weekly_percent: z.number().nullable().default(null),
  weekly_resets_at: z.string().nullable().default(null),
  monthly_percent: z.number().nullable().default(null),
  monthly_resets_at: z.string().nullable().default(null),
  percent: z.number().nullable().default(null),
  limit_cents: z.number().int().nullable().default(null),
  used_cents: z.number().int().nullable().default(null),
  remaining_cents: z.number().int().nullable().default(null),
});
export type OpenCodeAccount = z.infer<typeof OpenCodeAccountSchema>;

// ----- Usage / Health -----
export const UsagePayloadSchema = z.object({
  updated_at: z.string(),
  claude: z.array(ClaudeAccountSchema),
  gpt: z.array(GptAccountSchema),
  cursor: z.array(CursorAccountSchema),
  openrouter: z.array(CreditsAccountSchema),
  deepseek: z.array(CreditsAccountSchema),
  opencode: z.array(OpenCodeAccountSchema),
  fal: z.array(CreditsAccountSchema),
  bitcoin: z.array(BitcoinAccountSchema),
  adsense: z.array(AdsenseAccountSchema),
  retroachievements: z.array(RetroAchievementsAccountSchema).default([]),
  weather: WeatherPayloadSchema.nullable().default(null),
  currencies: CurrenciesPayloadSchema.nullable().default(null),
  git: GitPayloadSchema.nullable().default(null),
  calendar: CalendarPayloadSchema.nullable().default(null),
  rss: RssPayloadSchema.nullable().default(null),
});
export type UsagePayload = z.infer<typeof UsagePayloadSchema>;

export const HealthPayloadSchema = z.object({
  ok: z.boolean().default(true),
  version: z.string(),
  panel: z.string().default("/"),
  panel_lan: z.string().default(""),
  display: z.string().default("/display"),
  usage: z.string().default("/usage"),
  events: z.string().default("/events"),
  docs: z.string().default("/docs"),
  listen: z.record(z.union([z.string(), z.number()])),
  interval_s: z.number().int(),
});
export type HealthPayload = z.infer<typeof HealthPayloadSchema>;
