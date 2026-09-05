import { useRef, useState, type ChangeEvent } from "react";
import { createAlarm } from "../../../api/client";
import type { AlarmsPublic } from "../../../api/types";
import { DownloadIcon, UploadIcon } from "../../../components/icons";
import type { ALARMS_STR } from "../alarmsCopy";
import { downloadAlarmsJson, parseAlarmsJson } from "./helpers";

export function AlarmsIOButtons({ data, c, onReload }: { data: AlarmsPublic; c: typeof ALARMS_STR.pt; onReload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function flash(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg((m) => (m === text ? null : m)), 3000);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const parsed = parseAlarmsJson(await file.text());
    if (!parsed || parsed.length === 0) {
      flash(c.alarmsImportEmpty);
      return;
    }
    setBusy(true);
    let count = 0;
    for (const rule of parsed) {
      const res = await createAlarm(rule);
      if (res.ok) count++;
    }
    setBusy(false);
    if (count === 0) {
      flash(c.alarmsImportError);
      return;
    }
    await onReload();
    flash(c.alarmsImported(count));
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink"
        title={c.exportAlarms}
        aria-label={c.exportAlarms}
        onClick={() => downloadAlarmsJson(data.rules)}
      >
        <DownloadIcon size={14} />
      </button>
      <button
        type="button"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        title={c.importAlarms}
        aria-label={c.importAlarms}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon size={14} />
      </button>
      <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={(e) => void handleFile(e)} />
      {msg ? <span className="text-[11.5px] text-ink3">{msg}</span> : null}
    </div>
  );
}
