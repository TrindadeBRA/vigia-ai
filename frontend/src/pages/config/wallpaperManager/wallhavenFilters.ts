export type WallhavenSorting = "date_added" | "relevance" | "random" | "views" | "favorites" | "toplist";
export type WallhavenOrder = "desc" | "asc";
export type WallhavenTopRange = "1d" | "3d" | "1w" | "1M" | "3M" | "6M" | "1y";

export type WallhavenFilters = {
    categories: string; // 3 chars 0/1 e.g. "111"
    purity: string; // 3 chars 0/1 e.g. "100"
    sorting: WallhavenSorting;
    order: WallhavenOrder;
    topRange: WallhavenTopRange;
    atleast: string; // e.g. "1920x1080" or ""
    resolutions: string; // comma separated e.g. "1920x1080,2560x1440" or ""
    ratios: string; // comma separated e.g. "16x9" or ""
    colors: string; // hex without # e.g. "660000" or ""
    seed: string; // 6 chars for random
};

export const WALLHAVEN_DEFAULTS: WallhavenFilters = {
    categories: "111",
    purity: "100",
    sorting: "relevance",
    order: "desc",
    topRange: "1M",
    atleast: "",
    resolutions: "",
    ratios: "",
    colors: "",
    seed: "",
};

export const WALLHAVEN_SORTING_OPTIONS: Array<{ value: WallhavenSorting; label: string }> = [
    { value: "relevance", label: "Relevância" },
    { value: "date_added", label: "Mais recentes" },
    { value: "views", label: "Mais vistos" },
    { value: "favorites", label: "Mais favoritos" },
    { value: "toplist", label: "Top lista" },
    { value: "random", label: "Aleatório" },
];

export const WALLHAVEN_TOPRANGE_OPTIONS: Array<{ value: WallhavenTopRange; label: string }> = [
    { value: "1d", label: "1 dia" },
    { value: "3d", label: "3 dias" },
    { value: "1w", label: "1 semana" },
    { value: "1M", label: "1 mês" },
    { value: "3M", label: "3 meses" },
    { value: "6M", label: "6 meses" },
    { value: "1y", label: "1 ano" },
];

export const WALLHAVEN_ATLEAST_PRESETS = ["", "1920x1080", "2560x1440", "3840x2160", "1280x720", "1920x1200", "2560x1080", "3440x1440"];
export const WALLHAVEN_RESOLUTIONS_PRESETS = ["", "1920x1080", "2560x1440", "3840x2160", "1920x1200", "2560x1080", "3440x1440", "5120x2880"];
export const WALLHAVEN_RATIOS_PRESETS = ["", "16x9", "16x10", "21x9", "4x3", "5x4", "1x1", "3x2", "32x9", "48x9"];

// Paleta oficial Wallhaven (https://wallhaven.cc/help/api)
export const WALLHAVEN_COLORS = [
    "660000", "990000", "cc0000", "cc3333", "ea4c88", "993399", "663399", "333399",
    "0066cc", "0099cc", "66cccc", "77cc33", "669900", "336600", "666600", "999900",
    "cccc33", "ffff00", "ffcc33", "ff9900", "ff6600", "cc6633", "996633", "663300",
    "000000", "999999", "cccccc", "ffffff", "424153",
];

export function wallhavenFiltersToQuery(f: WallhavenFilters): Record<string, string> {
    const out: Record<string, string> = {};
    if (f.categories && /^[01]{3}$/.test(f.categories) && f.categories !== "111") out.categories = f.categories;
    else if (f.categories) out.categories = f.categories;
    if (f.purity && /^[01]{3}$/.test(f.purity) && f.purity !== "100") out.purity = f.purity;
    else if (f.purity) out.purity = f.purity;
    if (f.sorting) out.sorting = f.sorting;
    if (f.order) out.order = f.order;
    if (f.sorting === "toplist" && f.topRange) out.topRange = f.topRange;
    if (f.atleast && /^\d+x\d+$/.test(f.atleast)) out.atleast = f.atleast;
    if (f.resolutions) {
        const cleaned = f.resolutions.split(",").map((s) => s.trim()).filter((s) => /^\d+x\d+$/.test(s)).join(",");
        if (cleaned) out.resolutions = cleaned;
    }
    if (f.ratios) {
        const cleaned = f.ratios.split(",").map((s) => s.trim()).filter((s) => /^\d+x\d+$/.test(s)).join(",");
        if (cleaned) out.ratios = cleaned;
    }
    if (f.colors && /^[0-9a-fA-F]{6}$/.test(f.colors)) out.colors = f.colors.toLowerCase();
    if (f.sorting === "random" && f.seed && /^[a-zA-Z0-9]{6}$/.test(f.seed)) out.seed = f.seed;
    return out;
}

export function isWallhavenFiltersDefault(f: WallhavenFilters): boolean {
    return (
        f.categories === WALLHAVEN_DEFAULTS.categories &&
        f.purity === WALLHAVEN_DEFAULTS.purity &&
        f.sorting === WALLHAVEN_DEFAULTS.sorting &&
        f.order === WALLHAVEN_DEFAULTS.order &&
        f.topRange === WALLHAVEN_DEFAULTS.topRange &&
        !f.atleast &&
        !f.resolutions &&
        !f.ratios &&
        !f.colors &&
        !f.seed
    );
}
