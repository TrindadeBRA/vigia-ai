import { z } from "zod";

export const FirmwareWifiPatchSchema = z.object({
  wifi_ssid: z.string().max(32).optional(),
  wifi_password: z.string().max(63).nullable().optional(),
});
export type FirmwareWifiPatch = z.infer<typeof FirmwareWifiPatchSchema>;

export const FirmwarePublicSchema = z.object({
  wifi_ssid: z.string(),
  wifi_password: z.string(),
  wifi_password_set: z.boolean(),
  detected_ssid: z.string().nullable(),
  usage_url: z.string(),
  secrets_path: z.string().nullable(),
  secrets_present: z.boolean(),
  can_write: z.boolean(),
  needs_source: z.boolean(),
  can_update_source: z.boolean(),
  source_ref: z.string().nullable(),
  wanted_ref: z.string(),
  source_stale: z.boolean(),
  can_flash: z.boolean(),
  pio: z.string().nullable(),
  in_docker: z.boolean(),
  running: z.boolean(),
  reason: z.string().nullable(),
});
export type FirmwarePublic = z.infer<typeof FirmwarePublicSchema>;

export const FirmwareSaveResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable().optional(),
  secrets_path: z.string().nullable().optional(),
  wrote_secrets: z.boolean().optional(),
});
export type FirmwareSaveResult = z.infer<typeof FirmwareSaveResultSchema>;
