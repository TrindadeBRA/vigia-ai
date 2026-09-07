import { useEffect, useState } from "react";
import { fetchCameraConfig, saveCameraConfig } from "../../api/client";
import type { CameraConfig } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, StatusPill, TextField } from "./ui";

const MASK = "•".repeat(16);

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

export function CameraConfigCard({ c }: { c: ConfigCopy }) {
  const [cfg, setCfg] = useState<CameraConfig | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("554");
  const [path, setPath] = useState("onvif1");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const save = useRequest();

  async function reload() {
    const data = await fetchCameraConfig();
    setCfg(data);
    setHost(data.host);
    setPort(String(data.port));
    setPath(data.path);
    setUsername(data.username);
    setPassword(data.configured ? MASK : "");
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cfg) return null;

  const portNum = Number(port);
  const ready = Boolean(host.trim()) && Number.isInteger(portNum) && portNum > 0 && portNum <= 65535 && Boolean(path.trim()) && Boolean(username.trim());
  const pill = cfg.configured ? { state: "ok" as const, label: c.cameraConfigured } : { state: "missing" as const, label: c.cameraNotConfigured };

  return (
    <article className={`${cfgCard} gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={iconChip}><CameraIcon /></div>
          <div className="min-w-0">
            <h3 className="m-0 text-[15.5px] font-bold">{c.cameraTitle}</h3>
            <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{c.cameraBlurb}</p>
          </div>
        </div>
        <StatusPill state={pill.state} label={pill.label} />
      </div>

      <ActionRow>
        <TextField label={c.cameraHost} autoComplete="off" placeholder={c.cameraHostPh} value={host} onChange={(e) => setHost(e.target.value)} />
        <TextField label={c.cameraPort} autoComplete="off" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} />
      </ActionRow>
      <ActionRow>
        <TextField label={c.cameraPath} autoComplete="off" placeholder={c.cameraPathPh} value={path} onChange={(e) => setPath(e.target.value.replace(/^\/+/, ""))} />
        <TextField label={c.cameraUsername} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
      </ActionRow>
      <ActionRow>
        <TextField
          label={c.cameraPassword}
          type="password"
          autoComplete="off"
          placeholder={c.cameraPasswordPh}
          value={password}
          onFocus={() => { if (password === MASK) setPassword(""); }}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          loading={save.busy}
          disabled={!ready}
          onClick={() =>
            save.run(
              async () => {
                const patch: Record<string, unknown> = { host: host.trim(), port: portNum, path: path.trim(), username: username.trim() };
                if (password && password !== MASK) patch.password = password;
                const res = await saveCameraConfig(patch);
                if (res.ok) await reload();
                return res;
              },
              { success: c.cameraSaved, error: c.cameraError },
            )
          }
        >
          {save.busy ? c.cameraSaving : c.cameraSave}
        </Button>
      </ActionRow>

      {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
    </article>
  );
}
