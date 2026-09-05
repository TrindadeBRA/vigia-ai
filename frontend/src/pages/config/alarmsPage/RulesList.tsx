import { useMemo, useState } from "react";
import { deleteAlarm, patchAlarm } from "../../../api/client";
import type { AlarmMetric, AlarmsPublic } from "../../../api/types";
import { cn } from "../../../cn";
import { useRequest } from "../../../hooks/useRequest";
import { TrashIcon, SlidersIcon } from "../../../components/icons";
import { cfgHint, iconBtn } from "../../../tw";
import type { ALARMS_STR } from "../alarmsCopy";
import { ActionRow, Button, FieldStatus, SelectField, Switch, TextField } from "../ui";
import { PROVIDER_LABEL, formatThreshold, ruleHint, ruleSearchText, suggestLabel } from "./helpers";
import { ProviderIcon } from "./ProviderIcon";

export function RulesList({
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
