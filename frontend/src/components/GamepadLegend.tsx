import { useEffect, useState } from "react";

export type GamepadKind = "xbox" | "playstation" | "generic";

export function detectGamepadKind(id: string): GamepadKind {
    const s = id.toLowerCase();
    if (s.includes("xbox") || s.includes("x-box") || s.includes("microsoft") || s.includes("xinput")) return "xbox";
    if (s.includes("playstation") || s.includes("ps3") || s.includes("ps4") || s.includes("ps5") || s.includes("dualshock") || s.includes("dualsense") || s.includes("sony") || s.includes("054c")) return "playstation";
    // 8BitDo e outros costumam reportar como Xbox no modo XInput; genérico fica branco
    return "generic";
}

function useGamepadInfo(): { connected: boolean; kind: GamepadKind; id: string } {
    const [info, setInfo] = useState<{ connected: boolean; kind: GamepadKind; id: string }>({ connected: false, kind: "generic", id: "" });
    useEffect(() => {
        const check = () => {
            try {
                const pads = navigator.getGamepads?.() || [];
                const pad = Array.from(pads).find(Boolean) as Gamepad | undefined;
                if (pad) setInfo({ connected: true, kind: detectGamepadKind(pad.id), id: pad.id });
                else setInfo((p) => (p.connected ? { ...p, connected: false } : p));
            } catch { /* ignore */ }
        };
        const onConnect = (e: GamepadEvent) => setInfo({ connected: true, kind: detectGamepadKind(e.gamepad.id), id: e.gamepad.id });
        const onDisconnect = () => {
            try {
                const pads = navigator.getGamepads?.() || [];
                const pad = Array.from(pads).find(Boolean) as Gamepad | undefined;
                if (pad) setInfo({ connected: true, kind: detectGamepadKind(pad.id), id: pad.id });
                else setInfo({ connected: false, kind: "generic", id: "" });
            } catch { setInfo({ connected: false, kind: "generic", id: "" }); }
        };
        window.addEventListener("gamepadconnected", onConnect as EventListener);
        window.addEventListener("gamepaddisconnected", onDisconnect as EventListener);
        const id = window.setInterval(check, 1000);
        check();
        return () => {
            window.removeEventListener("gamepadconnected", onConnect as EventListener);
            window.removeEventListener("gamepaddisconnected", onDisconnect as EventListener);
            window.clearInterval(id);
        };
    }, []);
    return info;
}

function FaceBtn({ face, kind }: { face: "A" | "B" | "X" | "Y"; kind: GamepadKind }) {
    if (kind === "playstation") {
        // PlayStation: X=Cross (azul), O=Circle (vermelho), Square (rosa), Triangle (verde)
        // Mapeamento físico: A->Cross, B->Circle, X->Square, Y->Triangle
        const map: Record<string, { label: string; bg: string; fg: string }> = {
            A: { label: "×", bg: "#1e3a8a", fg: "#93c5fd" }, // Cross
            B: { label: "○", bg: "#7f1d1d", fg: "#fca5a5" }, // Circle
            X: { label: "□", bg: "#831843", fg: "#f9a8d4" }, // Square
            Y: { label: "△", bg: "#14532d", fg: "#86efac" }, // Triangle
        };
        const m = map[face];
        return (
            <span
                className="inline-flex size-[18px] items-center justify-center rounded-full text-[11px] font-black leading-none shadow-sm"
                style={{ background: m.bg, color: m.fg }}
                aria-label={face}
            >
                {m.label}
            </span>
        );
    }
    if (kind === "xbox") {
        const colors: Record<string, string> = { A: "#22c55e", B: "#ef4444", X: "#3b82f6", Y: "#eab308" };
        return (
            <span
                className="inline-flex size-[18px] items-center justify-center rounded-full text-[10px] font-black leading-none text-white shadow-sm"
                style={{ background: colors[face] }}
            >
                {face}
            </span>
        );
    }
    // genérico: todos brancos
    return (
        <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-white text-[10px] font-black leading-none text-zinc-900 shadow-sm">
            {face}
        </span>
    );
}

export function GamepadLegend({
    section,
    isNested,
    insideCard,
}: {
    section: "overview" | "account";
    isNested: boolean;
    insideCard: boolean;
}) {
    const { connected, kind } = useGamepadInfo();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (connected) {
            setVisible(true);
            return;
        }
        const check = () => {
            try {
                const pads = navigator.getGamepads?.() || [];
                if (Array.from(pads).some(Boolean)) setVisible(true);
            } catch { }
        };
        const id = window.setInterval(check, 800);
        return () => window.clearInterval(id);
    }, [connected]);

    if (!visible && !connected) return null;

    // legendas contextuais
    const isOverview = section === "overview" && !isNested;

    return (
        <div
            className="pointer-events-none fixed bottom-3 right-3 z-[60] hidden max-w-[min(96vw,860px)] select-none rounded-xl border border-edge bg-panel/95 px-3 py-2 shadow-card backdrop-blur-[8px] md:flex"
            style={{ fontSize: 11, lineHeight: 1.3 }}
            aria-hidden
        >
            <div className="flex flex-nowrap items-center gap-x-3 gap-y-1 overflow-x-auto whitespace-nowrap text-ink2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-md:flex-wrap max-md:whitespace-normal">
                {isOverview && !insideCard ? (
                    <>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">D-Pad</span>/<span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">LS</span> Navegar</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">RS</span> Scroll</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="A" kind={kind} /> Entrar</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="B" kind={kind} /> Voltar</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="X" kind={kind} /> Tamanho</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="Y" kind={kind} /> Cor</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">{kind === "playstation" ? "R1" : "RB"}</span>+D-Pad Mover</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">{kind === "playstation" ? "L1" : "LB"}</span> Atualizar</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">{kind === "playstation" ? "L2" : "LT"}</span>/<span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">{kind === "playstation" ? "R2" : "RT"}</span> Zoom</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">Select</span> Foco</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">Start</span> Menu</span>
                    </>
                ) : isOverview && insideCard ? (
                    <>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">D-Pad</span> Navegar dentro</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="A" kind={kind} /> Selecionar</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="B" kind={kind} /> Sair</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">RS</span> Scroll</span>
                    </>
                ) : isNested ? (
                    <>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">D-Pad</span>/<span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">LS</span> Navegar</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">RS</span> Scroll</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="A" kind={kind} /> Selecionar</span>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="B" kind={kind} /> Voltar</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">Home</span> Dashboard</span>
                    </>
                ) : (
                    <>
                        <span className="inline-flex items-center gap-1"><FaceBtn face="B" kind={kind} /> Voltar</span>
                        <span className="inline-flex items-center gap-1"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">Home</span> Dashboard</span>
                    </>
                )}
                <span className="inline-flex items-center gap-1 opacity-60"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">Home</span> Dashboard</span>
                <span className="inline-flex items-center gap-1 opacity-60"><span className="rounded bg-chip px-1 py-0.5 font-mono text-[10px]">Start+Select</span> Fullscreen</span>
            </div>
        </div>
    );
}
