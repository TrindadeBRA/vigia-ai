import { useState } from "react";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Fold, Switch, TextField } from "./ui";

type GithubRepoConfig = { id: string; repo: string; label: string };
type GithubProfileConfig = { id: string; username: string; label: string };
type GithubConfig = { enabled: boolean; hidden: boolean; repos: GithubRepoConfig[]; profiles: GithubProfileConfig[] };

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

function RepoRow({ repo, c, onReload }: { repo: GithubRepoConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const remove = useRequest();
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(repo.label);
    const save = useRequest();

    return (
        <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{repo.label || repo.repo}</p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{repo.repo}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => remove.run(async () => { const r = await apiDelete(`/api/github/repos/${repo.id}`); await onReload(); return r; }, { success: c.removed, error: c.offline })}>{remove.busy ? c.removing : c.remove}</Button>
                </div>
            </div>
            {editing ? (
                <div className="flex flex-col gap-2 border-t border-edge pt-2">
                    <TextField label={c.githubLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.githubLabelPh} />
                    <Button loading={save.busy} onClick={() => save.run(async () => { const r = await apiPatch(`/api/github/repos/${repo.id}`, { label }); await onReload(); setEditing(false); return r; }, { success: c.saved, error: c.offline })}>{save.busy ? c.saving : c.save}</Button>
                    {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
                </div>
            ) : null}
            {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
        </li>
    );
}

function ProfileRow({ profile, c, onReload }: { profile: GithubProfileConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const remove = useRequest();
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(profile.label);
    const save = useRequest();

    return (
        <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{profile.label || profile.username}</p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">@{profile.username}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => remove.run(async () => { const r = await apiDelete(`/api/github/profiles/${profile.id}`); await onReload(); return r; }, { success: c.removed, error: c.offline })}>{remove.busy ? c.removing : c.remove}</Button>
                </div>
            </div>
            {editing ? (
                <div className="flex flex-col gap-2 border-t border-edge pt-2">
                    <TextField label={c.githubLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.githubLabelPh} />
                    <Button loading={save.busy} onClick={() => save.run(async () => { const r = await apiPatch(`/api/github/profiles/${profile.id}`, { label }); await onReload(); setEditing(false); return r; }, { success: c.saved, error: c.offline })}>{save.busy ? c.saving : c.save}</Button>
                    {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
                </div>
            ) : null}
            {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
        </li>
    );
}

export function GithubConfigCard({ github, c, onReload }: { github: GithubConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [repo, setRepo] = useState("");
    const [label, setLabel] = useState("");
    const [preview, setPreview] = useState<{ ok: boolean; error?: string; stars?: number | null } | null>(null);

    const toggleEnabled = useRequest();
    const add = useRequest();
    const doPreview = useRequest();

    const hint = github.repos.length ? `${github.repos.length} repositório${github.repos.length === 1 ? "" : "s"}` : c.githubEmpty;
    const listSummary = github.repos.length ? `${c.githubListLabel} (${github.repos.length})` : c.githubListLabel;

    async function handlePreview() {
        const r = repo.trim();
        if (!r) { setPreview({ ok: false, error: c.githubNoPreview }); return; }
        setPreview(null);
        await doPreview.run(async () => {
            try {
                const data = await apiPost("/api/github/preview", { repo: r, label: label.trim() }) as { ok: boolean; error?: string; stars?: number | null };
                setPreview(data);
                return { ok: data.ok, error: data.error } as { ok: boolean; error?: string };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setPreview({ ok: false, error: msg });
                return { ok: false, error: msg };
            }
        }, { success: c.githubPreviewOk, error: c.githubPreviewFail });
    }

    async function handleAdd() {
        const r = repo.trim();
        if (!r) return;
        await add.run(async () => {
            const res = await apiPost("/api/github/repos", { repo: r, label: label.trim() });
            if ((res as { ok?: boolean }).ok) {
                await onReload();
                setRepo(""); setLabel(""); setPreview(null);
            }
            return res as { ok: boolean; error?: string };
        }, { success: c.added, error: c.offline });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        {PROVIDER_ICON.github ? <img className={iconImg} src={PROVIDER_ICON.github} alt="" draggable={false} /> : <span className="text-[18px]">🐙</span>}
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.githubTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={github.enabled && !github.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await apiPatch("/api/github/config", { enabled: next, hidden: !next });
                            await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.githubLead}</p>

            <Fold summary={listSummary}>
                {github.repos.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {github.repos.map((repo) => (
                            <RepoRow key={repo.id} repo={repo} c={c} onReload={onReload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.githubEmpty}</p>
                )}
            </Fold>

            <Fold summary={c.githubAdd}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.githubRepoLabel} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={c.githubRepoPh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.githubRepoHint}</p>
                    <TextField label={c.githubLabelLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.githubLabelPh} />

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" loading={doPreview.busy} onClick={() => void handlePreview()} disabled={!repo.trim()}>
                            {doPreview.busy ? c.githubPreviewing : c.githubPreview}
                        </Button>
                        <Button loading={add.busy} onClick={() => void handleAdd()} disabled={!repo.trim()}>
                            {add.busy ? c.adding : c.githubAdd}
                        </Button>
                    </div>

                    {preview ? (
                        <div className={`rounded-[10px] border px-3 py-2.5 text-[12px] ${preview.ok ? "border-good/30 bg-good/10 text-ink" : "border-bad/30 bg-bad/10 text-bad"}`}>
                            {preview.ok ? (
                                <span>{c.githubPreviewOk} {preview.stars != null ? `· ⭐ ${preview.stars}` : ""}</span>
                            ) : (
                                <span>{preview.error || c.githubPreviewFail}</span>
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

export function GithubProfilesConfigCard({ github, c, onReload }: { github: GithubConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [username, setUsername] = useState("");
    const [profileLabel, setProfileLabel] = useState("");
    const [profilePreview, setProfilePreview] = useState<{ ok: boolean; error?: string; followers?: number | null } | null>(null);

    const toggleEnabled = useRequest();
    const addProfile = useRequest();
    const doProfilePreview = useRequest();

    const hint = github.profiles.length ? `${github.profiles.length} perfil${github.profiles.length === 1 ? "" : "is"}` : c.githubProfilesEmpty;
    const profileListSummary = github.profiles.length ? `${c.githubProfileListLabel} (${github.profiles.length})` : c.githubProfileListLabel;

    async function handleProfilePreview() {
        const u = username.trim();
        if (!u) { setProfilePreview({ ok: false, error: c.githubProfileNoPreview }); return; }
        setProfilePreview(null);
        await doProfilePreview.run(async () => {
            try {
                const data = await apiPost("/api/github/profiles/preview", { username: u, label: profileLabel.trim() }) as { ok: boolean; error?: string; followers?: number | null };
                setProfilePreview(data);
                return { ok: data.ok, error: data.error } as { ok: boolean; error?: string };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setProfilePreview({ ok: false, error: msg });
                return { ok: false, error: msg };
            }
        }, { success: c.githubProfilePreviewOk, error: c.githubProfilePreviewFail });
    }

    async function handleAddProfile() {
        const u = username.trim();
        if (!u) return;
        await addProfile.run(async () => {
            const res = await apiPost("/api/github/profiles", { username: u, label: profileLabel.trim() });
            if ((res as { ok?: boolean }).ok) {
                await onReload();
                setUsername(""); setProfileLabel(""); setProfilePreview(null);
            }
            return res as { ok: boolean; error?: string };
        }, { success: c.added, error: c.offline });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        {PROVIDER_ICON.github ? <img className={iconImg} src={PROVIDER_ICON.github} alt="" draggable={false} /> : <span className="text-[18px]">🐙</span>}
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.githubProfileTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={github.enabled && !github.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await apiPatch("/api/github/config", { enabled: next, hidden: !next });
                            await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.githubProfileLead}</p>

            <Fold summary={profileListSummary}>
                {github.profiles.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {github.profiles.map((profile) => (
                            <ProfileRow key={profile.id} profile={profile} c={c} onReload={onReload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.githubProfilesEmpty}</p>
                )}
            </Fold>

            <Fold summary={c.githubAddProfile}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.githubProfileLabel} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={c.githubProfilePh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.githubProfileHint}</p>
                    <TextField label={c.githubLabelLabel} value={profileLabel} onChange={(e) => setProfileLabel(e.target.value)} placeholder={c.githubLabelPh} />

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" loading={doProfilePreview.busy} onClick={() => void handleProfilePreview()} disabled={!username.trim()}>
                            {doProfilePreview.busy ? c.githubPreviewing : c.githubPreview}
                        </Button>
                        <Button loading={addProfile.busy} onClick={() => void handleAddProfile()} disabled={!username.trim()}>
                            {addProfile.busy ? c.adding : c.githubAddProfile}
                        </Button>
                    </div>

                    {profilePreview ? (
                        <div className={`rounded-[10px] border px-3 py-2.5 text-[12px] ${profilePreview.ok ? "border-good/30 bg-good/10 text-ink" : "border-bad/30 bg-bad/10 text-bad"}`}>
                            {profilePreview.ok ? (
                                <span>{c.githubProfilePreviewOk} {profilePreview.followers != null ? `· 👥 ${profilePreview.followers}` : ""}</span>
                            ) : (
                                <span>{profilePreview.error || c.githubProfilePreviewFail}</span>
                            )}
                        </div>
                    ) : null}
                    {doProfilePreview.message ? <FieldStatus status={doProfilePreview.status} message={doProfilePreview.message} /> : null}
                    {addProfile.message ? <FieldStatus status={addProfile.status} message={addProfile.message} /> : null}
                </div>
            </Fold>
        </article>
    );
}
