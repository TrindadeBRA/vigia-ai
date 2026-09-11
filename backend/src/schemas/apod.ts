import { z } from "zod";

export const ApodPayloadSchema = z.object({
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    updated_at: z.string().nullable().default(null),
    date: z.string().nullable().default(null),
    title: z.string().nullable().default(null),
    explanation: z.string().nullable().default(null),
    url: z.string().nullable().default(null),
    hdurl: z.string().nullable().default(null),
    media_type: z.string().nullable().default(null),
    copyright: z.string().nullable().default(null),
    service_version: z.string().nullable().default(null),
});
export type ApodPayload = z.infer<typeof ApodPayloadSchema>;

export const ApodConfigSchema = z.object({
    enabled: z.boolean().default(false),
    hidden: z.boolean().default(false),
    api_key: z.string().default(""),
});
export type ApodConfig = z.infer<typeof ApodConfigSchema>;

export const ApodPatchSchema = z.object({
    enabled: z.boolean().nullable().default(null),
    hidden: z.boolean().nullable().default(null),
    api_key: z.string().nullable().default(null),
});
export type ApodPatch = z.infer<typeof ApodPatchSchema>;
