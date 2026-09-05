import { useState } from "react";
import { cn } from "../../../cn";
import { cfgFieldLabel } from "../../../tw";
import { SelectField } from "../ui";
import {
    WALLHAVEN_ATLEAST_PRESETS,
    WALLHAVEN_COLORS,
    WALLHAVEN_RATIOS_PRESETS,
    WALLHAVEN_RESOLUTIONS_PRESETS,
    WALLHAVEN_SORTING_OPTIONS,
    WALLHAVEN_TOPRANGE_OPTIONS,
    isWallhavenFiltersDefault,
    type WallhavenFilters,
} from "./wallhavenFilters";

export function WallhavenAdvancedFilters({
    value,
    onChange,
}: {
    value: WallhavenFilters;
    onChange: (next: WallhavenFilters) => void;
}) {
    const [open, setOpen] = useState(false);
    const isDefault = isWallhavenFiltersDefault(value);
    const activeCount = (() => {
        let n = 0;
        if (value.categories !== "111") n++;
        if (value.purity !== "100") n++;
        if (value.sorting !== "relevance") n++;
        if (value.order !== "desc") n++;
        if (value.atleast) n++;
        if (value.resolutions) n++;
        if (value.ratios) n++;
        if (value.colors) n++;
        if (value.seed) n++;
        return n;
    })();

    function patch(p: Partial<WallhavenFilters>) {
        onChange({ ...value, ...p });
    }

    function toggleCategory(idx: number) {
        const arr = value.categories.split("");
        arr[idx] = arr[idx] === "1" ? "0" : "1";
        // não deixa tudo 0 — força pelo menos um
        if (arr.join("") === "000") arr[idx] = "1";
        patch({ categories: arr.join("") });
    }
    function togglePurity(idx: number) {
        const arr = value.purity.split("");
        arr[idx] = arr[idx] === "1" ? "0" : "1";
        if (arr.join("") === "000") arr[idx] = "1";
        patch({ purity: arr.join("") });
    }

    return (
        <div className="rounded-[12px] border border-edge bg-chip/40">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
                <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
                    <span className={cn("inline-block size-1.5 shrink-0 -rotate-45 border-b-[1.8px] border-r-[1.8px] border-current transition-transform", open && "rotate-45")} />
                    Filtros avançados Wallhaven
                    {!isDefault ? (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-ink">{activeCount} ativos</span>
                    ) : null}
                </span>
                <span className="text-xs text-ink3">{open ? "Ocultar" : "Mostrar"}</span>
            </button>
            {open ? (
                <div className="flex flex-col gap-4 border-t border-edge px-3 py-3">
                    {/* Categorias */}
                    <div className="flex flex-col gap-1.5">
                        <span className={cfgFieldLabel}>Categorias</span>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { idx: 0, label: "General" },
                                { idx: 1, label: "Anime" },
                                { idx: 2, label: "People" },
                            ].map((c) => {
                                const on = value.categories[c.idx] === "1";
                                return (
                                    <button
                                        key={c.label}
                                        type="button"
                                        onClick={() => toggleCategory(c.idx)}
                                        className={cn(
                                            "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                                            on ? "border-accent bg-accent text-accent-ink" : "border-edge bg-canvas text-ink2 hover:border-accent/40",
                                        )}
                                    >
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                        <span className="text-[11px] text-ink3">categories={value.categories} (General/Anime/People)</span>
                    </div>

                    {/* Pureza */}
                    <div className="flex flex-col gap-1.5">
                        <span className={cfgFieldLabel}>Pureza</span>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { idx: 0, label: "SFW" },
                                { idx: 1, label: "Sketchy" },
                                { idx: 2, label: "NSFW" },
                            ].map((c) => {
                                const on = value.purity[c.idx] === "1";
                                const needsKey = c.idx > 0;
                                return (
                                    <button
                                        key={c.label}
                                        type="button"
                                        onClick={() => togglePurity(c.idx)}
                                        className={cn(
                                            "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                                            on ? "border-accent bg-accent text-accent-ink" : "border-edge bg-canvas text-ink2 hover:border-accent/40",
                                        )}
                                        title={needsKey ? "Requer API key do Wallhaven" : undefined}
                                    >
                                        {c.label}
                                        {needsKey ? " *" : ""}
                                    </button>
                                );
                            })}
                        </div>
                        <span className="text-[11px] text-ink3">purity={value.purity} · Sketchy/NSFW precisam de API key</span>
                    </div>

                    {/* Ordenação */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <SelectField
                            label="Ordenar por"
                            value={value.sorting}
                            onChange={(e) => patch({ sorting: e.target.value as WallhavenFilters["sorting"] })}
                            options={WALLHAVEN_SORTING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        <SelectField
                            label="Ordem"
                            value={value.order}
                            onChange={(e) => patch({ order: e.target.value as WallhavenFilters["order"] })}
                            options={[
                                { value: "desc", label: "Descendente" },
                                { value: "asc", label: "Ascendente" },
                            ]}
                        />
                        {value.sorting === "toplist" ? (
                            <SelectField
                                label="Período (toplist)"
                                value={value.topRange}
                                onChange={(e) => patch({ topRange: e.target.value as WallhavenFilters["topRange"] })}
                                options={WALLHAVEN_TOPRANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                            />
                        ) : value.sorting === "random" ? (
                            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                                <span className={cfgFieldLabel}>Seed (aleatório)</span>
                                <input
                                    value={value.seed}
                                    onChange={(e) => patch({ seed: e.target.value.slice(0, 6) })}
                                    placeholder="ex: a1b2c3"
                                    maxLength={6}
                                    className="box-border h-[42px] w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
                                />
                            </label>
                        ) : (
                            <div className="hidden sm:block" />
                        )}
                    </div>

                    {/* Resolução */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <SelectField
                            label="Resolução mínima (atleast)"
                            value={value.atleast}
                            onChange={(e) => patch({ atleast: e.target.value })}
                            options={WALLHAVEN_ATLEAST_PRESETS.map((v) => ({ value: v, label: v || "Qualquer" }))}
                        />
                        <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                            <span className={cfgFieldLabel}>Resoluções exatas (resolutions)</span>
                            <input
                                value={value.resolutions}
                                onChange={(e) => patch({ resolutions: e.target.value })}
                                placeholder="ex: 1920x1080,2560x1440"
                                className="box-border h-[42px] w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {WALLHAVEN_RESOLUTIONS_PRESETS.filter(Boolean).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => patch({ resolutions: value.resolutions ? `${value.resolutions},${r}` : r })}
                                className="rounded-full border border-edge bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink2 hover:border-accent/40"
                            >
                                + {r}
                            </button>
                        ))}
                        {value.resolutions ? (
                            <button type="button" onClick={() => patch({ resolutions: "" })} className="rounded-full bg-bad px-2.5 py-1 text-[11px] font-bold text-white">
                                Limpar
                            </button>
                        ) : null}
                    </div>

                    {/* Proporção */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                            <span className={cfgFieldLabel}>Proporções (ratios)</span>
                            <input
                                value={value.ratios}
                                onChange={(e) => patch({ ratios: e.target.value })}
                                placeholder="ex: 16x9,21x9"
                                className="box-border h-[42px] w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink3"
                            />
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {WALLHAVEN_RATIOS_PRESETS.filter(Boolean).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => patch({ ratios: value.ratios ? `${value.ratios},${r}` : r })}
                                    className="rounded-full border border-edge bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink2 hover:border-accent/40"
                                >
                                    + {r}
                                </button>
                            ))}
                            {value.ratios ? (
                                <button type="button" onClick={() => patch({ ratios: "" })} className="rounded-full bg-bad px-2.5 py-1 text-[11px] font-bold text-white">
                                    Limpar
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {/* Cor */}
                    <div className="flex flex-col gap-1.5">
                        <span className={cfgFieldLabel}>Cor (colors)</span>
                        <div className="flex flex-wrap gap-1.5">
                            {WALLHAVEN_COLORS.map((hex) => {
                                const active = value.colors.toLowerCase() === hex.toLowerCase();
                                return (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => patch({ colors: active ? "" : hex })}
                                        title={`#${hex}`}
                                        className={cn(
                                            "size-7 rounded-full border-2 transition-transform hover:scale-110",
                                            active ? "border-accent ring-2 ring-accent/30" : "border-white/60 shadow-sm",
                                        )}
                                        style={{ backgroundColor: `#${hex}` }}
                                        aria-label={`Cor #${hex}`}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                value={value.colors}
                                onChange={(e) => patch({ colors: e.target.value.replace(/^#/, "").slice(0, 6) })}
                                placeholder="hex sem # — ex: 660000"
                                maxLength={6}
                                className="box-border h-[36px] w-[160px] rounded-[10px] border border-edge bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink3"
                            />
                            {value.colors ? (
                                <>
                                    <span className="inline-flex size-6 rounded-full border border-edge" style={{ backgroundColor: `#${value.colors}` }} />
                                    <button type="button" onClick={() => patch({ colors: "" })} className="rounded-full bg-bad px-2.5 py-1 text-[11px] font-bold text-white">
                                        Limpar
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-edge pt-3">
                        <button
                            type="button"
                            onClick={() => onChange({ categories: "111", purity: "100", sorting: "relevance", order: "desc", topRange: "1M", atleast: "", resolutions: "", ratios: "", colors: "", seed: "" })}
                            className="rounded-[10px] border border-edge bg-canvas px-3 py-2 text-xs font-bold text-ink2 hover:bg-chip"
                        >
                            Restaurar padrão
                        </button>
                        <span className="self-center text-[11px] text-ink3">
                            Documentação: <a href="https://wallhaven.cc/help/api" target="_blank" rel="noreferrer" className="underline hover:text-ink">wallhaven.cc/help/api</a>
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
