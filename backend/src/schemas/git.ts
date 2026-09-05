import { z } from "zod";

export const GitCommitSchema = z.object({
    hash: z.string(),
    short_hash: z.string(),
    author_name: z.string(),
    author_email: z.string(),
    date: z.string(),
    subject: z.string(),
    body: z.string().default(""),
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const GitRepoSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    source: z.string(),
    branch: z.string().nullable().default(null),
    limit: z.number().int().min(1).max(50).default(5),
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    commits: z.array(GitCommitSchema).default([]),
    updated_at: z.string().nullable().default(null),
    head: z.string().nullable().default(null),
    remote_url: z.string().nullable().default(null),
});
export type GitRepo = z.infer<typeof GitRepoSchema>;

export const GitPayloadSchema = z.object({
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    updated_at: z.string().nullable().default(null),
    repos: z.array(GitRepoSchema).default([]),
});
export type GitPayload = z.infer<typeof GitPayloadSchema>;

export const GitRepoConfigSchema = z.object({
    id: z.string(),
    source: z.string(),
    label: z.string().default(""),
    limit: z.number().int().min(1).max(50).default(5),
    branch: z.string().nullable().default(null),
});
export type GitRepoConfig = z.infer<typeof GitRepoConfigSchema>;

export const GitConfigSchema = z.object({
    enabled: z.boolean().default(false),
    hidden: z.boolean().default(false),
    repos: z.array(GitRepoConfigSchema).default([]),
});
export type GitConfig = z.infer<typeof GitConfigSchema>;

export const GitRepoBodySchema = z.object({
    source: z.string().min(1),
    label: z.string().default(""),
    limit: z.number().int().min(1).max(50).nullable().default(null),
    branch: z.string().nullable().default(null),
});
export type GitRepoBody = z.infer<typeof GitRepoBodySchema>;

export const GitPatchSchema = z.object({
    enabled: z.boolean().nullable().default(null),
    hidden: z.boolean().nullable().default(null),
});
export type GitPatch = z.infer<typeof GitPatchSchema>;

export const GitRepoPatchSchema = z.object({
    source: z.string().nullable().default(null),
    label: z.string().nullable().default(null),
    limit: z.number().int().min(1).max(50).nullable().default(null),
    branch: z.string().nullable().default(null),
});
export type GitRepoPatch = z.infer<typeof GitRepoPatchSchema>;
