import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { createAlarm, deleteAlarm, fetchAlarms, patchAlarm } from "../../api/client";
import type { AlarmMetric, AlarmsPublic, TelegramChat } from "../../api/types";
import { Skeleton } from "../../components/Skeleton";
import { cn } from "../../cn";
import { useRequest } from "../../hooks/useRequest";
import { SlidersIcon, TrashIcon } from "../../components/icons";
import { PROVIDER_ICON } from "../../theme";
import { cfgFieldLabel, cfgHint, cfgStatus, iconBtn, iconChip, iconImg, pageCol, viewFade } from "../../tw";
import { ALARMS_STR } from "./alarmsCopy";
import type { ConfigOutlet } from "./usePublicConfig";
import { useTelegram } from "./useTelegram";
import { ActionRow, Button, Card, FieldStatus, SelectField, StatusPill, Switch, TextField } from "./ui";

const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  gpt: "GPT",
  cursor: "Cursor",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  opencode: "OpenCode",
  fal: "fal.ai",
  bitcoin: "Bitcoin",
  adsense: "AdSense",
};

function ruleHint(c: typeof ALARMS_STR.pt, metric: AlarmMetric | undefined, threshold: number): string {
  if (!metric) return "";
  return metric.kind === "percent" ? c.triggerHintPercent(threshold) : c.triggerHintCents(threshold);
}

function formatThreshold(metric: AlarmMetric | undefined, threshold: number): string {
  if (metric?.kind === "cents") return `$${(threshold / 100).toFixed(2)}`;
  return `${threshold}%`;
}

function ruleSearchText(
  c: typeof ALARMS_STR.pt,
  rule: AlarmsPublic["rules"][number],
  metric: AlarmMetric | undefined,
): string {
  const providerName = PROVIDER_LABEL[rule.provider] || rule.provider;
  const metricName = metric?.label || rule.metric;
  const title = rule.label || suggestLabel(c, rule.provider, metric, rule.threshold);
  return `${providerName} ${metricName} ${title} ${formatThreshold(metric, rule.threshold)}`.toLowerCase();
}

function suggestLabel(c: typeof ALARMS_STR.pt, provider: string, metric: AlarmMetric | undefined, threshold: number): string {
  if (!metric) return "";
  const providerName = PROVIDER_LABEL[provider] || provider;
  return metric.kind === "percent"
    ? c.suggestUsage(providerName, threshold, metric.label)
    : c.suggestBalance(providerName, `$${(threshold / 100).toFixed(2)}`, metric.label);
}

function ProviderIcon({
  provider,
  size = "sm",
  className,
}: {
  provider: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const src = PROVIDER_ICON[provider];
  if (!src) return null;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]",
        size === "lg" ? "size-[42px]" : iconChip,
        className,
      )}
      aria-hidden
    >
      <img
        className={cn("object-contain", size === "lg" ? "size-[26px]" : iconImg)}
        src={src}
        alt=""
        draggable={false}
      />
    </span>
  );
}

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

      <Card title={c.rulesTitle} lead={c.rulesLead}>
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

function TelegramConnectedPanel({
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

function RulesList({
  data,
  c,
  onReload,
  className,
}: {
  data: AlarmsPublic;
  c: typeof ALARMS_STR.pt;
  onReload: () => Promise<void>;
  className?: string;
}) {
  const [filterProvider, setFilterProvider] = useState("");
  const [search, setSearch] = useState("");

  const providerOrder = useMemo(() => Object.keys(data.metrics || {}), [data.metrics]);
  const activeCount = useMemo(() => data.rules.filter((r) => r.enabled).length, [data.rules]);

  const sortedRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rules = data.rules;
    if (filterProvider) rules = rules.filter((r) => r.provider === filterProvider);
    if (q) {
      rules = rules.filter((rule) => {
        const metric = data.metrics[rule.provider]?.find((m) => m.key === rule.metric);
        return ruleSearchText(c, rule, metric).includes(q);
      });
    }

    return [...rules].sort((a, b) => {
      const pa = providerOrder.indexOf(a.provider);
      const pb = providerOrder.indexOf(b.provider);
      const providerCmp = (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
      if (providerCmp !== 0) return providerCmp;
      const ma = data.metrics[a.provider]?.find((m) => m.key === a.metric)?.label || a.metric;
      const mb = data.metrics[b.provider]?.find((m) => m.key === b.metric)?.label || b.metric;
      return ma.localeCompare(mb) || a.threshold - b.threshold;
    });
  }, [c, data.metrics, data.rules, filterProvider, providerOrder, search]);

  const showToolbar = data.rules.length > 0;

  if (data.rules.length === 0) {
    return <p className={cn(cfgHint, className)}>{c.empty}</p>;
  }

  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-edge bg-canvas/25 p-2", className)}>
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-2 pb-2 pt-1">
          <p className="m-0 text-sm font-semibold text-ink">{c.rulesSummary(data.rules.length, activeCount)}</p>
          <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-2 sm:max-w-[420px]">
            {data.rules.length >= 4 ? (
              <div className="min-w-[140px] flex-[1.4]">
                <TextField
                  placeholder={c.searchRules}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            ) : null}
            {providerOrder.length > 1 ? (
              <SelectField
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                wrapperClassName="min-w-[148px] flex-1"
                options={[
                  { value: "", label: c.filterAll },
                  ...providerOrder.map((p) => ({ value: p, label: PROVIDER_LABEL[p] || p })),
                ]}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {sortedRules.length === 0 ? (
        <p className={cn(cfgHint, "px-2 py-4")}>{c.rulesFilteredEmpty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-edge p-0">
          {sortedRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              metric={data.metrics[rule.provider]?.find((m) => m.key === rule.metric)}
              c={c}
              onReload={onReload}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  metric,
  c,
  onReload,
}: {
  rule: AlarmsPublic["rules"][number];
  metric: AlarmMetric | undefined;
  c: typeof ALARMS_STR.pt;
  onReload: () => Promise<void>;
}) {
  const toggle = useRequest();
  const remove = useRequest();
  const save = useRequest();
  const [editing, setEditing] = useState(false);
  const [editThreshold, setEditThreshold] = useState(rule.threshold);
  const [editLabel, setEditLabel] = useState(rule.label);

  const startEdit = () => {
    setEditThreshold(rule.threshold);
    setEditLabel(rule.label);
    setEditing(true);
  };

  const suggested = suggestLabel(c, rule.provider, metric, rule.threshold);
  const customName = rule.label.trim() && rule.label.trim() !== suggested.trim() ? rule.label.trim() : "";
  const metricLabel = metric?.label || rule.metric;
  const thresholdLabel = formatThreshold(metric, rule.threshold);

  if (editing) {
    return (
      <li className="bg-panel/30 px-3 py-3 transition-colors hover:bg-chip/45">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ProviderIcon provider={rule.provider} />
            <span className="text-sm font-bold text-ink">{PROVIDER_LABEL[rule.provider] || rule.provider}</span>
            <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-bold text-ink">{metricLabel}</span>
            <span className="font-mono text-xs font-semibold text-accent">{thresholdLabel}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={c.label} placeholder={c.labelPh} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            <TextField
              label={c.threshold}
              type="number"
              value={editThreshold}
              onChange={(e) => setEditThreshold(Number(e.target.value))}
            />
          </div>
          <p className="m-0 text-[12.5px] leading-[1.45] text-ink3">{ruleHint(c, metric, editThreshold)}</p>
          <ActionRow>
            <Button
              loading={save.busy}
              onClick={() =>
                save.run(
                  async () => {
                    const res = await patchAlarm(rule.id, { threshold: editThreshold, label: editLabel });
                    if (res.ok) {
                      await onReload();
                      setEditing(false);
                    }
                    return res;
                  },
                  { success: c.saved, error: c.saveFailed },
                )
              }
            >
              {save.busy ? c.saving : c.save}
            </Button>
            <Button variant="ghost" disabled={save.busy} onClick={() => setEditing(false)}>
              {c.cancel}
            </Button>
          </ActionRow>
          {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "transition-colors hover:bg-chip/45",
        !rule.enabled && "opacity-55",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <ProviderIcon provider={rule.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-ink">
              {PROVIDER_LABEL[rule.provider] || rule.provider} · {metricLabel}
            </span>
            <span className="shrink-0 rounded-full border border-edge bg-chip px-2 py-0.5 font-mono text-[11px] font-bold text-accent">
              {thresholdLabel}
            </span>
          </div>
          <p className="m-0 mt-0.5 truncate text-[12px] leading-snug text-ink3">
            {customName || ruleHint(c, metric, rule.threshold)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Switch
            compact
            label={c.enabledLabel}
            busy={toggle.busy}
            checked={rule.enabled}
            onChange={(e) =>
              toggle.run(async () => {
                const res = await patchAlarm(rule.id, { enabled: e.target.checked });
                if (res.ok) await onReload();
                return res;
              })
            }
          />
          <button type="button" className={iconBtn} aria-label={c.edit} onClick={startEdit}>
            <SlidersIcon size={16} />
          </button>
          <button
            type="button"
            className={cn(iconBtn, "text-bad hover:text-bad")}
            aria-label={c.remove}
            disabled={remove.busy}
            onClick={() =>
              remove.run(
                async () => {
                  const res = await deleteAlarm(rule.id);
                  if (res.ok) await onReload();
                  return res;
                },
                { success: c.removed },
              )
            }
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>

      {toggle.message || remove.message ? (
        <div className="px-3 pb-2.5">
          <FieldStatus
            status={remove.message ? remove.status : toggle.status}
            message={remove.message || toggle.message}
          />
        </div>
      ) : null}
    </li>
  );
}
