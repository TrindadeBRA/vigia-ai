import type { FastifyInstance } from "fastify";
import * as telegramBot from "./bot.js";
import { displayLanUrl } from "../netutil.js";
import { load } from "../store.js";

export async function createTelegramRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/telegram/status", async () => {
    const cfg = load() as Record<string, unknown>;
    const tg = (cfg.telegram ?? {}) as Record<string, unknown>;
    const token = String(tg.bot_token ?? "");
    const chatsRaw = (tg.chats ?? []) as unknown[];
    const chats = chatsRaw.filter((ch) => ch !== null && typeof ch === "object").map((ch) => {
      const d = ch as Record<string, unknown>;
      return { id: String(d.id ?? ""), label: String(d.label ?? ""), added_at: String(d.added_at ?? "") };
    }).filter((ch) => ch.id);
    return { configured: Boolean(token), bot_username: String(tg.bot_username ?? ""), chats };
  });

  app.post("/api/telegram/token", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const token = String(body?.bot_token ?? "").trim();
    if (!token) return reply.code(400).send({ ok: false, error: "token vazio" });
    try {
      const me = await telegramBot.validateToken(token);
      const username = String((me as Record<string, unknown>).username ?? "");
      telegramBot.setToken(token, username);
      const poller = (app as unknown as { telegramPoller?: { restart: () => Promise<void> } }).telegramPoller;
      if (poller) await poller.restart();
      return { ok: true };
    } catch (exc) {
      return reply.code(400).send({ ok: false, error: `token inválido: ${exc}` });
    }
  });

  app.post("/api/telegram/token/clear", async (request) => {
    telegramBot.clearToken();
    const poller = (app as unknown as { telegramPoller?: { stop: () => Promise<void> } }).telegramPoller;
    if (poller) await poller.stop();
    return { ok: true };
  });

  app.post("/api/telegram/chats/remove", async (request) => {
    const body = request.body as Record<string, unknown> | null;
    const chatId = String(body?.chat_id ?? "");
    if (!chatId) return { ok: false, error: "chat_id vazio" };
    telegramBot.removeChat(chatId);
    return { ok: true };
  });

  app.post("/api/telegram/test", async (request, reply) => {
    const cfg = load() as Record<string, unknown>;
    const port = Number(((cfg.listen as Record<string, unknown>) ?? {}).port ?? 8787);
    const displayUrl = displayLanUrl(port) || null;
    const sent = await telegramBot.broadcast("Teste OK — você receberá os alarmes aqui.", displayUrl);
    if (sent === 0) return reply.code(400).send({ ok: false, error: "nenhum chat registrado — mande /start pro bot primeiro" });
    return { ok: true };
  });
}
