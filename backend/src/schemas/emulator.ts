import { z } from "zod";

export const EMULATOR_CDN_VERSIONS = ["stable", "latest", "nightly"] as const;
export type EmulatorCdnVersion = typeof EMULATOR_CDN_VERSIONS[number];

export const EMULATOR_ICON_THEMES = ["monochrome", "flatux", "daite"] as const;
export type EmulatorIconTheme = typeof EMULATOR_ICON_THEMES[number];

export const EMULATOR_PLATFORMS = [
    { id: "nes", label: "NES / Famicom", core: "nes", exts: ["nes", "fds", "unif", "unf"], needsBios: false },
    { id: "snes", label: "SNES / Super Famicom", core: "snes", exts: ["smc", "fig", "sfc", "gd3", "gd7", "dx2", "bsx", "swc"], needsBios: false },
    { id: "n64", label: "Nintendo 64", core: "n64", exts: ["z64", "n64"], needsBios: false, warning: "Desempenho limitado no navegador (20-35fps). Alguns jogos têm lentidão ou falhas gráficas." },
    { id: "gb", label: "Game Boy / Game Boy Color", core: "gambatte", exts: ["gb", "gbc", "dmg"], needsBios: false },
    { id: "gba", label: "Game Boy Advance", core: "gba", exts: ["gba"], needsBios: false },
    { id: "nds", label: "Nintendo DS", core: "nds", exts: ["nds"], needsBios: true, warning: "Requer 3 arquivos de BIOS. Toque pode falhar em mobile. Desempenho mediano." },
    { id: "psx", label: "PlayStation", core: "psx", exts: ["cue", "bin", "iso", "img", "pbp", "chd", "ccd", "mds"], needsBios: true },
    { id: "segaMD", label: "Mega Drive / Genesis", core: "segaMD", exts: ["md", "sg", "smd", "gen", "bin"], needsBios: false },
    { id: "segaMS", label: "Master System", core: "segaMS", exts: ["sms"], needsBios: false },
    { id: "segaGG", label: "Game Gear", core: "segaGG", exts: ["gg"], needsBios: false },
    { id: "segaCD", label: "Sega CD", core: "segaCD", exts: ["cue", "bin", "iso", "chd"], needsBios: true },
    { id: "sega32x", label: "Sega 32X", core: "sega32x", exts: ["32x"], needsBios: false, warning: "Biblioteca muito pequena — poucos jogos utilizam este hardware." },
    { id: "atari2600", label: "Atari 2600", core: "atari2600", exts: ["a26"], needsBios: false },
    { id: "atari7800", label: "Atari 7800", core: "atari7800", exts: ["a78"], needsBios: true },
    { id: "lynx", label: "Atari Lynx", core: "lynx", exts: ["lnx"], needsBios: false },
    { id: "arcade", label: "Arcade", core: "arcade", exts: ["zip"], needsBios: false },
    { id: "mame2003", label: "MAME 2003", core: "mame2003", exts: ["zip"], needsBios: false },
    { id: "vb", label: "Virtual Boy", core: "vb", exts: ["vb"], needsBios: false },
    { id: "coleco", label: "ColecoVision", core: "coleco", exts: ["col", "cv"], needsBios: false },
    { id: "pce", label: "PC Engine / TurboGrafx-16", core: "pce", exts: ["pce"], needsBios: false },
    { id: "ngp", label: "Neo Geo Pocket", core: "ngp", exts: ["ngp", "ngc"], needsBios: false },
    { id: "ws", label: "WonderSwan", core: "ws", exts: ["ws", "wsc"], needsBios: false },
    { id: "c64", label: "Commodore 64", core: "vice_x64sc", exts: ["d64"], needsBios: false },
] as const;

export type EmulatorPlatformId = typeof EMULATOR_PLATFORMS[number]["id"];

export const EmulatorPlatformConfigSchema = z.object({
    id: z.string(),
    enabled: z.boolean().default(false),
    romPath: z.string().default(""),
    biosPath: z.string().nullable().default(null),
    core: z.string().nullable().default(null),
});
export type EmulatorPlatformConfig = z.infer<typeof EmulatorPlatformConfigSchema>;

export const EmulatorIgdbConfigSchema = z.object({
    clientId: z.string().default(""),
    clientSecret: z.string().default(""),
});
export type EmulatorIgdbConfig = z.infer<typeof EmulatorIgdbConfigSchema>;

export const EmulatorGameMetaSchema = z.object({
    platform: z.string(),
    file: z.string(),
    igdbId: z.number().nullable().default(null),
    name: z.string().nullable().default(null),
    coverUrl: z.string().nullable().default(null),
    coverImageId: z.string().nullable().default(null),
    summary: z.string().nullable().default(null),
    storyline: z.string().nullable().default(null),
    firstReleaseDate: z.number().nullable().default(null),
    rating: z.number().nullable().default(null),
    aggregatedRating: z.number().nullable().default(null),
    totalRating: z.number().nullable().default(null),
    ratingCount: z.number().nullable().default(null),
    url: z.string().nullable().default(null),
    genres: z.array(z.string()).nullable().default(null),
    themes: z.array(z.string()).nullable().default(null),
    gameModes: z.array(z.string()).nullable().default(null),
    playerPerspectives: z.array(z.string()).nullable().default(null),
    platforms: z.array(z.object({ id: z.number(), name: z.string(), abbreviation: z.string().optional() })).nullable().default(null),
    developers: z.array(z.string()).nullable().default(null),
    publishers: z.array(z.string()).nullable().default(null),
    screenshots: z.array(z.string()).nullable().default(null),
    artworks: z.array(z.string()).nullable().default(null),
    videos: z.array(z.object({ name: z.string(), videoId: z.string() })).nullable().default(null),
    releaseDates: z.array(z.object({ human: z.string(), region: z.number().nullable().default(null), date: z.number().nullable().default(null) })).nullable().default(null),
    updatedAt: z.string().nullable().default(null),
});
export type EmulatorGameMeta = z.infer<typeof EmulatorGameMetaSchema>;

export const EmulatorConfigSchema = z.object({
    enabled: z.boolean().default(false),
    hidden: z.boolean().default(false),
    cdnVersion: z.enum(EMULATOR_CDN_VERSIONS).default("stable"),
    cacheEnabled: z.boolean().default(true),
    volume: z.number().min(0).max(1).default(1),
    startOnLoaded: z.boolean().default(true),
    fullscreenOnLoad: z.boolean().default(false),
    color: z.string().nullable().default(null),
    backgroundBlur: z.boolean().default(false),
    softLoad: z.boolean().default(false),
    disableCue: z.boolean().default(false),
    language: z.string().default("pt-BR"),
    saveFolder: z.string().default(""),
    biosFolder: z.string().default(""),
    defaultOptions: z.record(z.unknown()).default({}),
    // controle
    disableAutoUnload: z.boolean().default(false),
    disableBatchBootup: z.boolean().default(false),
    noAutoFocus: z.boolean().default(false),
    hideSettings: z.boolean().default(false),
    // tema de ícones RetroArch XMB (cdn, sem download local)
    iconTheme: z.enum(EMULATOR_ICON_THEMES).default("monochrome"),
    // IGDB
    igdb: EmulatorIgdbConfigSchema.default({ clientId: "", clientSecret: "" }),
    // plataformas
    platforms: z.array(EmulatorPlatformConfigSchema).default([]),
    // metadados de jogos (chave = "platform::file")
    gameMeta: z.record(EmulatorGameMetaSchema).default({}),
});
export type EmulatorConfig = z.infer<typeof EmulatorConfigSchema>;

export const EmulatorRomSchema = z.object({
    name: z.string(),
    file: z.string(),
    ext: z.string(),
    size: z.number().nullable().default(null),
});
export type EmulatorRom = z.infer<typeof EmulatorRomSchema>;

export const EmulatorSaveSchema = z.object({
    platform: z.string(),
    game: z.string(),
    type: z.enum(["state", "sram", "save"]),
    data: z.string().nullable().default(null),
    updatedAt: z.string().nullable().default(null),
});
export type EmulatorSave = z.infer<typeof EmulatorSaveSchema>;
