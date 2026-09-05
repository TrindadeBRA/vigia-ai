import { useState } from "react";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Fold, SelectField, Switch, TextField } from "./ui";

type CalendarItem = { id: string; url: string; label: string; kind: "events" | "tasks"; limit: number };
type CalendarConfig = { enabled: boolean; hidden: boolean; calendars: CalendarItem[] };

async function apiPost(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data;
}
async function apiPatch(path: string, body: unknown) {
    const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data;
}
async function apiDelete(path: string) {
    const res = await fetch(path, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data;
}

function CalendarRow({ item, c, onReload }: { item: CalendarItem; c: ConfigCopy; onReload: () => Promise<void> }) {
    const remove = useRequest();
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(item.label);
    const [url, setUrl] = useState(item.url);
    const [kind, setKind] = useState(item.kind);
    const [limit, setLimit] = useState(String(item.limit));
    const save = useRequest();

    return (
        <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">
                        {item.label || item.url.slice(0, 32)}
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.kind === "tasks" ? "bg-accent text-accent-ink" : "bg-chip text-ink2"}`}>{item.kind === "tasks" ? "Tarefas" : "Eventos"}</span>
                    </p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{item.url} · {item.limit} itens</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => remove.run(async () => { const r = await apiDelete(`/api/calendar/calendars/${item.id}`); await onReload(); return r; }, { success: c.removed, error: c.offline })}>{remove.busy ? c.removing : c.remove}</Button>
                </div>
            </div>
            {editing ? (
                <div className="flex flex-col gap-2 border-t border-edge pt-2">
                    <TextField label={c.calendarUrlLabel} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={c.calendarUrlPh} />
                    <TextField label={c.calendarLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.calendarLabelPh} />
                    <div className="flex gap-2">
                        <SelectField label={c.calendarKindLabel} value={kind} onChange={(e) => setKind(e.target.value as "events" | "tasks")} options={[{ value: "events", label: c.calendarKindEvents }, { value: "tasks", label: c.calendarKindTasks }]} />
                        <SelectField label={c.calendarLimitLabel} value={limit} onChange={(e) => setLimit(e.target.value)} options={["3", "5", "10", "15", "20", "30", "50"].map((v) => ({ value: v, label: v }))} />
                    </div>
                    <Button loading={save.busy} onClick={() => save.run(async () => { const r = await apiPatch(`/api/calendar/calendars/${item.id}`, { url, label, kind, limit: Number(limit) }); await onReload(); setEditing(false); return r; }, { success: c.saved, error: c.offline })}>{save.busy ? c.saving : c.save}</Button>
                    {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
                </div>
            ) : null}
            {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
        </li>
    );
}

export function CalendarConfigCard({ calendar, c, onReload }: { calendar: CalendarConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [url, setUrl] = useState("");
    const [label, setLabel] = useState("");
    const [kind, setKind] = useState<"events" | "tasks">("events");
    const [limit, setLimit] = useState("5");
    const [preview, setPreview] = useState<{ ok: boolean; error?: string; events?: unknown[] } | null>(null);

    const toggleEnabled = useRequest();
    const add = useRequest();
    const doPreview = useRequest();

    const hint = calendar.calendars.length ? `${calendar.calendars.length} calendário${calendar.calendars.length === 1 ? "" : "s"}` : c.calendarEmpty;
    const listSummary = calendar.calendars.length ? `${c.calendarListLabel} (${calendar.calendars.length})` : c.calendarListLabel;

    async function handlePreview() {
        const u = url.trim();
        if (!u) { setPreview({ ok: false, error: c.calendarNoPreview }); return; }
        setPreview(null);
        await doPreview.run(async () => {
            try {
                const data = await apiPost("/api/calendar/preview", { url: u, label: label.trim(), kind, limit: Number(limit) }) as { ok: boolean; error?: string; events?: unknown[] };
                setPreview(data);
                return { ok: data.ok, error: data.error } as { ok: boolean; error?: string };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setPreview({ ok: false, error: msg });
                return { ok: false, error: msg };
            }
        }, { success: c.calendarPreviewOk, error: c.calendarPreviewFail });
    }

    async function handleAdd() {
        const u = url.trim();
        if (!u) return;
        await add.run(async () => {
            const res = await apiPost("/api/calendar/calendars", { url: u, label: label.trim(), kind, limit: Number(limit) });
            if ((res as { ok?: boolean }).ok) {
                await onReload();
                setUrl(""); setLabel(""); setPreview(null);
            }
            return res as { ok: boolean; error?: string };
        }, { success: c.added, error: c.offline });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        {PROVIDER_ICON.calendar ? <img className={iconImg} src={PROVIDER_ICON.calendar} alt="" draggable={false} /> : <span className="text-[18px]">📅</span>}
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.calendarTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={calendar.enabled && !calendar.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await apiPatch("/api/calendar/config", { enabled: next, hidden: !next });
                            await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.calendarLead}</p>

            <Fold summary={listSummary}>
                {calendar.calendars.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {calendar.calendars.map((item) => (
                            <CalendarRow key={item.id} item={item} c={c} onReload={onReload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.calendarEmpty}</p>
                )}
            </Fold>

            <Fold summary={c.calendarAdd}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.calendarUrlLabel} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={c.calendarUrlPh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.calendarUrlHint}</p>
                    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
                        <TextField label={c.calendarLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.calendarLabelPh} />
                        <SelectField label={c.calendarKindLabel} value={kind} onChange={(e) => setKind(e.target.value as "events" | "tasks")} options={[{ value: "events", label: c.calendarKindEvents }, { value: "tasks", label: c.calendarKindTasks }]} />
                    </div>
                    <SelectField label={c.calendarLimitLabel} value={limit} onChange={(e) => setLimit(e.target.value)} options={["3", "5", "10", "15", "20", "30", "50"].map((v) => ({ value: v, label: v }))} />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.calendarLimitHint}</p>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" loading={doPreview.busy} onClick={() => void handlePreview()} disabled={!url.trim()}>
                            {doPreview.busy ? c.calendarPreviewing : c.calendarPreview}
                        </Button>
                        <Button loading={add.busy} onClick={() => void handleAdd()} disabled={!url.trim()}>
                            {add.busy ? c.adding : c.calendarAdd}
                        </Button>
                    </div>

                    {preview ? (
                        <div className={`rounded-[10px] border px-3 py-2.5 text-[12px] ${preview.ok ? "border-good/30 bg-good/10 text-ink" : "border-bad/30 bg-bad/10 text-bad"}`}>
                            {preview.ok ? (
                                <span>{c.calendarPreviewOk} {Array.isArray(preview.events) ? `· ${preview.events.length} itens` : ""}</span>
                            ) : (
                                <span>{preview.error || c.calendarPreviewFail}</span>
                            )}
                        </div>
                    ) : null}
                    {doPreview.message ? <FieldStatus status={doPreview.status} message={doPreview.message} /> : null}
                    {add.message ? <FieldStatus status={add.status} message={add.message} /> : null}
                </div>
            </Fold>
        </article>
    );
}
