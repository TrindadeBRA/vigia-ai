import { logNotification } from "../httpClient.js";
import { createNote } from "../notes.js";
import { load, updateSync as update } from "../store.js";

export const TELEGRAM_API = "https://api.telegram.org";
export const TELEGRAM_LOG_MESSAGE = `${TELEGRAM_API}/bot/sendMessage`;
export const CONFIRMATION_MSG = "✅ Vigia AI conectado — você vai receber os alarmes aqui.";
export const NOTE_HELP_MSG = "📝 Use /note {texto} para criar uma Nota no dashboard.\nExemplo: /note Comprar pão amanhã 8h";
export const NOTE_CREATED_MSG = "📝 Nota criada no dashboard!";
export const NOTE_EMPTY_MSG = "⚠️ Texto vazio. Use: /note {seu texto}\nExemplo: /note Reunião amanhã 14h";
export const TASKLIST_HELP_MSG = "✅ Use /tasklist {itens} para criar uma checklist no dashboard.\nSepare por quebra de linha ou ;\nExemplo: /tasklist comprar pão; pagar conta; ligar pra mãe";
export const TASKLIST_CREATED_MSG = "✅ Tasklist criada no dashboard!";
export const TASKLIST_EMPTY_MSG = "⚠️ Lista vazia. Use: /tasklist {itens}\nSepare por ; ou quebra de linha\nExemplo: /tasklist comprar pão; pagar conta";

function parseNoteCommand(text: string): string | null | undefined {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  // suporta /note, /note@botname, com ou sem texto
  const m = /^\/note(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (!m) return null;
  // m[1] é o texto após /note (pode ser undefined se só "/note")
  if (m[1] === undefined) return undefined; // comando sem texto
  return m[1].trim();
}

function parseTasklistCommand(text: string): string | null | undefined {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  const m = /^\/tasklist(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (!m) return null;
  if (m[1] === undefined) return undefined;
  return m[1].trim();
}

function buildTasklistMarkdown(raw: string): string {
  // split por quebra de linha ou ; — cada item vira "- [ ] {item}"
  const parts = String(raw ?? "")
    .split(/[\r\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return "";
  return parts.map((item) => `- [ ] ${item}`).join("\n");
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (exc) {
    console.log(`[telegram] falha ao enviar mensagem para ${chatId}: ${exc}`);
  }
}

export function getBotToken(): string {
  const cfg = load() as Record<string, unknown>;
  return String(((cfg.telegram as Record<string, unknown>) ?? {}).bot_token ?? "");
}

export async function validateToken(token: string): Promise<Record<string, unknown>> {
  const url = `${TELEGRAM_API}/bot${token}/getMe`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await resp.json()) as Record<string, unknown>;
  if (!data.ok) throw new Error(String(data.description ?? "token inválido"));
  const result = data.result as unknown;
  if (result === null || typeof result !== "object" || Array.isArray(result)) throw new Error("resposta inválida do Telegram");
  return result as Record<string, unknown>;
}

export function setToken(token: string, username: string): void {
  update((c: Record<string, unknown>) => {
    const tg = (c.telegram as Record<string, unknown>) ?? {};
    tg.bot_token = token;
    tg.bot_username = username;
    c.telegram = tg;
  });
}

export function clearToken(): void {
  update((c: Record<string, unknown>) => {
    const tg = (c.telegram as Record<string, unknown>) ?? {};
    tg.bot_token = "";
    tg.bot_username = "";
    tg.chats = [];
    c.telegram = tg;
  });
}

export function addChat(chatId: string, label: string): boolean {
  const cfg = load() as Record<string, unknown>;
  const chats = ((cfg.telegram as Record<string, unknown>)?.chats ?? []) as Array<Record<string, unknown>>;
  const existing = chats.find((ch) => String(ch.id) === chatId);
  if (existing) return false;
  update((c: Record<string, unknown>) => {
    const tg = (c.telegram as Record<string, unknown>) ?? {};
    const list = Array.isArray(tg.chats) ? [...(tg.chats as unknown[])] : [];
    list.push({ id: chatId, label, added_at: String(Math.trunc(Date.now() / 1000)) });
    tg.chats = list;
    c.telegram = tg;
  });
  return true;
}

export function removeChat(chatId: string): void {
  update((c: Record<string, unknown>) => {
    const tg = (c.telegram as Record<string, unknown>) ?? {};
    const list = Array.isArray(tg.chats) ? (tg.chats as Array<Record<string, unknown>>) : [];
    tg.chats = list.filter((ch) => String(ch.id) !== chatId);
    c.telegram = tg;
  });
}

async function sendMessageSync(
  token: string,
  chatId: string,
  text: string,
  opts: { parseMode?: string | null; replyMarkup?: Record<string, unknown> | null } = {},
): Promise<[Response, number]> {
  const parseMode = opts.parseMode ?? "HTML";
  const replyMarkup = opts.replyMarkup ?? null;
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const start = performance.now();
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const elapsedMs = performance.now() - start;
  return [resp, elapsedMs];
}

export function urlButtonMarkup(url: string, label = "Abrir VigiaAI"): Record<string, unknown> {
  return { inline_keyboard: [[{ text: label, url }]] };
}

function logDelivery(opts: { status: number | null; elapsedMs: number; error?: string | null }): void {
  logNotification("POST", TELEGRAM_LOG_MESSAGE, {
    label: "TELEGRAM",
    status: opts.status,
    elapsedMs: opts.elapsedMs,
    error: opts.error ?? null,
  });
}

// broadcast is async but we keep sync-compatible wrapper that returns Promise<number>
// Python's broadcast is sync blocking; Node version is async.
export async function broadcast(text: string, buttonUrl: string | null = null, parseMode = "HTML"): Promise<number> {
  const cfg = load() as Record<string, unknown>;
  const tg = (cfg.telegram as Record<string, unknown>) ?? {};
  const token = String(tg.bot_token ?? "");
  const chats = Array.isArray(tg.chats) ? [...(tg.chats as unknown[])] as Array<Record<string, unknown>> : [];
  if (!token || chats.length === 0) return 0;
  const replyMarkup = buttonUrl ? urlButtonMarkup(buttonUrl) : null;
  let sent = 0;
  const dead: string[] = [];
  for (const chat of chats) {
    const start = performance.now();
    try {
      const [resp, elapsedMs] = await sendMessageSync(token, String(chat.id), text, { parseMode, replyMarkup });
      let data: Record<string, unknown> = {};
      try {
        data = (await resp.json()) as Record<string, unknown>;
      } catch { }
      if (resp.status === 200 && data.ok) {
        sent += 1;
        logDelivery({ status: resp.status, elapsedMs });
      } else if (resp.status === 400 || resp.status === 403) {
        dead.push(String(chat.id));
        logDelivery({ status: resp.status, elapsedMs });
      } else {
        const txt = await resp.text().catch(() => "");
        logDelivery({ status: resp.status, elapsedMs, error: txt.slice(0, 300) });
      }
    } catch (exc) {
      logDelivery({ status: null, elapsedMs: performance.now() - start, error: String(exc) });
    }
  }
  if (dead.length > 0) {
    update((c: Record<string, unknown>) => {
      const t = (c.telegram as Record<string, unknown>) ?? {};
      const list = Array.isArray(t.chats) ? (t.chats as Array<Record<string, unknown>>) : [];
      t.chats = list.filter((ch) => !dead.includes(String(ch.id)));
      c.telegram = t;
    });
  }
  return sent;
}

export async function pollOnce(token: string, offset: number, signal?: AbortSignal): Promise<number> {
  const url = `${TELEGRAM_API}/bot${token}/getUpdates`;
  const params = new URLSearchParams({ timeout: "25", offset: String(offset) });
  const full = `${url}?${params.toString()}`;
  const combinedSignal = signal ? (typeof (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any === "function"
    ? (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([signal, AbortSignal.timeout(35_000)])
    : signal) : AbortSignal.timeout(35_000);
  const resp = await fetch(full, {
    method: "GET",
    signal: combinedSignal,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await resp.json()) as Record<string, unknown>;
  if (!data.ok) throw new Error(String(data.description ?? "getUpdates falhou"));
  const updates = (data.result ?? []) as unknown[];
  let nextOffset = offset;
  for (const item of updates) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const dict = item as Record<string, unknown>;
    const updateId = dict.update_id;
    if (typeof updateId === "number" && Number.isFinite(updateId)) {
      nextOffset = Math.max(nextOffset, updateId + 1);
    }
    const message = dict.message as unknown;
    if (message === null || typeof message !== "object" || Array.isArray(message)) continue;
    const msg = message as Record<string, unknown>;
    const chat = msg.chat as unknown;
    if (chat === null || typeof chat !== "object" || Array.isArray(chat)) continue;
    const chatDict = chat as Record<string, unknown>;
    const chatIdRaw = chatDict.id;
    if (chatIdRaw === null || chatIdRaw === undefined) continue;
    const chatId = String(chatIdRaw);
    const firstName = String(chatDict.first_name ?? "");
    const lastName = String(chatDict.last_name ?? "");
    const username = String(chatDict.username ?? "");
    const parts = [firstName, lastName].filter((p) => p.trim());
    const label = parts.join(" ") || (username ? `@${username}` : chatId);
    const isNew = addChat(chatId, label);
    const textRaw = typeof msg.text === "string" ? msg.text : "";
    const noteParsed = parseNoteCommand(textRaw);
    const tasklistParsed = parseTasklistCommand(textRaw);
    const isNoteCommand = noteParsed !== null;
    const isTasklistCommand = tasklistParsed !== null;
    if (isNoteCommand) {
      // /note sempre registra o chat (se ainda não registrado) e cria a nota
      if (noteParsed === undefined || !noteParsed) {
        await sendTelegramMessage(token, chatId, NOTE_EMPTY_MSG);
      } else {
        const truncated = noteParsed.length > 10000 ? noteParsed.slice(0, 10000) : noteParsed;
        const fromLabel = label || chatId;
        try {
          createNote(truncated, { createdBy: `telegram:${chatId}:${fromLabel}` });
        } catch (exc) {
          console.log(`[telegram] falha ao criar nota via /note: ${exc}`);
          await sendTelegramMessage(token, chatId, "❌ Falha ao criar nota. Tente novamente.");
          continue;
        }
        const preview = truncated.length > 120 ? truncated.slice(0, 120) + "…" : truncated;
        await sendTelegramMessage(token, chatId, `${NOTE_CREATED_MSG}\n\n"${preview}"`);
      }
      // se era novo chat e também era /note, não envia a mensagem de boas-vindas duplicada
      continue;
    }
    if (isTasklistCommand) {
      if (tasklistParsed === undefined || !tasklistParsed) {
        await sendTelegramMessage(token, chatId, TASKLIST_EMPTY_MSG);
      } else {
        const markdown = buildTasklistMarkdown(tasklistParsed);
        if (!markdown) {
          await sendTelegramMessage(token, chatId, TASKLIST_EMPTY_MSG);
        } else {
          const truncated = markdown.length > 10000 ? markdown.slice(0, 10000) : markdown;
          const fromLabel = label || chatId;
          try {
            createNote(truncated, { createdBy: `telegram:${chatId}:${fromLabel}` });
          } catch (exc) {
            console.log(`[telegram] falha ao criar tasklist via /tasklist: ${exc}`);
            await sendTelegramMessage(token, chatId, "❌ Falha ao criar tasklist. Tente novamente.");
            continue;
          }
          const count = truncated.split("\n").filter((l) => l.startsWith("- [ ]")).length;
          const preview = truncated.length > 300 ? truncated.slice(0, 300) + "…" : truncated;
          await sendTelegramMessage(token, chatId, `${TASKLIST_CREATED_MSG} (${count} ${count === 1 ? "tarefa" : "tarefas"})\n\n${preview}`);
        }
      }
      continue;
    }
    if (isNew) {
      await sendTelegramMessage(token, chatId, CONFIRMATION_MSG);
    }
  }
  return nextOffset;
}

export const get_bot_token = getBotToken;
export const validate_token = validateToken;
export const set_token = setToken;
export const clear_token = clearToken;
export const add_chat = addChat;
export const remove_chat = removeChat;
export const poll_once = pollOnce;
