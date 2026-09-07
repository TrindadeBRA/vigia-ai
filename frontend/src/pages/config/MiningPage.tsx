import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchMiningConfig, fetchMiningStatus, saveMiningConfig } from "../../api/client";
import type { MiningConfig, MiningStatus } from "../../api/types";
import { Skeleton } from "../../components/Skeleton";
import { fmtWhen } from "../../format";
import { useRequest } from "../../hooks/useRequest";
import { cfgHint, cfgStatus, pageCol, viewFade } from "../../tw";
import { MINING_STR } from "./miningCopy";
import { ActionRow, Button, Card, FieldStatus, Switch, TextField } from "./ui";
import type { DisplayOutlet } from "./usePublicConfig";

const STATUS_POLL_MS = 5000;

function fmtHashrate(hs: number): string {
  if (!hs || hs <= 0) return "0 H/s";
  if (hs >= 1_000_000) return `${(hs / 1_000_000).toFixed(2)} MH/s`;
  if (hs >= 1_000) return `${(hs / 1_000).toFixed(2)} kH/s`;
  return `${Math.round(hs)} H/s`;
}

function fmtUptime(totalS: number): string {
  if (!totalS || totalS <= 0) return "0min";
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
}

export default function MiningPage() {
  const ctx = useOutletContext<DisplayOutlet | null>();
  const c = MINING_STR[ctx?.lang || "pt"];

  const [status, setStatus] = useState<MiningStatus | null>(null);
  const [statusPhase, setStatusPhase] = useState<"loading" | "ready" | "error">("loading");
  const reloadStatus = useCallback(async () => {
    try {
      const s = await fetchMiningStatus();
      setStatus(s);
      setStatusPhase("ready");
    } catch {
      setStatusPhase((p) => (p === "ready" ? "ready" : "error"));
    }
  }, []);
  useEffect(() => {
    void reloadStatus();
    const timer = window.setInterval(() => { void reloadStatus(); }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [reloadStatus]);

  const [config, setConfig] = useState<MiningConfig | null>(null);
  const reloadConfig = useCallback(async () => {
    try {
      const cfg = await fetchMiningConfig();
      setConfig(cfg);
    } catch {
      // mantém o que já tinha carregado — o card de status já mostra offline
    }
  }, []);
  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  const save = useRequest();

  if (statusPhase === "loading" && !status) return <Skeleton page="config" />;

  if (statusPhase === "error" && !status) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button onClick={() => { setStatusPhase("loading"); void reloadStatus(); }}>{c.retry}</Button>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
      </header>

      <Card title={c.statusTitle}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
          <Row label={c.currentStatusLabel} value={c.status[status.status]} hint={c.hintCurrentStatus} />
          <Row label={c.hashrateCurrent} value={fmtHashrate(status.hashrateCurrent)} hint={c.hintHashrateCurrent} />
          <Row label={c.hashrateAvg} value={fmtHashrate(status.hashrateAvg)} hint={c.hintHashrateAvg} />
          <Row label={c.sharesAccepted} value={String(status.sharesAccepted)} hint={c.hintSharesAccepted} />
          <Row label={c.sharesRejected} value={String(status.sharesRejected)} hint={c.hintSharesRejected} />
          <Row label={c.bestDifficulty} value={status.bestDifficulty.toLocaleString()} hint={c.hintBestDifficulty} />
          <Row label={c.blockHeight} value={status.blockHeight ? status.blockHeight.toLocaleString() : "—"} hint={c.hintBlockHeight} />
          <Row label={c.uptime} value={fmtUptime(status.uptimeS)} hint={c.hintUptime} />
          <Row label={c.lastReport} value={status.reportedAt ? fmtWhen(status.reportedAt) : c.never} hint={c.hintLastReport} />
        </div>
        {status.stale ? <p className={`${cfgHint} mt-3`}>{c.staleHint}</p> : null}
        {status.lastError ? (
          <p className="mb-0 mt-2 text-[12.5px] leading-snug text-bad">{c.lastErrorLabel}: {status.lastError}</p>
        ) : null}
      </Card>

      <Card title={c.logTitle} lead={c.logLead}>
        {status.log.length ? (
          <pre className="m-0 max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-3 text-[11.5px] leading-[1.5] text-ink2">
            {status.log.join("\n")}
          </pre>
        ) : (
          <p className={cfgHint}>{c.logEmpty}</p>
        )}
      </Card>

      {config ? (
        <Card
          title={c.configTitle}
          lead={c.configLead}
          action={
            <Switch
              label={c.enabledLabel}
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
          }
        >
          <div className="flex flex-col gap-3">
            <ActionRow>
              <TextField label={c.poolUrlLabel} value={config.poolUrl} onChange={(e) => setConfig({ ...config, poolUrl: e.target.value })} />
              <TextField
                label={c.poolPortLabel}
                type="number"
                value={config.poolPort}
                onChange={(e) => setConfig({ ...config, poolPort: Number(e.target.value) || 0 })}
              />
            </ActionRow>
            <TextField
              label={c.walletLabel}
              hint={c.walletHint}
              placeholder="bc1q…"
              value={config.btcWallet}
              onChange={(e) => setConfig({ ...config, btcWallet: e.target.value })}
            />
            {!config.btcWallet.trim() ? <p className={cfgHint}>{c.walletMissingHint}</p> : null}
            <TextField
              label={c.workerLabel}
              hint={c.workerHint}
              value={config.workerName}
              onChange={(e) => setConfig({ ...config, workerName: e.target.value })}
            />
            <ActionRow>
              <Button
                loading={save.busy}
                onClick={() =>
                  save.run(
                    async () => {
                      const res = await saveMiningConfig(config);
                      if (res.ok) await reloadConfig();
                      return res;
                    },
                    { success: c.saved, error: c.offline },
                  )
                }
              >
                {save.busy ? c.saving : c.save}
              </Button>
            </ActionRow>
            {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-edge/60 py-1.5 first:pt-0 sm:border-none sm:py-0.5">
      <span
        className={hint ? "cursor-help text-ink3 underline decoration-dotted decoration-ink3/60 underline-offset-2" : "text-ink3"}
        title={hint}
      >
        {label}
      </span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
