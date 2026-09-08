/**
 * RetroArch XMB icon themes via CDN (jsDelivr).
 * Nenhum arquivo é baixado para o projeto — uso direto via URL.
 * Fallback para emoji 🎮 quando o download falhar.
 *
 * Temas:
 * - monochrome (default) — https://github.com/libretro/retroarch-assets/tree/master/xmb/monochrome/png
 * - flatux — https://github.com/libretro/retroarch-assets/tree/master/xmb/flatux/png
 * - daite — https://github.com/libretro/retroarch-assets/tree/master/xmb/daite/png
 */

export type RetroarchTheme = "monochrome" | "flatux" | "daite";

export const RETROARCH_THEMES: Array<{ value: RetroarchTheme; label: string }> = [
    { value: "monochrome", label: "Monochrome (padrão)" },
    { value: "flatux", label: "FlatUX" },
    { value: "daite", label: "Daite" },
];

const CDN_BASE = "https://cdn.jsdelivr.net/gh/libretro/retroarch-assets@master";

/**
 * Mapeamento de platform id (EMULATOR_PLATFORMS) -> nome do arquivo PNG no retroarch-assets.
 * Arquivos verificados em xmb/{monochrome,flatux,daite}/png
 */
export const PLATFORM_ICON_FILE: Record<string, string> = {
    nes: "Nintendo - Nintendo Entertainment System.png",
    snes: "Nintendo - Super Nintendo Entertainment System.png",
    n64: "Nintendo - Nintendo 64.png",
    gb: "Nintendo - Game Boy.png",
    gba: "Nintendo - Game Boy Advance.png",
    nds: "Nintendo - Nintendo DS.png",
    psx: "Sony - PlayStation.png",
    segaMD: "Sega - Mega Drive - Genesis.png",
    segaMS: "Sega - Master System - Mark III.png",
    segaGG: "Sega - Game Gear.png",
    segaCD: "Sega - Mega-CD - Sega CD.png",
    sega32x: "Sega - 32X.png",
    atari2600: "Atari - 2600.png",
    atari7800: "Atari - 7800.png",
    lynx: "Atari - Lynx.png",
    arcade: "FBNeo - Arcade Games.png",
    mame2003: "MAME 2003.png",
    vb: "Nintendo - Virtual Boy.png",
    coleco: "Coleco - ColecoVision.png",
    pce: "NEC - PC Engine - TurboGrafx 16.png",
    ngp: "SNK - Neo Geo Pocket.png",
    ws: "Bandai - WonderSwan.png",
    c64: "Commodore - 64.png",
};

/** Ícone genérico para header / fallback quando platform === "all" */
export const GENERIC_ICON_FILE = "retroarch.png";

export function getRetroarchIconFilename(platformId: string): string | null {
    if (platformId === "all") return GENERIC_ICON_FILE;
    return PLATFORM_ICON_FILE[platformId] ?? null;
}

export function getRetroarchIconUrl(
    platformId: string,
    theme: RetroarchTheme = "monochrome",
): string | null {
    const file = getRetroarchIconFilename(platformId);
    if (!file) return null;
    // encode filename para URL (espaços, hífens, etc)
    const encoded = encodeURIComponent(file).replace(/%2F/g, "/");
    return `${CDN_BASE}/xmb/${theme}/png/${encoded}`;
}

/** Lista todos os temas disponíveis para um platform (para debug) */
export function getAllThemeUrls(platformId: string): Record<RetroarchTheme, string | null> {
    return {
        monochrome: getRetroarchIconUrl(platformId, "monochrome"),
        flatux: getRetroarchIconUrl(platformId, "flatux"),
        daite: getRetroarchIconUrl(platformId, "daite"),
    };
}
