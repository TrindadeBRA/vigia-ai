import { useEffect, useState } from "react";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, FieldStatus, Switch, TextField } from "./ui";

type ApodConfig = { enabled: boolean; hidden: boolean; api_key?: string };

async function apiPatch(path: string, body: unknown) {
    const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data;
}

export function ApodConfigCard({ apod, c, onReload }: { apod: ApodConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const toggleEnabled = useRequest();
    const saveKey = useRequest();
    const preview = useRequest();
    const [apiKey, setApiKey] = useState(apod.api_key || "");
    const [previewData, setPreviewData] = useState<{ ok: boolean; title?: string | null; date?: string | null; error?: string | null } | null>(null);

    useEffect(() => {
        setApiKey(apod.api_key || "");
    }, [apod.api_key]);

    const enabled = Boolean(apod.enabled && !apod.hidden);
    const hint = enabled ? c.apodEnabledHint : c.apodDisabledHint;

    return (
        <article id="cfg-apod" className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        <span className="text-[18px]" aria-hidden>🛰️</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.apodTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={enabled}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            await apiPatch("/api/apod/config", { enabled: next, hidden: !next });
                            await onReload();
                            return { ok: true };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.apodLead}</p>

            <TextField
                label={c.apodApiKeyLabel}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={c.apodApiKeyPh}
                autoComplete="off"
            />
            <p className="m-0 text-[11px] leading-snug text-ink3">{c.apodApiKeyHint}</p>

            <div className="flex flex-wrap gap-2">
                <Button
                    loading={saveKey.busy}
                    disabled={apiKey === (apod.api_key || "")}
                    onClick={() => saveKey.run(async () => {
                        await apiPatch("/api/apod/config", { api_key: apiKey.trim() });
                        await onReload();
                        return { ok: true };
                    }, { success: c.saved, error: c.offline })}
                >
                    {saveKey.busy ? c.saving : c.save}
                </Button>
                <Button
                    variant="secondary"
                    loading={preview.busy}
                    onClick={() => preview.run(async () => {
                        if (apiKey !== (apod.api_key || "")) {
                            await apiPatch("/api/apod/config", { api_key: apiKey.trim() });
                            await onReload();
                        }
                        const res = await fetch("/api/apod", { cache: "no-store" });
                        const data = await res.json() as { ok: boolean; title?: string | null; date?: string | null; error?: string | null };
                        setPreviewData(data);
                        if (!data.ok) throw new Error(data.error || c.apodPreviewFail);
                        return { ok: true };
                    }, { success: c.apodPreviewOk, error: c.apodPreviewFail })}
                >
                    {preview.busy ? c.apodPreviewing : c.apodPreview}
                </Button>
            </div>
            {saveKey.message ? <FieldStatus status={saveKey.status} message={saveKey.message} /> : null}
            {preview.message ? <FieldStatus status={preview.status} message={preview.message} /> : null}
            {previewData?.ok && previewData.title ? (
                <p className="m-0 rounded-[10px] border border-edge bg-chip px-3 py-2 text-[12.5px] text-ink2">
                    <span className="font-semibold text-ink">{previewData.title}</span>
                    {previewData.date ? <span className="ml-2 text-ink3">{previewData.date}</span> : null}
                </p>
            ) : null}

            <p className="m-0 text-xs text-ink3">
                <a href="https://api.nasa.gov" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {c.apodPoweredBy} ↗
                </a>
            </p>
        </article>
    );
}
