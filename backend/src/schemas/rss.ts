import { z } from "zod";

export const RssItemSchema = z.object({
    title: z.string().default(""),
    link: z.string().nullable().default(null),
    description: z.string().nullable().default(null),
    pubDate: z.string().nullable().default(null),
    author: z.string().nullable().default(null),
    categories: z.array(z.string()).default([]),
    guid: z.string().nullable().default(null),
    enclosure: z.string().nullable().default(null),
});
export type RssItem = z.infer<typeof RssItemSchema>;

export const RssFeedSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    url: z.string(),
    limit: z.number().int().min(1).max(50).default(10),
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    title: z.string().nullable().default(null),
    description: z.string().nullable().default(null),
    link: z.string().nullable().default(null),
    items: z.array(RssItemSchema).default([]),
    updated_at: z.string().nullable().default(null),
});
export type RssFeed = z.infer<typeof RssFeedSchema>;

export const RssPayloadSchema = z.object({
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    updated_at: z.string().nullable().default(null),
    feeds: z.array(RssFeedSchema).default([]),
});
export type RssPayload = z.infer<typeof RssPayloadSchema>;

export const RssConfigItemSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    url: z.string().min(1),
    limit: z.number().int().min(1).max(50).default(10),
});
export type RssConfigItem = z.infer<typeof RssConfigItemSchema>;

export const RssConfigSchema = z.object({
    enabled: z.boolean().default(false),
    hidden: z.boolean().default(false),
    feeds: z.array(RssConfigItemSchema).default([]),
});
export type RssConfig = z.infer<typeof RssConfigSchema>;

export const RssBodySchema = z.object({
    url: z.string().min(1),
    label: z.string().default(""),
    limit: z.number().int().min(1).max(50).nullable().default(null),
});
export type RssBody = z.infer<typeof RssBodySchema>;

export const RssPatchSchema = z.object({
    enabled: z.boolean().nullable().default(null),
    hidden: z.boolean().nullable().default(null),
});
export type RssPatch = z.infer<typeof RssPatchSchema>;

export const RssItemPatchSchema = z.object({
    url: z.string().nullable().default(null),
    label: z.string().nullable().default(null),
    limit: z.number().int().min(1).max(50).nullable().default(null),
});
export type RssItemPatch = z.infer<typeof RssItemPatchSchema>;
