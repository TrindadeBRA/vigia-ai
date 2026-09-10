import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { dataDir } from "../config.js";
import { getIgdbGameById, igdbArtworkUrl, igdbConfigured, igdbCoverUrl, igdbScreenshotUrl, searchIgdbGames } from "../providers/igdb.js";
import { EMULATOR_PLATFORMS } from "../schemas/emulator.js";
import { load, updateSync as update } from "../store.js";

const ALLOWED_EXTS = new Map<string, Set<string>>();
for (const p of EMULATOR_PLATFORMS) {
    ALLOWED_EXTS.set(p.id, new Set(p.exts.map((e) => e.toLowerCase())));
}
// also map core -> exts for custom core override
const CORE_TO_EXTS = new Map<string, Set<string>>();
for (const p of EMULATOR_PLATFORMS) {
    CORE_TO_EXTS.set(p.core, new Set(p.exts.map((e) => e.toLowerCase())));
}

function safeJoin(base: string, file: string): string | null {
    const resolved = resolve(join(base, file));
    const baseResolved = resolve(base);
    if (!resolved.startsWith(baseResolved)) return null;
    return resolved;
}

function getGameMetaMap(): Record<string, Record<string, unknown>> {
    const cfg = load() as Record<string, unknown>;
    const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
    return (emu.gameMeta ?? {}) as Record<string, Record<string, unknown>>;
}

function gameKey(platform: string, file: string): string {
    return `${platform}::${file}`;
}

function savesDir(): string {
    return join(dataDir(), "emulator-saves");
}

function ensureSavesDir(): void {
    try { mkdirSync(savesDir(), { recursive: true }); } catch { /* ignore */ }
}

function sanitizeSegment(s: string): string {
    // remove path separators and control chars, keep safe filename chars
    return s.replace(/[\/\\:\0]/g, "_").replace(/[^a-zA-Z0-9._\-+()\[\] ]/g, "_").slice(0, 120) || "_";
}

function saveFileName(platform: string, game: string, kind: "sram" | "state"): string {
    // game = ROM file name without ext or with ext — use as-is sanitized
    const base = sanitizeSegment(game.replace(/\.[^.]+$/, ""));
    const plat = sanitizeSegment(platform);
    const ext = kind === "state" ? ".state" : ".srm";
    return `${plat}__${base}${ext}`;
}

function saveFilePath(platform: string, game: string, kind: "sram" | "state"): string {
    return join(savesDir(), saveFileName(platform, game, kind));
}

export async function createEmulatorRoutes(app: FastifyInstance): Promise<void> {
    // GET config
    app.get("/api/emulator/config", { schema: { tags: ["Emulador"] } }, async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.emulator ?? {}) as Record<string, unknown>;
    });

    // PATCH config — global settings + platforms
    app.patch("/api/emulator/config", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });

        // validate cdnVersion
        if (body.cdnVersion !== undefined && body.cdnVersion !== null) {
            const v = String(body.cdnVersion);
            if (!["stable", "latest", "nightly"].includes(v)) {
                return reply.code(400).send({ ok: false, error: "cdnVersion inválido" });
            }
        }
        if (body.volume !== undefined && body.volume !== null) {
            const vol = Number(body.volume);
            if (Number.isNaN(vol) || vol < 0 || vol > 1) {
                return reply.code(400).send({ ok: false, error: "volume deve ser 0..1" });
            }
        }
        if (body.iconTheme !== undefined && body.iconTheme !== null) {
            const t = String(body.iconTheme);
            if (!["monochrome", "flatux", "daite"].includes(t)) {
                return reply.code(400).send({ ok: false, error: "iconTheme inválido" });
            }
        }

        update((cfg: Record<string, unknown>) => {
            const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
            if (!cfg.emulator) cfg.emulator = emu;

            const fields: Array<[string, unknown]> = [
                ["enabled", body.enabled],
                ["hidden", body.hidden],
                ["cdnVersion", body.cdnVersion],
                ["iconTheme", body.iconTheme],
                ["cacheEnabled", body.cacheEnabled],
                ["volume", body.volume],
                ["startOnLoaded", body.startOnLoaded],
                ["fullscreenOnLoad", body.fullscreenOnLoad],
                ["color", body.color],
                ["backgroundBlur", body.backgroundBlur],
                ["softLoad", body.softLoad],
                ["disableCue", body.disableCue],
                ["language", body.language],
                ["saveFolder", body.saveFolder],
                ["biosFolder", body.biosFolder],
                ["defaultOptions", body.defaultOptions],
                ["disableAutoUnload", body.disableAutoUnload],
                ["disableBatchBootup", body.disableBatchBootup],
                ["noAutoFocus", body.noAutoFocus],
                ["hideSettings", body.hideSettings],
            ];
            for (const [k, v] of fields) {
                if (v !== undefined) (emu as Record<string, unknown>)[k] = v;
            }
            if (body.igdb !== undefined && body.igdb !== null && typeof body.igdb === "object") {
                const raw = body.igdb as Record<string, unknown>;
                const cur = (emu.igdb ?? {}) as Record<string, unknown>;
                if (raw.clientId !== undefined) cur.clientId = String(raw.clientId).trim();
                if (raw.clientSecret !== undefined) cur.clientSecret = String(raw.clientSecret).trim();
                emu.igdb = cur;
            }
            if (body.gameMeta !== undefined && body.gameMeta !== null && typeof body.gameMeta === "object" && !Array.isArray(body.gameMeta)) {
                const cur = (emu.gameMeta ?? {}) as Record<string, unknown>;
                for (const [k, v] of Object.entries(body.gameMeta as Record<string, unknown>)) {
                    if (v === null) delete cur[k];
                    else if (typeof v === "object") cur[k] = v;
                }
                emu.gameMeta = cur;
            }

            // platforms: array of { id, enabled, romPath, biosPath, core }
            if (body.platforms !== undefined && body.platforms !== null) {
                if (!Array.isArray(body.platforms)) {
                    // ignore invalid
                } else {
                    const cleaned: Array<Record<string, unknown>> = [];
                    for (const it of body.platforms as unknown[]) {
                        if (typeof it !== "object" || it === null || !(it as Record<string, unknown>).id) continue;
                        const r = it as Record<string, unknown>;
                        const id = String(r.id);
                        // validate id exists in known platforms
                        if (!EMULATOR_PLATFORMS.some((p) => p.id === id)) continue;
                        cleaned.push({
                            id,
                            enabled: Boolean(r.enabled),
                            romPath: String(r.romPath ?? ""),
                            biosPath: r.biosPath != null ? String(r.biosPath) : null,
                            core: r.core != null ? String(r.core) : null,
                        });
                    }
                    emu.platforms = cleaned;
                }
            }

            // single platform patch via body.platform
            if (body.platform !== undefined && body.platform !== null && typeof body.platform === "object") {
                const r = body.platform as Record<string, unknown>;
                const id = String(r.id ?? "");
                if (id && EMULATOR_PLATFORMS.some((p) => p.id === id)) {
                    const platforms = (emu.platforms ?? []) as Array<Record<string, unknown>>;
                    const idx = platforms.findIndex((p) => String(p.id) === id);
                    const entry: Record<string, unknown> = {
                        id,
                        enabled: r.enabled !== undefined ? Boolean(r.enabled) : (idx >= 0 ? Boolean(platforms[idx].enabled) : false),
                        romPath: r.romPath !== undefined ? String(r.romPath) : (idx >= 0 ? String(platforms[idx].romPath ?? "") : ""),
                        biosPath: r.biosPath !== undefined ? (r.biosPath === null ? null : String(r.biosPath)) : (idx >= 0 ? (platforms[idx].biosPath as string | null) : null),
                        core: r.core !== undefined ? (r.core === null ? null : String(r.core)) : (idx >= 0 ? (platforms[idx].core as string | null) : null),
                    };
                    if (idx >= 0) platforms[idx] = entry;
                    else platforms.push(entry);
                    emu.platforms = platforms;
                }
            }
        });

        const cfg = load() as Record<string, unknown>;
        return { ok: true, data: cfg.emulator };
    });

    // GET roms for a platform
    app.get("/api/emulator/roms", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const query = (request.query ?? {}) as Record<string, string>;
        const platform = String(query.platform ?? "").trim();
        if (!platform) return reply.code(400).send({ ok: false, error: "platform obrigatório" });
        const plat = EMULATOR_PLATFORMS.find((p) => p.id === platform);
        if (!plat) return reply.code(400).send({ ok: false, error: "plataforma desconhecida" });

        const cfg = load() as Record<string, unknown>;
        const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
        const platforms = (emu.platforms ?? []) as Array<Record<string, unknown>>;
        const pCfg = platforms.find((p) => String(p.id) === platform);
        const romPath = String(pCfg?.romPath ?? "").trim();
        if (!romPath) return { ok: true, platform, romPath: "", roms: [] };

        if (!existsSync(romPath) || !statSync(romPath).isDirectory()) {
            return { ok: true, platform, romPath, roms: [], warning: "pasta não encontrada" };
        }

        // determine allowed exts (use core override if present)
        const core = pCfg?.core ? String(pCfg.core) : plat.core;
        const exts = CORE_TO_EXTS.get(core) ?? ALLOWED_EXTS.get(platform) ?? new Set(plat.exts);

        let files: string[] = [];
        try {
            files = readdirSync(romPath);
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }

        const roms: Array<{ name: string; file: string; ext: string; size: number | null; meta?: Record<string, unknown> | null }> = [];
        const metaMap = getGameMetaMap();
        for (const f of files) {
            const full = join(romPath, f);
            let st: ReturnType<typeof statSync> | null = null;
            try {
                st = statSync(full);
            } catch { continue; }
            if (!st.isFile()) continue;
            const ext = extname(f).slice(1).toLowerCase();
            if (!exts.has(ext)) continue;
            const key = gameKey(platform, f);
            roms.push({ name: basename(f, extname(f)), file: f, ext, size: st.size, meta: metaMap[key] ?? null });
        }
        roms.sort((a, b) => a.name.localeCompare(b.name));
        return { ok: true, platform, romPath, roms };
    });

    // GET all roms grouped by platform (for unified card)
    app.get("/api/emulator/roms/all", { schema: { tags: ["Emulador"] } }, async (_request, _reply) => {
        const cfg = load() as Record<string, unknown>;
        const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
        const platforms = (emu.platforms ?? []) as Array<Record<string, unknown>>;
        const enabled = platforms.filter((p) => Boolean(p.enabled));
        const groups: Array<{ platform: string; label: string; core: string; romPath: string; roms: Array<{ name: string; file: string; ext: string; size: number | null }>; warning?: string }> = [];
        for (const pCfg of enabled) {
            const platform = String(pCfg.id);
            const plat = EMULATOR_PLATFORMS.find((x) => x.id === platform);
            if (!plat) continue;
            const romPath = String(pCfg.romPath ?? "").trim();
            const core = pCfg.core ? String(pCfg.core) : plat.core;
            const exts = CORE_TO_EXTS.get(core) ?? ALLOWED_EXTS.get(platform) ?? new Set(plat.exts);
            let roms: Array<{ name: string; file: string; ext: string; size: number | null; meta?: Record<string, unknown> | null }> = [];
            let warning: string | undefined;
            const metaMap = getGameMetaMap();
            if (!romPath) {
                warning = "pasta não configurada";
            } else if (!existsSync(romPath) || !statSync(romPath).isDirectory()) {
                warning = "pasta não encontrada";
            } else {
                try {
                    const files = readdirSync(romPath);
                    for (const f of files) {
                        const full = join(romPath, f);
                        let st: ReturnType<typeof statSync> | null = null;
                        try { st = statSync(full); } catch { continue; }
                        if (!st.isFile()) continue;
                        const ext = extname(f).slice(1).toLowerCase();
                        if (!exts.has(ext)) continue;
                        const key = gameKey(platform, f);
                        roms.push({ name: basename(f, extname(f)), file: f, ext, size: st.size, meta: metaMap[key] ?? null });
                    }
                    roms.sort((a, b) => a.name.localeCompare(b.name));
                } catch (e) {
                    warning = String(e);
                }
            }
            groups.push({ platform, label: plat.label, core, romPath, roms, warning });
        }
        return { ok: true, groups };
    });

    // GET rom file
    app.get("/api/emulator/rom/:platform/:file", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform, file } = request.params as { platform: string; file: string };
        const plat = EMULATOR_PLATFORMS.find((p) => p.id === platform);
        if (!plat) return reply.code(400).send({ ok: false, error: "plataforma desconhecida" });

        const cfg = load() as Record<string, unknown>;
        const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
        const platforms = (emu.platforms ?? []) as Array<Record<string, unknown>>;
        const pCfg = platforms.find((p) => String(p.id) === platform);
        const romPath = String(pCfg?.romPath ?? "").trim();
        if (!romPath) return reply.code(404).send({ ok: false, error: "romPath não configurado" });

        const safe = safeJoin(romPath, file);
        if (!safe) return reply.code(400).send({ ok: false, error: "caminho inválido" });
        if (!existsSync(safe) || !statSync(safe).isFile()) {
            return reply.code(404).send({ ok: false, error: "arquivo não encontrado" });
        }

        // check ext allowed
        const ext = extname(file).slice(1).toLowerCase();
        const core = pCfg?.core ? String(pCfg.core) : plat.core;
        const exts = CORE_TO_EXTS.get(core) ?? ALLOWED_EXTS.get(platform) ?? new Set(plat.exts);
        if (!exts.has(ext)) return reply.code(400).send({ ok: false, error: "extensão não suportada para esta plataforma" });

        const stream = createReadStream(safe);
        const stat = statSync(safe);
        reply.header("Content-Length", String(stat.size));
        reply.header("Content-Type", "application/octet-stream");
        reply.header("Content-Disposition", `inline; filename="${basename(file)}"`);
        reply.header("Cache-Control", "public, max-age=3600");
        return reply.send(stream);
    });

    // GET bios file (similar, but from biosFolder or per-platform biosPath)
    app.get("/api/emulator/bios/:platform", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform } = request.params as { platform: string };
        const plat = EMULATOR_PLATFORMS.find((p) => p.id === platform);
        if (!plat) return reply.code(400).send({ ok: false, error: "plataforma desconhecida" });

        const cfg = load() as Record<string, unknown>;
        const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
        const platforms = (emu.platforms ?? []) as Array<Record<string, unknown>>;
        const pCfg = platforms.find((p) => String(p.id) === platform);
        const biosPath = pCfg?.biosPath ? String(pCfg.biosPath) : String(emu.biosFolder ?? "").trim();
        if (!biosPath) return reply.code(404).send({ ok: false, error: "bios não configurado" });

        // biosPath can be file or folder
        let filePath = biosPath;
        if (existsSync(biosPath) && statSync(biosPath).isDirectory()) {
            // try to find any file in folder — return first? Better list
            return reply.code(400).send({ ok: false, error: "biosFolder é pasta — use /api/emulator/bios/:platform/:file" });
        }
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
            return reply.code(404).send({ ok: false, error: "bios não encontrado" });
        }
        const stream = createReadStream(filePath);
        const stat = statSync(filePath);
        reply.header("Content-Length", String(stat.size));
        reply.header("Content-Type", "application/octet-stream");
        reply.header("Content-Disposition", `inline; filename="${basename(filePath)}"`);
        return reply.send(stream);
    });

    app.get("/api/emulator/bios/:platform/:file", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform, file } = request.params as { platform: string; file: string };
        const cfg = load() as Record<string, unknown>;
        const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
        const biosFolder = String(emu.biosFolder ?? "").trim();
        if (!biosFolder) return reply.code(404).send({ ok: false, error: "biosFolder não configurado" });
        const safe = safeJoin(biosFolder, file);
        if (!safe) return reply.code(400).send({ ok: false, error: "caminho inválido" });
        if (!existsSync(safe) || !statSync(safe).isFile()) {
            return reply.code(404).send({ ok: false, error: "bios não encontrado" });
        }
        const stream = createReadStream(safe);
        const stat = statSync(safe);
        reply.header("Content-Length", String(stat.size));
        reply.header("Content-Type", "application/octet-stream");
        return reply.send(stream);
    });

    // GET platforms meta (for frontend to know exts, labels)
    app.get("/api/emulator/platforms", { schema: { tags: ["Emulador"] } }, async () => {
        return { ok: true, platforms: EMULATOR_PLATFORMS };
    });

    // ── IGDB ──────────────────────────────────────────────────────────────
    app.get("/api/emulator/igdb/status", { schema: { tags: ["Emulador"] } }, async () => {
        return { ok: true, configured: igdbConfigured() };
    });

    app.get("/api/emulator/igdb/search", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const q = String((request.query as Record<string, string>)?.q ?? "").trim();
        if (!q) return reply.code(400).send({ ok: false, error: "q obrigatório" });
        if (!igdbConfigured()) return reply.code(400).send({ ok: false, error: "IGDB não configurado — preencha Client ID e Secret em Configurações > Emulador" });
        const limitRaw = Number((request.query as Record<string, string>)?.limit ?? 10);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, Math.floor(limitRaw))) : 10;
        try {
            const results = await searchIgdbGames(q, limit);
            const mapped = results.map((g) => mapIgdbGame(g));
            return { ok: true, results: mapped };
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
    });

    app.get("/api/emulator/igdb/game/:id", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "id inválido" });
        if (!igdbConfigured()) return reply.code(400).send({ ok: false, error: "IGDB não configurado" });
        try {
            const g = await getIgdbGameById(id);
            if (!g) return reply.code(404).send({ ok: false, error: "jogo não encontrado" });
            return { ok: true, game: mapIgdbGame(g) };
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
    });

    function mapIgdbGame(g: import("../providers/igdb.js").IgdbGame) {
        const developers = (g.involved_companies ?? []).filter((c) => c.developer).map((c) => c.company.name);
        const publishers = (g.involved_companies ?? []).filter((c) => c.publisher).map((c) => c.company.name);
        return {
            id: g.id,
            name: g.name,
            summary: g.summary ?? null,
            storyline: g.storyline ?? null,
            coverImageId: g.cover?.image_id ?? null,
            coverUrl: g.cover?.image_id ? igdbCoverUrl(g.cover.image_id, "cover_big") : null,
            firstReleaseDate: g.first_release_date ?? null,
            rating: g.rating ?? null,
            aggregatedRating: g.aggregated_rating ?? null,
            totalRating: g.total_rating ?? null,
            ratingCount: g.rating_count ?? null,
            url: g.url ?? null,
            genres: g.genres?.map((x) => x.name) ?? null,
            themes: g.themes?.map((x) => x.name) ?? null,
            gameModes: g.game_modes?.map((x) => x.name) ?? null,
            playerPerspectives: g.player_perspectives?.map((x) => x.name) ?? null,
            platforms: g.platforms ?? null,
            developers: developers.length ? developers : null,
            publishers: publishers.length ? publishers : null,
            screenshots: g.screenshots?.map((s) => igdbScreenshotUrl(s.image_id, "screenshot_big")) ?? null,
            artworks: g.artworks?.map((a) => igdbArtworkUrl(a.image_id, "720p")) ?? null,
            videos: g.videos?.map((v) => ({ name: v.name, videoId: v.video_id })) ?? null,
            releaseDates: g.release_dates?.map((r) => ({ human: r.human, region: r.region ?? null, date: r.date ?? null })) ?? null,
        };
    }

    // ── Game meta (capas IGDB por ROM) ───────────────────────────────────
    app.get("/api/emulator/game-meta", { schema: { tags: ["Emulador"] } }, async () => {
        return { ok: true, gameMeta: getGameMetaMap() };
    });

    app.patch("/api/emulator/game-meta", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (!body) return reply.code(400).send({ ok: false, error: "corpo vazio" });
        const platform = String(body.platform ?? "").trim();
        const file = String(body.file ?? "").trim();
        if (!platform || !file) return reply.code(400).send({ ok: false, error: "platform e file obrigatórios" });
        const key = gameKey(platform, file);
        // se body.clear === true, remove
        if (body.clear === true) {
            update((cfg) => {
                const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
                const gm = (emu.gameMeta ?? {}) as Record<string, unknown>;
                delete gm[key];
                emu.gameMeta = gm;
            });
            return { ok: true, cleared: true };
        }
        const igdbId = body.igdbId != null ? Number(body.igdbId) : null;
        const name = body.name != null ? String(body.name) : null;
        const coverImageId = body.coverImageId != null ? String(body.coverImageId) : null;
        const coverUrl = body.coverUrl != null ? String(body.coverUrl) : (coverImageId ? igdbCoverUrl(coverImageId, "cover_big") : null);
        const summary = body.summary != null ? String(body.summary) : null;
        const storyline = body.storyline != null ? String(body.storyline) : null;
        const firstReleaseDate = body.firstReleaseDate != null ? Number(body.firstReleaseDate) : null;
        const rating = body.rating != null ? Number(body.rating) : null;
        const aggregatedRating = body.aggregatedRating != null ? Number(body.aggregatedRating) : null;
        const totalRating = body.totalRating != null ? Number(body.totalRating) : null;
        const ratingCount = body.ratingCount != null ? Number(body.ratingCount) : null;
        const url = body.url != null ? String(body.url) : null;
        const genres = Array.isArray(body.genres) ? (body.genres as unknown[]).map(String) : null;
        const themes = Array.isArray(body.themes) ? (body.themes as unknown[]).map(String) : null;
        const gameModes = Array.isArray(body.gameModes) ? (body.gameModes as unknown[]).map(String) : null;
        const playerPerspectives = Array.isArray(body.playerPerspectives) ? (body.playerPerspectives as unknown[]).map(String) : null;
        const platforms = Array.isArray(body.platforms) ? body.platforms as unknown as Array<{ id: number; name: string; abbreviation?: string }> : null;
        const developers = Array.isArray(body.developers) ? (body.developers as unknown[]).map(String) : null;
        const publishers = Array.isArray(body.publishers) ? (body.publishers as unknown[]).map(String) : null;
        const screenshots = Array.isArray(body.screenshots) ? (body.screenshots as unknown[]).map(String) : null;
        const artworks = Array.isArray(body.artworks) ? (body.artworks as unknown[]).map(String) : null;
        const videos = Array.isArray(body.videos) ? body.videos as unknown as Array<{ name: string; videoId: string }> : null;
        const releaseDates = Array.isArray(body.releaseDates) ? body.releaseDates as unknown as Array<{ human: string; region: number | null; date: number | null }> : null;
        update((cfg) => {
            const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
            const gm = (emu.gameMeta ?? {}) as Record<string, unknown>;
            gm[key] = {
                platform,
                file,
                igdbId: Number.isFinite(igdbId as number) ? igdbId : null,
                name,
                coverUrl,
                coverImageId,
                summary,
                storyline,
                firstReleaseDate: Number.isFinite(firstReleaseDate as number) ? firstReleaseDate : null,
                rating: Number.isFinite(rating as number) ? rating : null,
                aggregatedRating: Number.isFinite(aggregatedRating as number) ? aggregatedRating : null,
                totalRating: Number.isFinite(totalRating as number) ? totalRating : null,
                ratingCount: Number.isFinite(ratingCount as number) ? ratingCount : null,
                url,
                genres,
                themes,
                gameModes,
                playerPerspectives,
                platforms,
                developers,
                publishers,
                screenshots,
                artworks,
                videos,
                releaseDates,
                updatedAt: new Date().toISOString(),
            };
            emu.gameMeta = gm;
        });
        return { ok: true, key, gameMeta: getGameMetaMap()[key] };
    });

    app.delete("/api/emulator/game-meta/:platform/:file", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform, file } = request.params as { platform: string; file: string };
        const key = gameKey(platform, file);
        const before = getGameMetaMap()[key];
        if (!before) return reply.code(404).send({ ok: false, error: "metadado não encontrado" });
        update((cfg) => {
            const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
            const gm = (emu.gameMeta ?? {}) as Record<string, unknown>;
            delete gm[key];
            emu.gameMeta = gm;
        });
        return { ok: true, cleared: true };
    });

    // ── Saves (sincronizados no servidor) ────────────────────────────────
    // Lista saves existentes
    app.get("/api/emulator/saves", { schema: { tags: ["Emulador"] } }, async () => {
        ensureSavesDir();
        let files: string[] = [];
        try { files = readdirSync(savesDir()); } catch { files = []; }
        const saves: Array<{ platform: string; game: string; kind: "sram" | "state"; file: string; size: number; mtime: string | null }> = [];
        for (const f of files) {
            const full = join(savesDir(), f);
            let st: ReturnType<typeof statSync> | null = null;
            try { st = statSync(full); } catch { continue; }
            if (!st.isFile()) continue;
            const isState = f.endsWith(".state");
            const isSrm = f.endsWith(".srm");
            if (!isState && !isSrm) continue;
            const kind: "sram" | "state" = isState ? "state" : "sram";
            // parse platform__game.ext
            const sep = f.indexOf("__");
            const platform = sep >= 0 ? f.slice(0, sep) : "unknown";
            const game = sep >= 0 ? f.slice(sep + 2).replace(/\.(state|srm)$/, "") : f.replace(/\.(state|srm)$/, "");
            saves.push({ platform, game, kind, file: f, size: st.size, mtime: st.mtime.toISOString() });
        }
        saves.sort((a, b) => (b.mtime ?? "").localeCompare(a.mtime ?? ""));
        return { ok: true, saves };
    });

    // Baixa um save específico
    app.get("/api/emulator/saves/:platform/:game/:kind", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform, game, kind } = request.params as { platform: string; game: string; kind: string };
        if (kind !== "sram" && kind !== "state") return reply.code(400).send({ ok: false, error: "kind deve ser sram ou state" });
        const plat = sanitizeSegment(platform);
        const g = sanitizeSegment(game);
        if (!plat || !g) return reply.code(400).send({ ok: false, error: "parâmetros inválidos" });
        const filePath = saveFilePath(plat, g, kind as "sram" | "state");
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
            return reply.code(404).send({ ok: false, error: "save não encontrado" });
        }
        const st = statSync(filePath);
        reply.header("Content-Length", String(st.size));
        reply.header("Content-Type", "application/octet-stream");
        reply.header("Content-Disposition", `attachment; filename="${basename(filePath)}"`);
        reply.header("Cache-Control", "no-store");
        return reply.send(createReadStream(filePath));
    });

    // Faz upload/salva um save (body = bytes brutos)
    app.put("/api/emulator/saves/:platform/:game/:kind", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform, game, kind } = request.params as { platform: string; game: string; kind: string };
        if (kind !== "sram" && kind !== "state") return reply.code(400).send({ ok: false, error: "kind deve ser sram ou state" });
        const plat = sanitizeSegment(platform);
        const g = sanitizeSegment(game);
        if (!plat || !g) return reply.code(400).send({ ok: false, error: "parâmetros inválidos" });
        ensureSavesDir();
        const filePath = saveFilePath(plat, g, kind as "sram" | "state");
        // body pode vir como Buffer (catch-all parser) ou objeto
        const body = (request as unknown as { body?: unknown }).body;
        let buf: Buffer | null = null;
        if (Buffer.isBuffer(body)) buf = body;
        else if (body instanceof Uint8Array) buf = Buffer.from(body);
        else if (typeof body === "string") buf = Buffer.from(body, "binary");
        else if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
            // fallback: JSON com base64
            const b64 = String((body as Record<string, unknown>).data ?? "");
            try { buf = Buffer.from(b64, "base64"); } catch { buf = null; }
        }
        if (!buf || buf.length === 0) {
            return reply.code(400).send({ ok: false, error: "corpo vazio — envie bytes do save" });
        }
        if (buf.length > 64 * 1024 * 1024) {
            return reply.code(413).send({ ok: false, error: "save muito grande (limite 64 MB)" });
        }
        try {
            writeFileSync(filePath, buf);
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
        const st = statSync(filePath);
        return { ok: true, platform: plat, game: g, kind, size: st.size, mtime: st.mtime.toISOString() };
    });

    // Deleta um save
    app.delete("/api/emulator/saves/:platform/:game/:kind", { schema: { tags: ["Emulador"] } }, async (request, reply) => {
        const { platform, game, kind } = request.params as { platform: string; game: string; kind: string };
        if (kind !== "sram" && kind !== "state") return reply.code(400).send({ ok: false, error: "kind deve ser sram ou state" });
        const plat = sanitizeSegment(platform);
        const g = sanitizeSegment(game);
        const filePath = saveFilePath(plat, g, kind as "sram" | "state");
        if (!existsSync(filePath)) return reply.code(404).send({ ok: false, error: "save não encontrado" });
        try { unlinkSync(filePath); } catch (e) { return reply.code(500).send({ ok: false, error: String(e) }); }
        return { ok: true, deleted: true };
    });
}
