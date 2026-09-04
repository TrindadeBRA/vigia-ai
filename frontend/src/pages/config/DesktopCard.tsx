/**
 * Card «Aplicativo» — só renderiza dentro do app Electron.
 *
 * Nada aqui é essencial ao produto: no navegador o componente devolve `null` e
 * a página fica exatamente como sempre foi.
 */
import { useState } from "react";
import { useRequest } from "../../hooks/useRequest";
import { desktop, useDesktopStatus } from "../../desktop";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, Card, CodeRow, FieldStatus, Switch } from "./ui";

export function DesktopCard({ c }: { c: ConfigCopy }) {
  const api = desktop();
  const { status, reload } = useDesktopStatus();
  const restart = useRequest();
  const [busy, setBusy] = useState<"lan" | "autostart" | null>(null);
  const [updateMsg, setUpdateMsg] = useState("");

  if (!api || !status) return null;

  const lanUrl = status.lan.length ? `http://${status.lan[0]}:${status.port}/display` : null;

  const toggle = async (key: "lan" | "autostart", value: boolean) => {
    setBusy(key);
    try {
      if (key === "lan") await api.setLanExposure(value);
      else await api.setAutostart(value);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={c.appTitle} lead={c.appLead}>
      <div className="mt-3 flex flex-col gap-4">
        <label className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">{c.appAutostart}</span>
            <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-ink2">{c.appAutostartHint}</span>
          </span>
          <Switch
            compact
            label={c.appAutostart}
            checked={status.autostart}
            busy={busy === "autostart"}
            onChange={(e) => void toggle("autostart", e.target.checked)}
          />
        </label>

        <label className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">{c.appLan}</span>
            <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-ink2">{c.appLanHint}</span>
            <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-warn">{c.appLanWarn}</span>
          </span>
          <Switch
            compact
            label={c.appLan}
            checked={status.lanExposed}
            busy={busy === "lan"}
            onChange={(e) => void toggle("lan", e.target.checked)}
          />
        </label>

        {lanUrl ? (
          <CodeRow
            label={c.appCopyLan}
            value={lanUrl}
            copyLabel={c.copyUrl}
            copiedLabel={c.copied}
            failLabel={c.fail}
          />
        ) : (
          <p className="m-0 text-[12.5px] text-ink2">{c.appNoLan}</p>
        )}

        <div className="grid grid-cols-1 gap-2 text-[12.5px] text-ink2 min-[560px]:grid-cols-2">
          <span>
            {c.appVersionLabel}: <strong className="text-ink">{status.version}</strong>
          </span>
          <span>
            {c.appCollectorLabel}: <strong className="text-ink">{status.collectorVersion ?? "—"}</strong>
          </span>
        </div>

        <ActionRow>
          <Button
            variant="ghost"
            onClick={() => void api.openExternal(`http://127.0.0.1:${status.port}/display`)}
          >
            {c.appOpenBrowser}
          </Button>
          <Button
            loading={restart.busy}
            onClick={() =>
              void restart.run(() => api.restartCollector().then(async (r) => (await reload(), r)), {
                success: c.appRestarted,
                error: c.appRestartFail,
              })
            }
          >
            {restart.busy ? c.appRestarting : c.appRestart}
          </Button>
          <Button variant="ghost" onClick={() => void api.openDataFolder()}>
            {c.appDataFolder}
          </Button>
          <Button variant="ghost" onClick={() => void api.openLogsFolder()}>
            {c.appLogsFolder}
          </Button>
          {status.packaged ? (
            <Button
              variant="ghost"
              onClick={() => void api.checkForUpdates().then((r) => setUpdateMsg(r.status))}
            >
              {c.appCheckUpdates}
            </Button>
          ) : null}
        </ActionRow>

        <FieldStatus status={restart.status} message={restart.message} />
        {updateMsg ? <p className="m-0 text-[12.5px] text-ink2">{updateMsg}</p> : null}
      </div>
    </Card>
  );
}
