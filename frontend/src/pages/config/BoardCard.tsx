import { useEffect, useState } from "react";
import { downloadFirmwareFile, downloadFirmwareSource, fetchFirmware, flashFirmware, saveFirmware } from "../../api/client";
import type { ConfigPublic, FirmwarePublic } from "../../api/types";
import { cn } from "../../cn";
import { saveTextFile } from "../../desktop";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { Button, CodeRow, FieldStatus, StepBadge, TextField } from "./ui";

function firmwareBody(ssid: string, password: string): { wifi_ssid: string; wifi_password: string } {
  return { wifi_ssid: ssid.trim(), wifi_password: password };
}

export function BoardCard({ cfg, c }: { cfg: ConfigPublic; c: ConfigCopy }) {
  const save = useRequest();
  const flash = useRequest();
  const dl = useRequest();
  const detect = useRequest();
  const fetchSrc = useRequest();
  const [fw, setFw] = useState<FirmwarePublic | null>(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState("");

  function applyStatus(next: FirmwarePublic) {
    setFw(next);
  }

  async function loadFromCollector(): Promise<FirmwarePublic | null> {
    const next = await fetchFirmware();
    applyStatus(next);
    setSsid(next.wifi_ssid || next.detected_ssid || "");
    setPassword(next.wifi_password || "");
    return next;
  }

  useEffect(() => {
    void loadFromCollector().catch(() => undefined);
  }, []);

  const usageUrl = fw?.usage_url || cfg.urls.usage_lan;
  const canFlash = Boolean(fw?.can_flash);
  const body = () => firmwareBody(ssid, password);

  async function afterSave(out: { ok: boolean; firmware?: FirmwarePublic }) {
    if (!out.ok) return;
    if (out.firmware) {
      applyStatus(out.firmware);
      if (out.firmware.wifi_ssid) setSsid(out.firmware.wifi_ssid);
      if (out.firmware.wifi_password) setPassword(out.firmware.wifi_password);
      return;
    }
    const next = await fetchFirmware();
    applyStatus(next);
    if (next.wifi_password) setPassword(next.wifi_password);
    if (next.wifi_ssid) setSsid(next.wifi_ssid);
  }

  return (
    <section className="flex min-w-0 w-full flex-col gap-0 overflow-hidden rounded-2xl border border-edge bg-panel shadow-card [.flat_&]:shadow-none">
      <div className="flex flex-col gap-3 px-[18px] py-4">
        <div className="flex items-start gap-2.5">
          <StepBadge n="1" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[15.5px] font-bold">{c.boardTitle}</h2>
            <p className="mb-0 mt-1 text-[13.5px] leading-[1.55] text-ink2">{c.boardLead}</p>
          </div>
        </div>
        {!cfg.urls.board_ok ? <p className="m-0 text-[12.5px] leading-normal text-warn">{c.boardNoIp}</p> : null}
        <CodeRow label={c.boardUrlLabel} value={usageUrl} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
        <p className="-mt-1 mb-0 text-xs leading-[1.45] text-ink3">{c.boardUrlHint}</p>
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
          <TextField
            label={c.boardSsid}
            value={ssid}
            autoComplete="off"
            onChange={(e) => setSsid(e.target.value)}
            hint={fw?.detected_ssid ? c.boardSsidHint(fw.detected_ssid) : undefined}
          />
          <TextField
            label={c.boardPassword}
            autoComplete="off"
            name="vigia-wifi-psk"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            loading={detect.busy}
            onClick={() =>
              void detect.run(
                async () => {
                  const next = await fetchFirmware();
                  applyStatus(next);
                  if (next.detected_ssid) {
                    setSsid(next.detected_ssid);
                    return { ok: true };
                  }
                  return { ok: false, error: c.boardDetectFail };
                },
                { success: c.boardDetectOk, error: c.boardDetectFail },
              )
            }
          >
            {c.boardDetectWifi}
          </Button>
          <Button
            variant="secondary"
            loading={save.busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              save.run(
                async () => {
                  const out = await saveFirmware(body());
                  await afterSave(out);
                  return out;
                },
                { success: c.boardSecretsOk, error: c.fail },
              )
            }
          >
            {save.busy ? c.boardSavingSecrets : c.boardSaveSecrets}
          </Button>
        </div>
        <FieldStatus status={save.status} message={save.message} />
        <FieldStatus status={detect.status} message={detect.message} />
      </div>

      <div className="h-px bg-edge" />

      <div className="flex flex-col gap-3 px-[18px] py-4">
        <div className="flex items-start gap-2.5">
          <StepBadge n="2" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[15.5px] font-bold">{c.boardFlashTitle}</h2>
            <p className="mb-0 mt-1 text-[13.5px] leading-[1.55] text-ink2">{c.boardFlashLead}</p>
          </div>
        </div>
        <p
          className={cn(
            "m-0 rounded-[10px] border px-3 py-2 text-[12.5px] leading-[1.45]",
            canFlash
              ? "border-[color-mix(in_srgb,var(--good)_35%,var(--card-border))] bg-[color-mix(in_srgb,var(--good)_8%,transparent)] text-ink2"
              : "border-edge bg-canvas text-ink2",
          )}
        >
          {canFlash ? c.boardFlashReady : fw?.reason || c.boardFlashUsb}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {fw && !fw.can_write ? (
            <Button
              variant="secondary"
              loading={fetchSrc.busy}
              onClick={() =>
                void fetchSrc.run(
                  async () => {
                    const out = await downloadFirmwareSource();
                    if (out.ok && out.firmware) applyStatus(out.firmware);
                    else if (out.ok) await loadFromCollector();
                    return out;
                  },
                  { success: c.boardFetchFirmwareOk, error: c.boardFetchFirmwareFail },
                )
              }
            >
              {fetchSrc.busy ? c.boardFetchingFirmware : c.boardFetchFirmware}
            </Button>
          ) : null}
          <Button
            loading={flash.busy}
            disabled={flash.busy || Boolean(fw && !fw.can_flash)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setLog("");
              void flash.run(
                async () => {
                  const out = await flashFirmware(body(), setLog);
                  if (out.ok) {
                    const next = await fetchFirmware();
                    applyStatus(next);
                    if (next.wifi_password) setPassword(next.wifi_password);
                  }
                  return out;
                },
                { success: c.boardFlashOk, error: c.boardFlashFail },
              );
            }}
          >
            {flash.busy ? c.boardFlashing : c.boardFlash}
          </Button>
        </div>
        {log ? (
          <pre
            className="mb-0 mt-0 max-h-56 overflow-auto rounded-[10px] border border-edge bg-canvas p-3 text-[11.5px] leading-snug text-ink2"
            aria-label={c.boardLogLabel}
          >
            {log}
          </pre>
        ) : null}
        <FieldStatus status={fetchSrc.status} message={fetchSrc.message} />
        <FieldStatus status={flash.status} message={flash.message} />
      </div>

      <details className="group border-t border-edge px-[18px] py-3">
        <summary className="cursor-pointer list-none text-[13.5px] font-bold text-ink2 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="text-ink3 transition-transform group-open:rotate-90" aria-hidden>
              ▸
            </span>
            {c.boardAdvanced}
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="m-0 text-[13px] leading-[1.5] text-ink3">{c.boardAdvancedLead}</p>
          <CodeRow label={c.boardDestLabel} value={c.boardDest} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
          <CodeRow label={c.flashCmdLabel} value={c.flashCmd} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
          <div>
            <Button
              variant="ghost"
              loading={dl.busy}
              onClick={() =>
                dl.run(
                  async () => {
                    const text = await downloadFirmwareFile(body());
                    await saveTextFile("secrets.h", text);
                    return { ok: true };
                  },
                  { success: c.boardOk, error: c.fail },
                )
              }
            >
              {dl.busy ? c.boardDownloading : c.boardDownload}
            </Button>
            <FieldStatus status={dl.status} message={dl.message} />
          </div>
        </div>
      </details>
    </section>
  );
}
