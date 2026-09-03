import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { createAlarm, deleteAlarm, fetchAlarms, patchAlarm } from "../../api/client";
import type { AlarmMetric, AlarmsPublic } from "../../api/types";
import { Skeleton } from "../../components/Skeleton";
import { useRequest } from "../../hooks/useRequest";
import { cfgFieldLabel, cfgGrid, cfgHint, cfgStatus, pageCol, viewFade } from "../../tw";
import { ALARMS_STR } from "./alarmsCopy";
import type { ConfigOutlet } from "./usePublicConfig";
import { usePush, type PushSupport } from "./usePush";
import { useTelegram } from "./useTelegram";
import { ActionRow, Button, Card, FieldStatus, StatusPill, Switch, TextField } from "./ui";

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

function pushBadge(state: PushSupport, c: typeof ALARMS_STR.pt): { state: "ok" | "warn" | "missing"; label: string } {
  if (state === "unsupported") return { state: "missing", label: c.pushUnsupported };
  if (state === "denied") return { state: "missing", label: c.pushDenied };
  if (state === "on") return { state: "ok", label: c.pushOn };
  return { state: "warn", label: c.pushOff };
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
      <span className={cfgFieldLabel}>{label}</span>
      <select
        className="w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ruleHint(c: typeof ALARMS_STR.pt, metric: AlarmMetric | undefined, threshold: number): string {
  if (!metric) return "";
  return metric.kind === "percent" ? c.triggerHintPercent(threshold) : c.triggerHintCents(threshold);
}

function suggestLabel(c: typeof ALARMS_STR.pt, provider: string, metric: AlarmMetric | undefined, threshold: number): string {
  if (!metric) return "";
  const providerName = PROVIDER_LABEL[provider] || provider;
  return metric.kind === "percent"
    ? c.suggestUsage(providerName, threshold, metric.label)
    : c.suggestBalance(providerName, `$${(threshold / 100).toFixed(2)}`, metric.label);
}

export default function AlarmsPage() {
  const ctx = useOutletContext<ConfigOutlet | null>();
  const c = ALARMS_STR[ctx?.lang || "pt"];
  const push = usePush();
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

  const pushAction = useRequest();
  const testAction = useRequest();
  const telegramTokenAction = useRequest();
  const telegramTestAction = useRequest();
  const telegramRemoveAction = useRequest();
  const telegramClearAction = useRequest();
  const addAction = useRequest();

  const TEST_DELAY_S = 15;
  const [testCountdown, setTestCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (testCountdown === null || testCountdown <= 0) return;
    const id = window.setTimeout(() => setTestCountdown((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [testCountdown]);

  useEffect(() => {
    if (testCountdown !== 0) return;
    setTestCountdown(null);
    void testAction.run(() => push.sendTest(), { success: c.testSent, error: c.testFailed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testCountdown]);

  const currentMetric = data?.metrics[provider]?.find((m) => m.key === metric);
  const badge = pushBadge(push.state, c);
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

      <Card title={c.pushTitle} lead={c.pushLead} action={<StatusPill state={badge.state} label={badge.label} />}>
        <ActionRow>
          {push.state === "on" ? (
            <Button
              variant="secondary"
              loading={pushAction.busy}
              onClick={() =>
                pushAction.run(() => push.unsubscribe(), { success: c.pushOff, error: c.offline })
              }
            >
              {pushAction.busy ? c.disabling : c.disable}
            </Button>
          ) : (
            <Button
              loading={pushAction.busy}
              disabled={push.state === "unsupported" || push.state === "denied"}
              onClick={() =>
                pushAction.run(() => push.subscribe(), { success: c.pushOn, error: c.offline })
              }
            >
              {pushAction.busy ? c.enabling : c.enable}
            </Button>
          )}
          <Button
            variant="ghost"
            loading={testAction.busy}
            disabled={push.state !== "on" || testCountdown !== null}
            onClick={() => setTestCountdown(TEST_DELAY_S)}
          >
            {testCountdown !== null ? c.sendingTestIn(testCountdown) : testAction.busy ? c.sendingTest : c.sendTest}
          </Button>
        </ActionRow>
        {pushAction.message ? <FieldStatus status={pushAction.status} message={pushAction.message} /> : null}
        {testAction.message ? <FieldStatus status={testAction.status} message={testAction.message} /> : null}
        <p className={cfgHint}>{c.secureContextNote}</p>
      </Card>

      <Card title={c.telegramTitle} lead={c.telegramLead} action={<StatusPill state={tgBadge.state} label={tgBadge.label} />}>
        {!tg?.configured ? (
          <>
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
          </>
        ) : (
          <>
            {tg.chats.length === 0 ? (
              <>
                <ActionRow>
                  <Button
                    variant="secondary"
                    onClick={() => window.open(`https://t.me/${tg.bot_username}`, "_blank", "noopener,noreferrer")}
                  >
                    {c.telegramOpenBot}
                  </Button>
                </ActionRow>
                <p className={cfgHint}>{c.telegramConnectHint}</p>
              </>
            ) : (
              <>
                <div className={cfgGrid}>
                  {tg.chats.map((chat) => (
                    <article
                      key={chat.id}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-edge bg-panel px-[18px] py-3 shadow-card [.flat_&]:shadow-none"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-ink">{chat.label || chat.id}</span>
                      <Button
                        variant="ghost"
                        loading={telegramRemoveAction.busy}
                        onClick={() =>
                          telegramRemoveAction.run(() => telegram.removeChat(chat.id), {
                            success: c.removed,
                            error: c.offline,
                          })
                        }
                      >
                        {telegramRemoveAction.busy ? c.removing : c.remove}
                      </Button>
                    </article>
                  ))}
                </div>
                <ActionRow>
                  <Button
                    variant="ghost"
                    loading={telegramTestAction.busy}
                    onClick={() =>
                      telegramTestAction.run(() => telegram.sendTest(), {
                        success: c.telegramTestSent,
                        error: c.telegramTestFailed,
                      })
                    }
                  >
                    {telegramTestAction.busy ? c.sendingTest : c.sendTest}
                  </Button>
                </ActionRow>
                {telegramTestAction.message ? (
                  <FieldStatus status={telegramTestAction.status} message={telegramTestAction.message} />
                ) : null}
              </>
            )}
            <ActionRow>
              <Button
                variant="secondary"
                loading={telegramClearAction.busy || telegram.busy}
                onClick={() =>
                  telegramClearAction.run(() => telegram.clearToken(), {
                    success: c.telegramDisconnect,
                    error: c.offline,
                  })
                }
              >
                {telegramClearAction.busy ? c.telegramDisconnecting : tg.chats.length ? c.telegramDisconnect : c.telegramChangeToken}
              </Button>
            </ActionRow>
            {telegramClearAction.message ? (
              <FieldStatus status={telegramClearAction.status} message={telegramClearAction.message} />
            ) : null}
          </>
        )}
      </Card>

      <Card title={c.rulesTitle} lead={c.rulesLead}>
        <ActionRow>
          <Select
            label={c.provider}
            value={provider}
            onChange={setProvider}
            options={providers.map((p) => ({ value: p, label: PROVIDER_LABEL[p] || p }))}
          />
          <Select
            label={c.metric}
            value={metric}
            onChange={setMetric}
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
        {currentMetric ? <p className={cfgHint}>{ruleHint(c, currentMetric, threshold)}</p> : null}
        {addAction.message ? <FieldStatus status={addAction.status} message={addAction.message} /> : null}

        <div className={cfgGrid}>
          {data.rules.length === 0 ? <p className={cfgHint}>{c.empty}</p> : null}
          {data.rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} metric={data.metrics[rule.provider]?.find((m) => m.key === rule.metric)} c={c} onReload={reload} />
          ))}
        </div>
      </Card>
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

  const title = rule.label || suggestLabel(c, rule.provider, metric, rule.threshold) || `${PROVIDER_LABEL[rule.provider] || rule.provider} · ${metric?.label || rule.metric}`;

  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-2xl border border-edge bg-panel px-[18px] py-4 shadow-card [.flat_&]:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <TextField label={c.label} placeholder={c.labelPh} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
              <TextField
                label={c.threshold}
                type="number"
                value={editThreshold}
                onChange={(e) => setEditThreshold(Number(e.target.value))}
              />
              <p className="m-0 text-[12.5px] leading-[1.45] text-ink3">{ruleHint(c, metric, editThreshold)}</p>
            </div>
          ) : (
            <>
              <h3 className="m-0 text-[14.5px] font-bold">{title}</h3>
              <p className="mb-0 mt-1 text-[12.5px] leading-[1.45] text-ink3">{ruleHint(c, metric, rule.threshold)}</p>
            </>
          )}
        </div>
        {!editing ? (
          <Switch
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
        ) : null}
      </div>
      <ActionRow>
        {editing ? (
          <>
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
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={startEdit}>
              {c.edit}
            </Button>
            <Button
              variant="ghost"
              loading={remove.busy}
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
              {remove.busy ? c.removing : c.remove}
            </Button>
          </>
        )}
      </ActionRow>
      {toggle.message || remove.message || save.message ? (
        <FieldStatus
          status={save.message ? save.status : remove.message ? remove.status : toggle.status}
          message={save.message || remove.message || toggle.message}
        />
      ) : null}
    </article>
  );
}
