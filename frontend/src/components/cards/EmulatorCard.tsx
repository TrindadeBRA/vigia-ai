import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { downloadSave, uploadSave } from "../../lib/emulatorSaves";
import type { RetroarchTheme } from "../../lib/retroarchIcons";
import { RetroarchIconBadge } from "../RetroarchIcon";
import { EmulatorToolbar } from "./EmulatorToolbar";

export type EmulatorPlatformMeta = {
    id: string;
    label: string;
    core: string;
    exts: string[];
    needsBios: boolean;
};

export type EmulatorRom = {
    name: string;
    file: string;
    ext: string;
    size: number | null;
    platform: string;
    platformLabel: string;
    core: string;
    biosPath: string | null;
};

export type EmulatorRomGroup = {
    platform: string;
    label: string;
    core: string;
    romPath: string;
    biosPath?: string | null;
    roms: Array<{ name: string; file: string; ext: string; size: number | null; meta?: Record<string, unknown> | null }>;
    warning?: string;
};

export type EmulatorGlobalConfig = {
    cdnVersion: "stable" | "latest" | "nightly";
    iconTheme?: RetroarchTheme;
    cacheEnabled: boolean;
    volume: number;
    startOnLoaded: boolean;
    fullscreenOnLoad: boolean;
    color: string | null;
    backgroundColor?: string;
    backgroundBlur: boolean;
    softLoad: boolean;
    disableCue: boolean;
    language: string;
    saveFolder: string;
    biosFolder: string;
    defaultOptions: Record<string, unknown>;
    disableAutoUnload: boolean;
    disableBatchBootup: boolean;
    noAutoFocus: boolean;
    hideSettings: boolean;
};

const CDN_BASE = (v: string) => `https://cdn.emulatorjs.org/${v}/data/`;

export function emulatorAllowedSizes(): CardSize[] {
    return ["md", "lg", "xl", "wl", "wxl", "free"];
}

export function emulatorSizeLabel(size: CardSize, t: T): string {
    const s = normalizeSize(size);
    if (s === "md") return t.cardNormal;
    if (s === "lg") return t.cardLarge;
    if (s === "xl") return t.cardXl;
    if (s === "wl") return t.cardWl;
    if (s === "wxl") return t.cardWxl;
    if (s === "free") return t.cardFree;
    return t.cardNormal;
}

let _emulatorActiveCount = 0;
export function isEmulatorActive(): boolean {
    return _emulatorActiveCount > 0;
}
function setEmulatorActive(active: boolean) {
    if (active) _emulatorActiveCount++;
    else _emulatorActiveCount = Math.max(0, _emulatorActiveCount - 1);
    window.dispatchEvent(new CustomEvent("vigia:emulator-active", { detail: { active: isEmulatorActive() } }));
}

function _formatSize(bytes: number | null): string {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
void _formatSize;

export function EmulatorBoardCard({
    platform,
    core,
    romPath,
    biosPath,
    globalConfig,
    size,
}: {
    platform: string;
    core: string;
    romPath: string;
    biosPath: string | null;
    globalConfig: EmulatorGlobalConfig | null;
    t?: T;
    size: CardSize;
}) {
    const isUnified = platform === "all";
    const s = normalizeSize(size);
    const isSmall = s === "sm" || s === "md" || s === "lg";
    const navigate = useNavigate();
    const containerId = useRef(`ejs-unified-${Math.random().toString(36).slice(2, 8)}`);
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const emulatorRef = useRef<HTMLDivElement>(null);
    const [roms, setRoms] = useState<EmulatorRom[]>([]);
    const [groups, setGroups] = useState<EmulatorRomGroup[]>([]);
    const [loadingRoms, setLoadingRoms] = useState(false);
    const [romError, setRomError] = useState<string | null>(null);
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [currentGame, setCurrentGame] = useState<string | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const lastRomKeyRef = useRef<string | null>(null);
    const loadTimeoutRef = useRef<number | null>(null);
    const loaderRef = useRef<HTMLScriptElement | null>(null);
    const activeRef = useRef(false);
    const loadingRef = useRef(false);
    const resettingRef = useRef(false);
    const sramFlushRef = useRef<(() => void) | null>(null);
    const sramCleanupRef = useRef<(() => void) | null>(null);

    const cdnVersion = globalConfig?.cdnVersion ?? "stable";
    const dataPath = CDN_BASE(cdnVersion);

    const fetchRoms = useCallback(async () => {
        setLoadingRoms(true);
        setRomError(null);
        try {
            if (isUnified) {
                const res = await fetch("/api/emulator/roms/all", { cache: "no-store" });
                const j = (await res.json()) as { ok: boolean; groups?: EmulatorRomGroup[]; error?: string };
                if (!j.ok) {
                    setRomError(j.error || "erro ao listar ROMs");
                    setRoms([]);
                    setGroups([]);
                } else {
                    const gs = j.groups ?? [];
                    setGroups(gs);
                    const all: EmulatorRom[] = [];
                    for (const g of gs) {
                        for (const r of g.roms) {
                            all.push({ ...r, platform: g.platform, platformLabel: g.label, core: g.core, biosPath: (g as unknown as { biosPath?: string | null }).biosPath ?? null });
                        }
                    }
                    setRoms(all);
                    if (!all.length) {
                        const warnings = gs.filter((g) => g.warning).map((g) => g.label + ": " + g.warning).join("; ");
                        setRomError(warnings || "nenhum jogo encontrado — configure as pastas de ROMs");
                    }
                }
            } else {
                const res = await fetch(`/api/emulator/roms?platform=${encodeURIComponent(platform)}`, { cache: "no-store" });
                const j = (await res.json()) as { ok: boolean; roms?: EmulatorRom[]; error?: string; warning?: string };
                if (!j.ok) {
                    setRomError(j.error || "erro ao listar ROMs");
                    setRoms([]);
                } else {
                    const list = (j.roms ?? []).map((r) => ({ ...r, platform, platformLabel: platform, core, biosPath }));
                    setRoms(list);
                    if (j.warning) setRomError(j.warning);
                    if (!list.length && !j.warning) {
                        setRomError(romPath ? "nenhum jogo encontrado (verifique extensões)" : "configure a pasta de jogos");
                    }
                }
            }
        } catch (e) {
            setRomError(String(e));
            setRoms([]);
        } finally {
            setLoadingRoms(false);
        }
    }, [platform, romPath, isUnified, core, biosPath]);

    useEffect(() => {
        void fetchRoms();
    }, [fetchRoms]);

    // Track AudioContexts to allow proper audio cleanup on destroy
    useEffect(() => {
        const w = window as unknown as Record<string, unknown>;
        if (!w.__vigiaAudioContextsPatched) {
            w.__vigiaAudioContextsPatched = true;
            w.__vigiaAudioContexts = [];
            const OrigAC = window.AudioContext;
            const OrigWK = (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext | undefined;
            const patch = (Orig: typeof AudioContext) => {
                if (!Orig) return;
                const Patched = function (this: AudioContext, ...args: unknown[]) {
                    const ctx = new (Orig as unknown as new (...a: unknown[]) => AudioContext)(...args);
                    (w.__vigiaAudioContexts as AudioContext[]).push(ctx);
                    return ctx;
                } as unknown as typeof AudioContext;
                Patched.prototype = Orig.prototype;
                return Patched;
            };
            try {
                (window as unknown as Record<string, unknown>).AudioContext = patch(OrigAC);
                if (OrigWK) (window as unknown as Record<string, unknown>).webkitAudioContext = patch(OrigWK);
            } catch { }
        }
        // Silencia Wake Lock negado (EmulatorJS tenta manter tela acesa — falha em HTTP/iframe sem permissão)
        const onUnhandled = (e: PromiseRejectionEvent) => {
            const msg = String(e.reason?.message ?? e.reason ?? "");
            if (msg.includes("Wake Lock") || msg.includes("NotAllowedError")) {
                e.preventDefault();
                console.warn("[EmulatorJS] Wake Lock negado — ignorado (sem impacto no jogo)");
            }
        };
        window.addEventListener("unhandledrejection", onUnhandled);
        // Completa traduções pt-BR faltando no EmulatorJS (evita spam de \"Translation not found\")
        const ptbrPatch: Record<string, string> = {
            "Context Menu": "Menu de contexto",
            "Note that some cheats require a restart to disable": "Alguns cheats precisam reiniciar para desativar",
            "Click to resume Emulator": "Clique para retomar o emulador",
            "Drop save state here to load": "Solte o save state aqui para carregar",
            "Outdated graphics driver": "Driver gráfico desatualizado",
            "Start Screen Recording": "Iniciar gravação de tela",
            "Stop Screen Recording": "Parar gravação de tela",
            "This project is powered by": "Este projeto usa",
            "View the RetroArch license here": "Ver licença do RetroArch aqui",
            "Disks": "Discos",
            "Exit EmulatorJS": "Sair do emulador",
            "Exit Emulation": "Sair da emulação",
            "BUTTON_1": "Botão 1",
            "BUTTON_2": "Botão 2",
            "BUTTON_3": "Botão 3",
            "BUTTON_4": "Botão 4",
            "up arrow": "seta para cima",
            "down arrow": "seta para baixo",
            "left arrow": "seta para esquerda",
            "right arrow": "seta para direita",
            "LEFT_TOP_SHOULDER": "ombro superior esquerdo",
            "RIGHT_TOP_SHOULDER": "ombro superior direito",
            "CRT beam": "CRT beam",
            "CRT caligari": "CRT caligari",
            "CRT lottes": "CRT lottes",
            "CRT yeetron": "CRT yeetron",
            "CRT zfast": "CRT zfast",
            "SABR": "SABR",
            "Bicubic": "Bicúbico",
            "Mix frames": "Misturar quadros",
            "WebGL2": "WebGL2",
            "Requires restart": "Requer reinício",
            "VSync": "VSync",
            "Video Rotation": "Rotação de vídeo",
            "Rewind Enabled (Requires restart)": "Rebobinar (requer reinício)",
            "System Save interval": "Intervalo de save do sistema",
            "Menu Bar Button": "Botão da barra de menu",
            "visible": "visível",
            "hidden": "oculto",
            "Screenshot Source": "Fonte da captura",
            "Screenshot Format": "Formato da captura",
            "Screenshot Upscale": "Ampliação da captura",
            "Screen Recording FPS": "FPS da gravação",
            "Screen Recording Format": "Formato da gravação",
            "Screen Recording Upscale": "Ampliação da gravação",
            "Screen Recording Video Bitrate": "Bitrate de vídeo",
            "Screen Recording Audio Bitrate": "Bitrate de áudio",
            "Menubar Mouse Trigger": "Gatilho do mouse na barra",
            "Downward Movement": "Movimento para baixo",
            "Movement Anywhere": "Movimento em qualquer lugar",
            "Direct Keyboard Input": "Entrada direta do teclado",
            "Forward Alt key": "Encaminhar tecla Alt",
            "Lock Mouse": "Travar mouse",
        };
        const w2 = window as unknown as Record<string, unknown>;
        // Injeta antes do EmulatorJS carregar o JSON de idioma — ele faz fetch e mescla com EJS_language
        // Se já houver langJson carregado, mescla direto
        const tryPatchLang = () => {
            const langJson = w2.EJS_langJson as Record<string, string> | undefined;
            if (langJson && typeof langJson === "object") {
                for (const [k, v] of Object.entries(ptbrPatch)) {
                    if (!(k in langJson)) langJson[k] = v;
                }
            }
        };
        tryPatchLang();
        // Também intercepta fetch de localization/pt-BR.json para injetar as chaves faltando
        const origFetch = window.fetch.bind(window);
        (window as unknown as Record<string, unknown>).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
            const res = await origFetch(input as RequestInfo, init);
            if (typeof url === "string" && url.includes("localization/pt-BR.json")) {
                try {
                    const clone = res.clone();
                    const json = (await clone.json()) as Record<string, string>;
                    for (const [k, v] of Object.entries(ptbrPatch)) {
                        if (!(k in json)) json[k] = v;
                    }
                    return new Response(JSON.stringify(json), {
                        status: res.status,
                        statusText: res.statusText,
                        headers: res.headers,
                    });
                } catch { /* fallback: retorna original */ }
            }
            return res;
        };
        return () => {
            window.removeEventListener("unhandledrejection", onUnhandled);
            // Restaura fetch original se ainda for o nosso wrapper
            try {
                if ((window as unknown as Record<string, unknown>).fetch !== origFetch) {
                    (window as unknown as Record<string, unknown>).fetch = origFetch;
                }
            } catch { }
        };
    }, []);

    // Remove overlay nativo do EmulatorJS — mas permite reabrir o editor de controles nativo quando solicitado
    useEffect(() => {
        const style = document.createElement("style");
        style.id = "ejs-no-overlay";
        style.textContent = `
            .ejs_menu_bar,
            .ejs_context_menu,
            .ejs_settings_parent,
            .ejs_cheat_parent,
            .ejs_virtualGamepad_open,
            .ejs_ad_iframe,
            .ejs_message {
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            /* Popups nativos (controles/cheats) ficam ocultos por padrão, mas podem ser reexibidos via .vigia-allow-ejs-popup */
            .ejs_popup_container {
                display: none !important;
            }
            .vigia-allow-ejs-popup .ejs_popup_container {
                display: block !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            .vigia-allow-ejs-popup .ejs_control_body {
                display: block !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            .ejs_canvas_parent { pointer-events: auto; }
            .ejs_parent { --ejs-primary-color: 26,175,255; }
        `;
        if (!document.getElementById("ejs-no-overlay")) {
            document.head.appendChild(style);
        }
        document.getElementById("ejs-menu-fix")?.remove();
        return () => { };
    }, []);

    // Bloqueia menu de contexto nativo (clique direito) — tudo via nossa toolbar
    // mas libera quando o editor nativo de controles está aberto
    useEffect(() => {
        const container = gameContainerRef.current;
        if (!container) return;
        const onContext = (e: MouseEvent) => {
            const parent = document.querySelector(".ejs_parent.vigia-allow-ejs-popup");
            if (parent) return;
            e.preventDefault();
        };
        container.addEventListener("contextmenu", onContext);
        return () => container.removeEventListener("contextmenu", onContext);
    }, [status]);

    // Quando o popup nativo de controles fecha, remove a permissão de overlay
    useEffect(() => {
        if (status !== "ready") return;
        const parent = emulatorRef.current?.querySelector(".ejs_parent") as HTMLElement | null;
        if (!parent) return;
        const obs = new MutationObserver(() => {
            const popup = parent.querySelector(".ejs_popup_container") as HTMLElement | null;
            const visible = popup && popup.style.display !== "none" && !popup.hasAttribute("hidden");
            if (!visible) parent.classList.remove("vigia-allow-ejs-popup");
        });
        obs.observe(parent, { attributes: true, subtree: true, attributeFilter: ["style", "hidden", "class"] });
        // também fecha com Esc
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") parent.classList.remove("vigia-allow-ejs-popup");
        };
        document.addEventListener("keydown", onKey);
        return () => {
            obs.disconnect();
            document.removeEventListener("keydown", onKey);
        };
    }, [status]);

    useEffect(() => {
        return () => {
            if (activeRef.current) {
                setEmulatorActive(false);
                activeRef.current = false;
            }
            if (loaderRef.current) {
                loaderRef.current.remove();
                loaderRef.current = null;
            }
            const w = window as unknown as Record<string, unknown>;
            if (w.EJS_emulator && typeof (w.EJS_emulator as { exit?: () => void }).exit === "function") {
                try { (w.EJS_emulator as { exit: () => void }).exit(); } catch { }
            }
        };
    }, []);

    const destroyEmulator = useCallback(() => {
        if (activeRef.current) {
            setEmulatorActive(false);
            activeRef.current = false;
        }
        try {
            const wMute = window as unknown as Record<string, unknown>;
            wMute.EJS_volume = 0;
            const emuMute = wMute.EJS_emulator as Record<string, unknown> | undefined;
            if (emuMute) {
                try { (emuMute.setVolume as ((v: number) => void) | undefined)?.call(emuMute, 0); } catch { }
                try { (emuMute.pause as (() => void) | undefined)?.call(emuMute); } catch { }
                const mod = (emuMute as Record<string, unknown>).Module as Record<string, unknown> | undefined;
                if (mod) {
                    try { ((mod as Record<string, unknown>).pauseMainLoop as (() => void) | undefined)?.call(mod); } catch { }
                }
            }
        } catch { }
        try {
            const wAudio = window as unknown as Record<string, unknown>;
            const contexts = (wAudio.__vigiaAudioContexts as AudioContext[] | undefined) ?? [];
            for (const ctx of [...contexts]) {
                try {
                    if (ctx.state !== "closed") {
                        ctx.close().catch(() => {
                            try { if (ctx.state === "running") ctx.suspend().catch(() => { }); } catch { }
                        });
                    }
                } catch { }
            }
            (wAudio.__vigiaAudioContexts as AudioContext[]).length = 0;
            document.querySelectorAll("audio, video").forEach((el) => {
                try { (el as HTMLMediaElement).pause(); (el as HTMLMediaElement).muted = true; el.remove(); } catch { }
            });
        } catch { }
        if (loaderRef.current) {
            loaderRef.current.remove();
            loaderRef.current = null;
        }
        document.querySelectorAll('script[src*="emulatorjs"]').forEach((s) => s.remove());
        document.querySelectorAll('link[href*="emulatorjs"], link[href*="emulator.min.css"]').forEach((s) => s.remove());
        const w = window as unknown as Record<string, unknown>;
        const emu = w.EJS_emulator as Record<string, unknown> | undefined;
        if (emu) {
            for (const m of ["exit", "destroy", "pause", "stop", "terminate", "close", "pauseMainLoop"]) {
                try { (emu[m] as (() => void) | undefined)?.call(emu); } catch { }
            }
            try {
                const mod = (emu as Record<string, unknown>).Module as Record<string, unknown> | undefined;
                if (mod) {
                    for (const m of ["pauseMainLoop", "exit", "_emscripten_exit_with_live_runtime"]) {
                        try { (mod[m] as (() => void) | undefined)?.call(mod); } catch { }
                    }
                }
            } catch { }
            try {
                const workers = (emu as Record<string, unknown>).workers as unknown[] | undefined;
                if (Array.isArray(workers)) {
                    for (const ww of workers) {
                        try { (ww as { terminate?: () => void }).terminate?.(); } catch { }
                    }
                }
            } catch { }
        }
        if (emulatorRef.current) {
            emulatorRef.current.innerHTML = "";
        }
        document.querySelectorAll('[id^="ejs-"], .ejs--menu, .ejs--settings, [class*="ejs"]').forEach((el) => {
            if (el === emulatorRef.current || el === gameContainerRef.current) return;
            if (emulatorRef.current?.contains(el)) return;
            const isEmulatorEl = el.querySelector("canvas") || el.tagName === "CANVAS" || el.className?.toString().includes("ejs");
            if (isEmulatorEl) el.remove();
        });
        document.querySelectorAll("canvas").forEach((c) => {
            if (c.closest('[id^="ejs-"]') && !emulatorRef.current?.contains(c)) {
                c.remove();
            }
        });
        const gw = window as unknown as Record<string, unknown>;
        const ejsKeys = Object.keys(gw).filter((k) => k.startsWith("EJS_"));
        for (const k of ejsKeys) {
            if (["EJS_STORAGE", "EJS_DUMMYSTORAGE", "EJS_SHADERS", "EJS_COMPRESSION", "EJS_GameManager"].includes(k)) continue;
            try { delete gw[k]; } catch { }
        }
        try { delete gw.EJS_emulator; } catch { }
        try { delete (window as unknown as Record<string, unknown>).EJS_emulator; } catch { }
        // flush SRAM pendente antes de destruir (ciclo pode não ter chegado)
        try { sramFlushRef.current?.(); } catch { /* ignore */ }
        try { sramCleanupRef.current?.(); } catch { /* ignore */ }
        sramFlushRef.current = null;
        sramCleanupRef.current = null;
        if (loadTimeoutRef.current != null) {
            window.clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
        }
        loadingRef.current = false;
        resettingRef.current = false;
        setStatus("idle");
        setErrorMsg(null);
        setCurrentGame(null);
    }, []);

    const loadGame = useCallback(async (romValue: string) => {
        if (!romValue) return;
        if (loadingRef.current) return;
        let rom: EmulatorRom | undefined;
        let effectivePlatform = platform;
        let effectiveCore = core;
        let effectiveBiosPath = biosPath;
        if (isUnified) {
            const sep = romValue.indexOf("::");
            if (sep === -1) return;
            const plat = romValue.slice(0, sep);
            const file = romValue.slice(sep + 2);
            rom = roms.find((r) => r.platform === plat && r.file === file);
            if (!rom) return;
            effectivePlatform = rom.platform;
            effectiveCore = rom.core;
            effectiveBiosPath = rom.biosPath;
        } else {
            rom = roms.find((r) => r.file === romValue);
            if (!rom) return;
        }

        const alreadyResetting = resettingRef.current;
        if (!alreadyResetting) {
            destroyEmulator();
            await new Promise((r) => setTimeout(r, 200));
        } else {
            await new Promise((r) => setTimeout(r, 100));
        }
        loadingRef.current = true;
        lastRomKeyRef.current = romValue;
        setStatus("loading");
        setErrorMsg(null);
        setCurrentGame(rom.name);
        setSelectedPlatform(effectivePlatform);

        const container = emulatorRef.current;
        if (!container) {
            loadingRef.current = false;
            setStatus("error");
            setErrorMsg("container não encontrado");
            return;
        }
        container.innerHTML = "";
        const gameDiv = document.createElement("div");
        gameDiv.id = containerId.current;
        gameDiv.style.width = "100%";
        gameDiv.style.height = "100%";
        gameDiv.style.minHeight = isSmall ? "110px" : "260px";
        gameDiv.style.display = "flex";
        gameDiv.style.alignItems = "center";
        gameDiv.style.justifyContent = "center";
        gameDiv.style.overflow = "hidden";
        container.appendChild(gameDiv);

        const w = window as unknown as Record<string, unknown>;

        let biosUrl: string | undefined;
        if (effectiveBiosPath) {
            biosUrl = `/api/emulator/bios/${encodeURIComponent(effectivePlatform)}`;
        } else if (globalConfig?.biosFolder) {
            biosUrl = undefined;
        }

        const gameUrl = `/api/emulator/rom/${encodeURIComponent(effectivePlatform)}/${encodeURIComponent(rom.file)}`;

        // EJS_core deve ser o ID da plataforma (system) — ex: "gb", "gba", "nds", "n64"
        // O EmulatorJS resolve o core automaticamente (gb→gambatte, gba→mgba, nds→melonds, etc)
        // Não mapear para nome do core aqui, senão o EmulatorJS pode não encontrar o system
        void effectiveCore;
        w.EJS_player = `#${containerId.current}`;
        w.EJS_core = effectivePlatform;
        w.EJS_gameUrl = gameUrl;
        w.EJS_pathtodata = dataPath;
        w.EJS_gameName = rom.name;
        if (biosUrl) w.EJS_biosUrl = biosUrl;
        if (globalConfig?.color) w.EJS_color = globalConfig.color;
        w.EJS_backgroundColor = (globalConfig as unknown as { backgroundColor?: string })?.backgroundColor ?? "transparent";
        w.EJS_backgroundBlur = globalConfig?.backgroundBlur ?? false;
        w.EJS_volume = globalConfig?.volume ?? 1;
        w.EJS_startOnLoaded = globalConfig?.startOnLoaded ?? true;
        w.EJS_fullscreenOnLoad = globalConfig?.fullscreenOnLoad ?? false;
        w.EJS_threads = false;
        w.EJS_cacheConfig = globalConfig?.cacheEnabled ? { enabled: true } : { enabled: false };
        w.EJS_language = globalConfig?.language ?? "pt-BR";
        w.EJS_softLoad = globalConfig?.softLoad ?? false;
        w.EJS_disableCue = globalConfig?.disableCue ?? false;
        w.EJS_defaultOptions = globalConfig?.defaultOptions ?? {};
        w.EJS_disableAutoUnload = globalConfig?.disableAutoUnload ?? false;
        w.EJS_disableBatchBootup = globalConfig?.disableBatchBootup ?? false;
        w.EJS_noAutoFocus = globalConfig?.noAutoFocus ?? false;
        w.EJS_hideSettings = globalConfig?.hideSettings ?? false;
        // Desativa 100% do overlay nativo — todas as funções via nossa toolbar
        w.EJS_Buttons = {
            playPause: false,
            play: false,
            pause: false,
            restart: false,
            mute: false,
            unmute: false,
            settings: false,
            fullscreen: false,
            enterFullscreen: false,
            exitFullscreen: false,
            saveState: false,
            loadState: false,
            screenRecord: false,
            gamepad: false,
            cheat: false,
            volumeSlider: false,
            saveSavFiles: false,
            loadSavFiles: false,
            quickSave: false,
            quickLoad: false,
            screenshot: false,
            cacheManager: false,
            exitEmulation: false,
            netplay: false,
            diskButton: false,
            contextMenu: false,
        } as unknown as typeof w.EJS_Buttons;
        // Garante que o CSS de ocultação já esteja aplicado antes do start
        try {
            const existing = emulatorRef.current?.querySelector(".ejs_menu_bar") as HTMLElement | null;
            if (existing) existing.style.display = "none";
        } catch { /* ignore */ }

        // Guarda jogo atual para callbacks de save
        const currentPlatform = effectivePlatform;
        const currentGameName = rom.name;

        // SRAM: imediato + adicional no ciclo do dashboard (backup)
        const getCurrentSram = (): Uint8Array | null => {
            try {
                const w3 = window as unknown as Record<string, unknown>;
                const emu3 = w3.EJS_emulator as Record<string, unknown> | undefined;
                const gm3 = (emu3 as Record<string, unknown> | undefined)?.gameManager as Record<string, unknown> | undefined;
                const getSave = (gm3 as Record<string, unknown> | undefined)?.getSaveFile as ((b?: boolean) => Uint8Array | null) | undefined;
                const d = getSave ? getSave.call(gm3, false) : null;
                if (d && (d as Uint8Array).length > 0) return d as Uint8Array;
            } catch { /* ignore */ }
            return null;
        };
        const flushSramPeriodic = () => {
            const d = getCurrentSram();
            if (d && d.length > 0) void uploadSave(currentPlatform, currentGameName, "sram", d);
        };
        const onDashboardCycle = () => flushSramPeriodic();
        window.addEventListener("vigia:dashboard-cycle", onDashboardCycle as EventListener);
        // expõe para destroyEmulator fazer flush final
        const prevFlush = sramFlushRef.current;
        const prevCleanup = sramCleanupRef.current;
        void prevFlush; void prevCleanup;
        sramFlushRef.current = flushSramPeriodic;
        sramCleanupRef.current = () => {
            window.removeEventListener("vigia:dashboard-cycle", onDashboardCycle as EventListener);
            flushSramPeriodic();
        };

        const onGameStart = () => {
            setStatus("ready");
            loadingRef.current = false;
            if (!activeRef.current) {
                activeRef.current = true;
                setEmulatorActive(true);
            }
            // Restaura SRAM do servidor (sincronizado entre dispositivos)
            void (async () => {
                try {
                    const data = await downloadSave(currentPlatform, currentGameName, "sram");
                    if (data && data.length > 0) {
                        const w2 = window as unknown as Record<string, unknown>;
                        const emu = w2.EJS_emulator as Record<string, unknown> | undefined;
                        const gm = (emu as Record<string, unknown> | undefined)?.gameManager as Record<string, unknown> | undefined;
                        const mod = (emu as Record<string, unknown> | undefined)?.Module as Record<string, unknown> | undefined;
                        const fs = (mod as Record<string, unknown> | undefined)?.FS as { writeFile: (p: string, d: Uint8Array) => void; unlink: (p: string) => void } | undefined;
                        const getSavePath = (emu as Record<string, unknown> | undefined)?.getSaveFilePath as (() => string) | undefined
                            ?? (gm as Record<string, unknown> | undefined)?.getSaveFilePath as (() => string) | undefined;
                        if (fs && getSavePath) {
                            try {
                                const savePath = String(getSavePath.call(gm ?? emu) ?? "");
                                if (savePath) {
                                    try { fs.unlink(savePath); } catch { /* ignore */ }
                                    fs.writeFile(savePath, data);
                                    const loadFn = (gm as Record<string, unknown> | undefined)?.loadSaveFiles as (() => void) | undefined
                                        ?? (emu as Record<string, unknown> | undefined)?.loadSaveFiles as (() => void) | undefined;
                                    if (loadFn) try { loadFn.call(gm ?? emu); } catch { /* ignore */ }
                                    console.log("[emulator-saves] SRAM restaurado do servidor", currentPlatform, currentGameName, data.length);
                                }
                            } catch (e) { console.warn("[emulator-saves] falha ao restaurar SRAM", e); }
                        }
                    }
                } catch (e) { console.warn("[emulator-saves] download SRAM falhou", e); }
            })();
            // Garante que nenhum overlay nativo apareça mesmo após o start
            setTimeout(() => {
                try {
                    const bar = emulatorRef.current?.querySelector(".ejs_menu_bar") as HTMLElement | null;
                    if (bar) bar.style.display = "none";
                    const ctx = emulatorRef.current?.querySelector(".ejs_context_menu") as HTMLElement | null;
                    if (ctx) ctx.style.display = "none";
                } catch { /* ignore */ }
            }, 100);
            // Hooks: onSaveState/onSaveSave/onSaveUpdate = imediato; ciclo = adicional
            setTimeout(() => {
                try {
                    const w3 = window as unknown as Record<string, unknown>;
                    const emu3 = w3.EJS_emulator as Record<string, unknown> | undefined;
                    const gm3 = (emu3 as Record<string, unknown> | undefined)?.gameManager as Record<string, unknown> | undefined;
                    if (gm3 && typeof (gm3 as Record<string, unknown>).saveSaveFiles === "function") {
                        const origSave = (gm3 as Record<string, unknown>).saveSaveFiles as () => void;
                        (gm3 as Record<string, unknown>).saveSaveFiles = function (this: unknown, ...args: unknown[]) {
                            const ret = (origSave as unknown as (...a: unknown[]) => unknown).apply(this, args);
                            setTimeout(() => {
                                try {
                                    const getSave = (gm3 as Record<string, unknown>).getSaveFile as ((b?: boolean) => Uint8Array | null) | undefined;
                                    const saveData = getSave ? getSave.call(gm3, false) : null;
                                    if (saveData && saveData.length > 0) void uploadSave(currentPlatform, currentGameName, "sram", saveData as Uint8Array);
                                } catch (e) { console.warn("[emulator-saves] hook saveSaveFiles falhou", e); }
                            }, 500);
                            return ret;
                        };
                    }
                    const ejsInst = (w3 as Record<string, unknown>).EJS_emulator as Record<string, unknown> | undefined;
                    const enableSaveEvent = (ejsInst as Record<string, unknown> | undefined)?.enableSaveUpdateEvent as (() => void) | undefined;
                    if (enableSaveEvent && typeof enableSaveEvent === "function") {
                        try { enableSaveEvent.call(ejsInst); } catch { /* ignore */ }
                    }
                    const onSaveUpdate = (w3 as Record<string, unknown>).EJS_onSaveUpdate as unknown;
                    if (!onSaveUpdate) {
                        (w3 as Record<string, unknown>).EJS_onSaveUpdate = (data: { save?: Uint8Array; hash?: string }) => {
                            if (data?.save && data.save.length > 0) void uploadSave(currentPlatform, currentGameName, "sram", data.save);
                        };
                    }
                } catch (e) { console.warn("[emulator-saves] hook falhou", e); }
            }, 1500);
        };
        // State e SRAM = imediato; ciclo do dashboard faz save adicional (backup)
        w.EJS_onSaveState = (data: { state: Uint8Array; screenshot?: Uint8Array }) => {
            if (data?.state && data.state.length > 0) void uploadSave(currentPlatform, currentGameName, "state", data.state);
        };
        w.EJS_onSaveSave = (data: { save: Uint8Array; screenshot?: Uint8Array }) => {
            if (data?.save && data.save.length > 0) void uploadSave(currentPlatform, currentGameName, "sram", data.save);
        };
        w.EJS_onLoadState = () => { };
        w.EJS_onGameStart = onGameStart;
        (window as unknown as Record<string, unknown>).EJS_onGameStart = onGameStart;
        w.EJS_ready = () => {
            console.log("[EmulatorJS] ready");
        };

        const script = document.createElement("script");
        script.src = `${dataPath}loader.js`;
        script.async = true;
        script.onerror = () => {
            loadingRef.current = false;
            setStatus("error");
            setErrorMsg("falha ao carregar EmulatorJS (CDN). Verifique a conexão.");
        };
        script.onload = () => {
            window.setTimeout(() => {
                const w3 = window as unknown as Record<string, unknown>;
                if (!w3.EJS_emulator) {
                    console.warn("[EmulatorJS] loader loaded but EJS_emulator not created after 8s");
                }
            }, 8000);
        };
        loaderRef.current = script;
        document.body.appendChild(script);

        // Timeout proporcional ao tamanho da ROM: 15s base + 1s por MB (mín 15s, máx 60s)
        const romSizeMb = rom.size ? rom.size / (1024 * 1024) : 1;
        const timeoutMs = Math.min(60000, Math.max(15000, 15000 + Math.ceil(romSizeMb) * 1000));
        if (loadTimeoutRef.current != null) window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = window.setTimeout(() => {
            loadTimeoutRef.current = null;
            setStatus((prev) => {
                if (prev === "loading") {
                    loadingRef.current = false;
                    const isNds = effectivePlatform === "nds";
                    const hint = isNds && !effectiveBiosPath
                        ? " NDS requer BIOS — configure em Configurações → Emulador."
                        : "";
                    setErrorMsg(`tempo esgotado ao carregar o jogo.${hint} Verifique o arquivo e tente novamente.`);
                    return "error";
                }
                return prev;
            });
        }, timeoutMs);
        // Cancela timeout quando o jogo inicia com sucesso
        const origOnGameStart = onGameStart;
        const wrappedOnGameStart = () => {
            if (loadTimeoutRef.current != null) {
                window.clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
            }
            origOnGameStart();
        };
        w.EJS_onGameStart = wrappedOnGameStart;
        (window as unknown as Record<string, unknown>).EJS_onGameStart = wrappedOnGameStart;
    }, [roms, platform, core, biosPath, globalConfig, dataPath, destroyEmulator, isSmall, isUnified]);

    // pending play from library (localStorage + event)
    useEffect(() => {
        const checkPending = () => {
            try {
                const raw = localStorage.getItem("vigia:emulator:pending");
                if (!raw) return;
                const j = JSON.parse(raw) as { platform: string; file: string; key: string; at: number };
                if (!j.key || !j.platform || !j.file) return;
                // only if within last 30s
                if (Date.now() - j.at > 30_000) {
                    localStorage.removeItem("vigia:emulator:pending");
                    return;
                }
                setPendingKey(j.key);
            } catch { }
        };
        checkPending();
        const onPlay = (e: Event) => {
            const d = (e as CustomEvent).detail as { platform: string; file: string; key: string };
            if (d?.key) setPendingKey(d.key);
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key === "vigia:emulator:pending") checkPending();
        };
        window.addEventListener("vigia:emulator-play", onPlay as EventListener);
        window.addEventListener("storage", onStorage);
        // also poll once after roms load
        const id = window.setInterval(checkPending, 1000);
        return () => {
            window.removeEventListener("vigia:emulator-play", onPlay as EventListener);
            window.removeEventListener("storage", onStorage);
            window.clearInterval(id);
        };
    }, []);

    // when roms are ready and we have a pending key, auto-load
    useEffect(() => {
        if (!pendingKey || loadingRoms || roms.length === 0) return;
        const exists = roms.some((r) => `${r.platform}::${r.file}` === pendingKey);
        if (!exists) {
            // maybe the pending is stale — clear
            try { localStorage.removeItem("vigia:emulator:pending"); } catch { }
            setPendingKey(null);
            return;
        }
        // consume pending
        try { localStorage.removeItem("vigia:emulator:pending"); } catch { }
        const keyToLoad = pendingKey;
        setPendingKey(null);
        void loadGame(keyToLoad);
    }, [pendingKey, loadingRoms, roms, loadGame]);

    const [, setSelectedPlatform] = useState<string>("");

    // ResizeObserver: when card resizes, tell EmulatorJS to resize canvas
    useEffect(() => {
        if (status !== "ready") return;
        const container = gameContainerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => {
            const emu = (window as unknown as Record<string, unknown>).EJS_emulator as Record<string, unknown> | undefined;
            if (emu) {
                try { (emu.handleResize as (() => void) | undefined)?.call(emu); } catch { }
                try { (emu.resize as (() => void) | undefined)?.call(emu); } catch { }
            }
            window.dispatchEvent(new Event("resize"));
            const canvas = emulatorRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
            if (canvas && container) {
                const rect = container.getBoundingClientRect();
                canvas.style.maxWidth = "100%";
                canvas.style.maxHeight = "100%";
                canvas.style.width = "auto";
                canvas.style.height = "auto";
                canvas.style.objectFit = "contain";
                if (canvas.width > rect.width || canvas.height > rect.height) {
                    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
                    if (scale < 1) {
                        canvas.style.width = Math.floor(canvas.width * scale) + "px";
                        canvas.style.height = Math.floor(canvas.height * scale) + "px";
                    }
                }
            }
        });
        ro.observe(container);
        if (emulatorRef.current) ro.observe(emulatorRef.current);
        return () => ro.disconnect();
    }, [status]);

    useEffect(() => {
        if (status !== "ready") return;
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
            const emu = (window as unknown as Record<string, unknown>).EJS_emulator as Record<string, unknown> | undefined;
            try { (emu?.handleResize as (() => void) | undefined)?.call(emu); } catch { }
        }, 300);
        return () => clearTimeout(timer);
    }, [size, status]);

    const handleContainerFocus = useCallback(() => {
        if (status === "ready" && !activeRef.current) {
            activeRef.current = true;
            setEmulatorActive(true);
        }
    }, [status]);

    const handleContainerBlur = useCallback(() => { }, []);

    const totalGames = roms.length;
    const totalPlatforms = groups.length;

    return (
        <div className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden", isSmall ? "gap-1" : "gap-1.5")}>
            <div
                ref={gameContainerRef}
                onFocus={handleContainerFocus}
                onMouseEnter={handleContainerFocus}
                onMouseLeave={handleContainerBlur}
                tabIndex={0}
                className={cn(
                    "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-edge bg-black",
                    isSmall ? "min-h-[90px]" : "min-h-[120px]",
                )}
                style={{ outline: "none" }}
            >
                <div
                    ref={emulatorRef}
                    className="absolute inset-0 overflow-hidden [&_canvas]:!w-full [&_canvas]:!h-full [&_canvas]:!object-contain"
                    style={{ contain: "layout size" } as React.CSSProperties}
                />
                {status === "idle" ? (
                    <div className="relative z-10 flex flex-col items-center gap-3 p-4 text-center pointer-events-none">
                        <RetroarchIconBadge platform={isUnified ? "all" : platform} theme={(globalConfig?.iconTheme as RetroarchTheme) ?? "monochrome"} size={48} alt="Emulador" />
                        <div className="text-[13px] font-semibold text-white/80">
                            {loadingRoms ? "carregando biblioteca…" : totalGames ? `${totalGames} jogo${totalGames === 1 ? "" : "s"} · ${totalPlatforms} plataforma${totalPlatforms === 1 ? "" : "s"}` : "nenhum jogo na pasta"}
                        </div>
                        <div className="max-w-[30ch] text-[11px] leading-snug text-white/40">
                            {totalGames ? "abra a biblioteca para escolher um jogo" : "configure as pastas de ROMs em Configurações → Emulador"}
                        </div>
                    </div>
                ) : null}
                {status === "loading" ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80">
                        <div className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <div className="text-[12px] text-white/60">carregando{currentGame ? ` · ${currentGame}` : "…"}</div>
                    </div>
                ) : null}
                {status === "error" ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black p-4 text-center">
                        <div className="text-[12px] text-bad">{errorMsg ?? "erro ao carregar"}</div>
                        <button type="button" onClick={() => {
                            const key = pendingKey ?? lastRomKeyRef.current;
                            if (key) void loadGame(key);
                        }} className="rounded-lg bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20">tentar novamente</button>
                    </div>
                ) : null}
            </div>

            <div className={cn("flex shrink-0 items-center gap-1 overflow-hidden", isSmall ? "gap-1" : "gap-1.5")}>
                <button
                    type="button"
                    onClick={() => navigate("/display/emulator")}
                    title={`Biblioteca${totalGames ? ` · ${totalGames} jogos` : ""}`}
                    aria-label="Biblioteca"
                    className={cn(
                        "flex shrink-0 items-center justify-center rounded-xl bg-accent font-bold text-white transition hover:brightness-110 active:scale-[0.98]",
                        isSmall ? "size-7 text-[12px]" : "h-8 px-2.5 text-[12px] gap-1",
                    )}
                >
                    <span className={isSmall ? "text-[12px]" : "text-[13px]"}>▦</span>
                    {!isSmall ? <span className="hidden sm:inline">Biblioteca</span> : null}
                    {totalGames ? <span className={cn("rounded-full bg-white/20 font-bold", isSmall ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]")}>{totalGames}</span> : null}
                </button>
                {status === "ready" ? <EmulatorToolbar status={status} onExit={destroyEmulator} compact={isSmall} /> : null}
            </div>

            <div className={cn("flex shrink-0 items-center justify-between gap-1 overflow-hidden text-ink3", isSmall ? "text-[10px]" : "text-[11px]")}>
                <span className="min-w-0 flex-1 truncate">
                    {status === "ready" && currentGame ? `jogando · ${currentGame}` : isUnified ? `${totalPlatforms} plataformas · ${totalGames} jogos` : `${core} · ${dataPath.replace("https://", "")}`}
                </span>
                {status === "ready" ? <span className="shrink-0 text-good">● jogando</span> : loadingRoms ? <span className="shrink-0">carregando…</span> : romError ? <span className="shrink-0 truncate text-warn">{romError}</span> : null}
            </div>
        </div>
    );
}
