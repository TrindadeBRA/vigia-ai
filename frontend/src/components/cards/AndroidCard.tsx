import { useCallback, useEffect, useRef, useState } from "react";
import { sendAndroidInput } from "../../api/client";
import type { AndroidDevice } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { emptyNote } from "../../tw";

/** Widget de espelhamento Android via ADB (protótipo inspirado no scrcpy).
 * Usa `adb exec-out screencap -p` no coletor e entrega MJPEG via
 * `/api/android/devices/:id/stream` (polling ~2.5fps). Toque/clique no
 * preview envia `adb shell input tap/swipe/keyevent` — espelhamento
 * interativo leve sem precisar do binário scrcpy. Para H.264 nativo,
 * o usuário pode rodar scrcpy externo; este card cobre o caso sem
 * dependência extra. */
export function androidAllowedSizes(): CardSize[] {
    return ["sm", "md", "lg", "xl", "free"];
}

export function androidSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "sm") return t.widgetSmall;
    if (s === "free") return t.cardFree;
    if (s === "xl") return t.cardXl;
    return s === "lg" ? t.cardLarge : t.cardNormal;
}

const RECONNECT_MS = 3000;

function AndroidIcon({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
            <path d="M6 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
            <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M8 18v-2a4 4 0 0 1 8 0v2" />
            <path d="M9 9l-1-1M15 9l1-1" />
        </svg>
    );
}

function ControlButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cn(
                "flex size-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
                active ? "bg-accent text-accent-ink" : "bg-black/45 text-white hover:bg-black/60 active:bg-black/75",
            )}
        >
            {children}
        </button>
    );
}

export function AndroidBoardCard({ device, t, size }: { device: AndroidDevice | null; t: T; size: CardSize }) {
    void size;
    const [tick, setTick] = useState(0);
    const [broken, setBroken] = useState(false);
    const [interactive, setInteractive] = useState(true);
    const [sending, setSending] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setBroken(false);
        setTick((n) => n + 1);
    }, [device?.id]);

    useEffect(() => {
        if (!device?.configured || !broken) return;
        const timer = window.setTimeout(() => setTick((n) => n + 1), RECONNECT_MS);
        return () => window.clearTimeout(timer);
    }, [device?.configured, broken]);

    const sendInput = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
        if (!device || sending) return;
        setSending(true);
        try {
            await sendAndroidInput(device.id, { action, ...extra } as never);
        } catch {
            // ignore
        } finally {
            setSending(false);
        }
    }, [device, sending]);

    const handleTap = useCallback((e: React.MouseEvent<HTMLImageElement> | React.TouchEvent<HTMLImageElement>) => {
        if (!device || !interactive || !imgRef.current) return;
        const rect = imgRef.current.getBoundingClientRect();
        let clientX: number, clientY: number;
        if ("touches" in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if ("clientX" in e) {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        } else return;
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        void sendInput("tap", { x, y });
    }, [device, interactive, sendInput]);

    // Swipe handling for drag
    const swipeStart = useRef<{ x: number; y: number } | null>(null);
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
        if (!interactive || !imgRef.current) return;
        const rect = imgRef.current.getBoundingClientRect();
        swipeStart.current = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [interactive]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
        if (!swipeStart.current || !imgRef.current) return;
        const rect = imgRef.current.getBoundingClientRect();
        const end = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
        const start = swipeStart.current;
        swipeStart.current = null;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.02) {
            // tap
            void sendInput("tap", { x: end.x, y: end.y });
        } else {
            void sendInput("swipe", { x: start.x, y: start.y, x2: end.x, y2: end.y, duration: 300 });
        }
    }, [sendInput]);

    if (!device) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
                <AndroidIcon size={32} />
                <div className={emptyNote}>{t.androidNeedsConfigHint ?? "Configure um dispositivo Android em Configurações."}</div>
            </div>
        );
    }

    if (!device.configured) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center">
                <AndroidIcon size={32} />
                <div className={emptyNote}>{t.androidNeedsConfigHint ?? "Configure um dispositivo Android em Configurações."}</div>
                <div className="text-[11px] text-ink3">{device.label || device.serial || `${device.host}:${device.port}`}</div>
            </div>
        );
    }

    if (device.state !== "device" && !device.online) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 text-center p-3">
                <AndroidIcon size={32} />
                <div className="text-[12px] font-semibold">{device.label || device.model || device.serial || `${device.host}:${device.port}`}</div>
                <div className="text-[11px] leading-snug text-ink3">{t.androidOfflineHint ?? "Dispositivo offline — verifique cabo USB ou adb connect e autorize a depuração."}</div>
                <div className="text-[10px] text-ink3">Estado: {device.state}</div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-chip">
            <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
                <img
                    ref={imgRef}
                    key={tick}
                    src={`/api/android/devices/${device.id}/stream`}
                    alt={device.label || device.model || "Android"}
                    className={cn("h-full w-full object-contain transition-opacity", broken && "opacity-30", interactive && "cursor-pointer")}
                    onLoad={() => setBroken(false)}
                    onError={() => setBroken(true)}
                    onClick={handleTap}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    draggable={false}
                />
                {broken ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-panel/70 px-3 text-center text-[11px] leading-snug text-ink3">
                        {t.androidOfflineHint ?? "Não foi possível carregar o espelhamento."}
                    </div>
                ) : null}
                {/* Barra de controles sobreposta */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                    <div className="flex items-center gap-1">
                        <ControlButton label={t.androidBack ?? "Voltar"} onClick={() => void sendInput("back")}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        </ControlButton>
                        <ControlButton label={t.androidHome ?? "Home"} onClick={() => void sendInput("home")}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                        </ControlButton>
                        <ControlButton label={t.androidMenu ?? "Recentes"} onClick={() => void sendInput("menu")}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                        </ControlButton>
                    </div>
                    <div className="flex items-center gap-1">
                        <ControlButton label={t.androidPower ?? "Power"} onClick={() => void sendInput("power")}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                        </ControlButton>
                        <ControlButton label={interactive ? (t.androidInteractiveOn ?? "Toque ativo") : (t.androidInteractiveOff ?? "Toque inativo")} onClick={() => setInteractive((v) => !v)} active={interactive}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M8 14v2a4 4 0 0 0 8 0v-2" /><path d="M12 14v4" /></svg>
                        </ControlButton>
                    </div>
                </div>
                {/* Indicador de modelo */}
                <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    {device.model || device.label || device.serial || `${device.host}:${device.port}`}
                </div>
            </div>
        </div>
    );
}
