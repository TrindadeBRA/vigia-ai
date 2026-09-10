import { z } from "zod";

export const GithubRepoSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    repo: z.string(),
    ok: z.boolean(),
    error: z.string().nullable().default(null),
    full_name: z.string().nullable().default(null),
    description: z.string().nullable().default(null),
    stars: z.number().nullable().default(null),
    forks: z.number().nullable().default(null),
    open_issues: z.number().nullable().default(null),
    watchers: z.number().nullable().default(null),
    default_branch: z.string().nullable().default(null),
    html_url: z.string().nullable().default(null),
    pushed_at: z.string().nullable().default(null),
    updated_at: z.string().nullable().default(null),
});
export type GithubRepo = z.infer<typeof GithubRepoSchema>;

export const GithubPinnedRepoSchema = z.object({
    full_name: z.string(),
    description: z.string().nullable().default(null),
    stars: z.number().default(0),
    forks: z.number().default(0),
    language: z.string().nullable().default(null),
    html_url: z.string(),
});
export type GithubPinnedRepo = z.infer<typeof GithubPinnedRepoSchema>;

export const GithubProfileSchema = z.object({
    id: z.string().default(""),
    label: z.string().default(""),
    ok: z.boolean(),
    error: z.string().nullable().default(null),
    username: z.string(),
    name: z.string().nullable().default(null),
    avatar_url: z.string().nullable().default(null),
    bio: z.string().nullable().default(null),
    followers: z.number().nullable().default(null),
    public_repos: z.number().nullable().default(null),
    html_url: z.string(),
    pinned: z.array(GithubPinnedRepoSchema).default([]),
    updated_at: z.string().nullable().default(null),
});
export type GithubProfile = z.infer<typeof GithubProfileSchema>;

export const GithubPayloadSchema = z.object({
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    updated_at: z.string().nullable().default(null),
    repos: z.array(GithubRepoSchema).default([]),
    profiles: z.array(GithubProfileSchema).default([]),
});
export type GithubPayload = z.infer<typeof GithubPayloadSchema>;
