import { z } from "zod";
import { WeatherConfigSchema } from "./weather.js";
import { CurrenciesConfigSchema } from "./currencies.js";
import { ProviderIdSchema } from "./usage.js";

export const AccountPublicSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  suffix: z.string().nullable().default(null),
});
export type AccountPublic = z.infer<typeof AccountPublicSchema>;

export const ProviderCardPublicSchema = z.object({
  source: z.string(),
  label: z.string(),
  configured: z.boolean(),
  suffix: z.string().nullable().default(null),
  mode: z.string(),
  hidden: z.boolean().default(false),
  local_label: z.string().default(""),
  primary_label: z.string().default(""),
  accounts: z.array(AccountPublicSchema).default([]),
});
export type ProviderCardPublic = z.infer<typeof ProviderCardPublicSchema>;

export const UrlsPublicSchema = z.object({
  panel: z.array(z.string()),
  usage: z.array(z.string()),
  usage_lan: z.string(),
  usage_local: z.string(),
  secrets_h: z.string(),
  secrets_h_file: z.string(),
  board_ok: z.boolean(),
});
export type UrlsPublic = z.infer<typeof UrlsPublicSchema>;

export const ListenPublicSchema = z.object({
  host: z.string(),
  port: z.number().int(),
});
export type ListenPublic = z.infer<typeof ListenPublicSchema>;

export const DevicePublicSchema = z.object({
  ip: z.string().nullable().default(null),
  last_seen_s: z.number().int().nullable().default(null),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null),
});
export type DevicePublic = z.infer<typeof DevicePublicSchema>;

export const ConfigPublicSchema = z.object({
  ok: z.boolean().default(true),
  in_docker: z.boolean(),
  mock: z.boolean(),
  listen: ListenPublicSchema,
  urls: UrlsPublicSchema,
  lan_ips: z.array(z.string()),
  restart_needed_for_port: z.boolean().default(false),
  providers: z.record(ProviderCardPublicSchema),
  weather: WeatherConfigSchema.default({}),
  currencies: CurrenciesConfigSchema.default({}),
  device: DevicePublicSchema.default({}),
});
export type ConfigPublic = z.infer<typeof ConfigPublicSchema>;

export const ConfigPatchSchema = z.object({
  host: z.string().nullable().default(null),
  port: z.number().int().min(1).max(65535).nullable().default(null),
  mock: z.boolean().nullable().default(null),
  claude_hidden: z.boolean().nullable().default(null),
  gpt_hidden: z.boolean().nullable().default(null),
  cursor_hidden: z.boolean().nullable().default(null),
  openrouter_hidden: z.boolean().nullable().default(null),
  deepseek_hidden: z.boolean().nullable().default(null),
  opencode_hidden: z.boolean().nullable().default(null),
  fal_hidden: z.boolean().nullable().default(null),
  bitcoin_hidden: z.boolean().nullable().default(null),
  adsense_hidden: z.boolean().nullable().default(null),
  claude_local_label: z.string().nullable().default(null),
  gpt_local_label: z.string().nullable().default(null),
  cursor_local_label: z.string().nullable().default(null),
  openrouter_primary_label: z.string().nullable().default(null),
  deepseek_primary_label: z.string().nullable().default(null),
  opencode_primary_label: z.string().nullable().default(null),
  fal_primary_label: z.string().nullable().default(null),
  bitcoin_primary_label: z.string().nullable().default(null),
  adsense_primary_label: z.string().nullable().default(null),
  claude_paste: z.string().nullable().default(null),
  gpt_paste: z.string().nullable().default(null),
  cursor_paste: z.string().nullable().default(null),
  openrouter_paste: z.string().nullable().default(null),
  deepseek_paste: z.string().nullable().default(null),
  opencode_paste: z.string().nullable().default(null),
  fal_paste: z.string().nullable().default(null),
  bitcoin_paste: z.string().nullable().default(null),
  adsense_client_id: z.string().nullable().default(null),
  adsense_client_secret: z.string().nullable().default(null),
});
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;

export const ConfigSaveResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable().default(null),
  restart_needed_for_port: z.boolean().default(false),
});
export type ConfigSaveResult = z.infer<typeof ConfigSaveResultSchema>;

export const AddAccountBodySchema = z.object({
  provider: ProviderIdSchema,
  label: z.string().default(""),
  token: z.string().nullable().default(null),
  key: z.string().nullable().default(null),
});
export type AddAccountBody = z.infer<typeof AddAccountBodySchema>;

export const AddAccountResultSchema = z.object({
  ok: z.boolean(),
  id: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
});
export type AddAccountResult = z.infer<typeof AddAccountResultSchema>;

export const OkResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable().default(null),
  cleared: z.string().nullable().default(null),
});
export type OkResult = z.infer<typeof OkResultSchema>;
