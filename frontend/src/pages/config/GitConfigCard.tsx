import { useState } from "react";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Fold, SelectField, Switch, TextField } from "./ui";

type GitRepoConfig = { id: string; source: string; label: string; limit: number; branch: string | null };
type GitConfig = { enabled: boolean; hidden: boolean; repos: GitRepoConfig[] };

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

function RepoRow({ repo, c, onReload }: { repo: GitRepoConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const remove = useRequest();
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(repo.label);
    const [limit, setLimit] = useState(String(repo.limit));
    const [branch, setBranch] = useState(repo.branch || "");
    const save = useRequest();

    return (
        <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{repo.label || repo.source.split("/").pop()?.replace(/\.git$/, "") || repo.source}</p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{repo.source}{repo.branch ? ` · ${repo.branch}` : ""} · {repo.limit} commits</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => remove.run(async () => { const r = await apiDelete(`/api/git/repos/${repo.id}`); await onReload(); return r; }, { success: c.removed, error: c.offline })}>{remove.busy ? c.removing : c.remove}</Button>
                </div>
            </div>
            {editing ? (
                <div className="flex flex-col gap-2 border-t border-edge pt-2">
                    <TextField label={c.gitLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.gitLabelPh} />
                    <div className="flex gap-2">
                        <SelectField label={c.gitLimitLabel} value={limit} onChange={(e) => setLimit(e.target.value)} options={["3", "5", "10", "15", "20", "30", "50"].map((v) => ({ value: v, label: v }))} />
                        <TextField label={c.gitBranchLabel} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={c.gitBranchPh} />
                    </div>
                    <Button loading={save.busy} onClick={() => save.run(async () => { const r = await apiPatch(`/api/git/repos/${repo.id}`, { label, limit: Number(limit), branch: branch.trim() || null }); await onReload(); setEditing(false); return r; }, { success: c.saved, error: c.offline })}>{save.busy ? c.saving : c.save}</Button>
                    {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
                </div>
            ) : null}
            {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
        </li>
    );
}

export function GitConfigCard({ git, c, onReload }: { git: GitConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [source, setSource] = useState("");
    const [label, setLabel] = useState("");
    const [limit, setLimit] = useState("5");
    const [branch, setBranch] = useState("");
    const [preview, setPreview] = useState<{ ok: boolean; error?: string; commits?: unknown[] } | null>(null);

    const toggleEnabled = useRequest();
    const add = useRequest();
    const doPreview = useRequest();

    const hint = git.repos.length ? `${git.repos.length} repositório${git.repos.length === 1 ? "" : "s"}` : c.gitEmpty;
    const listSummary = git.repos.length ? `${c.gitListLabel} (${git.repos.length})` : c.gitListLabel;

    async function handlePreview() {
        const s = source.trim();
        if (!s) { setPreview({ ok: false, error: c.gitNoPreview }); return; }
        setPreview(null);
        await doPreview.run(async () => {
            try {
                const data = await apiPost("/api/git/preview", { source: s, label: label.trim(), limit: Number(limit), branch: branch.trim() || null }) as { ok: boolean; error?: string; commits?: unknown[] };
                setPreview(data);
                return { ok: data.ok, error: data.error } as { ok: boolean; error?: string };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setPreview({ ok: false, error: msg });
                return { ok: false, error: msg };
            }
        }, { success: c.gitPreviewOk, error: c.gitPreviewFail });
    }

    async function handleAdd() {
        const s = source.trim();
        if (!s) return;
        await add.run(async () => {
            const res = await apiPost("/api/git/repos", { source: s, label: label.trim(), limit: Number(limit), branch: branch.trim() || null });
            if ((res as { ok?: boolean }).ok) {
                await onReload();
                setSource(""); setLabel(""); setBranch(""); setPreview(null);
            }
            return res as { ok: boolean; error?: string };
        }, { success: c.added, error: c.offline });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        {PROVIDER_ICON.git ? <img className={iconImg} src={PROVIDER_ICON.git} alt="" draggable={false} /> : <span className="text-[18px]">🌿</span>}
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.gitTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={git.enabled && !git.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await apiPatch("/api/git/config", { enabled: next, hidden: !next });
                            await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.gitLead}</p>

            <Fold summary={listSummary}>
                {git.repos.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {git.repos.map((repo) => (
                            <RepoRow key={repo.id} repo={repo} c={c} onReload={onReload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.gitEmpty}</p>
                )}
            </Fold>

            <Fold summary={c.gitAdd}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.gitSourceLabel} value={source} onChange={(e) => setSource(e.target.value)} placeholder={c.gitSourcePh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.gitSourceHint}</p>
                    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
                        <TextField label={c.gitLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.gitLabelPh} />
                        <SelectField label={c.gitLimitLabel} value={limit} onChange={(e) => setLimit(e.target.value)} options={["3", "5", "10", "15", "20", "30", "50"].map((v) => ({ value: v, label: v }))} />
                    </div>
                    <TextField label={c.gitBranchLabel} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={c.gitBranchPh} />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.gitBranchHint}</p>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" loading={doPreview.busy} onClick={() => void handlePreview()} disabled={!source.trim()}>
                            {doPreview.busy ? c.gitPreviewing : c.gitPreview}
                        </Button>
                        <Button loading={add.busy} onClick={() => void handleAdd()} disabled={!source.trim()}>
                            {add.busy ? c.adding : c.gitAdd}
                        </Button>
                    </div>

                    {preview ? (
                        <div className={`rounded-[10px] border px-3 py-2.5 text-[12px] ${preview.ok ? "border-good/30 bg-good/10 text-ink" : "border-bad/30 bg-bad/10 text-bad"}`}>
                            {preview.ok ? (
                                <span>{c.gitPreviewOk} {Array.isArray(preview.commits) ? `· ${preview.commits.length} commits` : ""}</span>
                            ) : (
                                <span>{preview.error || c.gitPreviewFail}</span>
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
