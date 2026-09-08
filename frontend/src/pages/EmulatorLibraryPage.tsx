import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "../components/PageBreadcrumb";
import { RetroarchIcon, RetroarchIconBadge } from "../components/RetroarchIcon";
import { SearchIcon } from "../components/icons";
import { desktop } from "../desktop";
import { STR } from "../i18n";
import type { RetroarchTheme } from "../lib/retroarchIcons";
import { usePrefs } from "./display/usePrefs";

type RomMeta = {
    platform: string;
    file: string;
    igdbId: number | null;
    name: string | null;
    coverUrl: string | null;
    coverImageId: string | null;
    summary: string | null;
    storyline: string | null;
    firstReleaseDate: number | null;
    rating: number | null;
    aggregatedRating: number | null;
    totalRating: number | null;
    ratingCount: number | null;
    url: string | null;
    genres: string[] | null;
    themes: string[] | null;
    gameModes: string[] | null;
    playerPerspectives: string[] | null;
    platforms: Array<{ id: number; name: string; abbreviation?: string }> | null;
    developers: string[] | null;
    publishers: string[] | null;
    screenshots: string[] | null;
    artworks: string[] | null;
    videos: Array<{ name: string; videoId: string }> | null;
    releaseDates: Array<{ human: string; region: number | null; date: number | null }> | null;
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
    storyline: string | null;
    coverImageId: string | null;
    coverUrl: string | null;
    firstReleaseDate: number | null;
    rating: number | null;
    aggregatedRating: number | null;
    totalRating: number | null;
    ratingCount: number | null;
    url: string | null;
    genres: string[] | null;
    themes: string[] | null;
    gameModes: string[] | null;
    playerPerspectives: string[] | null;
    platforms: Array<{ id: number; name: string; abbreviation?: string }> | null;
    developers: string[] | null;
    publishers: string[] | null;
    screenshots: string[] | null;
    artworks: string[] | null;
    videos: Array<{ name: string; videoId: string }> | null;
    releaseDates: Array<{ human: string; region: number | null; date: number | null }> | null;
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
        nds: "#ff595e", psx: "#4361ee", segaMD: "#f77f00", segaMS: "#06d6a0",
        segaGG: "#ffbe0b", segaCD: "#fb5607", sega32x: "#8338ec",
        atari2600: "#ff006e", atari7800: "#fb5607", lynx: "#00bbf9",
        arcade: "#ff006e", mame2003: "#ffbe0b", vb: "#e63946",
        coleco: "#06d6a0", pce: "#ff9f1c", ngp: "#2ec4b6", ws: "#e71d36", c64: "#011627",
    };
    return map[id] ?? "#6c757d";
}

function isImageInput(s: string): boolean {
    const t = s.trim();
    if (!t) return false;
    if (t.startsWith("data:image/")) return true;
    if (/^https?:\/\//i.test(t)) return true;
    if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(t)) return true;
    // base64 puro (sem prefixo) — heurística: longo e só base64 chars
    const noSpace = t.replace(/\s/g, "");
    if (noSpace.length > 200 && /^[A-Za-z0-9+/=]+$/.test(noSpace) && noSpace.length % 4 === 0) return true;
    return false;
}

function normalizeImageInput(s: string): string | null {
    const t = s.trim();
    if (!t) return null;
    if (t.startsWith("data:image/")) return t;
    if (/^https?:\/\//i.test(t)) return t;
    // base64 puro -> adiciona prefixo png
    const noSpace = t.replace(/\s/g, "");
    if (noSpace.length > 200 && /^[A-Za-z0-9+/=]+$/.test(noSpace)) {
        return `data:image/png;base64,${noSpace}`;
    }
    // caminho local com extensão de imagem -> não dá pra usar direto no browser, precisa picker
    if (/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(t)) return null;
    return null;
}

function formatDate(ts: number | null): string {
    if (!ts) return "—";
    try { return new Date(ts * 1000).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

export function sanitizeIgdbQuery(raw: string): string {
    if (!raw) return "";
    let s = raw.trim();
    // remove extensão de arquivo (.zip, .nes, .smc, .gba, .iso, .chd, etc)
    s = s.replace(/\.[a-z0-9]{1,5}$/i, "");
    // separadores comuns em nomes de ROM: _ e . viram espaço
    s = s.replace(/[_\.]+/g, " ");
    // remove tudo entre parênteses, colchetes e chaves (tags de versão, ripper, idioma, região, etc)
    s = s.replace(/\([^)]*\)/g, " ");
    s = s.replace(/\[[^\]]*\]/g, " ");
    s = s.replace(/\{[^}]*\}/g, " ");
    // tags de versão soltas que sobraram fora dos delimitadores
    s = s.replace(/\s+v\d+(\.\d+)*\s*$/i, " ");
    s = s.replace(/\s+Rev\.?\s*[A-Z0-9]+\s*$/i, " ");
    s = s.replace(/\s+Beta\s*$/i, " ");
    s = s.replace(/\s+Alpha\s*$/i, " ");
    s = s.replace(/\s+Proto\s*$/i, " ");
    s = s.replace(/\s+Demo\s*$/i, " ");
    // normaliza separador " - "
    s = s.replace(/\s*-\s*/g, " - ");
    // normaliza espaços
    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(/^[\s\-_,]+|[\s\-_,]+$/g, "").trim();
    s = s.replace(/\s+/g, " ").trim();
    if (s === "-" || s === "") return "";
    s = s.replace(/\s+-\s*$/g, "").trim();
    return s;
}

export default function EmulatorLibraryPage() {
    const navigate = useNavigate();
    const [prefs] = usePrefs();
    void STR[prefs.lang];
    const [iconTheme, setIconTheme] = useState<RetroarchTheme>("monochrome");
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
    const [detailMeta, setDetailMeta] = useState<RomMeta | null>(null);
    const [detailLightbox, setDetailLightbox] = useState<string | null>(null);
    const [customCoverPreview, setCustomCoverPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [romsRes, metaRes, igdbStatusRes, emuCfgRes] = await Promise.all([
                fetch("/api/emulator/roms/all", { cache: "no-store" }).then((r) => r.json()),
                fetch("/api/emulator/game-meta", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ gameMeta: {} })),
                fetch("/api/emulator/igdb/status", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ configured: false })),
                fetch("/api/emulator/config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
            ]);
            if (emuCfgRes?.iconTheme && ["monochrome", "flatux", "daite"].includes(emuCfgRes.iconTheme)) {
                setIconTheme(emuCfgRes.iconTheme as RetroarchTheme);
            }
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

    const searchIgdb = useCallback(async (q: string) => {
        const query = q.trim();
        if (!query) return;
        setIgdbLoading(true);
        setIgdbError(null);
        try {
            const res = await fetch(`/api/emulator/igdb/search?q=${encodeURIComponent(query)}&limit=12`, { cache: "no-store" });
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
    }, []);

    const doIgdbSearch = useCallback(async (overrideQuery?: string) => {
        const q = (overrideQuery ?? igdbQuery).trim();
        if (!q) return;
        await searchIgdb(q);
    }, [igdbQuery, searchIgdb]);

    const openIgdbSearch = useCallback((platform: string, file: string, name: string) => {
        const raw = (name || file || "").trim();
        const sanitized = sanitizeIgdbQuery(raw);
        const query = sanitized || raw.replace(/\.[a-z0-9]{1,5}$/i, "").trim();
        setSelectedRom({ platform, file, name });
        setIgdbQuery(query);
        setIgdbResults([]);
        setIgdbError(null);
        setCustomCoverPreview(null);
        // busca automática ao abrir o popup com o nome sanitizado
        if (query) void searchIgdb(query);
    }, [searchIgdb]);

    const handleCustomCoverFile = useCallback(async (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result ?? "");
            if (dataUrl.startsWith("data:image/")) setCustomCoverPreview(dataUrl);
        };
        reader.readAsDataURL(file);
    }, []);

    const handlePickImage = useCallback(async () => {
        // Electron: picker nativo que já retorna data:image base64
        if (desktop() && (window.vigia as unknown as { pickImage?: () => Promise<string | null> })?.pickImage) {
            try {
                const picked = await (window.vigia as unknown as { pickImage: () => Promise<string | null> }).pickImage();
                if (picked && picked.startsWith("data:image/")) {
                    setCustomCoverPreview(picked);
                    setIgdbQuery(picked.slice(0, 80) + "…");
                    return;
                }
                if (picked) {
                    const norm = normalizeImageInput(picked);
                    if (norm) setCustomCoverPreview(norm);
                    return;
                }
                return;
            } catch { /* fallback para input file */ }
        }
        fileInputRef.current?.click();
    }, []);

    const handleUseCustomCover = useCallback(async () => {
        if (!selectedRom || !customCoverPreview) return;
        const key = `${selectedRom.platform}::${selectedRom.file}`;
        setSavingMeta(key);
        try {
            const res = await fetch("/api/emulator/game-meta", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platform: selectedRom.platform,
                    file: selectedRom.file,
                    coverUrl: customCoverPreview,
                    coverImageId: null,
                    name: selectedRom.name || null,
                }),
            });
            const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
            if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
            setGroups((prev) => prev.map((g) => {
                if (g.platform !== selectedRom.platform) return g;
                return {
                    ...g,
                    roms: g.roms.map((r) => {
                        if (r.file !== selectedRom.file) return r;
                        const prevMeta = r.meta;
                        return {
                            ...r,
                            meta: {
                                platform: selectedRom.platform,
                                file: selectedRom.file,
                                igdbId: prevMeta?.igdbId ?? null,
                                name: prevMeta?.name ?? selectedRom.name ?? null,
                                coverUrl: customCoverPreview,
                                coverImageId: null,
                                summary: prevMeta?.summary ?? null,
                                storyline: prevMeta?.storyline ?? null,
                                firstReleaseDate: prevMeta?.firstReleaseDate ?? null,
                                rating: prevMeta?.rating ?? null,
                                aggregatedRating: prevMeta?.aggregatedRating ?? null,
                                totalRating: prevMeta?.totalRating ?? null,
                                ratingCount: prevMeta?.ratingCount ?? null,
                                url: prevMeta?.url ?? null,
                                genres: prevMeta?.genres ?? null,
                                themes: prevMeta?.themes ?? null,
                                gameModes: prevMeta?.gameModes ?? null,
                                playerPerspectives: prevMeta?.playerPerspectives ?? null,
                                platforms: prevMeta?.platforms ?? null,
                                developers: prevMeta?.developers ?? null,
                                publishers: prevMeta?.publishers ?? null,
                                screenshots: prevMeta?.screenshots ?? null,
                                artworks: prevMeta?.artworks ?? null,
                                videos: prevMeta?.videos ?? null,
                                releaseDates: prevMeta?.releaseDates ?? null,
                                updatedAt: new Date().toISOString(),
                            },
                        };
                    }),
                };
            }));
            setSelectedRom(null);
            setCustomCoverPreview(null);
            setIgdbResults([]);
        } catch (e) {
            setIgdbError(String(e));
        } finally {
            setSavingMeta(null);
        }
    }, [selectedRom, customCoverPreview]);

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
                    storyline: game.storyline,
                    firstReleaseDate: game.firstReleaseDate,
                    rating: game.rating,
                    aggregatedRating: game.aggregatedRating,
                    totalRating: game.totalRating,
                    ratingCount: game.ratingCount,
                    url: game.url,
                    genres: game.genres,
                    themes: game.themes,
                    gameModes: game.gameModes,
                    playerPerspectives: game.playerPerspectives,
                    platforms: game.platforms,
                    developers: game.developers,
                    publishers: game.publishers,
                    screenshots: game.screenshots,
                    artworks: game.artworks,
                    videos: game.videos,
                    releaseDates: game.releaseDates,
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
                                storyline: game.storyline,
                                firstReleaseDate: game.firstReleaseDate,
                                rating: game.rating,
                                aggregatedRating: game.aggregatedRating,
                                totalRating: game.totalRating,
                                ratingCount: game.ratingCount,
                                url: game.url,
                                genres: game.genres,
                                themes: game.themes,
                                gameModes: game.gameModes,
                                playerPerspectives: game.playerPerspectives,
                                platforms: game.platforms,
                                developers: game.developers,
                                publishers: game.publishers,
                                screenshots: game.screenshots,
                                artworks: game.artworks,
                                videos: game.videos,
                                releaseDates: game.releaseDates,
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
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        <RetroarchIconBadge platform="all" theme={iconTheme} size={36} alt="Biblioteca" />
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
                                    <RetroarchIcon platform={group.platform} theme={iconTheme} size={22} alt={group.label} />
                                    <span className="size-2.5 rounded-full" style={{ background: platformColor(group.platform) }} aria-hidden />
                                    <h2 className="m-0 text-[15px] font-bold">{group.label}</h2>
                                    <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-ink2">{group.roms.length} jogo{group.roms.length === 1 ? "" : "s"}</span>
                                    {group.warning ? <span className="text-[11px] text-warn">· {group.warning}</span> : null}
                                </div>
                                <span className="text-[11px] text-ink3">{group.core} · {group.romPath || "sem pasta"}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
                                                        <RetroarchIconBadge platform={group.platform} theme={iconTheme} size={48} alt={group.label} />
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
                                                {meta ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailMeta(meta)}
                                                        className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/85"
                                                        title="Ver detalhes"
                                                        aria-label="Ver detalhes"
                                                    >
                                                        <SearchIcon size={14} className="text-white" />
                                                    </button>
                                                ) : null}
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
                                                            title="Buscar informações no IGDB"
                                                        >
                                                            Buscar Informações
                                                        </button>
                                                        {meta ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void clearCover(group.platform, rom.file)}
                                                                disabled={isSaving}
                                                                className="rounded-xl border border-edge bg-panel px-2 py-1.5 text-[11px] hover:border-bad hover:text-bad disabled:opacity-50"
                                                                title="Remover informações"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { setSelectedRom(null); setCustomCoverPreview(null); }}>
                    <div
                        className="flex max-h-[85vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
                            <div>
                                <div className="text-[14px] font-bold">Buscar Informações</div>
                                <div className="text-[12px] text-ink3">{selectedRom.platform} · {selectedRom.file}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSelectedRom(null); setCustomCoverPreview(null); }}
                                className="rounded-xl border border-edge bg-chip px-3 py-1.5 text-[12px] hover:border-accent"
                            >
                                Fechar
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 border-b border-edge bg-chip/30 px-4 py-3">
                            <div className="flex gap-2">
                                <input
                                    value={igdbQuery}
                                    onChange={(e) => {
                                        setIgdbQuery(e.target.value);
                                        const norm = normalizeImageInput(e.target.value);
                                        if (norm) setCustomCoverPreview(norm);
                                        else if (isImageInput(e.target.value)) setCustomCoverPreview(null);
                                        else setCustomCoverPreview(null);
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Enter") void doIgdbSearch(); }}
                                    placeholder="Nome do jogo, URL da imagem ou base64…"
                                    className="flex-1 rounded-xl border border-edge bg-panel px-3 py-2 text-[13px] outline-none focus:border-accent"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => void doIgdbSearch()}
                                    disabled={igdbLoading || !igdbQuery.trim() || isImageInput(igdbQuery)}
                                    className="rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                                >
                                    {igdbLoading ? "Buscando…" : "Buscar"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handlePickImage()}
                                    className="rounded-xl border border-edge bg-panel px-3 py-2 text-[13px] hover:border-accent"
                                    title="Escolher imagem (arquivo local)"
                                >
                                    ⋯
                                </button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleCustomCoverFile(f);
                                    e.target.value = "";
                                }}
                            />
                            {customCoverPreview ? (
                                <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-2">
                                    <img src={customCoverPreview} alt="preview" className="size-16 rounded-lg object-cover" />
                                    <div className="min-w-0 flex-1 text-[11px] text-ink3">Imagem personalizada pronta para usar</div>
                                    <button type="button" onClick={() => void handleUseCustomCover()} disabled={Boolean(savingMeta)} className="rounded-xl bg-accent px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Usar imagem</button>
                                    <button type="button" onClick={() => setCustomCoverPreview(null)} className="rounded-xl border border-edge bg-chip px-2 py-1.5 text-[11px]">✕</button>
                                </div>
                            ) : null}
                            {isImageInput(igdbQuery) && !customCoverPreview ? (
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { const n = normalizeImageInput(igdbQuery); if (n) setCustomCoverPreview(n); }} className="rounded-xl bg-accent px-3 py-1.5 text-[12px] font-bold text-white">Usar como capa</button>
                                    <span className="self-center text-[11px] text-ink3">URL/base64 detectado — clique para pré-visualizar</span>
                                </div>
                            ) : null}
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
                                    {igdbError ? "" : "Digite o nome e clique em Buscar para ver resultados do IGDB. Você também pode colar URL/base64 de imagem ou usar ⋯ para escolher um arquivo."}
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
                                                    {g.genres?.slice(0, 2).map((gn) => <span key={gn} className="rounded-full bg-chip px-1.5 py-0.5">{gn}</span>)}
                                                    {g.platforms?.slice(0, 2).map((p) => (
                                                        <span key={p.id} className="rounded-full bg-chip px-1.5 py-0.5">{p.abbreviation || p.name}</span>
                                                    ))}
                                                </div>
                                                {(g.screenshots?.length ?? 0) > 0 ? <div className="mt-1 text-[10px] text-ink3">{g.screenshots!.length} screenshot(s)</div> : null}
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

            {/* Detalhes do jogo */}
            {detailMeta ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setDetailMeta(null)}>
                    <div className="flex max-h-[90vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
                            <div className="min-w-0">
                                <div className="truncate text-[15px] font-bold">{detailMeta.name ?? "Detalhes"}</div>
                                <div className="text-[11px] text-ink3">{detailMeta.platform} · {detailMeta.file}{detailMeta.firstReleaseDate ? ` · ${formatDate(detailMeta.firstReleaseDate)}` : ""}</div>
                            </div>
                            <button type="button" onClick={() => setDetailMeta(null)} className="rounded-xl border border-edge bg-chip px-3 py-1.5 text-[12px] hover:border-accent">Fechar</button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <div className="flex flex-col gap-4 md:flex-row">
                                <div className="w-full shrink-0 md:w-[260px]">
                                    {detailMeta.coverUrl ? <img src={detailMeta.coverUrl} alt={detailMeta.name ?? ""} className="w-full rounded-xl border border-edge object-cover" /> : <div className="flex h-[320px] items-center justify-center rounded-xl border border-edge bg-chip text-ink3">sem capa</div>}
                                    {(detailMeta.rating ?? detailMeta.aggregatedRating ?? detailMeta.totalRating) ? (
                                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                            {detailMeta.rating ? <span className="rounded-full bg-accent px-2 py-1 font-bold text-white">★ {Math.round(detailMeta.rating)}%</span> : null}
                                            {detailMeta.aggregatedRating ? <span className="rounded-full bg-chip px-2 py-1">Crítica {Math.round(detailMeta.aggregatedRating)}%</span> : null}
                                            {detailMeta.totalRating ? <span className="rounded-full bg-chip px-2 py-1">Total {Math.round(detailMeta.totalRating)}%</span> : null}
                                            {detailMeta.ratingCount ? <span className="rounded-full bg-chip px-2 py-1">{detailMeta.ratingCount} votos</span> : null}
                                        </div>
                                    ) : null}
                                    {detailMeta.url ? <a href={detailMeta.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-chip px-3 py-1.5 text-[12px] hover:border-accent border border-edge">Abrir no IGDB ↗</a> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    {detailMeta.summary ? <div className="text-[13px] leading-relaxed">{detailMeta.summary}</div> : <div className="text-[13px] text-ink3">Sem descrição.</div>}
                                    {detailMeta.storyline ? <div className="mt-3 rounded-xl bg-chip/40 p-3 text-[12px] leading-relaxed"><span className="font-bold">Enredo: </span>{detailMeta.storyline}</div> : null}
                                    <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                                        {detailMeta.genres?.length ? <div><span className="font-bold">Gêneros:</span> {detailMeta.genres.join(", ")}</div> : null}
                                        {detailMeta.themes?.length ? <div><span className="font-bold">Temas:</span> {detailMeta.themes.join(", ")}</div> : null}
                                        {detailMeta.gameModes?.length ? <div><span className="font-bold">Modos:</span> {detailMeta.gameModes.join(", ")}</div> : null}
                                        {detailMeta.playerPerspectives?.length ? <div><span className="font-bold">Perspectiva:</span> {detailMeta.playerPerspectives.join(", ")}</div> : null}
                                        {detailMeta.developers?.length ? <div><span className="font-bold">Desenvolvedor:</span> {detailMeta.developers.join(", ")}</div> : null}
                                        {detailMeta.publishers?.length ? <div><span className="font-bold">Publicadora:</span> {detailMeta.publishers.join(", ")}</div> : null}
                                        {detailMeta.platforms?.length ? <div className="sm:col-span-2"><span className="font-bold">Plataformas:</span> {detailMeta.platforms.map((p) => p.abbreviation || p.name).join(", ")}</div> : null}
                                        {detailMeta.releaseDates?.length ? <div className="sm:col-span-2"><span className="font-bold">Lançamentos:</span> {detailMeta.releaseDates.map((r) => r.human).join(" · ")}</div> : null}
                                    </div>
                                    {(detailMeta.screenshots?.length ?? 0) > 0 || (detailMeta.artworks?.length ?? 0) > 0 ? (
                                        <div className="mt-4">
                                            <div className="text-[12px] font-bold">Galeria</div>
                                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {(detailMeta.screenshots ?? []).map((src) => (
                                                    <button key={src} type="button" onClick={() => setDetailLightbox(src)} className="overflow-hidden rounded-xl border border-edge bg-chip">
                                                        <img src={src} alt="screenshot" className="h-[110px] w-full object-cover hover:opacity-90" loading="lazy" />
                                                    </button>
                                                ))}
                                                {(detailMeta.artworks ?? []).map((src) => (
                                                    <button key={src} type="button" onClick={() => setDetailLightbox(src)} className="overflow-hidden rounded-xl border border-edge bg-chip">
                                                        <img src={src} alt="artwork" className="h-[110px] w-full object-cover hover:opacity-90" loading="lazy" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {(detailMeta.videos?.length ?? 0) > 0 ? (
                                        <div className="mt-4">
                                            <div className="text-[12px] font-bold">Vídeos</div>
                                            <div className="mt-2 flex flex-col gap-2">
                                                {detailMeta.videos!.map((v) => (
                                                    <a key={v.videoId} href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" className="rounded-xl border border-edge bg-chip px-3 py-2 text-[12px] hover:border-accent">▶ {v.name}</a>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
            {detailLightbox ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setDetailLightbox(null)}>
                    <img src={detailLightbox} alt="preview" className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    <button type="button" onClick={() => setDetailLightbox(null)} className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1.5 text-white">✕</button>
                </div>
            ) : null}
        </div>
    );
}
