import { useMemo, useState } from "react";
import { createAlarm } from "../../../api/client";
import type { AlarmsPublic } from "../../../api/types";
import { useRequest } from "../../../hooks/useRequest";
import { cfgHint } from "../../../tw";
import type { ALARMS_STR } from "../alarmsCopy";
import { ActionRow, Button, Card, FieldStatus, SelectField, TextField } from "../ui";
import { calendarUnitLabel, suggestLabel } from "./helpers";

export function CalendarAlarmCard({
    c,
    data,
    onReload,
}: {
    c: typeof ALARMS_STR.pt;
    data: AlarmsPublic;
    onReload: () => Promise<void>;
}) {
    const calendars = data.calendars ?? [];
    const metrics = data.metrics.calendar ?? [
        { key: "all", label: "Eventos e tarefas", kind: "calendar" as const },
        { key: "event", label: "Eventos", kind: "calendar" as const },
        { key: "task", label: "Tarefas", kind: "calendar" as const },
    ];

    const [metric, setMetric] = useState(metrics[0]?.key ?? "all");
    const [threshold, setThreshold] = useState(30);
    const [unit, setUnit] = useState<"minutes" | "hours" | "days">("minutes");
    const [calendarId, setCalendarId] = useState("*");
    const [label, setLabel] = useState("");
    const [labelDirty, setLabelDirty] = useState(false);

    const currentMetric = metrics.find((m) => m.key === metric);
    const suggested = useMemo(() => suggestLabel(c, "calendar", currentMetric, threshold, unit), [c, currentMetric, threshold, unit]);

    // auto-fill label if not dirty
    const displayLabel = labelDirty ? label : suggested;

    const addAction = useRequest();

    const canAdd = metric && threshold > 0 && Number.isFinite(threshold);

    return (
        <Card title={c.calendarSectionTitle} lead={c.calendarSectionLead}>
            <div className="flex flex-col gap-4">
                {calendars.length === 0 ? (
                    <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                        <p className="m-0 font-semibold">{c.calendarNoCalendars}</p>
                        <p className="m-0 mt-1 text-[12.5px] opacity-80">{c.calendarNoCalendarsHint}</p>
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField
                        label={c.calendarKind}
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                        options={metrics.map((m) => ({
                            value: m.key,
                            label: m.key === "event" ? c.calendarKindEvent : m.key === "task" ? c.calendarKindTask : c.calendarKindAll,
                        }))}
                    />
                    <SelectField
                        label={c.calendarTarget}
                        value={calendarId}
                        onChange={(e) => setCalendarId(e.target.value)}
                        options={[
                            { value: "*", label: c.calendarTargetAll },
                            ...calendars.map((cal) => ({ value: cal.id, label: cal.label || cal.url.slice(0, 32) })),
                        ]}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField
                        label={c.calendarThreshold}
                        type="number"
                        value={threshold}
                        onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
                    />
                    <SelectField
                        label={c.calendarUnit}
                        value={unit}
                        onChange={(e) => setUnit(e.target.value as "minutes" | "hours" | "days")}
                        options={[
                            { value: "minutes", label: c.calendarUnitMinutes },
                            { value: "hours", label: c.calendarUnitHours },
                            { value: "days", label: c.calendarUnitDays },
                        ]}
                    />
                </div>

                {currentMetric ? (
                    <p className={cfgHint}>
                        {c.triggerHintCalendar(threshold, unit)} · {calendarUnitLabel(c, unit)}
                    </p>
                ) : null}

                <ActionRow>
                    <TextField
                        label={c.label}
                        placeholder={suggested}
                        value={displayLabel}
                        onChange={(e) => {
                            setLabel(e.target.value);
                            setLabelDirty(e.target.value.trim() !== "");
                        }}
                    />
                    <Button
                        loading={addAction.busy}
                        disabled={!canAdd}
                        onClick={() =>
                            addAction.run(
                                async () => {
                                    const res = await createAlarm({
                                        provider: "calendar",
                                        metric,
                                        threshold,
                                        threshold_unit: unit,
                                        calendar_id: calendarId,
                                        label: labelDirty ? label : suggested,
                                    });
                                    if (res.ok) {
                                        setLabel("");
                                        setLabelDirty(false);
                                        await onReload();
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
                {addAction.message ? <FieldStatus status={addAction.status} message={addAction.message} /> : null}
            </div>
        </Card>
    );
}
