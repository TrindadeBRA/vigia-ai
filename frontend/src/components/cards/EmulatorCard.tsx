import { useCallback, useEffect, useRef, useState } from "react";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";

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
    roms: Array<{ name: string; file: string; ext: string; size: number | null }>;
    warning?: string;
};

export type EmulatorGlobalConfig = {
    cdnVersion: "stable" | "latest" | "nightly";
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

function formatSize(bytes: number | null): string {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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
    const isSmall = s === "sm" || s === "md";
    const containerId = useRef(`ejs-unified-${Math.random().toString(36).slice(2, 8)}`);
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const emulatorRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const tomSelectRef = useRef<TomSelect | null>(null);
    const [roms, setRoms] = useState<EmulatorRom[]>([]);
    const [groups, setGroups] = useState<EmulatorRomGroup[]>([]);
    const [loadingRoms, setLoadingRoms] = useState(false);
    const [romError, setRomError] = useState<string | null>(null);
    const [selectedRom, setSelectedRom] = useState<string>("");
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const loaderRef = useRef<HTMLScriptElement | null>(null);
    const activeRef = useRef(false);
    const loadingRef = useRef(false);
    const resettingRef = useRef(false);

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

    // Tom Select — searchable dropdown with optgroups (programmatic options)
    useEffect(() => {
        const el = selectRef.current;
        if (!el) return;
        if (tomSelectRef.current) {
            try { tomSelectRef.current.destroy(); } catch { }
            tomSelectRef.current = null;
        }
        // Don't init while still loading
        if (loadingRoms) return;

        // Build options programmatically for Tom Select
        const tsOptions: Array<{ value: string; text: string; optgroup?: string }> = [];
        const tsOptgroups: Array<{ value: string; label: string }> = [];
        if (isUnified) {
            for (const g of groups) {
                if (!g.roms.length) continue;
                tsOptgroups.push({ value: g.platform, label: g.label });
                for (const r of g.roms) {
                    tsOptions.push({
                        value: g.platform + "::" + r.file,
                        text: r.name + " (" + r.ext + ")" + (r.size ? " \u00b7 " + formatSize(r.size) : ""),
                        optgroup: g.platform,
                    });
                }
            }
        } else {
            for (const r of roms) {
                tsOptions.push({
                    value: r.file,
                    text: r.name + " (" + r.ext + ")" + (r.size ? " \u00b7 " + formatSize(r.size) : ""),
                });
            }
        }

        const ts = new TomSelect(el, {
            maxOptions: 500,
            placeholder: tsOptions.length ? "selecione um jogo" : "nenhum jogo",
            searchField: ["text"],
            optgroupField: "optgroup",
            optgroups: tsOptgroups,
            options: tsOptions,
            optgroupLabelField: "label",
            optgroupValueField: "value",
            lockOptgroupOrder: true,
            dropdownParent: "body",
            onChange: (value: string) => {
                setSelectedRom(value);
                if (value) void loadGame(value);
                else destroyEmulator();
            },
        });
        tomSelectRef.current = ts;
        if (selectedRom) ts.setValue(selectedRom, true);

        return () => {
            try { ts.destroy(); } catch { }
            if (tomSelectRef.current === ts) tomSelectRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roms, groups, loadingRoms]);

    // Keep Tom Select value in sync with selectedRom
    useEffect(() => {
        const ts = tomSelectRef.current;
        if (!ts) return;
        const current = ts.getValue() as string;
        if (current !== selectedRom) {
            ts.setValue(selectedRom, true);
        }
    }, [selectedRom]);

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
        return () => { };
    }, []);

    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const style = document.createElement("style");
        style.id = "ejs-menu-fix";
        style.textContent = `
            .ejs_menu_bar.ejs_menu_bar_hidden { display: none !important; }
            .ejs_menu_bar:not(.ejs_menu_bar_hidden) { display: flex !important; }
            .ejs_canvas_parent { pointer-events: auto; }
            /* Tom Select theming to match Vigia — dropdown must escape card overflow */
            .ts-wrapper { min-height: 34px; }
            .ts-control { border-color: var(--card-border, #2e2e2e) !important; background: var(--chip, #232323) !important; color: var(--text, #f5f5f5) !important; border-radius: 10px !important; padding: 4px 8px !important; font-size: 12.5px !important; }
            .ts-control input { color: var(--text, #f5f5f5) !important; font-size: 12.5px !important; }
            .ts-control input::placeholder { color: var(--text-muted, #737373) !important; }
            .ts-dropdown { background: var(--card, #1c1c1c) !important; border-color: var(--card-border, #2e2e2e) !important; border-radius: 10px !important; color: var(--text, #f5f5f5) !important; z-index: 9999 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; }
            .ts-dropdown .optgroup-header { background: var(--chip, #232323) !important; color: var(--text-dim, #a1a1a1) !important; font-weight: 700 !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 10px 4px !important; }
            .ts-dropdown .option { color: var(--text, #f5f5f5) !important; font-size: 12.5px !important; padding: 6px 10px !important; }
            .ts-dropdown .option.active { background: var(--accent, #e63931) !important; color: var(--accent-ink, #fff) !important; }
            .ts-dropdown .create { color: var(--text-muted, #737373) !important; }
            .ts-wrapper.plugin-remove_button .item { background: var(--accent, #e63931) !important; color: var(--accent-ink, #fff) !important; border-radius: 6px !important; }
        `;
        if (!document.getElementById("ejs-menu-fix")) {
            document.head.appendChild(style);
        }
        return () => { };
    }, []);

    const toggleMenu = useCallback(() => {
        const menuBar = emulatorRef.current?.querySelector(".ejs_menu_bar") as HTMLElement | null;
        if (!menuBar) return;
        const isHidden = menuBar.classList.contains("ejs_menu_bar_hidden");
        if (isHidden) {
            menuBar.classList.remove("ejs_menu_bar_hidden");
            setMenuOpen(true);
        } else {
            menuBar.classList.add("ejs_menu_bar_hidden");
            setMenuOpen(false);
        }
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                const menuBar = emulatorRef.current?.querySelector(".ejs_menu_bar") as HTMLElement | null;
                menuBar?.classList.add("ejs_menu_bar_hidden");
                setMenuOpen(false);
            }
        };
        const onClickOutside = (e: MouseEvent) => {
            const menuBar = emulatorRef.current?.querySelector(".ejs_menu_bar") as HTMLElement | null;
            const target = e.target as HTMLElement;
            if (menuBar && !menuBar.contains(target) && !target.closest('[data-emu-menu-btn]')) {
                menuBar.classList.add("ejs_menu_bar_hidden");
                setMenuOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        const timer = setTimeout(() => document.addEventListener("click", onClickOutside), 100);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("click", onClickOutside);
            clearTimeout(timer);
        };
    }, [menuOpen]);

    useEffect(() => {
        if (status !== "ready") return;
        const container = emulatorRef.current;
        if (!container) return;
        const ejsParent = container.querySelector('[id^="ejs-"]') as HTMLElement | null;
        const target_el = ejsParent ?? container;
        const blockMenuOpen = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest(".ejs_menu_button") || target.closest(".ejs_menu_bar") || target.closest("[data-emu-menu-btn]")) return;
            const menuBar = container.querySelector(".ejs_menu_bar") as HTMLElement | null;
            if (!menuBar) return;
            if (menuBar.classList.contains("ejs_menu_bar_hidden")) {
                e.stopPropagation();
                if (e.type === "click" || e.type === "mousedown" || e.type === "touchstart") e.preventDefault();
            } else {
                if (e.type === "click" || e.type === "mousedown" || e.type === "touchstart") {
                    e.stopPropagation();
                    e.preventDefault();
                    menuBar.classList.add("ejs_menu_bar_hidden");
                    setMenuOpen(false);
                }
            }
        };
        const blockMouseMove = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest(".ejs_menu_bar") || target.closest("[data-emu-menu-btn]")) return;
            const menuBar = container.querySelector(".ejs_menu_bar") as HTMLElement | null;
            if (menuBar?.classList.contains("ejs_menu_bar_hidden")) e.stopPropagation();
        };
        for (const el of [container, target_el]) {
            if (!el) continue;
            el.addEventListener("click", blockMenuOpen, true);
            el.addEventListener("mousedown", blockMenuOpen, true);
            el.addEventListener("touchstart", blockMenuOpen, true);
            el.addEventListener("mousemove", blockMouseMove, true);
        }
        return () => {
            for (const el of [container, target_el]) {
                if (!el) continue;
                el.removeEventListener("click", blockMenuOpen, true);
                el.removeEventListener("mousedown", blockMenuOpen, true);
                el.removeEventListener("touchstart", blockMenuOpen, true);
                el.removeEventListener("mousemove", blockMouseMove, true);
            }
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
            if (tomSelectRef.current) {
                try { tomSelectRef.current.destroy(); } catch { }
                tomSelectRef.current = null;
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
        loadingRef.current = false;
        resettingRef.current = false;
        setStatus("idle");
        setErrorMsg(null);
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
        setStatus("loading");
        setErrorMsg(null);
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
        gameDiv.style.minHeight = isSmall ? "180px" : "260px";
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

        const coreMap: Record<string, string> = { gb: "gambatte", gba: "mgba" };
        const resolvedCore = coreMap[effectiveCore] ?? effectiveCore;
        w.EJS_player = `#${containerId.current}`;
        w.EJS_core = resolvedCore;
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
        w.EJS_noAutoFocus = true;

        const onGameStart = () => {
            setStatus("ready");
            loadingRef.current = false;
            if (!activeRef.current) {
                activeRef.current = true;
                setEmulatorActive(true);
            }
            setTimeout(() => {
                const menuBar = emulatorRef.current?.querySelector(".ejs_menu_bar") as HTMLElement | null;
                if (menuBar && !menuBar.classList.contains("ejs_menu_bar_hidden")) {
                    menuBar.classList.add("ejs_menu_bar_hidden");
                    setMenuOpen(false);
                }
            }, 300);
        };
        w.EJS_onSaveState = () => { };
        w.EJS_onSaveSave = () => { };
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

        window.setTimeout(() => {
            setStatus((prev) => {
                if (prev === "loading") {
                    loadingRef.current = false;
                    setErrorMsg("tempo esgotado ao carregar o jogo. Verifique o arquivo e tente novamente.");
                    return "error";
                }
                return prev;
            });
        }, 15000);
    }, [roms, platform, core, biosPath, globalConfig, dataPath, destroyEmulator, isSmall, isUnified]);

    // Track selected platform for bios/gameUrl (used in loadGame via closure)
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

    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-2">
            <div
                ref={gameContainerRef}
                onFocus={handleContainerFocus}
                onMouseEnter={handleContainerFocus}
                onMouseLeave={handleContainerBlur}
                tabIndex={0}
                className={cn(
                    "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border bg-black",
                    status === "ready" ? "border-accent" : "border-edge",
                    isSmall ? "min-h-[180px]" : "min-h-[260px]",
                )}
                style={{ outline: "none" }}
            >
                <div
                    ref={emulatorRef}
                    className="absolute inset-0 overflow-hidden [&_canvas]:!w-full [&_canvas]:!h-full [&_canvas]:!object-contain"
                    style={{ contain: "layout size" } as React.CSSProperties}
                />
                {status === "idle" ? (
                    <div className="relative z-10 flex flex-col items-center gap-2 p-4 text-center pointer-events-none">
                        <div className="text-[13px] font-medium text-white/70">
                            {roms.length ? "selecione um jogo abaixo" : "nenhum jogo na pasta"}
                        </div>
                        <div className="max-w-[28ch] text-[11px] leading-snug text-white/40">
                            {isUnified ? `${groups.length} plataformas · ${roms.length} jogos` : romPath ? `pasta: ${romPath}` : "configure a pasta de jogos nas configurações"}
                        </div>
                    </div>
                ) : null}
                {status === "loading" ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80">
                        <div className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <div className="text-[12px] text-white/60">carregando...</div>
                    </div>
                ) : null}
                {status === "error" ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black p-4 text-center">
                        <div className="text-[12px] text-bad">{errorMsg ?? "erro ao carregar"}</div>
                        <button type="button" onClick={() => selectedRom && void loadGame(selectedRom)} className="rounded-lg bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20">tentar novamente</button>
                    </div>
                ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <div className="min-w-0 flex-1">
                    <select
                        ref={selectRef}
                        defaultValue={selectedRom}
                        disabled={loadingRoms}
                    >
                        <option value="">selecione um jogo</option>
                    </select>
                    {romError ? <div className="mt-1 truncate text-[11px] text-warn">{romError}</div> : null}
                </div>
                {status === "ready" ? (
                    <button
                        type="button"
                        data-emu-menu-btn
                        onClick={toggleMenu}
                        title={menuOpen ? "Fechar menu" : "Menu do emulador"}
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg border text-ink2 hover:text-ink ${menuOpen ? "border-accent bg-accent text-white" : "border-edge bg-chip hover:border-accent"}`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => void fetchRoms()}
                    title="Atualizar lista"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-edge bg-chip text-ink2 hover:border-accent hover:text-ink"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9" /><path d="M21 12H12M12 12V3" /></svg>
                </button>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 text-[11px] text-ink3">
                <span className="truncate">{isUnified ? `${groups.length} plataformas · ${roms.length} jogos` : `${core} · ${dataPath.replace("https://", "")}`}</span>
                {status === "ready" ? <span className="shrink-0 text-good">● jogando</span> : null}
            </div>
        </div>
    );
}
