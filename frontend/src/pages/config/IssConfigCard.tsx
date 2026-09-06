import { useRequest } from "../../hooks/useRequest";
import { cfgCard, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { FieldStatus, Switch } from "./ui";

type IssConfig = { enabled: boolean; hidden: boolean };

async function apiPatch(path: string, body: unknown) {
    const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data;
}

export function IssConfigCard({ iss, c, onReload }: { iss: IssConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const toggleEnabled = useRequest();

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        <span className="text-[18px]">🛰️</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.issTitle}</h3>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={iss.enabled && !iss.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(async () => {
                            const res = await apiPatch("/api/iss/config", { enabled: next, hidden: !next });
                            await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }}
                />
            </div>
            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}
            <p className="m-0 text-[12.5px] leading-[1.5] text-ink2">{c.issLead}</p>
        </article>
    );
}
