import type { TelegramChat } from "../../../api/types";
import { cn } from "../../../cn";
import { useRequest } from "../../../hooks/useRequest";
import { cfgFieldLabel } from "../../../tw";
import type { ALARMS_STR } from "../alarmsCopy";
import { Button, FieldStatus } from "../ui";

export function TelegramConnectedPanel({
  c,
  botUsername,
  chats,
  telegramBusy,
  testAction,
  removeAction,
  clearAction,
  onRemoveChat,
  onSendTest,
  onClear,
}: {
  c: typeof ALARMS_STR.pt;
  botUsername: string;
  chats: TelegramChat[];
  telegramBusy: boolean;
  testAction: ReturnType<typeof useRequest>;
  removeAction: ReturnType<typeof useRequest>;
  clearAction: ReturnType<typeof useRequest>;
  onRemoveChat: (chatId: string) => void;
  onSendTest: () => void;
  onClear: () => void;
}) {
  const hasChats = chats.length > 0;
  const openBot = () => {
    if (botUsername) window.open(`https://t.me/${botUsername}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="w-full overflow-hidden rounded-xl border border-edge bg-canvas/25">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#229ED9]/15 text-lg font-bold text-[#229ED9]"
              aria-hidden
            >
              @
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[11.5px] font-[650] uppercase tracking-[.4px] text-ink3">{c.telegramBotLabel}</p>
              <p className="m-0 mt-0.5 truncate text-sm font-semibold text-ink">
                {botUsername ? `@${botUsername}` : c.telegramConnected}
              </p>
            </div>
          </div>
          {botUsername ? (
            <Button variant="secondary" className="shrink-0" onClick={openBot}>
              {c.telegramOpenBotShort}
            </Button>
          ) : null}
        </div>

        {hasChats ? (
          <div className="w-full border-b border-edge">
            <div className="px-4 pt-3">
              <span className={cfgFieldLabel}>{c.telegramRecipients}</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-0 p-0">
              {chats.map((chat, index) => {
                const label = chat.label || chat.id;
                const initial = (label.trim()[0] || "?").toUpperCase();
                return (
                  <li
                    key={chat.id}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3",
                      index < chats.length - 1 && "border-b border-edge/70",
                    )}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#229ED9]/15 text-sm font-bold text-[#229ED9]"
                      aria-hidden
                    >
                      {initial}
                    </span>
                    <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-ink">{label}</p>
                    <Button
                      variant="ghost"
                      className="shrink-0 px-2.5"
                      loading={removeAction.busy}
                      onClick={() => onRemoveChat(chat.id)}
                    >
                      {removeAction.busy ? c.removing : c.remove}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 border-b border-edge px-4 py-6 text-center">
            <p className="m-0 max-w-[40ch] text-sm leading-relaxed text-ink2">{c.telegramConnectHint}</p>
            {botUsername ? (
              <Button variant="secondary" onClick={openBot}>
                {c.telegramOpenBot}
              </Button>
            ) : null}
          </div>
        )}

        <div className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {hasChats ? (
              <Button variant="secondary" loading={testAction.busy} onClick={onSendTest}>
                {testAction.busy ? c.sendingTest : c.sendTest}
              </Button>
            ) : null}
          </div>
          <Button variant="ghost" loading={clearAction.busy || telegramBusy} onClick={onClear}>
            {clearAction.busy ? c.telegramDisconnecting : hasChats ? c.telegramDisconnect : c.telegramChangeToken}
          </Button>
        </div>
      </div>

      {testAction.message ? <FieldStatus status={testAction.status} message={testAction.message} /> : null}
      {clearAction.message ? <FieldStatus status={clearAction.status} message={clearAction.message} /> : null}
    </div>
  );
}
