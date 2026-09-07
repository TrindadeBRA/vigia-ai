import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "../components/PageBreadcrumb";
import { STR } from "../i18n";
import { usePrefs } from "./display/usePrefs";

type RomMeta = {
    platform: string;
    file: string;
    igdbId: number | null;
    name: string | null;
    coverUrl: string | null;
    coverImageId: string | null;
    summary: string | null;
    firstReleaseDate: number | null;
    rating: number | null;
    updatedAt: string | null;
};

type RomItem = {
    name: string;
    file: string;
    ext: string;
    size: number | null;
    meta?: RomMeta | null;
};

type RomGroup = {
    platform: string;
    label: string;
    core: string;
    romPath: string;
    roms: RomItem[];
    warning?: string;
};

type IgdbResult = {
    id: number;
    name: string;
    summary: string | null;
    coverImageId: string | null;
    coverUrl: string | null;
    firstReleaseDate: number | null;
    rating: number | null;
    platforms: Array<{ id: number; name: string; abbreviation?: string }> | null;
};

function formatSize(bytes: number | null): string {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function platformColor(id: string): string {
    const map: Record<string, string> = {
        nes: "#e63946", snes: "#9d4edd", n64: "#2a9d8f", gb: "#8ac926", gba: "#1982c4",
        nds: "#ff595e", psx: "#4361ee", psp: "#7209b7", segaMD: "#f77f00", segaMS: "#06d6a0",
        segaGG: "#ffbe0b", segaCD: "#fb5607", sega32x: "#8338ec", segaSaturn: "#3a86ff",
        atari2600: "#ff006e", atari7800: "#fb5607", lynx: "#00bbf9", jaguar: "#00f5d4",
        arcade: "#ff006e", mame2003: "#ffbe0b", "3do": "#8338ec", vb: "#e63946",
        coleco: "#06d6a0", pce: "#ff9f1c", ngp: "#2ec4b6", ws: "#e71d36", c64: "#011627",
        amiga: "#ff9f1c", "3ds": "#ef476f", dos: "#118ab2",
    };
    return map[id] ?? "#6c757d";
}

export default function EmulatorLibraryPage() {
    const navigate = useNavigate();
    const [prefs] = usePrefs();
    void STR[prefs.lang];
    const [groups, setGroups] = useState<RomGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [platformFilter, setPlatformFilter] = useState<string>("all");
    const [igdbConfigured, setIgdbConfigured] = useState<boolean | null>(null);
    const [selectedRom, setSelectedRom] = useState<{ platform: string; file: string; name: string } | null>(null);
    const [igdbQuery, setIgdbQuery] = useState("");
    const [igdbResults, setIgdbResults] = useState<IgdbResult[]>([]);
    const [igdbLoading, setIgdbLoading] = useState(false);
    const [igdbError, setIgdbError] = useState<string | null>(null);
    const [savingMeta, setSavingMeta] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [romsRes, metaRes, igdbStatusRes] = await Promise.all([
                fetch("/api/emulator/roms/all", { cache: "no-store" }).then((r) => r.json()),
                fetch("/api/emulator/game-meta", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ gameMeta: {} })),
                fetch("/api/emulator/igdb/status", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ configured: false })),
            ]);
            if (!romsRes.ok) {
                setError(romsRes.error || "erro ao listar jogos");
                setGroups([]);
            } else {
                const gs: RomGroup[] = romsRes.groups ?? [];
                // merge meta if not already included (backend already includes meta per rom, but also fetch map for safety)
                const metaMap: Record<string, RomMeta> = metaRes.gameMeta ?? {};
                for (const g of gs) {
                    for (const r of g.roms) {
                        const key = `${g.platform}::${r.file}`;
                        if (!r.meta && metaMap[key]) r.meta = metaMap[key];
                    }
                }
                setGroups(gs);
            }
            setIgdbConfigured(Boolean(igdbStatusRes.configured));
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    const allRomsCount = useMemo(() => groups.reduce((acc, g) => acc + g.roms.length, 0), [groups]);

    const filteredGroups = useMemo(() => {
        let gs = groups;
        if (platformFilter !== "all") gs = gs.filter((g) => g.platform === platformFilter);
        if (!search.trim()) return gs;
        const q = search.trim().toLowerCase();
        return gs.map((g) => ({
            ...g,
            roms: g.roms.filter((r) => {
                const metaName = r.meta?.name?.toLowerCase() ?? "";
                return r.name.toLowerCase().includes(q) || r.file.toLowerCase().includes(q) || metaName.includes(q) || g.label.toLowerCase().includes(q);
            }),
        })).filter((g) => g.roms.length > 0);
    }, [groups, search, platformFilter]);

    const handlePlay = useCallback((platform: string, file: string) => {
        const key = `${platform}::${file}`;
        try {
            localStorage.setItem("vigia:emulator:pending", JSON.stringify({ platform, file, key, at: Date.now() }));
        } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent("vigia:emulator-play", { detail: { platform, file, key } }));
        navigate("/display");
        // also try to scroll to emulator card after navigation
        setTimeout(() => {
            const el = document.querySelector('[data-gamepad-card="emulator:all"]') as HTMLElement | null;
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 400);
    }, [navigate]);

    const openIgdbSearch = useCallback((platform: string, file: string, name: string) => {
        setSelectedRom({ platform, file, name });
        setIgdbQuery(name);
        setIgdbResults([]);
        setIgdbError(null);
    }, []);

    const doIgdbSearch = useCallback(async () => {
        const q = igdbQuery.trim();
        if (!q) return;
        setIgdbLoading(true);
        setIgdbError(null);
        try {
            const res = await fetch(`/api/emulator/igdb/search?q=${encodeURIComponent(q)}&limit=12`, { cache: "no-store" });
            const j = await res.json() as { ok: boolean; results?: IgdbResult[]; error?: string };
            if (!j.ok) {
                setIgdbError(j.error || "erro na busca IGDB");
                setIgdbResults([]);
            } else {
                setIgdbResults(j.results ?? []);
                if ((j.results ?? []).length === 0) setIgdbError("nenhum resultado encontrado");
            }
        } catch (e) {
            setIgdbError(String(e));
        } finally {
            setIgdbLoading(false);
        }
    }, [igdbQuery]);

    const assignCover = useCallback(async (game: IgdbResult) => {
        if (!selectedRom) return;
        const key = `${selectedRom.platform}::${selectedRom.file}`;
        setSavingMeta(key);
        try {
            const res = await fetch("/api/emulator/game-meta", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platform: selectedRom.platform,
                    file: selectedRom.file,
                    igdbId: game.id,
                    name: game.name,
                    coverImageId: game.coverImageId,
                    coverUrl: game.coverUrl,
                    summary: game.summary,
                    firstReleaseDate: game.firstReleaseDate,
                    rating: game.rating,
                }),
            });
            const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
            if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
            // update local state
            setGroups((prev) => prev.map((g) => {
                if (g.platform !== selectedRom.platform) return g;
                return {
                    ...g,
                    roms: g.roms.map((r) => {
                        if (r.file !== selectedRom.file) return r;
                        return {
                            ...r,
                            meta: {
                                platform: selectedRom.platform,
                                file: selectedRom.file,
                                igdbId: game.id,
                                name: game.name,
                                coverUrl: game.coverUrl,
                                coverImageId: game.coverImageId,
                                summary: game.summary,
                                firstReleaseDate: game.firstReleaseDate,
                                rating: game.rating,
                                updatedAt: new Date().toISOString(),
                            },
                        };
                    }),
                };
            }));
            setSelectedRom(null);
            setIgdbResults([]);
        } catch (e) {
            setIgdbError(String(e));
        } finally {
            setSavingMeta(null);
        }
    }, [selectedRom]);

    const clearCover = useCallback(async (platform: string, file: string) => {
        const key = `${platform}::${file}`;
        setSavingMeta(key);
        try {
            const res = await fetch(`/api/emulator/game-meta`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform, file, clear: true }),
            });
            const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
            if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
            setGroups((prev) => prev.map((g) => {
                if (g.platform !== platform) return g;
                return { ...g, roms: g.roms.map((r) => r.file === file ? { ...r, meta: null } : r) };
            }));
        } catch (e) {
            setError(String(e));
        } finally {
            setSavingMeta(null);
        }
    }, []);

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
                <div className="flex items-center gap-3">
                    <div className="size-10 animate-pulse rounded-xl bg-chip" />
                    <div className="h-6 w-40 animate-pulse rounded bg-chip" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-[220px] animate-pulse rounded-2xl bg-chip" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1280px] px-4 py-4 pb-10">
            <PageBreadcrumb current="Biblioteca" lang={prefs.lang} onBack={() => navigate("/display")} className="mb-3" />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="m-0 flex items-center gap-2 text-[22px] font-[800] tracking-[-.3px]">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-[18px] text-white">🎮</span>
                        Biblioteca de Jogos
                    </h1>
                    <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-ink2">
                        {allRomsCount === 0 ? "Nenhum jogo encontrado — configure as pastas de ROMs em Configurações > Emulador." : `${allRomsCount} jogo${allRomsCount === 1 ? "" : "s"} em ${groups.length} plataforma${groups.length === 1 ? "" : "s"} · agrupados por plataforma`}
                    </p>
                    {error ? <p className="mt-2 text-[12px] text-bad">{error}</p> : null}
                    {igdbConfigured === false ? (
                        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
                            IGDB não configurado — adicione Client ID e Client Secret em Configurações → Emulador para buscar capas.
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void fetchAll()}
                        className="rounded-xl border border-edge bg-chip px-3 py-2 text-[12.5px] font-medium hover:border-accent"
                    >
                        ↻ Atualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/display/config")}
                        className="rounded-xl border border-edge bg-panel px-3 py-2 text-[12.5px] font-medium hover:border-accent"
                    >
                        ⚙ Configurar pastas
                    </button>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 max-w-[420px]">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nome, arquivo ou plataforma…"
                        className="w-full rounded-xl border border-edge bg-panel px-3 py-2.5 pl-9 text-[13px] outline-none placeholder:text-ink3 focus:border-accent"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3">⌕</span>
                    {search ? (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-chip px-2 py-1 text-[11px] hover:bg-edge"
                        >
                            limpar
                        </button>
                    ) : null}
                </div>
                <select
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="rounded-xl border border-edge bg-panel px-3 py-2.5 text-[13px] outline-none focus:border-accent"
                >
                    <option value="all">Todas as plataformas</option>
                    {groups.map((g) => (
                        <option key={g.platform} value={g.platform}>{g.label} ({g.roms.length})</option>
                    ))}
                </select>
                <span className="text-[12px] text-ink3">
                    {filteredGroups.reduce((a, g) => a + g.roms.length, 0)} jogo(s)
                </span>
            </div>

            {filteredGroups.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed border-edge bg-panel p-8 text-center">
                    <div className="text-[15px] font-semibold">Nenhum jogo corresponde à busca</div>
                    <div className="mt-1 text-[13px] text-ink3">Tente outro termo ou limpe os filtros.</div>
                </div>
            ) : (
                <div className="mt-6 flex flex-col gap-8">
                    {filteredGroups.map((group) => (
                        <section key={group.platform} className="overflow-hidden rounded-2xl border border-edge bg-panel">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-chip/50 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="size-2.5 rounded-full" style={{ background: platformColor(group.platform) }} aria-hidden />
                                    <h2 className="m-0 text-[15px] font-bold">{group.label}</h2>
                                    <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink2">{group.roms.length} jogo{group.roms.length === 1 ? "" : "s"}</span>
                                    {group.warning ? <span className="text-[11px] text-warn">· {group.warning}</span> : null}
                                </div>
                                <span className="text-[11px] text-ink3">{group.core} · {group.romPath || "sem pasta"}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {group.roms.map((rom) => {
                                    const meta = rom.meta;
                                    const cover = meta?.coverUrl;
                                    const displayName = meta?.name || rom.name;
                                    const key = `${group.platform}::${rom.file}`;
                                    const isSaving = savingMeta === key;
                                    return (
                                        <div
                                            key={rom.file}
                                            className="group/card flex flex-col overflow-hidden rounded-2xl border border-edge bg-canvas transition hover:border-accent hover:shadow-card"
                                        >
                                            <div className="relative aspect-[3/4] overflow-hidden bg-chip">
                                                {cover ? (
                                                    <img
                                                        src={cover}
                                                        alt={displayName}
                                                        loading="lazy"
                                                        className="size-full object-cover transition duration-300 group-hover/card:scale-[1.03]"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                ) : (
                                                    <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
                                                        <div className="flex size-12 items-center justify-center rounded-xl text-[22px]" style={{ background: `${platformColor(group.platform)}18`, color: platformColor(group.platform) }}>🎮</div>
                                                        <div className="line-clamp-2 text-[12px] font-semibold leading-tight">{displayName}</div>
                                                        <div className="text-[10px] text-ink3">{rom.ext.toUpperCase()} · {formatSize(rom.size)}</div>
                                                    </div>
                                                )}
                                                <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                                                    {group.platform}
                                                </div>
                                                {meta?.rating ? (
                                                    <div className="absolute right-2 top-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                                        ★ {Math.round(meta.rating)}%
                                                    </div>
                                                ) : null}
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 pt-6">
                                                    <div className="line-clamp-1 text-[12px] font-bold leading-tight text-white">{displayName}</div>
                                                    <div className="line-clamp-1 text-[10px] text-white/70">{rom.file}</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-1 flex-col gap-2 p-2.5">
                                                <div className="min-h-[32px]">
                                                    <div className="line-clamp-2 text-[12.5px] font-semibold leading-tight">{displayName}</div>
                                                    {meta?.name && meta.name !== rom.name ? (
                                                        <div className="line-clamp-1 text-[11px] text-ink3">{rom.name}</div>
                                                    ) : null}
                                                </div>
                                                {meta?.summary ? (
                                                    <div className="line-clamp-2 text-[11px] leading-snug text-ink3">{meta.summary}</div>
                                                ) : null}
                                                <div className="mt-auto flex flex-col gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePlay(group.platform, rom.file)}
                                                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[13px] font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                                                    >
                                                        ▶ Jogar
                                                    </button>
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => openIgdbSearch(group.platform, rom.file, rom.name)}
                                                            disabled={isSaving}
                                                            className="flex-1 rounded-xl border border-edge bg-chip px-2 py-1.5 text-[11px] font-medium hover:border-accent disabled:opacity-50"
                                                            title="Buscar capa no IGDB"
                                                        >
                                                            {cover ? "Trocar capa" : "Buscar capa"}
                                                        </button>
                                                        {cover ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void clearCover(group.platform, rom.file)}
                                                                disabled={isSaving}
                                                                className="rounded-xl border border-edge bg-panel px-2 py-1.5 text-[11px] hover:border-bad hover:text-bad disabled:opacity-50"
                                                                title="Remover capa"
                                                            >
                                                                ✕
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-center text-[10px] text-ink3">{rom.ext} · {formatSize(rom.size) || "—"}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {/* IGDB search modal */}
            {selectedRom ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedRom(null)}>
                    <div
                        className="flex max-h-[85vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
                            <div>
                                <div className="text-[14px] font-bold">Buscar capa no IGDB</div>
                                <div className="text-[12px] text-ink3">{selectedRom.platform} · {selectedRom.file}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRom(null)}
                                className="rounded-xl border border-edge bg-chip px-3 py-1.5 text-[12px] hover:border-accent"
                            >
                                Fechar
                            </button>
                        </div>
                        <div className="flex gap-2 border-b border-edge bg-chip/30 px-4 py-3">
                            <input
                                value={igdbQuery}
                                onChange={(e) => setIgdbQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") void doIgdbSearch(); }}
                                placeholder="Nome do jogo para buscar no IGDB…"
                                className="flex-1 rounded-xl border border-edge bg-panel px-3 py-2 text-[13px] outline-none focus:border-accent"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => void doIgdbSearch()}
                                disabled={igdbLoading || !igdbQuery.trim()}
                                className="rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                            >
                                {igdbLoading ? "Buscando…" : "Buscar"}
                            </button>
                        </div>
                        <div className="min-h-[200px] flex-1 overflow-auto p-3">
                            {igdbError ? <div className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">{igdbError}</div> : null}
                            {igdbLoading ? (
                                <div className="grid grid-cols-1 gap-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="h-[96px] animate-pulse rounded-xl bg-chip" />
                                    ))}
                                </div>
                            ) : igdbResults.length === 0 ? (
                                <div className="py-8 text-center text-[13px] text-ink3">
                                    {igdbError ? "" : "Digite o nome e clique em Buscar para ver resultados do IGDB."}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {igdbResults.map((g) => (
                                        <div key={g.id} className="flex gap-3 rounded-xl border border-edge bg-canvas p-3 hover:border-accent">
                                            <div className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-chip">
                                                {g.coverUrl ? (
                                                    <img src={g.coverUrl} alt={g.name} className="size-full object-cover" loading="lazy" />
                                                ) : (
                                                    <div className="flex size-full items-center justify-center text-[20px] text-ink3">🎮</div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="line-clamp-1 text-[13px] font-bold">{g.name}</div>
                                                {g.summary ? <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink3">{g.summary}</div> : null}
                                                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-ink3">
                                                    {g.firstReleaseDate ? <span>{new Date(g.firstReleaseDate * 1000).getFullYear()}</span> : null}
                                                    {g.rating ? <span>★ {Math.round(g.rating)}%</span> : null}
                                                    {g.platforms?.slice(0, 3).map((p) => (
                                                        <span key={p.id} className="rounded-full bg-chip px-1.5 py-0.5">{p.abbreviation || p.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void assignCover(g)}
                                                disabled={Boolean(savingMeta)}
                                                className="shrink-0 self-center rounded-xl bg-accent px-3 py-2 text-[12px] font-bold text-white hover:brightness-110 disabled:opacity-50"
                                            >
                                                Usar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="border-t border-edge bg-chip/20 px-4 py-2 text-[11px] text-ink3">
                            Dados e capas por <a href="https://www.igdb.com" target="_blank" rel="noreferrer" className="underline hover:text-ink">IGDB</a> (Twitch). Configure Client ID/Secret em Configurações → Emulador.
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
