import { useEffect, useMemo, useState } from "react";
import { createAlarm } from "../../../api/client";
import type { AlarmsPublic } from "../../../api/types";
import { useRequest } from "../../../hooks/useRequest";
import { cfgHint } from "../../../tw";
import type { ALARMS_STR } from "../alarmsCopy";
import { ActionRow, Button, Card, FieldStatus, TextField, TomSelectField } from "../ui";
import { PROVIDER_LABEL, ruleHint, suggestLabel } from "./helpers";

export function StorageAlarmCard({
    c,
    data,
    onReload,
}: {
    c: typeof ALARMS_STR.pt;
    data: AlarmsPublic;
    onReload: () => Promise<void>;
}) {
    const storageMetrics = data.metrics.storage ?? [];
    const systemMetrics = data.metrics.system ?? [];
    const hasStorage = storageMetrics.length > 0;
    const hasSystem = systemMetrics.length > 0;

    // default to storage if available
    const [provider, setProvider] = useState<string>(hasStorage ? "storage" : hasSystem ? "system" : "storage");
    const metrics = provider === "system" ? systemMetrics : storageMetrics;
    const [metric, setMetric] = useState(metrics[0]?.key ?? "free_gb");
    const [threshold, setThreshold] = useState(provider === "storage" && metric === "free_gb" ? 10 : 15);
    const [label, setLabel] = useState("");
    const [labelDirty, setLabelDirty] = useState(false);

    useEffect(() => {
        const m = (provider === "system" ? systemMetrics : storageMetrics)[0]?.key;
        if (m && !metrics.some((x) => x.key === metric)) setMetric(m);
    }, [provider, storageMetrics, systemMetrics, metrics, metric]);

    useEffect(() => {
        // sensible defaults per metric
        if (metric === "free_gb") setThreshold((v) => (v > 100 ? 10 : v));
        if (metric === "free_percent") setThreshold((v) => (v > 100 ? 15 : v));
        if (metric === "used_percent") setThreshold((v) => (v > 100 ? 85 : v));
    }, [metric]);

    const currentMetric = metrics.find((m) => m.key === metric);
    const suggested = useMemo(() => suggestLabel(c, provider, currentMetric, threshold), [c, provider, currentMetric, threshold]);
    const displayLabel = labelDirty ? label : suggested;
    const addAction = useRequest();
    const canAdd = metric && Number.isFinite(threshold) && threshold >= 0;

    if (!hasStorage && !hasSystem) return null;

    return (
        <Card
            title="Armazenamento e sistema"
            lead="Crie alertas quando o espaço livre do disco ficar baixo ou o uso do sistema subir — ideal para não deixar o HD/SSD lotar."
        >
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <TomSelectField
                        label="Origem"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        options={[
                            ...(hasStorage ? [{ value: "storage", label: PROVIDER_LABEL.storage || "Armazenamento" }] : []),
                            ...(hasSystem ? [{ value: "system", label: PROVIDER_LABEL.system || "Sistema" }] : []),
                        ]}
                        placeholder="Origem..."
                    />
                    <TomSelectField
                        label={c.metric}
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                        options={metrics.map((m) => ({ value: m.key, label: m.label }))}
                        placeholder="Métrica..."
                    />
                    <TextField
                        label={c.threshold}
                        type="number"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                </div>

                {currentMetric ? <p className={cfgHint}>{ruleHint(c, currentMetric, threshold)}</p> : null}

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
                                        provider,
                                        metric,
                                        threshold,
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

                <p className="m-0 text-[12.5px] leading-relaxed text-ink3">
                    Dica: para disco, use <b>Espaço livre (GB)</b> com limiar tipo <b>10 GB</b> ou <b>Espaço livre (%)</b> com <b>10%</b>. O alarme dispara quando o valor ficar <b>abaixo</b> do limiar.
                </p>
            </div>
        </Card>
    );
}
