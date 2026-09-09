import { useEffect, useState } from "react";
import { adbConnect, addAndroidDevice, fetchAndroidAdbDevices, fetchAndroidAdbStatus, fetchAndroidDevices, removeAndroidDevice, updateAndroidDevice } from "../../api/client";
import type { AndroidDevice } from "../../api/types";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useRequest } from "../../hooks/useRequest";
import { cfgCard, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, Checkbox, FieldStatus, Fold, StatusPill, TextField } from "./ui";

function AndroidIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
            <path d="M6 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
            <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M8 18v-2a4 4 0 0 1 8 0v2" />
        </svg>
    );
}

function AndroidRow({ device, c, onReload }: { device: AndroidDevice; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(device.label);
    const [host, setHost] = useState(device.host);
    const [port, setPort] = useState(String(device.port));
    const [serial, setSerial] = useState(device.serial);
    const [autoConnect, setAutoConnect] = useState(device.autoConnect);
    const save = useRequest();
    const remove = useRequest();
    const connect = useRequest();
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const deviceLabel = device.label || device.model || device.serial || `${device.host}:${device.port}`;

    const pill = device.online ? { state: "ok" as const, label: device.model || device.state } : device.configured ? { state: "missing" as const, label: device.state || "offline" } : { state: "missing" as const, label: c.androidNotConfigured ?? "Não configurado" };

    return (
        <li className="flex flex-col gap-2 rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-[650]">{deviceLabel}</p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">
                        {device.serial ? `serial: ${device.serial}` : device.host ? `${device.host}:${device.port}` : "—"} {device.model ? `· ${device.model}` : ""} · {device.state}
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <StatusPill state={pill.state} label={pill.label} />
                    {device.host ? (
                        <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={connect.busy} onClick={() => connect.run(async () => { const r = await adbConnect(device.host, Number(port) || 5555); await onReload(); return r; }, { success: c.androidConnected ?? "Conectado", error: c.androidError ?? "Falha" })}>
                            {connect.busy ? "..." : "Conectar"}
                        </Button>
                    ) : null}
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar" : "Editar"}</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[11px]" loading={remove.busy} onClick={() => setConfirmingRemove(true)}>
                        {remove.busy ? c.removing : c.remove}
                    </Button>
                </div>
            </div>
            {editing ? (
                <div className="flex flex-col gap-2 border-t border-edge pt-2">
                    <TextField label={c.androidLabel ?? "NOME"} autoComplete="off" placeholder={c.androidLabelPh ?? "ex.: Meu Pixel"} value={label} onChange={(e) => setLabel(e.target.value)} />
                    <ActionRow>
                        <TextField label={c.androidHost ?? "IP (TCP/IP, opcional)"} autoComplete="off" placeholder={c.androidHostPh ?? "ex.: 192.168.1.10"} value={host} onChange={(e) => setHost(e.target.value)} />
                        <TextField label={c.androidPort ?? "PORTA"} autoComplete="off" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} />
                    </ActionRow>
                    <TextField label={c.androidSerial ?? "SERIAL (USB, opcional)"} autoComplete="off" placeholder="ex.: 14ed0a1e ou emulator-5554" value={serial} onChange={(e) => setSerial(e.target.value)} />
                    <Checkbox label={c.androidAutoConnect ?? "Conectar automaticamente (TCP/IP)"} checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} />
                    <Button
                        loading={save.busy}
                        onClick={() =>
                            save.run(
                                async () => {
                                    const patch: Record<string, unknown> = {
                                        label: label.trim(),
                                        host: host.trim(),
                                        port: Number(port) || 5555,
                                        serial: serial.trim(),
                                        autoConnect,
                                    };
                                    const res = await updateAndroidDevice(device.id, patch);
                                    if (res.ok) { await onReload(); setEditing(false); }
                                    return res;
                                },
                                { success: c.androidSaved ?? "Salvo", error: c.androidError ?? "Falha" },
                            )
                        }
                    >
                        {save.busy ? (c.androidSaving ?? "Salvando…") : (c.androidSave ?? "Salvar")}
                    </Button>
                    {save.message ? <FieldStatus status={save.status} message={save.message} /> : null}
                    {connect.message ? <FieldStatus status={connect.status} message={connect.message} /> : null}
                </div>
            ) : null}
            {remove.message ? <FieldStatus status={remove.status} message={remove.message} /> : null}
            <ConfirmModal
                open={confirmingRemove}
                title={c.confirmRemoveTitle}
                body={c.confirmRemoveBody(deviceLabel)}
                confirmLabel={c.remove}
                cancelLabel={c.cancel}
                onCancel={() => setConfirmingRemove(false)}
                onConfirm={() => {
                    setConfirmingRemove(false);
                    void remove.run(async () => { const r = await removeAndroidDevice(device.id); await onReload(); return r; }, { success: c.removed, error: c.offline });
                }}
            />
        </li>
    );
}

export function AndroidConfigCard({ c }: { c: ConfigCopy }) {
    const [devices, setDevices] = useState<AndroidDevice[] | null>(null);
    const [adbStatus, setAdbStatus] = useState<{ ok: boolean; adb: string | null; version?: string; error?: string } | null>(null);
    const [liveDevices, setLiveDevices] = useState<Array<{ serial: string; state: string; model: string | null }>>([]);
    const [label, setLabel] = useState("");
    const [host, setHost] = useState("");
    const [port, setPort] = useState("5555");
    const [serial, setSerial] = useState("");
    const [autoConnect, setAutoConnect] = useState(false);
    const [connectHost, setConnectHost] = useState("");
    const [connectPort, setConnectPort] = useState("5555");
    const add = useRequest();
    const connectReq = useRequest();

    async function reload() {
        setDevices(await fetchAndroidDevices());
        try {
            const st = await fetchAndroidAdbStatus();
            setAdbStatus(st);
            setLiveDevices(st.devices || []);
        } catch {
            setAdbStatus({ ok: false, adb: null, error: "falha ao consultar adb" });
        }
    }

    async function reloadLive() {
        try {
            const list = await fetchAndroidAdbDevices();
            setLiveDevices(list);
        } catch { }
    }

    useEffect(() => { void reload(); }, []);

    if (devices === null) return null;

    const listSummary = devices.length ? `${c.androidListLabel ?? "Dispositivos cadastrados"} (${devices.length})` : (c.androidListLabel ?? "Dispositivos cadastrados");

    async function handleAdd() {
        await add.run(async () => {
            const res = await addAndroidDevice({
                label: label.trim(),
                host: host.trim(),
                port: Number(port) || 5555,
                serial: serial.trim(),
                autoConnect,
            });
            if (res.ok) {
                await reload();
                setLabel(""); setHost(""); setPort("5555"); setSerial(""); setAutoConnect(false);
            }
            return res;
        }, { success: c.androidSaved ?? "Salvo", error: c.androidError ?? "Falha" });
    }

    async function handleQuickConnect() {
        if (!connectHost.trim()) return;
        await connectReq.run(async () => {
            const r = await adbConnect(connectHost.trim(), Number(connectPort) || 5555);
            await reload();
            await reloadLive();
            return r;
        }, { success: c.androidConnected ?? "Conectado", error: c.androidError ?? "Falha" });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}><AndroidIcon /></div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.androidTitle ?? "Android (ADB / scrcpy)"}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{c.androidBlurb ?? "Espelhe a tela de qualquer Android via ADB — USB ou TCP/IP. Cada dispositivo vira um card no dashboard com vídeo ao vivo e controle por toque (tap/swipe) e botões (voltar/home). Inspirado no scrcpy, sem precisar do binário scrcpy."}</p>
                    </div>
                </div>
            </div>

            {/* Status ADB */}
            <div className="rounded-[10px] border border-edge bg-canvas px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold">ADB</span>
                    <div className="flex items-center gap-2">
                        {adbStatus ? (
                            <StatusPill state={adbStatus.ok ? "ok" : "missing"} label={adbStatus.ok ? (adbStatus.version || adbStatus.adb || "ok") : "não encontrado"} />
                        ) : <span className="text-[11px] text-ink3">verificando…</span>}
                        <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => void reload()}>Atualizar</Button>
                    </div>
                </div>
                {adbStatus && !adbStatus.ok ? (
                    <p className="m-0 mt-1 text-[11px] leading-snug text-ink3">{adbStatus.error} — instale com <code className="rounded bg-chip px-1 py-0.5">apt install adb</code> ou <code className="rounded bg-chip px-1 py-0.5">brew install android-platform-tools</code> no host do coletor.</p>
                ) : null}
                {liveDevices.length ? (
                    <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-ink3">Dispositivos detectados via adb ({liveDevices.length}):</span>
                        <ul className="m-0 flex list-none flex-col gap-1 p-0">
                            {liveDevices.map((d) => (
                                <li key={d.serial} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-2 py-1.5">
                                    <span className="min-w-0 flex-1 truncate text-[11px]"><span className="font-mono">{d.serial}</span> · {d.model || "—"} · {d.state}</span>
                                    <Button
                                        variant="ghost"
                                        className="shrink-0 px-2 py-1 text-[11px]"
                                        onClick={async () => {
                                            await addAndroidDevice({ label: d.model || d.serial, serial: d.serial });
                                            await reload();
                                        }}
                                    >
                                        Adicionar
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        <Button variant="ghost" className="mt-1 self-start px-2 py-1 text-[11px]" onClick={() => void reloadLive()}>Recarregar lista</Button>
                    </div>
                ) : adbStatus?.ok ? (
                    <p className="m-0 mt-1 text-[11px] text-ink3">Nenhum dispositivo detectado. Conecte via USB (ative Depuração USB) ou use o connect TCP/IP abaixo.</p>
                ) : null}
            </div>

            {/* Connect rápido TCP/IP */}
            <Fold summary="Conectar via TCP/IP (adb connect)">
                <div className="flex flex-col gap-2">
                    <p className="m-0 text-[11px] leading-snug text-ink3">No Android: ative Opções de desenvolvedor → Depuração USB e Depuração sem fio (ou <code className="rounded bg-chip px-1 py-0.5">adb tcpip 5555</code> via USB). Depois conecte pelo IP.</p>
                    <ActionRow>
                        <TextField label="IP" autoComplete="off" placeholder="192.168.1.10" value={connectHost} onChange={(e) => setConnectHost(e.target.value)} />
                        <TextField label="PORTA" autoComplete="off" inputMode="numeric" value={connectPort} onChange={(e) => setConnectPort(e.target.value.replace(/[^0-9]/g, ""))} />
                    </ActionRow>
                    <Button loading={connectReq.busy} disabled={!connectHost.trim()} onClick={() => void handleQuickConnect()}>
                        {connectReq.busy ? "Conectando…" : "Conectar (adb connect)"}
                    </Button>
                    {connectReq.message ? <FieldStatus status={connectReq.status} message={connectReq.message} /> : null}
                </div>
            </Fold>

            <Fold summary={listSummary} defaultOpen={devices.length > 0}>
                {devices.length ? (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {devices.map((d) => (
                            <AndroidRow key={d.id} device={d} c={c} onReload={reload} />
                        ))}
                    </ul>
                ) : (
                    <p className="m-0 text-xs text-ink3">{c.androidEmpty ?? "Nenhum dispositivo cadastrado ainda."}</p>
                )}
            </Fold>

            <Fold summary={c.androidAdd ?? "Adicionar dispositivo"}>
                <div className="flex flex-col gap-3">
                    <TextField label={c.androidLabel ?? "NOME"} autoComplete="off" placeholder={c.androidLabelPh ?? "ex.: Pixel 7"} value={label} onChange={(e) => setLabel(e.target.value)} />
                    <ActionRow>
                        <TextField label={c.androidHost ?? "IP (TCP/IP, opcional)"} autoComplete="off" placeholder={c.androidHostPh ?? "ex.: 192.168.1.10"} value={host} onChange={(e) => setHost(e.target.value)} />
                        <TextField label={c.androidPort ?? "PORTA"} autoComplete="off" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} />
                    </ActionRow>
                    <TextField label={c.androidSerial ?? "SERIAL (USB, opcional)"} autoComplete="off" placeholder="ex.: 14ed0a1e ou emulator-5554" value={serial} onChange={(e) => setSerial(e.target.value)} />
                    <Checkbox label={c.androidAutoConnect ?? "Conectar automaticamente (TCP/IP)"} checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} />
                    <p className="m-0 text-[11px] leading-snug text-ink3">Preencha IP para TCP/IP ou SERIAL para USB. Se ambos, o serial tem prioridade. O card no dashboard mostra o espelhamento ao vivo.</p>
                    <Button loading={add.busy} onClick={() => void handleAdd()}>
                        {add.busy ? (c.androidSaving ?? "Salvando…") : (c.androidAdd ?? "Adicionar dispositivo")}
                    </Button>
                    {add.message ? <FieldStatus status={add.status} message={add.message} /> : null}
                </div>
            </Fold>
        </article>
    );
}
