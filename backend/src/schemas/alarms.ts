import { z } from "zod";
import { ProviderIdSchema } from "./usage.js";

export const AlarmMetricKindSchema = z.enum(["percent", "cents"]);
export type AlarmMetricKind = z.infer<typeof AlarmMetricKindSchema>;

export const AlarmMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: AlarmMetricKindSchema,
});
export type AlarmMetric = z.infer<typeof AlarmMetricSchema>;

export const AlarmRuleSchema = z.object({
  id: z.string(),
  provider: ProviderIdSchema,
  account_id: z.string().default("*"),
  metric: z.string(),
  threshold: z.number(),
  enabled: z.boolean().default(true),
  label: z.string().default(""),
});
export type AlarmRule = z.infer<typeof AlarmRuleSchema>;

export const AlarmRuleBodySchema = z.object({
  provider: ProviderIdSchema,
  metric: z.string(),
  threshold: z.number(),
  enabled: z.boolean().default(true),
  label: z.string().default(""),
});
export type AlarmRuleBody = z.infer<typeof AlarmRuleBodySchema>;

export const AlarmRulePatchSchema = z.object({
  threshold: z.number().nullable().default(null),
  enabled: z.boolean().nullable().default(null),
  label: z.string().nullable().default(null),
});
export type AlarmRulePatch = z.infer<typeof AlarmRulePatchSchema>;

export const AlarmsPublicSchema = z.object({
  rules: z.array(AlarmRuleSchema),
  metrics: z.record(z.array(AlarmMetricSchema)),
});
export type AlarmsPublic = z.infer<typeof AlarmsPublicSchema>;
