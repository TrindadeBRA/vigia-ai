import { z } from "zod";

export const RetroRecentlyPlayedSchema = z.object({
  game_id: z.number().int().nullable().default(null),
  title: z.string().nullable().default(null),
  console_name: z.string().nullable().default(null),
  image_icon: z.string().nullable().default(null),
  last_played: z.string().nullable().default(null),
  achievements_total: z.number().int().nullable().default(null),
  num_achieved: z.number().int().nullable().default(null),
  score_achieved: z.number().int().nullable().default(null),
});
export type RetroRecentlyPlayed = z.infer<typeof RetroRecentlyPlayedSchema>;

export const RetroRecentAchievementSchema = z.object({
  id: z.number().int().nullable().default(null),
  game_id: z.number().int().nullable().default(null),
  game_title: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  points: z.number().int().nullable().default(null),
  badge_name: z.string().nullable().default(null),
  badge_url: z.string().nullable().default(null),
  date_awarded: z.string().nullable().default(null),
  hardcore: z.boolean().nullable().default(null),
});
export type RetroRecentAchievement = z.infer<typeof RetroRecentAchievementSchema>;

export const RetroAwardsSchema = z.object({
  total_awards_count: z.number().int().nullable().default(null),
  mastery_awards_count: z.number().int().nullable().default(null),
  completion_awards_count: z.number().int().nullable().default(null),
  beaten_hardcore_awards_count: z.number().int().nullable().default(null),
  beaten_softcore_awards_count: z.number().int().nullable().default(null),
  event_awards_count: z.number().int().nullable().default(null),
  site_awards_count: z.number().int().nullable().default(null),
});
export type RetroAwards = z.infer<typeof RetroAwardsSchema>;

export const RetroCompletionProgressSchema = z.object({
  total: z.number().int().nullable().default(null),
  count: z.number().int().nullable().default(null),
});
export type RetroCompletionProgress = z.infer<typeof RetroCompletionProgressSchema>;

export const RetroAchievementsAccountSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  ok: z.boolean(),
  error: z.string().nullable().default(null),
  username: z.string().nullable().default(null),
  ulid: z.string().nullable().default(null),
  user_pic: z.string().nullable().default(null),
  member_since: z.string().nullable().default(null),
  motto: z.string().nullable().default(null),
  total_points: z.number().int().nullable().default(null),
  total_softcore_points: z.number().int().nullable().default(null),
  total_true_points: z.number().int().nullable().default(null),
  rank: z.number().int().nullable().default(null),
  total_ranked: z.number().int().nullable().default(null),
  status: z.string().nullable().default(null),
  rich_presence_msg: z.string().nullable().default(null),
  rich_presence_msg_date: z.string().nullable().default(null),
  last_game_id: z.number().int().nullable().default(null),
  last_game_title: z.string().nullable().default(null),
  last_game_console: z.string().nullable().default(null),
  last_game_image_icon: z.string().nullable().default(null),
  recently_played: z.array(RetroRecentlyPlayedSchema).default([]),
  recent_achievements: z.array(RetroRecentAchievementSchema).default([]),
  awards: RetroAwardsSchema.nullable().default(null),
  completion_progress: RetroCompletionProgressSchema.nullable().default(null),
  updated_at: z.string().nullable().default(null),
});
export type RetroAchievementsAccount = z.infer<typeof RetroAchievementsAccountSchema>;
