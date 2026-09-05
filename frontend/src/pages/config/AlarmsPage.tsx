import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { createAlarm, fetchAlarms } from "../../api/client";
import type { AlarmsPublic } from "../../api/types";
import { Skeleton } from "../../components/Skeleton";
import { useRequest } from "../../hooks/useRequest";
import { pageCol, cfgHint, cfgStatus, viewFade } from "../../tw";
import { ALARMS_STR } from "./alarmsCopy";
import type { ConfigOutlet } from "./usePublicConfig";
import { useTelegram } from "./useTelegram";
import { ActionRow, Button, Card, FieldStatus, SelectField, StatusPill, TextField } from "./ui";
import { AlarmsIOButtons } from "./alarmsPage/AlarmsIOButtons";
import { PROVIDER_LABEL, ruleHint, suggestLabel } from "./alarmsPage/helpers";
import { ProviderIcon } from "./alarmsPage/ProviderIcon";
import { RulesList } from "./alarmsPage/RulesList";
import { TelegramConnectedPanel } from "./alarmsPage/TelegramConnectedPanel";

export default function AlarmsPage() {
  const ctx = useOutletContext<ConfigOutlet | null>();
  const c = ALARMS_STR[ctx?.lang || "pt"];
  const telegram = useTelegram();
  const [tokenInput, setTokenInput] = useState("");

  const [data, setData] = useState<AlarmsPublic | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const reload = useCallback(async () => {
    try {
      const d = await fetchAlarms();
      setData(d);
      setPhase("ready");
    } catch {
      setPhase((p) => (p === "ready" ? "ready" : "error"));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const providers = data ? Object.keys(data.metrics || {}) : [];
  const [provider, setProvider] = useState("");
  const [metric, setMetric] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [label, setLabel] = useState("");
  const [labelDirty, setLabelDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (!provider && providers.length) setProvider(providers[0]);
  }, [data, provider, providers]);

  useEffect(() => {
    if (!data || !provider) return;
    const opts = data.metrics[provider] || [];
    if (!opts.some((m) => m.key === metric)) setMetric(opts[0]?.key || "");
  }, [data, provider, metric]);

  const telegramTokenAction = useRequest();
  const telegramTestAction = useRequest();
  const telegramRemoveAction = useRequest();
  const telegramClearAction = useRequest();
  const addAction = useRequest();

  const currentMetric = data?.metrics[provider]?.find((m) => m.key === metric);
  const tg = telegram.status;
  const tgBadge = tg?.chats.length
    ? { state: "ok" as const, label: c.telegramConnected }
    : tg?.configured
      ? { state: "warn" as const, label: c.telegramNotConnected }
      : { state: "missing" as const, label: c.telegramNotConnected };

  const suggestedLabel = useMemo(
    () => suggestLabel(c, provider, currentMetric, threshold),
    [c, provider, currentMetric, threshold],
  );

  useEffect(() => {
    if (!labelDirty) setLabel(suggestedLabel);
  }, [suggestedLabel, labelDirty]);

  if (phase === "loading" && !data) return <Skeleton page="alarms" />;

  if (phase === "error" && !data) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button onClick={() => { setPhase("loading"); void reload(); }}>{c.retry}</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
      </header>

      <Card title={c.telegramTitle} lead={c.telegramLead} action={<StatusPill state={tgBadge.state} label={tgBadge.label} />}>
        {!tg?.configured ? (
          <div className="flex flex-col gap-3">
            <p className={cfgHint}>{c.telegramBotFatherHint}</p>
            <ActionRow>
              <TextField
                label={c.telegramTitle}
                placeholder={c.telegramTokenPh}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <Button
                loading={telegramTokenAction.busy || telegram.busy}
                disabled={!tokenInput.trim()}
                onClick={() =>
                  telegramTokenAction.run(
                    async () => {
                      const res = await telegram.saveToken(tokenInput.trim());
                      if (res.ok) setTokenInput("");
                      return res;
                    },
                    { success: c.telegramSaveToken, error: c.offline },
                  )
                }
              >
                {telegramTokenAction.busy ? c.telegramSavingToken : c.telegramSaveToken}
              </Button>
            </ActionRow>
            {telegramTokenAction.message ? (
              <FieldStatus status={telegramTokenAction.status} message={telegramTokenAction.message} />
            ) : null}
          </div>
        ) : (
          <TelegramConnectedPanel
            c={c}
            botUsername={tg.bot_username}
            chats={tg.chats}
            telegramBusy={telegram.busy}
            testAction={telegramTestAction}
            removeAction={telegramRemoveAction}
            clearAction={telegramClearAction}
            onRemoveChat={(chatId) =>
              telegramRemoveAction.run(() => telegram.removeChat(chatId), {
                success: c.removed,
                error: c.offline,
              })
            }
            onSendTest={() =>
              telegramTestAction.run(() => telegram.sendTest(), {
                success: c.telegramTestSent,
                error: c.telegramTestFailed,
              })
            }
            onClear={() =>
              telegramClearAction.run(() => telegram.clearToken(), {
                success: c.telegramDisconnect,
                error: c.offline,
              })
            }
          />
        )}
      </Card>

      <Card title={c.rulesTitle} lead={c.rulesLead} action={<AlarmsIOButtons data={data} c={c} onReload={reload} />}>
        <div className="flex flex-col gap-5">
          <ActionRow>
            <div className="flex min-w-[140px] flex-1 items-end gap-2.5">
              {provider ? <ProviderIcon provider={provider} size="lg" /> : null}
              <SelectField
                label={c.provider}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                wrapperClassName="min-w-0 flex-1"
                options={providers.map((p) => ({ value: p, label: PROVIDER_LABEL[p] || p }))}
              />
            </div>
            <SelectField
              label={c.metric}
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              options={(data.metrics[provider] || []).map((m) => ({ value: m.key, label: m.label }))}
            />
            <TextField
              label={c.threshold}
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </ActionRow>
          <ActionRow>
            <TextField
              label={c.label}
              placeholder={c.labelPh}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelDirty(e.target.value.trim() !== "");
              }}
            />
            <Button
              loading={addAction.busy}
              disabled={!provider || !metric}
              onClick={() =>
                addAction.run(
                  async () => {
                    const res = await createAlarm({ provider, metric, threshold, label });
                    if (res.ok) {
                      setLabel("");
                      setLabelDirty(false);
                      await reload();
                    }
                    return res;
                  },
                  { success: c.added, error: c.addFailed },
                )
              }
            >
              {addAction.busy ? c.adding : c.add}
            </Button>
          </ActionRow>
        </div>
        {currentMetric ? <p className={cfgHint}>{ruleHint(c, currentMetric, threshold)}</p> : null}
        {addAction.message ? <FieldStatus status={addAction.status} message={addAction.message} /> : null}

        <RulesList data={data} c={c} onReload={reload} className="mt-6" />
      </Card>
    </div>
  );
}
