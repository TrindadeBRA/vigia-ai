import { z } from "zod";

export const TelegramChatSchema = z.object({
  id: z.string(),
  label: z.string(),
  added_at: z.string(),
});
export type TelegramChat = z.infer<typeof TelegramChatSchema>;

export const TelegramStatusSchema = z.object({
  configured: z.boolean(),
  bot_username: z.string().default(""),
  chats: z.array(TelegramChatSchema),
});
export type TelegramStatus = z.infer<typeof TelegramStatusSchema>;

export const TelegramTokenBodySchema = z.object({
  bot_token: z.string(),
});
export type TelegramTokenBody = z.infer<typeof TelegramTokenBodySchema>;

export const TelegramChatBodySchema = z.object({
  chat_id: z.string(),
});
export type TelegramChatBody = z.infer<typeof TelegramChatBodySchema>;
