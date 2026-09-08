import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../cn";

type Emu = {
    paused?: boolean;
    volume?: number;
    muted?: boolean;
    isFastForward?: boolean;
    isSlowMotion?: boolean;
    rewindEnabled?: boolean;
    gameManager?: Record<string, unknown>;
    setVolume?: (v: number) => void;
    play?: () => void;
    pause?: () => void;
    togglePlaying?: () => void;
    toggleFullscreen?: (b: boolean) => void;
    displayMessage?: (m: string, t?: number) => void;
    screenshot?: (cb: (blob: Blob, fmt: string) => void, src?: string, fmt?: string, upscale?: number) => void;
    takeScreenshot?: (src?: string, fmt?: string, upscale?: number) => Promise<{ screenshot: Uint8Array; format: string }>;
    screenRecord?: () => MediaRecorder | null;
    changeSettingOption?: (k: string, v: string) => void;
    getSettingValue?: (k: string) => string | null;
    saveSettings?: () => void;
    enableShader?: (n: string) => void;
    toggleVirtualGamepad?: (b: boolean) => void;
    virtualGamepad?: HTMLElement;
    elements?: { parent?: HTMLElement };
    game?: HTMLElement;
    canvas?: HTMLCanvasElement;
    storage?: Record<string, { get: (k: string) => Promise<Uint8Array> }>;
    storageCache?: { storage?: { getAll: () => Promise<Array<{ key: string; fileSize: number; type: string }>> }; clear?: () => Promise<void>; delete?: (k: string) => Promise<void> };
    getBaseFileName?: (force?: boolean) => string;
} & Record<string, unknown>;

function getEmu(): Emu | null {
    const w = window as unknown as Record<string, unknown>;
    return (w.EJS_emulator as Emu | undefined) ?? null;
}

function getIframe(iframeRef?: React.RefObject<HTMLDivElement | null>): HTMLIFrameElement | null {
    if (!iframeRef?.current) return null;
    return iframeRef.current.querySelector("iframe") as HTMLIFrameElement | null;
}

function sendToFrame(iframeRef: React.RefObject<HTMLDivElement | null> | undefined, msg: Record<string, unknown>) {
    const iframe = getIframe(iframeRef as React.RefObject<HTMLDivElement | null>);
    if (!iframe?.contentWindow) return false;
    try {
        iframe.contentWindow.postMessage({ source: "vigia-emulator-host", ...msg }, "*");
        return true;
    } catch { return false; }
}

function IconPause() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
}
function IconPlay() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>;
}
function IconRestart() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>;
}
function IconSave() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>;
}
function IconLoad() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 3v5H7" /><path d="M12 12v9" /><path d="M9 15l3 3 3-3" /></svg>;
}
function IconVolume() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>;
}
function IconMute() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>;
}
function IconFullscreen() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>;
}
function IconScreenshot() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>;
}
function IconSettings() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 15a1.65 1.65 0 0 0-1-1.51V13a1.65 1.65 0 0 0 1-1.51 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 13 7a1.65 1.65 0 0 0 1 1.51V9a1.65 1.65 0 0 0-1 1.51z" /></svg>;
}
function IconGamepad() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="6" /><path d="M6 12h4" /><path d="M8 10v4" /><circle cx="17" cy="10" r="1" /><circle cx="15" cy="12" r="1" /></svg>;
}
function IconStop() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>;
}
function IconMore() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>;
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function EmulatorToolbar({
    status,
    onExit,
    compact,
    iframeRef,
}: {
    status: "idle" | "loading" | "ready" | "error";
    onExit: () => void;
    compact?: boolean;
    iframeRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const isReady = status === "ready";
    const [paused, setPaused] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const lastVolumeRef = useRef(1);
    const draggingRef = useRef(false);
    const [slot, setSlot] = useState("1");
    const [showMore, setShowMore] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [showCheats, setShowCheats] = useState(false);
    const [showCache, setShowCache] = useState(false);
    const [showDisks, setShowDisks] = useState(false);
    const [recording, setRecording] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const moreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isReady) return;
        // Se tem iframe, pede estado via postMessage e também tenta ler direto
        const id = window.setInterval(() => {
            if (draggingRef.current) return;
            // Tenta via iframe primeiro
            if (iframeRef?.current) {
                const iframe = getIframe(iframeRef as React.RefObject<HTMLDivElement | null>);
                if (iframe?.contentWindow) {
                    // Pede estado ao frame (frame responde com postMessage type=state)
                    try { iframe.contentWindow.postMessage({ source: "vigia-emulator-host", type: "getState" }, "*"); } catch {}
                    // Também tenta ler EJS_emulator do iframe se same-origin
                    try {
                        const w = iframe.contentWindow as unknown as Record<string, unknown>;
                        const emu = w.EJS_emulator as Emu | undefined;
                        if (emu) {
                            setPaused(Boolean(emu.paused));
                            if (typeof emu.volume === "number") {
                                const v = emu.volume;
                                setVolume(v);
                                if (v > 0) lastVolumeRef.current = v;
                            }
                            setMuted(Boolean(emu.muted));
                            const s = emu.getSettingValue?.("save-state-slot");
                            if (s) setSlot(s);
                            return;
                        }
                    } catch {}
                }
            }
            const emu = getEmu();
            if (!emu) return;
            setPaused(Boolean(emu.paused));
            if (typeof emu.volume === "number") {
                const v = emu.volume;
                setVolume(v);
                if (v > 0) lastVolumeRef.current = v;
            }
            setMuted(Boolean(emu.muted));
            const s = emu.getSettingValue?.("save-state-slot");
            if (s) setSlot(s);
        }, 500);
        // Escuta resposta de estado do iframe
        const onState = (e: MessageEvent) => {
            const msg = e.data as { source?: string; type?: string; detail?: Record<string, unknown> } | null;
            if (!msg || msg.source !== "vigia-emulator" || msg.type !== "state") return;
            const d = msg.detail as { paused?: boolean; volume?: number; muted?: boolean; slot?: string } | undefined;
            if (!d) return;
            if (typeof d.paused === "boolean") setPaused(d.paused);
            if (typeof d.volume === "number") {
                setVolume(d.volume);
                if (d.volume > 0) lastVolumeRef.current = d.volume;
            }
            if (typeof d.muted === "boolean") setMuted(d.muted);
            if (typeof d.slot === "string") setSlot(d.slot);
        };
        window.addEventListener("message", onState);
        return () => {
            window.clearInterval(id);
            window.removeEventListener("message", onState);
        };
    }, [isReady, iframeRef]);

    useEffect(() => {
        if (!showMore) return;
        const onClick = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowMore(false); };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
    }, [showMore]);

    const withEmu = useCallback((fn: (emu: Emu) => void) => {
        // Se tem iframe, tenta operar via postMessage primeiro para comandos simples
        // Para compatibilidade, também tenta getEmu direto (caso sem iframe)
        const emu = getEmu();
        if (emu) {
            try { fn(emu); return; } catch (e) { console.warn("[emu-toolbar]", e); }
        }
        // Fallback: se não tem emu no parent mas tem iframe, os comandos específicos
        // já são tratados via sendToFrame nos callbacks individuais
    }, [iframeRef]);

    const togglePause = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "togglePause" })) {
            setPaused((v) => !v);
            return;
        }
        withEmu((emu) => {
            if (emu.paused) emu.play?.();
            else emu.pause?.();
            setPaused(Boolean(!emu.paused));
        });
    }, [withEmu, iframeRef]);

    const doRestart = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "restart" })) return;
        withEmu((emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            (gm?.restart as (() => void) | undefined)?.call(gm);
            emu.displayMessage?.("Reiniciando…");
        });
    }, [withEmu, iframeRef]);

    const doSaveState = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "saveState" })) return;
        withEmu((emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            if (!gm) return;
            const supports = (gm.supportsStates as unknown as (() => number) | undefined)?.call(gm);
            if (supports === 0) { emu.displayMessage?.("Save states não suportado neste core"); return; }
            try {
                const state = (gm.getState as unknown as (() => Uint8Array) | undefined)?.call(gm);
                if (!state || state.length === 0) { emu.displayMessage?.("Falha ao salvar estado"); return; }
                const blob = new Blob([state as unknown as BlobPart]);
                const name = `${String(emu.getBaseFileName?.call(emu) ?? "game")}.state`;
                downloadBlob(blob, name);
                emu.displayMessage?.(`Estado salvo (slot ${slot})`);
                // also trigger our backend hook if available
                const w = window as unknown as Record<string, unknown>;
                const cb = w.EJS_onSaveState as ((d: { state: Uint8Array }) => void) | undefined;
                if (cb) try { cb({ state }); } catch { /* ignore */ }
            } catch (e) { console.warn(e); emu.displayMessage?.("Falha ao salvar estado"); }
        });
    }, [withEmu, slot, iframeRef]);

    const doLoadState = useCallback(async () => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "loadState" })) return;
        withEmu(async (emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            if (!gm) return;
            // try browser storage first if configured
            const loc = emu.getSettingValue?.("save-state-location");
            if (loc === "browser") {
                try {
                    const base = String(emu.getBaseFileName?.call(emu) ?? "game");
                    const storage = emu.storage as Record<string, { get: (k: string) => Promise<Uint8Array> }> | undefined;
                    const data = await storage?.states?.get(base + ".state");
                    if (data) { (gm.loadState as unknown as ((d: Uint8Array) => void) | undefined)?.call(gm, data); emu.displayMessage?.("Estado carregado do navegador"); return; }
                } catch { /* fallthrough to file picker */ }
            }
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".state,.bin";
            input.onchange = async () => {
                const f = input.files?.[0];
                if (!f) return;
                const buf = new Uint8Array(await f.arrayBuffer());
                (gm.loadState as unknown as ((d: Uint8Array) => void) | undefined)?.call(gm, buf);
                emu.displayMessage?.("Estado carregado");
            };
            input.click();
        });
    }, [withEmu, iframeRef]);

    const doQuickSave = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "quickSave", slot })) return;
        withEmu((emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            const ok = (gm?.quickSave as unknown as ((s: string) => boolean) | undefined)?.call(gm, slot);
            emu.displayMessage?.(ok ? `Salvo no slot ${slot}` : "Falha ao salvar");
        });
    }, [withEmu, slot, iframeRef]);

    const doQuickLoad = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "quickLoad", slot })) return;
        withEmu((emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            (gm?.quickLoad as unknown as ((s: string) => void) | undefined)?.call(gm, slot);
            emu.displayMessage?.(`Carregado do slot ${slot}`);
        });
    }, [withEmu, slot, iframeRef]);

    const doExportSram = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "exportSram" })) return;
        withEmu((emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            const file = (gm?.getSaveFile as unknown as ((b?: boolean) => Uint8Array | null) | undefined)?.call(gm, false);
            if (!file || file.length === 0) { emu.displayMessage?.("Nenhum save encontrado"); return; }
            const blob = new Blob([file as unknown as BlobPart]);
            const path = String((gm?.getSaveFilePath as unknown as (() => string) | undefined)?.call(gm) ?? "save.srm");
            const name = path.split("/").pop() ?? "save.srm";
            downloadBlob(blob, name);
            emu.displayMessage?.("Save exportado");
        });
    }, [withEmu]);

    const doImportSram = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "importSram" })) return;
        withEmu((emu) => {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            if (!gm) return;
            const input = document.createElement("input");
            input.type = "file";
            input.onchange = async () => {
                const f = input.files?.[0];
                if (!f) return;
                const data = new Uint8Array(await f.arrayBuffer());
                const path = String((gm.getSaveFilePath as unknown as (() => string) | undefined)?.call(gm) ?? "/save.srm");
                const FS = (gm.FS as { writeFile: (p: string, d: Uint8Array) => void; unlink: (p: string) => void; analyzePath: (p: string) => { exists: boolean }; mkdir: (p: string) => void } | undefined);
                if (!FS) return;
                try {
                    const parts = path.split("/");
                    let cp = "";
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!parts[i]) continue;
                        cp += "/" + parts[i];
                        try { if (!FS.analyzePath(cp).exists) FS.mkdir(cp); } catch { /* ignore */ }
                    }
                    try { if (FS.analyzePath(path).exists) FS.unlink(path); } catch { /* ignore */ }
                    FS.writeFile(path, data);
                    (gm.loadSaveFiles as unknown as (() => void) | undefined)?.call(gm);
                    emu.displayMessage?.("Save importado — reinicie se necessário");
                } catch (e) { console.warn(e); emu.displayMessage?.("Falha ao importar save"); }
            };
            input.click();
        });
    }, [withEmu]);

    const doScreenshot = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "screenshot" })) return;
        withEmu((emu) => {
            const take = emu.takeScreenshot ?? emu.screenshot;
            if (!take) { emu.displayMessage?.("Screenshot não disponível"); return; }
            // prefer takeScreenshot promise
            if (emu.takeScreenshot) {
                void (emu.takeScreenshot as (s?: string, f?: string, u?: number) => Promise<{ screenshot: Uint8Array; format: string }>)().then(({ screenshot, format }) => {
                    const blob = new Blob([screenshot as unknown as BlobPart], { type: `image/${format}` });
                    const base = String(emu.getBaseFileName?.call(emu) ?? "screenshot");
                    downloadBlob(blob, `${base}.${format}`);
                    emu.displayMessage?.("Screenshot salvo");
                }).catch(() => emu.displayMessage?.("Falha no screenshot"));
                return;
            }
            (emu.screenshot as (cb: (b: Blob, f: string) => void) => void)((blob: Blob, fmt: string) => {
                const base = String(emu.getBaseFileName?.call(emu) ?? "screenshot");
                downloadBlob(blob, `${base}.${fmt}`);
                emu.displayMessage?.("Screenshot salvo");
            });
        });
    }, [withEmu]);

    const toggleRecording = useCallback(() => {
        if (iframeRef?.current) {
            const action = recording ? "stop" : "start";
            if (sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "screenRecord", action })) {
                setRecording(!recording);
                return;
            }
        }
        withEmu((emu) => {
            if (recording && recorderRef.current) {
                try { recorderRef.current.stop(); } catch { /* ignore */ }
                recorderRef.current = null;
                setRecording(false);
                emu.displayMessage?.("Gravação parada");
                return;
            }
            const rec = emu.screenRecord?.();
            if (!rec) { emu.displayMessage?.("Gravação não suportada"); return; }
            recorderRef.current = rec;
            setRecording(true);
            emu.displayMessage?.("Gravando…");
            rec.addEventListener("stop", () => { setRecording(false); recorderRef.current = null; }, { once: true });
            rec.addEventListener("error", () => { setRecording(false); recorderRef.current = null; }, { once: true });
        });
    }, [withEmu, recording]);

    const setVol = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        if (clamped > 0) lastVolumeRef.current = clamped;
        setVolume(clamped);
        setMuted(clamped === 0);
        if (iframeRef?.current) sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "setVolume", volume: clamped });
        withEmu((emu) => {
            emu.volume = clamped;
            emu.setVolume?.(clamped);
        });
    }, [withEmu, iframeRef]);

    const toggleMute = useCallback(() => {
        const isMuted = muted || volume === 0;
        if (isMuted) {
            const nv = lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.5;
            setVolume(nv);
            setMuted(false);
            if (iframeRef?.current) sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "setVolume", volume: nv });
            withEmu((emu) => {
                emu.volume = nv;
                emu.muted = false;
                emu.setVolume?.(nv);
            });
        } else {
            if (volume > 0) lastVolumeRef.current = volume;
            setVolume(0);
            setMuted(true);
            if (iframeRef?.current) sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "setVolume", volume: 0 });
            withEmu((emu) => {
                emu.muted = true;
                emu.setVolume?.(0);
            });
        }
    }, [withEmu, muted, volume, iframeRef]);

    const doFullscreen = useCallback(() => {
        if (iframeRef?.current && sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "fullscreen" })) return;
        withEmu((emu) => {
            const isFs = Boolean(document.fullscreenElement);
            emu.toggleFullscreen?.(!isFs);
        });
    }, [withEmu, iframeRef]);

    const changeSlot = useCallback((next: string) => {
        setSlot(next);
        if (iframeRef?.current) sendToFrame(iframeRef as React.RefObject<HTMLDivElement | null>, { type: "changeSetting", key: "save-state-slot", value: next });
        withEmu((emu) => emu.changeSettingOption?.("save-state-slot", next));
    }, [withEmu, iframeRef]);

    if (!isReady) return null;

    const sz = compact ? "size-7" : "size-8";
    const btnBase = cn("flex shrink-0 items-center justify-center rounded-xl border text-ink2 hover:text-ink transition", sz);
    const btnChip = "border-edge bg-chip hover:border-accent";
    const btnAccent = "border-accent bg-accent text-white hover:brightness-110";

    return (
        <>
            <div className={cn("flex min-w-0 flex-1 items-center overflow-hidden", compact ? "gap-1" : "gap-1.5")}>
                <button type="button" onClick={togglePause} title={paused ? "Continuar" : "Pausar"} className={cn(btnBase, paused ? btnAccent : btnChip)}>
                    {paused ? <IconPlay /> : <IconPause />}
                </button>
                <button type="button" onClick={doRestart} title="Reiniciar" className={cn(btnBase, btnChip)}>
                    <IconRestart />
                </button>
                <div className={cn("flex shrink-0 items-center rounded-xl border border-edge bg-chip", compact ? "gap-0.5 p-0.5" : "gap-1 p-1")}>
                    <button type="button" onClick={doQuickSave} title={`Salvar rápido (slot ${slot})`} className={cn("flex items-center justify-center rounded-lg bg-panel text-ink2 hover:text-ink", compact ? "size-6" : "size-7")}>
                        <IconSave />
                    </button>
                    <select value={slot} onChange={(e) => changeSlot(e.target.value)} title="Slot de save state" className={cn("rounded-lg border border-edge bg-panel font-medium outline-none focus:border-accent", compact ? "h-6 px-0.5 text-[10px]" : "h-7 px-1 text-[11px]")}>
                        {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" onClick={doQuickLoad} title={`Carregar rápido (slot ${slot})`} className={cn("flex items-center justify-center rounded-lg bg-panel text-ink2 hover:text-ink", compact ? "size-6" : "size-7")}>
                        <IconLoad />
                    </button>
                </div>
                {!compact ? (
                    <>
                        <button type="button" onClick={doSaveState} title="Salvar estado (download)" className={cn(btnBase, btnChip)}>
                            <span className="text-[10px] font-bold">S</span>
                        </button>
                        <button type="button" onClick={doLoadState} title="Carregar estado (arquivo)" className={cn(btnBase, btnChip)}>
                            <span className="text-[10px] font-bold">L</span>
                        </button>
                        <div className="flex items-center gap-1 rounded-xl border border-edge bg-chip px-1.5 py-1">
                            <button type="button" onClick={toggleMute} title={muted ? "Ativar som" : "Silenciar"} className="flex size-6 items-center justify-center rounded-lg text-ink2 hover:text-ink">
                                {muted || volume === 0 ? <IconMute /> : <IconVolume />}
                            </button>
                            <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onInput={(e) => setVol(parseFloat((e.target as HTMLInputElement).value))} onChange={(e) => setVol(parseFloat((e.target as HTMLInputElement).value))} onPointerDown={() => { draggingRef.current = true; }} onPointerUp={() => { draggingRef.current = false; }} onPointerCancel={() => { draggingRef.current = false; }} className="h-1 w-14 accent-accent lg:w-16" aria-label="Volume" />
                        </div>
                    </>
                ) : null}
                <button type="button" onClick={doScreenshot} title="Screenshot" className={cn(btnBase, btnChip)}>
                    <IconScreenshot />
                </button>
                <button type="button" onClick={doFullscreen} title="Tela cheia" className={cn(btnBase, btnChip)}>
                    <IconFullscreen />
                </button>
                <button type="button" onClick={() => setShowSettings(true)} title="Configurações" className={cn(btnBase, btnChip)}>
                    <IconSettings />
                </button>
                <div className="relative shrink-0" ref={moreRef}>
                    <button type="button" onClick={() => setShowMore((v) => !v)} title="Mais opções" className={cn(btnBase, showMore ? btnAccent : btnChip)}>
                        <IconMore />
                    </button>
                    {showMore ? (
                        <div className="absolute bottom-full right-0 z-30 mb-2 flex min-w-[220px] flex-col gap-1 rounded-2xl border border-edge bg-panel p-2 shadow-card-hover">
                            {compact ? (
                                <>
                                    <button type="button" onClick={() => { setShowMore(false); doSaveState(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">⬇ Salvar estado (S)</button>
                                    <button type="button" onClick={() => { setShowMore(false); doLoadState(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">⬆ Carregar estado (L)</button>
                                    <div className="flex items-center gap-2 rounded-xl bg-chip px-3 py-2">
                                        <button type="button" onClick={toggleMute} className="flex size-7 items-center justify-center rounded-lg bg-panel text-ink2 hover:text-ink">{muted || volume === 0 ? <IconMute /> : <IconVolume />}</button>
                                        <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onInput={(e) => setVol(parseFloat((e.target as HTMLInputElement).value))} onChange={(e) => setVol(parseFloat((e.target as HTMLInputElement).value))} onPointerDown={() => { draggingRef.current = true; }} onPointerUp={() => { draggingRef.current = false; }} onPointerCancel={() => { draggingRef.current = false; }} className="h-1 flex-1 accent-accent" aria-label="Volume" />
                                    </div>
                                    <div className="my-1 h-px bg-edge" />
                                </>
                            ) : null}
                            <button type="button" onClick={() => { setShowMore(false); doExportSram(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">⬇ Exportar save (SRAM)</button>
                            <button type="button" onClick={() => { setShowMore(false); doImportSram(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">⬆ Importar save (SRAM)</button>
                            <button type="button" onClick={() => { setShowMore(false); toggleRecording(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">{recording ? "⏹ Parar gravação" : "● Gravar tela"}</button>
                            <button type="button" onClick={() => { setShowMore(false); setShowControls(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip"><IconGamepad /> Controles</button>
                            <button type="button" onClick={() => { setShowMore(false); setShowCheats(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">✦ Cheats</button>
                            <button type="button" onClick={() => { setShowMore(false); setShowDisks(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">💿 Discos</button>
                            <button type="button" onClick={() => { setShowMore(false); setShowCache(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-chip">🗄 Cache</button>
                            <div className="my-1 h-px bg-edge" />
                            <button type="button" onClick={() => { setShowMore(false); onExit(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-bad hover:bg-chip"><IconStop /> Parar jogo</button>
                        </div>
                    ) : null}
                </div>
            </div>

            {showSettings ? <EmulatorSettingsModal onClose={() => setShowSettings(false)} /> : null}
            {showControls ? <EmulatorControlsModal onClose={() => setShowControls(false)} /> : null}
            {showCheats ? <EmulatorCheatsModal onClose={() => setShowCheats(false)} /> : null}
            {showCache ? <EmulatorCacheModal onClose={() => setShowCache(false)} /> : null}
            {showDisks ? <EmulatorDisksModal onClose={() => setShowDisks(false)} /> : null}
        </>
    );
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label={title} className={cn("flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-card-hover", wide ? "max-w-[720px]" : "max-w-[520px]")} onClick={(e) => e.stopPropagation()}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
                    <h2 className="m-0 text-[15px] font-bold">{title}</h2>
                    <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-xl border border-edge bg-chip text-ink2 hover:text-ink">✕</button>
                </div>
                <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
            </div>
        </div>,
        document.body,
    );
}

function SettingRow({ label, value, options, onChange, hint }: { label: string; value: string; options: Record<string, string> | string[]; onChange: (v: string) => void; hint?: string }) {
    const opts: Record<string, string> = Array.isArray(options) ? Object.fromEntries(options.map((o) => [o, o])) : options;
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink2">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-xl border border-edge bg-canvas px-3 text-[13px] outline-none focus:border-accent">
                {Object.entries(opts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {hint ? <span className="text-[11px] text-ink3">{hint}</span> : null}
        </label>
    );
}

function EmulatorSettingsModal({ onClose }: { onClose: () => void }) {
    const [tab, setTab] = useState<"video" | "speed" | "input" | "save" | "core">("video");
    const [values, setValues] = useState<Record<string, string>>({});
    const [coreOpts, setCoreOpts] = useState<Array<{ key: string; desc: string; values: Array<{ value: string; label: string }>; current: string; info?: string }>>([]);

    useEffect(() => {
        const emu = getEmu();
        if (!emu) return;
        const v: Record<string, string> = {};
        const keys = ["shader", "webgl2Enabled", "fps", "vsync", "videoRotation", "screenshotSource", "screenshotFormat", "screenshotUpscale", "screenRecordFPS", "screenRecordFormat", "screenRecordUpscale", "screenRecordVideoBitrate", "screenRecordAudioBitrate", "fastForward", "ff-ratio", "slowMotion", "sm-ratio", "rewindEnabled", "rewind-granularity", "menubarBehavior", "keyboardInput", "altKeyboardInput", "lockMouse", "autofireInterval", "save-state-slot", "save-state-location", "save-save-interval", "virtual-gamepad", "menu-bar-button", "virtual-gamepad-left-handed-mode"];
        for (const k of keys) {
            const val = emu.getSettingValue?.(k);
            if (val != null) v[k] = String(val);
        }
        // defaults
        if (!v["shader"]) v["shader"] = "disabled";
        if (!v["fps"]) v["fps"] = "hide";
        if (!v["vsync"]) v["vsync"] = "enabled";
        if (!v["videoRotation"]) v["videoRotation"] = "0";
        if (!v["save-state-slot"]) v["save-state-slot"] = "1";
        if (!v["save-state-location"]) v["save-state-location"] = "download";
        setValues(v);
        try {
            const gm = emu.gameManager as Record<string, unknown> | undefined;
            const json = (gm?.getCoreOptionsJSON as (() => string | null) | undefined)?.call(gm);
            if (json) {
                const data = JSON.parse(json) as { options: Array<{ key: string; desc: string; values: Array<{ value: string; label: string }>; current: string; default: string; info?: string; visible?: boolean }> };
                if (data?.options?.length) {
                    setCoreOpts(data.options.filter((o) => o.visible !== false && o.values.length > 1).map((o) => ({ key: o.key, desc: o.desc || o.key, values: o.values, current: o.current ?? o.default, info: o.info })));
                }
            } else {
                const txt = (gm?.getCoreOptions as (() => string) | undefined)?.call(gm);
                if (txt) {
                    const opts: typeof coreOpts = [];
                    txt.split("\n").forEach((line) => {
                        const parts = line.split("; ");
                        if (parts.length < 2) return;
                        const name = parts[0];
                        const key = name.split("|")[0];
                        const desc = key.replace(/_/g, " ").replace(/.+\-(.+)/, "$1");
                        const options = parts[1].split("|").filter(Boolean);
                        if (options.length <= 1) return;
                        const cur = name.includes("|") ? name.split("|")[1] : options[0].replace("(Default) ", "");
                        opts.push({ key, desc, values: options.map((o) => ({ value: o, label: o })), current: cur });
                    });
                    setCoreOpts(opts);
                }
            }
        } catch { /* ignore */ }
    }, []);

    const set = useCallback((k: string, v: string) => {
        setValues((prev) => ({ ...prev, [k]: v }));
        const emu = getEmu();
        emu?.changeSettingOption?.(k, v);
    }, []);

    const tabs: Array<{ id: typeof tab; label: string }> = [
        { id: "video", label: "Vídeo" },
        { id: "speed", label: "Velocidade" },
        { id: "input", label: "Entrada" },
        { id: "save", label: "Saves" },
        { id: "core", label: "Core" },
    ];

    return (
        <ModalShell title="Configurações do emulador" onClose={onClose} wide>
            <div className="flex gap-1 overflow-x-auto pb-1">
                {tabs.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold", tab === t.id ? "bg-accent text-white" : "bg-chip text-ink2 hover:text-ink")}>{t.label}</button>
                ))}
            </div>
            {tab === "video" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <SettingRow label="Shader" value={values["shader"] ?? "disabled"} options={{ disabled: "Desativado", "2xScaleHQ.glslp": "2xScaleHQ", "crt-aperture.glslp": "CRT aperture", "crt-easymode.glslp": "CRT easymode", "crt-geom.glslp": "CRT geom" }} onChange={(v) => set("shader", v)} />
                    <SettingRow label="WebGL2" value={values["webgl2Enabled"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("webgl2Enabled", v)} hint="Requer reinício" />
                    <SettingRow label="FPS" value={values["fps"] ?? "hide"} options={{ show: "Mostrar", hide: "Ocultar" }} onChange={(v) => set("fps", v)} />
                    <SettingRow label="VSync" value={values["vsync"] ?? "enabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("vsync", v)} />
                    <SettingRow label="Rotação" value={values["videoRotation"] ?? "0"} options={{ "0": "0°", "1": "90°", "2": "180°", "3": "270°" }} onChange={(v) => set("videoRotation", v)} />
                    <SettingRow label="Fonte screenshot" value={values["screenshotSource"] ?? "canvas"} options={{ canvas: "canvas", retroarch: "retroarch" }} onChange={(v) => set("screenshotSource", v)} />
                    <SettingRow label="Formato screenshot" value={values["screenshotFormat"] ?? "png"} options={{ png: "png", jpeg: "jpeg", webp: "webp" }} onChange={(v) => set("screenshotFormat", v)} />
                    <SettingRow label="Upscale screenshot" value={values["screenshotUpscale"] ?? "1"} options={{ "0": "nativo", "1": "1x", "2": "2x", "3": "3x" }} onChange={(v) => set("screenshotUpscale", v)} />
                </div>
            ) : null}
            {tab === "speed" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <SettingRow label="Fast Forward" value={values["fastForward"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("fastForward", v)} />
                    <SettingRow label="FF Ratio" value={values["ff-ratio"] ?? "3.0"} options={["1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "5.0", "10.0", "unlimited"]} onChange={(v) => set("ff-ratio", v)} />
                    <SettingRow label="Slow Motion" value={values["slowMotion"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("slowMotion", v)} />
                    <SettingRow label="SM Ratio" value={values["sm-ratio"] ?? "3.0"} options={["1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "5.0"]} onChange={(v) => set("sm-ratio", v)} />
                    <SettingRow label="Rewind" value={values["rewindEnabled"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("rewindEnabled", v)} hint="Requer reinício" />
                    <SettingRow label="Rewind Granularidade" value={values["rewind-granularity"] ?? "6"} options={{ "1": "1", "3": "3", "6": "6", "12": "12", "25": "25" }} onChange={(v) => set("rewind-granularity", v)} />
                </div>
            ) : null}
            {tab === "input" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <SettingRow label="Teclado direto" value={values["keyboardInput"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("keyboardInput", v)} />
                    <SettingRow label="Encaminhar Alt" value={values["altKeyboardInput"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("altKeyboardInput", v)} />
                    <SettingRow label="Travar mouse" value={values["lockMouse"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("lockMouse", v)} />
                    <SettingRow label="Autofire intervalo" value={values["autofireInterval"] ?? "100"} options={{ "20": "20ms", "50": "50ms", "100": "100ms", "200": "200ms", "500": "500ms" }} onChange={(v) => set("autofireInterval", v)} />
                    <SettingRow label="Gamepad virtual" value={values["virtual-gamepad"] ?? "enabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("virtual-gamepad", v)} />
                    <SettingRow label="Mão esquerda" value={values["virtual-gamepad-left-handed-mode"] ?? "disabled"} options={{ enabled: "Ativado", disabled: "Desativado" }} onChange={(v) => set("virtual-gamepad-left-handed-mode", v)} />
                </div>
            ) : null}
            {tab === "save" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <SettingRow label="Slot" value={values["save-state-slot"] ?? "1"} options={["1", "2", "3", "4", "5", "6", "7", "8", "9"]} onChange={(v) => set("save-state-slot", v)} />
                    <SettingRow label="Local" value={values["save-state-location"] ?? "download"} options={{ download: "Download", browser: "Navegador" }} onChange={(v) => set("save-state-location", v)} />
                    <SettingRow label="Auto-save SRAM" value={values["save-save-interval"] ?? "300"} options={{ "0": "Desativado", "30": "30s", "60": "1min", "300": "5min", "600": "10min" }} onChange={(v) => set("save-save-interval", v)} />
                </div>
            ) : null}
            {tab === "core" ? (
                <div className="flex flex-col gap-3">
                    {coreOpts.length === 0 ? <p className="text-[13px] text-ink3">Nenhuma opção de core disponível para este jogo.</p> : coreOpts.map((o) => (
                        <SettingRow key={o.key} label={o.desc} value={values[o.key] ?? o.current} options={Object.fromEntries(o.values.map((v) => [v.value, v.label]))} onChange={(v) => set(o.key, v)} hint={o.info} />
                    ))}
                </div>
            ) : null}
            <p className="text-[11px] text-ink3">Algumas opções exigem reiniciar o jogo para aplicar.</p>
        </ModalShell>
    );
}

function EmulatorControlsModal({ onClose }: { onClose: () => void }) {
    const [info, setInfo] = useState<string>("Carregando…");
    useEffect(() => {
        const emu = getEmu();
        if (!emu) { setInfo("Emulador não iniciado"); return; }
        const gm = emu.gameManager as Record<string, unknown> | undefined;
        const controls = (emu as unknown as Record<string, unknown>).controls as Record<string, Record<string, { value?: number; value2?: string }>> | undefined;
        const lines: string[] = [];
        if (controls) {
            for (let p = 0; p < 2; p++) {
                const c = controls[p];
                if (!c || Object.keys(c).length === 0) continue;
                lines.push(`Jogador ${p + 1}: ${Object.keys(c).length} mapeamentos`);
            }
        }
        if (gm) {
            try {
                const portInfo = (gm.getControllerPortInfo as (() => string) | undefined)?.call(gm);
                if (portInfo) lines.push(portInfo);
            } catch { /* ignore */ }
        }
        setInfo(lines.join("\n") || "Controles padrão ativos. Use o editor nativo para remapear.");
    }, []);
    const openNative = useCallback(() => {
        const emu = getEmu() as unknown as Record<string, unknown> | null;
        if (!emu) return;
        const parent = (emu.elements as { parent?: HTMLElement } | undefined)?.parent ?? document.querySelector(".ejs_parent") as HTMLElement | null;
        if (parent) parent.classList.add("vigia-allow-ejs-popup");
        const menu = (emu as Record<string, unknown>).controlMenu as HTMLElement | undefined;
        if (menu) {
            menu.style.display = "";
            // garante que o container do popup também apareça
            const popup = menu.closest(".ejs_popup_container") as HTMLElement | null;
            if (popup) popup.style.display = "";
            // foca para capturar teclas
            try { menu.focus(); } catch { /* ignore */ }
        } else {
            // fallback: tenta encontrar qualquer popup de controles no DOM
            const fallback = document.querySelector(".ejs_control_body") as HTMLElement | null;
            if (fallback) {
                const container = fallback.closest(".ejs_popup_container") as HTMLElement | null;
                if (container) container.style.display = "";
                fallback.style.display = "";
            }
        }
        onClose();
    }, [onClose]);
    useEffect(() => {
        return () => {
            // ao fechar nosso modal sem abrir o nativo, garante que não fica com a classe presa
            // (quando o nativo abre, ele mesmo se fecha via botão Fechar dele)
        };
    }, []);
    return (
        <ModalShell title="Controles" onClose={onClose}>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink2">{info}</p>
            <div className="flex gap-2">
                <button type="button" onClick={openNative} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white">Abrir editor nativo</button>
                <button type="button" onClick={onClose} className="rounded-xl border border-edge bg-chip px-4 py-2 text-[13px] font-medium">Fechar</button>
            </div>
            <p className="text-[11px] text-ink3">O editor nativo abrirá sobre o jogo. Use Esc ou o botão Fechar dele para sair — ele fecha sozinho e remove o overlay.</p>
        </ModalShell>
    );
}

function EmulatorCheatsModal({ onClose }: { onClose: () => void }) {
    const [cheats, setCheats] = useState<Array<{ desc: string; code: string; checked: boolean }>>([]);
    const [desc, setDesc] = useState("");
    const [code, setCode] = useState("");
    useEffect(() => {
        const emu = getEmu();
        const list = (emu as unknown as Record<string, unknown>).cheats as Array<{ desc: string; code: string; checked: boolean }> | undefined;
        if (list) setCheats([...list]);
    }, []);
    const toggle = (i: number, checked: boolean) => {
        const emu = getEmu();
        if (!emu) return;
        const gm = emu.gameManager as Record<string, unknown> | undefined;
        (gm?.setCheat as ((idx: number, en: boolean, c: string) => void) | undefined)?.call(gm, i, checked, cheats[i].code);
        const next = [...cheats];
        next[i].checked = checked;
        setCheats(next);
        const arr = (emu as unknown as Record<string, unknown>).cheats as Array<{ checked: boolean }> | undefined;
        if (arr?.[i]) arr[i].checked = checked;
        (emu as unknown as { saveSettings?: () => void })?.saveSettings?.();
    };
    const add = () => {
        if (!desc.trim() || !code.trim()) return;
        const emu = getEmu();
        if (!emu) return;
        const list = (emu as unknown as Record<string, unknown>).cheats as Array<{ desc: string; code: string; checked: boolean }> | undefined;
        if (!list) return;
        list.push({ desc: desc.trim(), code: code.trim(), checked: false });
        setCheats([...list]);
        setDesc(""); setCode("");
        (emu as unknown as { saveSettings?: () => void })?.saveSettings?.();
        // refresh UI
        const gm = emu.gameManager as Record<string, unknown> | undefined;
        (gm?.resetCheat as (() => void) | undefined)?.call(gm);
        list.forEach((c, idx) => (gm?.setCheat as ((i: number, e: boolean, code: string) => void) | undefined)?.call(gm, idx, c.checked, c.code));
    };
    const remove = (i: number) => {
        const emu = getEmu();
        if (!emu) return;
        const list = (emu as unknown as Record<string, unknown>).cheats as Array<unknown> | undefined;
        if (!list) return;
        const gm = emu.gameManager as Record<string, unknown> | undefined;
        (gm?.setCheat as ((idx: number, en: boolean, c: string) => void) | undefined)?.call(gm, i, false, cheats[i].code);
        list.splice(i, 1);
        setCheats([...(list as typeof cheats)]);
        (emu as unknown as { saveSettings?: () => void })?.saveSettings?.();
    };
    return (
        <ModalShell title="Cheats" onClose={onClose}>
            {cheats.length === 0 ? <p className="text-[13px] text-ink3">Nenhum cheat adicionado.</p> : (
                <div className="flex flex-col gap-2">
                    {cheats.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl border border-edge bg-chip px-3 py-2">
                            <input type="checkbox" checked={c.checked} onChange={(e) => toggle(i, e.target.checked)} className="size-4 accent-accent" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium">{c.desc}</div>
                                <div className="truncate font-mono text-[11px] text-ink3">{c.code}</div>
                            </div>
                            <button type="button" onClick={() => remove(i)} className="rounded-lg bg-panel px-2 py-1 text-[11px] text-bad hover:bg-bad hover:text-white">remover</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="rounded-xl border border-edge bg-canvas p-3">
                <div className="mb-2 text-[12px] font-semibold">Adicionar cheat</div>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" className="mb-2 h-9 w-full rounded-xl border border-edge bg-panel px-3 text-[13px] outline-none focus:border-accent" />
                <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código" rows={2} className="mb-2 w-full rounded-xl border border-edge bg-panel px-3 py-2 font-mono text-[12px] outline-none focus:border-accent" />
                <button type="button" onClick={add} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white">Adicionar</button>
            </div>
        </ModalShell>
    );
}

function EmulatorCacheModal({ onClose }: { onClose: () => void }) {
    const [items, setItems] = useState<Array<{ key: string; size: number; type: string }>>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        void (async () => {
            const emu = getEmu();
            const cache = (emu as unknown as Record<string, unknown>)?.storageCache as { storage?: { getAll: () => Promise<Array<{ key: string; fileSize: number; type: string }>> } } | undefined;
            if (!cache?.storage?.getAll) { setLoading(false); return; }
            try {
                const all = await cache.storage.getAll();
                setItems(all.filter((i) => i.key).map((i) => ({ key: i.key, size: i.fileSize, type: i.type ?? "desconhecido" })));
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, []);
    const clearAll = async () => {
        const emu = getEmu();
        const cache = (emu as unknown as Record<string, unknown>)?.storageCache as { clear: () => Promise<void> } | undefined;
        if (cache?.clear) { await cache.clear(); setItems([]); }
    };
    const removeOne = async (key: string) => {
        const emu = getEmu();
        const cache = (emu as unknown as Record<string, unknown>)?.storageCache as { delete: (k: string) => Promise<void> } | undefined;
        if (cache?.delete) { await cache.delete(key); setItems((prev) => prev.filter((i) => i.key !== key)); }
    };
    return (
        <ModalShell title="Cache do emulador" onClose={onClose}>
            {loading ? <p className="text-[13px] text-ink3">Carregando…</p> : items.length === 0 ? <p className="text-[13px] text-ink3">Cache vazio.</p> : (
                <div className="flex flex-col gap-2">
                    {items.map((it) => (
                        <div key={it.key} className="flex items-center gap-2 rounded-xl border border-edge bg-chip px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-medium">{it.key.slice(0, 60)}</div>
                                <div className="text-[11px] text-ink3">{it.type} · {(it.size / 1024).toFixed(1)} kB</div>
                            </div>
                            <button type="button" onClick={() => void removeOne(it.key)} className="rounded-lg bg-panel px-2 py-1 text-[11px] hover:bg-bad hover:text-white">remover</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <button type="button" onClick={() => void clearAll()} className="rounded-xl border border-edge bg-chip px-4 py-2 text-[13px] font-medium hover:border-bad hover:text-bad">Limpar tudo</button>
                <button type="button" onClick={onClose} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white">Fechar</button>
            </div>
        </ModalShell>
    );
}

function EmulatorDisksModal({ onClose }: { onClose: () => void }) {
    const [count, setCount] = useState(0);
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        const emu = getEmu();
        const gm = emu?.gameManager as Record<string, unknown> | undefined;
        if (!gm) return;
        try {
            const c = (gm.getDiskCount as (() => number) | undefined)?.call(gm) ?? 0;
            const cur = (gm.getCurrentDisk as (() => number) | undefined)?.call(gm) ?? 0;
            setCount(c); setCurrent(cur);
        } catch { /* ignore */ }
    }, []);
    const setDisk = (idx: number) => {
        const emu = getEmu();
        const gm = emu?.gameManager as Record<string, unknown> | undefined;
        (gm?.setCurrentDisk as ((n: number) => void) | undefined)?.call(gm, idx);
        emu?.changeSettingOption?.("disk", String(idx));
        setCurrent(idx);
        emu?.displayMessage?.(`Disco ${idx + 1} selecionado`);
    };
    return (
        <ModalShell title="Discos" onClose={onClose}>
            {count <= 1 ? <p className="text-[13px] text-ink3">Este jogo tem apenas um disco.</p> : (
                <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: count }, (_, i) => (
                        <button key={i} type="button" onClick={() => setDisk(i)} className={cn("rounded-xl border px-4 py-3 text-[13px] font-semibold", current === i ? "border-accent bg-accent text-white" : "border-edge bg-chip hover:border-accent")}>Disco {i + 1}</button>
                    ))}
                </div>
            )}
            <button type="button" onClick={onClose} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white">Fechar</button>
        </ModalShell>
    );
}
