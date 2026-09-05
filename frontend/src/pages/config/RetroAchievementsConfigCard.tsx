import { useState } from "react";
import { previewRetroAchievements } from "../../api/client";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Fold, Switch, TextField } from "./ui";

type Props = {
    c: ConfigCopy;
    onReload: () => Promise<void>;
    provider: { configured: boolean; hidden: boolean; label: string; suffix: string | null; mode: string; accounts: Array<{ id: string; label: string; suffix: string | null }> };
};

export function RetroAchievementsConfigCard({ c, onReload, provider }: Props) {
    const [secret, setSecret] = useState("");
    const [label, setLabel] = useState("");
    const [preview, setPreview] = useState<{ ok: boolean; error?: string; username?: string | null; total_points?: number | null } | null>(null);

    const toggleEnabled = useRequest();
    const doPreview = useRequest();
    const add = useRequest();

    const hint = provider.configured
        ? `${provider.accounts.length ? `${provider.accounts.length} conta${provider.accounts.length === 1 ? "" : "s"}` : "configurado"}${provider.suffix ? ` · ••••${provider.suffix}` : ""}`
        : c.retroNotConfigured;

    async function handlePreview() {
        const s = secret.trim();
        if (!s) { setPreview({ ok: false, error: c.retroNeedSecret }); return; }
        setPreview(null);
        await doPreview.run(async () => {
            try {
                const data = await previewRetroAchievements({ secret: s, label: label.trim() });
                if (data.ok) {
                    setPreview({ ok: true, username: data.username, total_points: data.total_points });
                    return { ok: true } as { ok: boolean; error?: string };
                }
                setPreview({ ok: false, error: data.error || c.retroPreviewFail });
                return { ok: false, error: data.error || c.retroPreviewFail };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setPreview({ ok: false, error: msg });
                return { ok: false, error: msg };
            }
        }, { success: c.retroPreviewOk, error: c.retroPreviewFail });
    }

    async function handleAdd() {
        const s = secret.trim();
        if (!s) return;
        await add.run(async () => {
            const res = await fetch("/api/config/account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: "retroachievements", label: label.trim(), token: s, key: s }),
            });
            const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            if (data.ok) {
                await onReload();
                setSecret(""); setLabel(""); setPreview(null);
            }
            return data as { ok: boolean; error?: string };
        }, { success: c.added, error: c.offline });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        <img className={iconImg} src={PROVIDER_ICON.retroachievements} alt="" draggable={false} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.retroTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={!provider.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const nextHidden = !e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await fetch("/api/config", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ retroachievements_hidden: nextHidden }),
                            });
                            const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
                            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                            await onReload();
                            return data as { ok: boolean; error?: string };
                        }, { success: nextHidden ? c.hiddenOn : c.hiddenOff, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.retroLead}</p>

            <Fold summary={c.retroAddTitle}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.retroUserLabel} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.retroUserPh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.retroUserHint}</p>
                    <TextField label={c.retroSecretLabel} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={c.retroSecretPh} autoComplete="off" />
                    <p className="m-0 text-[11px] leading-snug text-ink3">{c.retroSecretHint}</p>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" loading={doPreview.busy} onClick={() => void handlePreview()} disabled={!secret.trim()}>
                            {doPreview.busy ? c.retroPreviewing : c.retroPreview}
                        </Button>
                        <Button loading={add.busy} onClick={() => void handleAdd()} disabled={!secret.trim()}>
                            {add.busy ? c.adding : c.retroAdd}
                        </Button>
                    </div>

                    {preview ? (
                        <div className={`rounded-[10px] border px-3 py-2.5 text-[12px] ${preview.ok ? "border-good/30 bg-good/10 text-ink" : "border-bad/30 bg-bad/10 text-bad"}`}>
                            {preview.ok ? (
                                <span>{c.retroPreviewOk} {preview.username ? `· ${preview.username}` : ""} {preview.total_points != null ? `· ${preview.total_points} pts` : ""}</span>
                            ) : (
                                <span>{preview.error || c.retroPreviewFail}</span>
                            )}
                        </div>
                    ) : null}
                    {doPreview.message ? <FieldStatus status={doPreview.status} message={doPreview.message} /> : null}
                    {add.message ? <FieldStatus status={add.status} message={add.message} /> : null}
                </div>
            </Fold>

            {provider.accounts.length ? (
                <Fold summary={`${c.retroListLabel} (${provider.accounts.length})`}>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {provider.accounts.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-edge bg-canvas px-2.5 py-2">
                                <div className="min-w-0">
                                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{a.label || "—"}</p>
                                    <p className="mb-0 mt-0.5 text-[11.5px] text-ink3">•••• {a.suffix || "----"}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={async () => {
                                        const res = await fetch(`/api/config/account/retroachievements/${a.id}`, { method: "DELETE" });
                                        if (res.ok) await onReload();
                                    }}
                                >
                                    {c.remove}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </Fold>
            ) : null}
        </article>
    );
}
