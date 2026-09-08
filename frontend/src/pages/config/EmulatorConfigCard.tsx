import { useEffect, useState } from "react";
import type { EmulatorConfig } from "../../api/types";
import { RetroarchIconBadge } from "../../components/RetroarchIcon";
import { useRequest } from "../../hooks/useRequest";
import type { RetroarchTheme } from "../../lib/retroarchIcons";
import { RETROARCH_THEMES } from "../../lib/retroarchIcons";
import { cfgCard, cfgHint, iconChip } from "../../tw";
import type { ConfigCopy } from "./copy";
import { Button, Checkbox, Fold, PathField, SelectField, SliderField, Switch, TextField } from "./ui";

const PLATFORM_LABELS: Record<string, string> = {
    nes: "NES / Famicom", snes: "SNES", n64: "Nintendo 64", gb: "Game Boy / Game Boy Color", gba: "GBA", nds: "NDS",
    psx: "PlayStation", segaMD: "Mega Drive", segaMS: "Master System",
    segaGG: "Game Gear", segaCD: "Sega CD", sega32x: "32X",
    atari2600: "Atari 2600", atari7800: "Atari 7800", lynx: "Lynx",
    arcade: "Arcade", mame2003: "MAME 2003", vb: "Virtual Boy", coleco: "ColecoVision",
    pce: "PC Engine", ngp: "Neo Geo Pocket", ws: "WonderSwan", c64: "C64",
};

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS);

export function EmulatorConfigCard({ c, onReload }: { c: ConfigCopy; onReload: () => Promise<void> }) {
    const [cfg, setCfg] = useState<EmulatorConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [platformsMeta, setPlatformsMeta] = useState<Array<{ id: string; label: string; core: string; exts: string[]; needsBios: boolean; warning?: string }>>([]);
    const toggleReq = useRequest();
    const saveReq = useRequest();
    const [editingRomPath, setEditingRomPath] = useState<Record<string, string>>({});
    const [editingBiosPath, setEditingBiosPath] = useState<Record<string, string>>({});

    async function load() {
        setLoading(true);
        try {
            const [emuRes, platRes] = await Promise.all([
                fetch("/api/emulator/config", { cache: "no-store" }).then((r) => r.json()),
                fetch("/api/emulator/platforms", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ platforms: [] })),
            ]);
            setCfg(emuRes as EmulatorConfig);
            if (platRes.platforms) setPlatformsMeta(platRes.platforms);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }

    useEffect(() => { void load(); }, []);

    if (loading || !cfg) {
        return (
            <article className={cfgCard}>
                <div className="flex items-center gap-3">
                    <div className={iconChip}><RetroarchIconBadge platform="all" theme="monochrome" size={32} alt="Emulador" /></div>
                    <div><h3 className="m-0 text-[15.5px] font-bold">Emulador</h3><p className={cfgHint}>carregando...</p></div>
                </div>
            </article>
        );
    }

    const enabledPlatforms = new Set((cfg.platforms ?? []).filter((p) => p.enabled).map((p) => p.id));

    async function patch(patch: Record<string, unknown>) {
        const res = await fetch("/api/emulator/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: unknown };
        if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
        // reload local
        const updated = await fetch("/api/emulator/config", { cache: "no-store" }).then((r) => r.json()) as EmulatorConfig;
        setCfg(updated);
        window.dispatchEvent(new CustomEvent("vigia:emulator-config-updated"));
        await onReload().catch(() => { });
        return j;
    }

    async function togglePlatform(id: string, enabled: boolean) {
        if (!cfg) return;
        const current = cfg.platforms ?? [];
        const idx = current.findIndex((p) => p.id === id);
        let next: typeof current;
        if (idx >= 0) {
            next = current.map((p) => p.id === id ? { ...p, enabled } : p);
        } else {
            next = [...current, { id, enabled, romPath: "", biosPath: null, core: null }];
        }
        await saveReq.run(async () => patch({ platforms: next }), { success: c.saved, error: c.fail });
    }

    async function saveRomPath(id: string) {
        if (!cfg) return;
        const romPath = (editingRomPath[id] ?? "").trim();
        const current = cfg.platforms ?? [];
        const idx = current.findIndex((p) => p.id === id);
        let next: typeof current;
        if (idx >= 0) next = current.map((p) => p.id === id ? { ...p, romPath } : p);
        else next = [...current, { id, enabled: false, romPath, biosPath: null, core: null }];
        await saveReq.run(async () => patch({ platforms: next }), { success: c.saved, error: c.fail });
    }

    async function saveBiosPath(id: string) {
        if (!cfg) return;
        const biosPath = (editingBiosPath[id] ?? "").trim() || null;
        const current = cfg.platforms ?? [];
        const idx = current.findIndex((p) => p.id === id);
        let next: typeof current;
        if (idx >= 0) next = current.map((p) => p.id === id ? { ...p, biosPath } : p);
        else next = [...current, { id, enabled: false, romPath: "", biosPath, core: null }];
        await saveReq.run(async () => patch({ platforms: next }), { success: c.saved, error: c.fail });
    }

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}><RetroarchIconBadge platform="all" theme={(cfg.iconTheme as RetroarchTheme) ?? "monochrome"} size={32} alt="Emulador" /></div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">Emulador (EmulatorJS)</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">
                            Cada plataforma habilitada vira um card no dashboard. Configure a pasta de ROMs e BIOS por plataforma. Usa CDN oficial (sem instalar nada).
                        </p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={cfg.enabled && !cfg.hidden}
                    busy={toggleReq.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleReq.run(async () => {
                            await patch({ enabled: next, hidden: !next });
                        }, { success: c.saved, error: c.fail });
                    }}
                />
            </div>

            {/* Global settings */}
            <Fold summary="Configurações globais (CDN, BIOS, saves, gamepad)">
                <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                    <SelectField
                        label="Tema dos ícones"
                        value={(cfg.iconTheme as string) ?? "monochrome"}
                        onChange={async (e) => {
                            const v = e.target.value as RetroarchTheme;
                            setCfg({ ...cfg, iconTheme: v } as EmulatorConfig);
                            await saveReq.run(async () => patch({ iconTheme: v }), { success: c.saved, error: c.fail });
                        }}
                        options={RETROARCH_THEMES.map((t) => ({ value: t.value, label: t.label }))}
                    />
                    <SelectField
                        label="Versão CDN"
                        value={cfg.cdnVersion}
                        onChange={async (e) => {
                            const v = e.target.value;
                            await saveReq.run(async () => patch({ cdnVersion: v }), { success: c.saved, error: c.fail });
                        }}
                        options={[
                            { value: "stable", label: "stable (recomendado)" },
                            { value: "latest", label: "latest" },
                            { value: "nightly", label: "nightly" },
                        ]}
                    />
                    <SelectField
                        label="Idioma do emulador"
                        value={cfg.language}
                        onChange={async (e) => {
                            await saveReq.run(async () => patch({ language: e.target.value }), { success: c.saved, error: c.fail });
                        }}
                        options={[
                            { value: "pt-BR", label: "Português (BR)" },
                            { value: "en-US", label: "English" },
                            { value: "es-ES", label: "Español" },
                        ]}
                    />
                    <PathField
                        kind="folder"
                        label="Pasta de saves (opcional)"
                        placeholder="ex.: /home/user/saves"
                        value={cfg.saveFolder}
                        onChange={(e) => setCfg({ ...cfg, saveFolder: e.target.value })}
                        onPicked={(v: string) => { setCfg((prev) => prev ? { ...prev, saveFolder: v } : prev); void saveReq.run(async () => patch({ saveFolder: v }), { success: c.saved, error: c.fail }); }}
                        onBlur={async () => {
                            await saveReq.run(async () => patch({ saveFolder: cfg.saveFolder }), { success: c.saved, error: c.fail });
                        }}
                    />
                    <PathField
                        kind="folder"
                        label="Pasta de BIOS (global)"
                        placeholder="ex.: /home/user/bios"
                        value={cfg.biosFolder}
                        onChange={(e) => setCfg({ ...cfg, biosFolder: e.target.value })}
                        onPicked={(v: string) => { setCfg((prev) => prev ? { ...prev, biosFolder: v } : prev); void saveReq.run(async () => patch({ biosFolder: v }), { success: c.saved, error: c.fail }); }}
                        onBlur={async () => {
                            await saveReq.run(async () => patch({ biosFolder: cfg.biosFolder }), { success: c.saved, error: c.fail });
                        }}
                    />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Checkbox label="Cache" checked={cfg.cacheEnabled} onChange={async (e) => { await saveReq.run(async () => patch({ cacheEnabled: e.target.checked }), { success: c.saved, error: c.fail }); }} />
                    <Checkbox label="Iniciar ao carregar" checked={cfg.startOnLoaded} onChange={async (e) => { await saveReq.run(async () => patch({ startOnLoaded: e.target.checked }), { success: c.saved, error: c.fail }); }} />
                    <Checkbox label="Tela cheia ao carregar" checked={cfg.fullscreenOnLoad} onChange={async (e) => { await saveReq.run(async () => patch({ fullscreenOnLoad: e.target.checked }), { success: c.saved, error: c.fail }); }} />
                    <Checkbox label="Esconder configurações" checked={cfg.hideSettings} onChange={async (e) => { await saveReq.run(async () => patch({ hideSettings: e.target.checked }), { success: c.saved, error: c.fail }); }} />
                    <Checkbox label="Não focar automaticamente ao carregar" checked={cfg.noAutoFocus} onChange={async (e) => { await saveReq.run(async () => patch({ noAutoFocus: e.target.checked }), { success: c.saved, error: c.fail }); }} />
                </div>
                <div className="mt-3">
                    <SliderField
                        label="Volume"
                        min={0}
                        max={1}
                        step={0.05}
                        value={cfg.volume}
                        onChange={(v) => setCfg({ ...cfg, volume: Math.max(0, Math.min(1, v)) })}
                        onCommit={(v) => { void saveReq.run(async () => patch({ volume: v }), { success: c.saved, error: c.fail }); }}
                    />
                </div>
                <div className="mt-3">
                    <p className={cfgHint}>Saves: sincronizados automaticamente no servidor (<code className="rounded bg-chip px-1 py-0.5 text-[11px]">backend/data/emulator-saves/</code>) — funcionam entre dispositivos. O IndexedDB local é usado apenas como cache. BIOS: necessária para PSX, NDS, Sega CD, Saturn, 3DO, etc.</p>
                </div>
            </Fold>

            {/* IGDB */}
            <Fold summary="IGDB — capas e informações dos jogos">
                <p className={cfgHint}>
                    Conecte sua conta da <a href="https://api.igdb.com" target="_blank" rel="noreferrer" className="underline hover:text-ink">IGDB (Twitch Developers)</a> para buscar capas e dados dos jogos na biblioteca. Crie um app em <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer" className="underline hover:text-ink">dev.twitch.tv/console/apps</a> e copie o Client ID e Client Secret.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                    <TextField
                        label="IGDB Client ID"
                        placeholder="ex.: abc123..."
                        value={cfg.igdb?.clientId ?? ""}
                        onChange={(e) => setCfg({ ...cfg, igdb: { ...(cfg.igdb ?? { clientId: "", clientSecret: "" }), clientId: e.target.value } })}
                        onBlur={async () => {
                            await saveReq.run(async () => patch({ igdb: { clientId: cfg.igdb?.clientId ?? "", clientSecret: cfg.igdb?.clientSecret ?? "" } }), { success: c.saved, error: c.fail });
                        }}
                    />
                    <TextField
                        label="IGDB Client Secret"
                        placeholder="ex.: xyz789..."
                        type="password"
                        value={cfg.igdb?.clientSecret ?? ""}
                        onChange={(e) => setCfg({ ...cfg, igdb: { ...(cfg.igdb ?? { clientId: "", clientSecret: "" }), clientSecret: e.target.value } })}
                        onBlur={async () => {
                            await saveReq.run(async () => patch({ igdb: { clientId: cfg.igdb?.clientId ?? "", clientSecret: cfg.igdb?.clientSecret ?? "" } }), { success: c.saved, error: c.fail });
                        }}
                    />
                </div>
                <div className="mt-2 flex gap-2">
                    <Button
                        loading={saveReq.busy}
                        onClick={async () => {
                            await saveReq.run(async () => patch({ igdb: { clientId: cfg.igdb?.clientId ?? "", clientSecret: cfg.igdb?.clientSecret ?? "" } }), { success: c.saved, error: c.fail });
                        }}
                    >
                        Salvar IGDB
                    </Button>
                    <span className="self-center text-[11px] text-ink3">
                        {(cfg.igdb?.clientId && cfg.igdb?.clientSecret) ? "✓ configurado" : "não configurado"}
                    </span>
                </div>
            </Fold>

            {/* Platforms */}
            <div className="flex flex-col gap-2">
                <h4 className="m-0 text-[13px] font-bold">Plataformas</h4>
                <p className={cfgHint}>Habilite as plataformas que deseja ver como cards. Cada uma precisa da pasta de ROMs configurada.</p>
                <div className="grid grid-cols-1 gap-2">
                    {(platformsMeta.length ? platformsMeta : ALL_PLATFORMS.map((id) => ({ id, label: PLATFORM_LABELS[id] ?? id, core: id, exts: [], needsBios: false }))).map((plat) => {
                        const pCfg = (cfg.platforms ?? []).find((p) => p.id === plat.id);
                        const enabled = enabledPlatforms.has(plat.id);
                        const romPath = pCfg?.romPath ?? "";
                        const biosPath = pCfg?.biosPath ?? "";
                        const extsLabel = plat.exts?.length ? plat.exts.join(", ") : "";
                        const platWarning = (plat as { warning?: string }).warning;
                        return (
                            <div key={plat.id} className={`rounded-xl border px-3 py-2.5 ${enabled ? "border-accent bg-chip" : "border-edge bg-canvas"}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-semibold">{plat.label} <span className="font-normal text-ink3">({plat.id})</span>{platWarning ? <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-600 dark:text-amber-400" title={platWarning}>⚠ desempenho limitado</span> : null}</div>
                                        <div className="text-[11px] text-ink3">{extsLabel ? `extensões: ${extsLabel}` : ""} {plat.needsBios ? "· precisa BIOS" : ""}</div>
                                        {platWarning ? <div className="mt-1 text-[11px] leading-[1.4] text-amber-600 dark:text-amber-400">{platWarning}</div> : null}
                                    </div>
                                    <Switch
                                        label={enabled ? "Ativo" : "Inativo"}
                                        checked={enabled}
                                        busy={saveReq.busy}
                                        onChange={(e) => void togglePlatform(plat.id, e.target.checked)}
                                    />
                                </div>
                                {enabled ? (
                                    <div className="mt-2 grid grid-cols-1 gap-2">
                                        <div className="flex gap-1.5">
                                            <PathField
                                                className="rounded-lg px-2.5 py-1.5 text-[12.5px]"
                                                kind="folder"
                                                placeholder="caminho da pasta de ROMs (ex.: /roms/snes)"
                                                value={editingRomPath[plat.id] ?? romPath}
                                                onChange={(e) => setEditingRomPath((m) => ({ ...m, [plat.id]: e.target.value }))}
                                                onPicked={(v: string) => setEditingRomPath((m) => ({ ...m, [plat.id]: v }))}
                                                onKeyDown={(e) => { if ((e as unknown as React.KeyboardEvent).key === "Enter") void saveRomPath(plat.id); }}
                                            />
                                            <Button loading={saveReq.busy} onClick={() => void saveRomPath(plat.id)}>Salvar</Button>
                                        </div>
                                        {plat.needsBios ? (
                                            <div className="flex gap-1.5">
                                                <PathField
                                                    className="rounded-lg px-2.5 py-1.5 text-[12.5px]"
                                                    kind="both"
                                                    placeholder="caminho do BIOS (arquivo ou pasta)"
                                                    value={editingBiosPath[plat.id] ?? biosPath}
                                                    onChange={(e) => setEditingBiosPath((m) => ({ ...m, [plat.id]: e.target.value }))}
                                                    onPicked={(v: string) => setEditingBiosPath((m) => ({ ...m, [plat.id]: v }))}
                                                    onKeyDown={(e) => { if ((e as unknown as React.KeyboardEvent).key === "Enter") void saveBiosPath(plat.id); }}
                                                />
                                                <Button loading={saveReq.busy} onClick={() => void saveBiosPath(plat.id)}>Salvar</Button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>

        </article>
    );
}
