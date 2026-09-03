import { useCallback, useEffect, useState } from "react";
import {
  clearTelegramToken,
  fetchTelegramStatus,
  removeTelegramChat,
  saveTelegramToken,
  testTelegram,
} from "../../api/client";
import type { TelegramStatus } from "../../api/types";

export function useTelegram() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchTelegramStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status?.configured || status.chats.length > 0) return;
    const id = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(id);
  }, [status?.configured, status?.chats.length, refresh]);

  const saveToken = useCallback(
    async (token: string) => {
      setBusy(true);
      try {
        const res = await saveTelegramToken(token);
        if (res.ok) await refresh();
        return res;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const clearToken = useCallback(async () => {
    setBusy(true);
    try {
      const res = await clearTelegramToken();
      if (res.ok) await refresh();
      return res;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const removeChat = useCallback(
    async (chatId: string) => {
      setBusy(true);
      try {
        const res = await removeTelegramChat(chatId);
        if (res.ok) await refresh();
        return res;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const sendTest = useCallback(async () => testTelegram(), []);

  return { status, busy, refresh, saveToken, clearToken, removeChat, sendTest };
}
