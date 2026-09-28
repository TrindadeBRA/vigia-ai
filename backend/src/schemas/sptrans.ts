import { z } from "zod";

export const SpTransMonitoredLineSchema = z.object({
  cl: z.number().int(),
  c: z.string().default(""),
  lt: z.string().default(""),
  tl: z.number().int().default(10),
  sl: z.number().int().default(1),
  lt0: z.string().default(""),
  lt1: z.string().default(""),
});
export type SpTransMonitoredLine = z.infer<typeof SpTransMonitoredLineSchema>;

export const SpTransStopSchema = z.object({
  id: z.string(),
  cp: z.number().int(),
  name: z.string().default(""),
  address: z.string().default(""),
  nickname: z.string().default(""),
  lines: z.array(SpTransMonitoredLineSchema).default([]),
});
export type SpTransStop = z.infer<typeof SpTransStopSchema>;

export const SpTransConfigSchema = z.object({
  enabled: z.boolean().default(false),
  hidden: z.boolean().default(false),
  stops: z.array(SpTransStopSchema).default([]),
});
export type SpTransConfig = z.infer<typeof SpTransConfigSchema>;

export const SpTransVehicleSchema = z.object({
  p: z.string().default(""),
  t: z.string().nullable().default(null),
  mins: z.number().int().nullable().default(null),
  a: z.boolean().default(false),
});
export type SpTransVehicle = z.infer<typeof SpTransVehicleSchema>;

export const SpTransLineForecastSchema = z.object({
  c: z.string().default(""),
  cl: z.number().int(),
  sl: z.number().int().default(0),
  lt0: z.string().default(""),
  lt1: z.string().default(""),
  qv: z.number().int().default(0),
  next: SpTransVehicleSchema.nullable().default(null),
  vehicles: z.array(SpTransVehicleSchema).default([]),
});
export type SpTransLineForecast = z.infer<typeof SpTransLineForecastSchema>;

export const SpTransPrevisaoSchema = z.object({
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
  updated_at: z.string().nullable().default(null),
  hr: z.string().nullable().default(null),
  cp: z.number().int(),
  np: z.string().nullable().default(null),
  lines: z.array(SpTransLineForecastSchema).default([]),
});
export type SpTransPrevisao = z.infer<typeof SpTransPrevisaoSchema>;

export const SpTransStopBodySchema = z.object({
  cp: z.number().int(),
  nickname: z.string().default(""),
});
export type SpTransStopBody = z.infer<typeof SpTransStopBodySchema>;

export const SpTransStopPatchSchema = z.object({
  nickname: z.string().nullable().default(null),
  lines: z.array(SpTransMonitoredLineSchema).nullable().default(null),
});
export type SpTransStopPatch = z.infer<typeof SpTransStopPatchSchema>;

export const SpTransTokenBodySchema = z.object({
  token: z.string().min(1),
});
export type SpTransTokenBody = z.infer<typeof SpTransTokenBodySchema>;
