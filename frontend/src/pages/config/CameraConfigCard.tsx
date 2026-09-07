import { useEffect, useState } from "react";
import { addCamera, fetchCameras, removeCamera, updateCamera } from "../../api/client";
import type { CameraItem } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, Checkbox, FieldStatus, Fold, StatusPill, TextField } from "./ui";

const MASK = "•".repeat(16);

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function CameraRow({ camera, c, onReload }: { camera: CameraItem; c: ConfigCopy; onReload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(camera.label);
  const [host, setHost] = useState(camera.host);
  const [port, setPort] = useState(String(camera.port));
  const [path, setPath] = useState(camera.path);
  const [username, setUsername] = useState(camera.username);
  const [password, setPassword] = useState(camera.configured ? MASK : "");
  const [ptzEnabled, setPtzEnabled] = useState(camera.ptzEnabled);
  const [onvifPort, setOnvifPort] = useState(String(camera.onvifPort));
  const save = useRequest();
  const remove = useRequest();

  const portNum = Number(port);
  const onvifPortNum = Number(onvifPort);
  const ready = Boolean(host.trim()) && Number.isInteger(portNum) && portNum > 0 && portNum <= 65535 && Boolean(username.trim());
  const pill = camera.configured ? { state: "ok" as const, label: c.cameraConfigured } : { state: "missing" as const, label: c.cameraNotConfigured };

  return (
    <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{camera.label || camera.host}</p>
          <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{camera.host}:{camera.port}/{camera.path}{camera.ptzEnabled ? ` · PTZ:${camera.onvifPort}` : ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusPill state={pill.state} label={pill.label} />
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-[11px]"
            loading={remove.busy}
            onClick={() => remove.run(async () => { const r = await removeCamera(camera.id); await onReload(); return r; }, { success: c.removed, error: c.offline })}
          >
            {remove.busy ? c.removing : c.remove}
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="flex flex-col gap-2 border-t border-edge pt-2">
          <TextField label={c.cameraLabel} autoComplete="off" placeholder={c.cameraLabelPh} value={label} onChange={(e) => setLabel(e.target.value)} />
          <ActionRow>
            <TextField label={c.cameraHost} autoComplete="off" placeholder={c.cameraHostPh} value={host} onChange={(e) => setHost(e.target.value)} />
            <TextField label={c.cameraPort} autoComplete="off" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} />
          </ActionRow>
          <ActionRow>
            <TextField label={c.cameraPath} autoComplete="off" placeholder={c.cameraPathPh} value={path} onChange={(e) => setPath(e.target.value.replace(/^\/+/, ""))} />
            <TextField label={c.cameraUsername} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </ActionRow>
          <TextField
            label={c.cameraPassword}
            type="password"
            autoComplete="off"
            placeholder={c.cameraPasswordPh}
            value={password}
            onFocus={() => { if (password === MASK) setPassword(""); }}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Checkbox label={c.cameraPtz} checked={ptzEnabled} onChange={(e) => setPtzEnabled(e.target.checked)} />
          {ptzEnabled ? (
            <TextField label={c.cameraOnvifPort} autoComplete="off" inputMode="numeric" placeholder={c.cameraOnvifPortPh} value={onvifPort} onChange={(e) => setOnvifPort(e.target.value.replace(/[^0-9]/g, ""))} />
          ) : null}
          <Button
            loading={save.busy}
            disabled={!ready}
            onClick={() =>
              save.run(
                async () => {
                  const patch: Record<string, unknown> = {
                    label: label.trim(),
                    host: host.trim(),
                    port: portNum,
                    path: path.trim(),
                    username: username.trim(),
                    ptzEnabled,
                    onvifPort: ptzEnabled ? onvifPortNum : camera.onvifPort,
                  };
                  if (password && password !== MASK) patch.password = password;
                  const res = await updateCamera(camera.id, patch);
                  if (res.ok) { await onReload(); setEditing(false); }
                  return res;
                },
                { success: c.cameraSaved, error: c.cameraError },
              )
            }
          >
            {save.busy ? c.cameraSaving : c.cameraSave}
          </Button>
          {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
        </div>
      ) : null}
      {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
    </li>
  );
}

export function CameraConfigCard({ c }: { c: ConfigCopy }) {
  const [cameras, setCameras] = useState<CameraItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("554");
  const [path, setPath] = useState("onvif1");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [ptzEnabled, setPtzEnabled] = useState(false);
  const [onvifPort, setOnvifPort] = useState("5000");
  const add = useRequest();

  async function reload() {
    setCameras(await fetchCameras());
  }

  useEffect(() => {
    void reload();
  }, []);

  if (cameras === null) return null;

  const portNum = Number(port);
  const onvifPortNum = Number(onvifPort);
  const ready = Boolean(host.trim()) && Number.isInteger(portNum) && portNum > 0 && portNum <= 65535 && Boolean(username.trim());
  const listSummary = cameras.length ? `${c.cameraListLabel} (${cameras.length})` : c.cameraListLabel;

  async function handleAdd() {
    if (!host.trim()) return;
    await add.run(async () => {
      const res = await addCamera({
        label: label.trim(),
        host: host.trim(),
        port: portNum,
        path: path.trim(),
        username: username.trim(),
        password,
        ptzEnabled,
        onvifPort: ptzEnabled ? onvifPortNum : 5000,
      });
      if (res.ok) {
        await reload();
        setLabel(""); setHost(""); setPort("554"); setPath("onvif1"); setUsername("admin"); setPassword(""); setPtzEnabled(false); setOnvifPort("5000");
      }
      return res;
    }, { success: c.cameraSaved, error: c.cameraError });
  }

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
      </div>

      <Fold summary={listSummary} defaultOpen={cameras.length > 0}>
        {cameras.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {cameras.map((camera) => (
              <CameraRow key={camera.id} camera={camera} c={c} onReload={reload} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-xs text-ink3">{c.cameraEmpty}</p>
        )}
      </Fold>

      <Fold summary={c.cameraAdd}>
        <div className="flex flex-col gap-3">
          <TextField label={c.cameraLabel} autoComplete="off" placeholder={c.cameraLabelPh} value={label} onChange={(e) => setLabel(e.target.value)} />
          <ActionRow>
            <TextField label={c.cameraHost} autoComplete="off" placeholder={c.cameraHostPh} value={host} onChange={(e) => setHost(e.target.value)} />
            <TextField label={c.cameraPort} autoComplete="off" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} />
          </ActionRow>
          <ActionRow>
            <TextField label={c.cameraPath} autoComplete="off" placeholder={c.cameraPathPh} value={path} onChange={(e) => setPath(e.target.value.replace(/^\/+/, ""))} />
            <TextField label={c.cameraUsername} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </ActionRow>
          <TextField label={c.cameraPassword} type="password" autoComplete="off" placeholder={c.cameraPasswordPh} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Checkbox label={c.cameraPtz} checked={ptzEnabled} onChange={(e) => setPtzEnabled(e.target.checked)} />
          {ptzEnabled ? (
            <TextField label={c.cameraOnvifPort} autoComplete="off" inputMode="numeric" placeholder={c.cameraOnvifPortPh} value={onvifPort} onChange={(e) => setOnvifPort(e.target.value.replace(/[^0-9]/g, ""))} />
          ) : null}
          <Button loading={add.busy} disabled={!ready} onClick={() => void handleAdd()}>
            {add.busy ? c.cameraSaving : c.cameraAdd}
          </Button>
          {add.message ? <FieldStatus status={add.status} message={add.message} /> : null}
        </div>
      </Fold>
    </article>
  );
}
