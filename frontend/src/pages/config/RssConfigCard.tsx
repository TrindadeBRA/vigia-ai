import { useState } from "react";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Fold, SelectField, Switch, TextField } from "./ui";

type RssFeedConfig = { id: string; url: string; label: string; limit: number };
type RssConfig = { enabled: boolean; hidden: boolean; feeds: RssFeedConfig[] };

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

function RssRow({ feed, c, onReload }: { feed: RssFeedConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const remove = useRequest();
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(feed.label);
    const [url, setUrl] = useState(feed.url);
    const [limit, setLimit] = useState(String(feed.limit));
    const save = useRequest();

    return (
        <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{feed.label || feed.url.replace(/^https?:\/\//, "").slice(0, 32)}</p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{feed.url} · {feed.limit} itens</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => remove.run(async () => { const r = await apiDelete(`/api/rss/feeds/${feed.id}`); await onReload(); return r; }, { success: c.removed, error: c.offline })}>{remove.busy ? c.removing : c.remove}</Button>
                </div>
            </div>
            {editing ? (
                <div className="flex flex-col gap-2 border-t border-edge pt-2">
                    <TextField label={c.rssUrlLabel} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={c.rssUrlPh} />
                    <TextField label={c.rssLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.rssLabelPh} />
                    <SelectField label={c.rssLimitLabel} value={limit} onChange={(e) => setLimit(e.target.value)} options={["3", "5", "10", "15", "20", "30", "50"].map((v) => ({ value: v, label: v }))} />
                    <Button loading={save.busy} onClick={() => save.run(async () => { const r = await apiPatch(`/api/rss/feeds/${feed.id}`, { url, label, limit: Number(limit) }); await onReload(); setEditing(false); return r; }, { success: c.saved, error: c.offline })}>{save.busy ? c.saving : c.save}</Button>
                    {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
                </div>
            ) : null}
            {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
        </li>
    );
}

export function RssConfigCard({ rss, c, onReload }: { rss: RssConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [url, setUrl] = useState("");
    const [label, setLabel] = useState("");
    const [limit, setLimit] = useState("10");
    const [preview, setPreview] = useState<{ ok: boolean; error?: string; items?: unknown[]; title?: string | null } | null>(null);

    const toggleEnabled = useRequest();
    const add = useRequest();
    const doPreview = useRequest();

    const feeds = rss?.feeds ?? [];
    const hint = feeds.length ? `${feeds.length} feed${feeds.length === 1 ? "" : "s"}` : c.rssEmpty;
    const listSummary = feeds.length ? `${c.rssListLabel} (${feeds.length})` : c.rssListLabel;

    async function handlePreview() {
        const u = url.trim();
        if (!u) { setPreview({ ok: false, error: c.rssNoPreview }); return; }
        setPreview(null);
        await doPreview.run(async () => {
            try {
                const data = await apiPost("/api/rss/preview", { url: u, label: label.trim(), limit: Number(limit) }) as { ok: boolean; error?: string; items?: unknown[]; title?: string | null };
                setPreview(data);
                return { ok: data.ok, error: data.error } as { ok: boolean; error?: string };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setPreview({ ok: false, error: msg });
                return { ok: false, error: msg };
            }
        }, { success: c.rssPreviewOk, error: c.rssPreviewFail });
    }

    async function handleAdd() {
        const u = url.trim();
        if (!u) return;
        await add.run(async () => {
            const res = await apiPost("/api/rss/feeds", { url: u, label: label.trim(), limit: Number(limit) });
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
                        {PROVIDER_ICON.rss ? <img className={iconImg} src={PROVIDER_ICON.rss} alt="" draggable={false} /> : <span className="text-[18px]">📰</span>}
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.rssTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={Boolean(rss?.enabled && !rss?.hidden)}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await apiPatch("/api/rss/config", { enabled: next, hidden: !next });
                            await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.rssLead}</p>

            <Fold summary={listSummary}>
                {feeds.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {feeds.map((feed) => (
                            <RssRow key={feed.id} feed={feed} c={c} onReload={onReload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.rssEmpty}</p>
                )}
            </Fold>

            <Fold summary={c.rssAdd}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.rssUrlLabel} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={c.rssUrlPh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.rssUrlHint}</p>
                    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
                        <TextField label={c.rssLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.rssLabelPh} />
                        <SelectField label={c.rssLimitLabel} value={limit} onChange={(e) => setLimit(e.target.value)} options={["3", "5", "10", "15", "20", "30", "50"].map((v) => ({ value: v, label: v }))} />
                    </div>
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.rssLimitHint}</p>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" loading={doPreview.busy} onClick={() => void handlePreview()} disabled={!url.trim()}>
                            {doPreview.busy ? c.rssPreviewing : c.rssPreview}
                        </Button>
                        <Button loading={add.busy} onClick={() => void handleAdd()} disabled={!url.trim()}>
                            {add.busy ? c.adding : c.rssAdd}
                        </Button>
                    </div>

                    {preview ? (
                        <div className={`rounded-[10px] border px-3 py-2.5 text-[12px] ${preview.ok ? "border-good/30 bg-good/10 text-ink" : "border-bad/30 bg-bad/10 text-bad"}`}>
                            {preview.ok ? (
                                <span>{c.rssPreviewOk} {preview.title ? `· ${preview.title}` : ""} {Array.isArray(preview.items) ? `· ${preview.items.length} itens` : ""}</span>
                            ) : (
                                <span>{preview.error || c.rssPreviewFail}</span>
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
