import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getIgdbGameById, igdbConfigured, igdbCoverUrl, searchIgdbGames } from "../providers/igdb.js";
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

export async function createEmulatorRoutes(app: FastifyInstance): Promise<void> {
    // GET config
    app.get("/api/emulator/config", async () => {
        const cfg = load() as Record<string, unknown>;
        return (cfg.emulator ?? {}) as Record<string, unknown>;
    });

    // PATCH config — global settings + platforms
    app.patch("/api/emulator/config", async (request, reply) => {
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

        update((cfg: Record<string, unknown>) => {
            const emu = (cfg.emulator ?? {}) as Record<string, unknown>;
            if (!cfg.emulator) cfg.emulator = emu;

            const fields: Array<[string, unknown]> = [
                ["enabled", body.enabled],
                ["hidden", body.hidden],
                ["cdnVersion", body.cdnVersion],
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
    app.get("/api/emulator/roms", async (request, reply) => {
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
    app.get("/api/emulator/roms/all", async (_request, _reply) => {
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
    app.get("/api/emulator/rom/:platform/:file", async (request, reply) => {
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
    app.get("/api/emulator/bios/:platform", async (request, reply) => {
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

    app.get("/api/emulator/bios/:platform/:file", async (request, reply) => {
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
    app.get("/api/emulator/platforms", async () => {
        return { ok: true, platforms: EMULATOR_PLATFORMS };
    });

    // ── IGDB ──────────────────────────────────────────────────────────────
    app.get("/api/emulator/igdb/status", async () => {
        return { ok: true, configured: igdbConfigured() };
    });

    app.get("/api/emulator/igdb/search", async (request, reply) => {
        const q = String((request.query as Record<string, string>)?.q ?? "").trim();
        if (!q) return reply.code(400).send({ ok: false, error: "q obrigatório" });
        if (!igdbConfigured()) return reply.code(400).send({ ok: false, error: "IGDB não configurado — preencha Client ID e Secret em Configurações > Emulador" });
        const limitRaw = Number((request.query as Record<string, string>)?.limit ?? 10);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, Math.floor(limitRaw))) : 10;
        try {
            const results = await searchIgdbGames(q, limit);
            const mapped = results.map((g) => ({
                id: g.id,
                name: g.name,
                summary: g.summary ?? null,
                coverImageId: g.cover?.image_id ?? null,
                coverUrl: g.cover?.image_id ? igdbCoverUrl(g.cover.image_id, "cover_big") : null,
                firstReleaseDate: g.first_release_date ?? null,
                rating: g.rating ?? null,
                platforms: g.platforms ?? null,
            }));
            return { ok: true, results: mapped };
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
    });

    app.get("/api/emulator/igdb/game/:id", async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) return reply.code(400).send({ ok: false, error: "id inválido" });
        if (!igdbConfigured()) return reply.code(400).send({ ok: false, error: "IGDB não configurado" });
        try {
            const g = await getIgdbGameById(id);
            if (!g) return reply.code(404).send({ ok: false, error: "jogo não encontrado" });
            return {
                ok: true,
                game: {
                    id: g.id,
                    name: g.name,
                    summary: g.summary ?? null,
                    coverImageId: g.cover?.image_id ?? null,
                    coverUrl: g.cover?.image_id ? igdbCoverUrl(g.cover.image_id, "cover_big") : null,
                    firstReleaseDate: g.first_release_date ?? null,
                    rating: g.rating ?? null,
                    platforms: g.platforms ?? null,
                },
            };
        } catch (e) {
            return reply.code(500).send({ ok: false, error: String(e) });
        }
    });

    // ── Game meta (capas IGDB por ROM) ───────────────────────────────────
    app.get("/api/emulator/game-meta", async () => {
        return { ok: true, gameMeta: getGameMetaMap() };
    });

    app.patch("/api/emulator/game-meta", async (request, reply) => {
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
        const firstReleaseDate = body.firstReleaseDate != null ? Number(body.firstReleaseDate) : null;
        const rating = body.rating != null ? Number(body.rating) : null;
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
                firstReleaseDate: Number.isFinite(firstReleaseDate as number) ? firstReleaseDate : null,
                rating: Number.isFinite(rating as number) ? rating : null,
                updatedAt: new Date().toISOString(),
            };
            emu.gameMeta = gm;
        });
        return { ok: true, key, gameMeta: getGameMetaMap()[key] };
    });

    app.delete("/api/emulator/game-meta/:platform/:file", async (request, reply) => {
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
}
