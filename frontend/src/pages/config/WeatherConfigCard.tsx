import { useEffect, useState } from "react";
import { patchWeatherConfig, searchCities, setWeatherLocation } from "../../api/client";
import type { WeatherConfig, WeatherGeocodingResult } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, cfgFieldLabel, cfgHint, iconChip, iconImg } from "../../tw";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, Checkbox, FieldStatus, Fold, Switch, TextField } from "./ui";

// Todas as variáveis Open-Meteo disponíveis (para o painel avançado)
const CURRENT_VARS = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature",
    "precipitation", "rain", "showers", "snowfall", "weather_code", "cloud_cover",
    "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
    "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "visibility", "evapotranspiration", "et0_fao_evapotranspiration",
    "vapour_pressure_deficit", "is_day", "sunshine_duration",
    "shortwave_radiation", "direct_radiation", "diffuse_radiation",
    "snow_depth", "freezing_level_height",
    "uv_index", "uv_index_clear_sky",
];

const HOURLY_VARS = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature",
    "precipitation_probability", "precipitation", "rain", "showers", "snowfall",
    "weather_code", "pressure_msl", "cloud_cover", "visibility",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "uv_index", "is_day", "sunshine_duration", "shortwave_radiation",
];

const DAILY_VARS = [
    "weather_code",
    "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
    "apparent_temperature_max", "apparent_temperature_min",
    "precipitation_sum", "rain_sum", "showers_sum", "snowfall_sum",
    "precipitation_hours", "precipitation_probability_max",
    "sunrise", "sunset", "daylight_duration", "sunshine_duration",
    "wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant",
    "shortwave_radiation_sum", "et0_fao_evapotranspiration",
    "uv_index_max", "uv_index_clear_sky_max",
];

function VarCheckboxes({ vars, selected, onToggle }: { vars: string[]; selected: string[]; onToggle: (v: string) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {vars.map((v) => {
                const on = selected.includes(v);
                return (
                    <label key={v} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-accent bg-accent text-accent-ink" : "border-edge bg-chip text-ink2 hover:border-accent hover:text-ink"}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(v)} />
                        {v}
                    </label>
                );
            })}
        </div>
    );
}

export function WeatherConfigCard({ weather, c, onReload }: { weather: WeatherConfig; c: ConfigCopy; onReload: () => Promise<void> }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<WeatherGeocodingResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [forecastDays, setForecastDays] = useState(String(weather.forecast_days));
    const [tempUnit, setTempUnit] = useState(weather.units.temperature_unit);
    const [windUnit, setWindUnit] = useState(weather.units.wind_speed_unit);
    const [precipUnit, setPrecipUnit] = useState(weather.units.precipitation_unit);

    const toggleEnabled = useRequest();
    const saveUnits = useRequest();
    const saveDisplay = useRequest();
    const saveVars = useRequest();
    const selectCity = useRequest();

    const loc = weather.location;
    const hasLocation = loc.latitude != null && loc.longitude != null;
    const display = weather.display;

    useEffect(() => {
        setForecastDays(String(weather.forecast_days));
        setTempUnit(weather.units.temperature_unit);
        setWindUnit(weather.units.wind_speed_unit);
        setPrecipUnit(weather.units.precipitation_unit);
    }, [weather.forecast_days, weather.units.temperature_unit, weather.units.wind_speed_unit, weather.units.precipitation_unit]);

    async function doSearch() {
        const q = query.trim();
        if (q.length < 2) return;
        setSearching(true);
        try {
            const res = await searchCities(q, 5);
            setResults(res);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }

    async function pickCity(r: WeatherGeocodingResult) {
        await selectCity.run(
            async () => {
                const res = await setWeatherLocation({
                    name: r.name,
                    latitude: r.latitude,
                    longitude: r.longitude,
                    country: r.country || "",
                    country_code: r.country_code || "",
                    timezone: r.timezone || "auto",
                    elevation: r.elevation ?? null,
                });
                if (res.ok) await onReload();
                return res;
            },
            { success: c.saved, error: c.offline },
        );
        setResults([]);
        setQuery("");
    }

    const unitsDirty = tempUnit !== weather.units.temperature_unit || windUnit !== weather.units.wind_speed_unit || precipUnit !== weather.units.precipitation_unit || forecastDays !== String(weather.forecast_days);

    const hint = hasLocation
        ? `${loc.name}${loc.country ? `, ${loc.country}` : ""}${loc.country_code ? ` (${loc.country_code})` : ""}`
        : c.weatherNotConfigured;

    const cityFoldSummary = hasLocation ? c.weatherChangeCity : c.weatherCityLabel;

    return (
        <article className={`${cfgCard} gap-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={iconChip}>
                        <img className={iconImg} src={PROVIDER_ICON.weather} alt="" draggable={false} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="m-0 text-[15.5px] font-bold">{c.weatherTitle}</h3>
                        <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
                    </div>
                </div>
                <Switch
                    label={c.showOnBoard}
                    checked={weather.enabled && !weather.hidden}
                    busy={toggleEnabled.busy}
                    onChange={async (e) => {
                        const next = e.target.checked;
                        await toggleEnabled.run(
                            async () => {
                                const res = await patchWeatherConfig({ enabled: next, hidden: !next });
                                if (res.ok) await onReload();
                                return res as { ok: boolean; error?: string };
                            },
                            { success: c.saved, error: c.offline },
                        );
                    }}
                />
            </div>

            {toggleEnabled.message ? <FieldStatus status={toggleEnabled.status} message={toggleEnabled.message} /> : null}

            <Fold summary={cityFoldSummary}>
                {hasLocation ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-edge bg-chip px-3 py-2.5">
                        <span className="text-sm font-semibold text-ink">
                            {loc.name}
                            {loc.country ? `, ${loc.country}` : ""} {loc.country_code ? `(${loc.country_code})` : ""}
                        </span>
                        <span className="text-xs text-ink3">
                            {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)} · {loc.timezone || "auto"}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-good px-2 py-0.5 text-[11px] font-bold text-white">{c.weatherSelected}</span>
                    </div>
                ) : null}
                <ActionRow>
                    <TextField placeholder={c.weatherCityPh} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doSearch(); } }} autoComplete="off" />
                    <Button variant="secondary" loading={searching} onClick={() => void doSearch()} disabled={query.trim().length < 2}>
                        {searching ? c.weatherSearching : "Buscar"}
                    </Button>
                </ActionRow>
                {results.length > 0 ? (
                    <div className="flex flex-col gap-1 rounded-[10px] border border-edge bg-canvas p-1">
                        {results.map((r) => (
                            <button
                                key={`${r.latitude}-${r.longitude}-${r.name}`}
                                type="button"
                                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-chip"
                                onClick={() => void pickCity(r)}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="font-semibold text-ink">{r.name}</span>
                                    <span className="ml-1.5 text-xs text-ink3">
                                        {[r.admin1, r.country].filter(Boolean).join(", ")} {r.country_code ? `(${r.country_code})` : ""}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs text-ink3">{r.latitude.toFixed(2)}, {r.longitude.toFixed(2)}</span>
                            </button>
                        ))}
                    </div>
                ) : query.trim().length >= 2 && !searching ? (
                    <p className="m-0 text-xs text-ink3">{c.weatherNoResults}</p>
                ) : null}
                {selectCity.message ? <FieldStatus status={selectCity.status} message={selectCity.message} /> : null}
            </Fold>

            <Fold summary={c.weatherUnitsTitle}>
                <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-ink3">{c.weatherTempUnit}</span>
                        <select value={tempUnit} onChange={(e) => setTempUnit(e.target.value)} className="w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink">
                            <option value="celsius">Celsius (°C)</option>
                            <option value="fahrenheit">Fahrenheit (°F)</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-ink3">{c.weatherWindUnit}</span>
                        <select value={windUnit} onChange={(e) => setWindUnit(e.target.value)} className="w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink">
                            <option value="kmh">km/h</option>
                            <option value="ms">m/s</option>
                            <option value="mph">mph</option>
                            <option value="kn">kn</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-ink3">{c.weatherPrecipUnit}</span>
                        <select value={precipUnit} onChange={(e) => setPrecipUnit(e.target.value)} className="w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink">
                            <option value="mm">mm</option>
                            <option value="inch">inch</option>
                        </select>
                    </label>
                </div>
                <ActionRow>
                    <TextField label={c.weatherForecastDays} type="number" min={1} max={16} value={forecastDays} onChange={(e) => setForecastDays(e.target.value)} />
                    <Button
                        loading={saveUnits.busy}
                        disabled={!unitsDirty}
                        onClick={() =>
                            saveUnits.run(
                                async () => {
                                    const res = await patchWeatherConfig({
                                        temperature_unit: tempUnit,
                                        wind_speed_unit: windUnit,
                                        precipitation_unit: precipUnit,
                                        forecast_days: Number(forecastDays),
                                    });
                                    if (res.ok) await onReload();
                                    return res as { ok: boolean; error?: string };
                                },
                                { success: c.saved, error: c.offline },
                            )
                        }
                    >
                        {saveUnits.busy ? c.saving : c.save}
                    </Button>
                </ActionRow>
                {saveUnits.message ? <FieldStatus status={saveUnits.status} message={saveUnits.message} /> : null}
            </Fold>

            <Fold summary={c.weatherDisplayTitle}>
                <div className="flex flex-wrap gap-3">
                    <Checkbox label={c.weatherShowCurrent} checked={display.show_current} onChange={async (e) => {
                        const v = e.target.checked;
                        await saveDisplay.run(async () => {
                            const res = await patchWeatherConfig({ display_show_current: v });
                            if (res.ok) await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }} />
                    <Checkbox label={c.weatherShowHourly} checked={display.show_hourly} onChange={async (e) => {
                        const v = e.target.checked;
                        await saveDisplay.run(async () => {
                            const res = await patchWeatherConfig({ display_show_hourly: v });
                            if (res.ok) await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }} />
                    <Checkbox label={c.weatherShowDaily} checked={display.show_daily} onChange={async (e) => {
                        const v = e.target.checked;
                        await saveDisplay.run(async () => {
                            const res = await patchWeatherConfig({ display_show_daily: v });
                            if (res.ok) await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }} />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <TextField label={c.weatherHourlyCount} type="number" min={1} max={48} value={String(display.hourly_count)} onChange={async (e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        await saveDisplay.run(async () => {
                            const res = await patchWeatherConfig({ display_hourly_count: v });
                            if (res.ok) await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }} />
                    <TextField label={c.weatherDailyCount} type="number" min={1} max={16} value={String(display.daily_count)} onChange={async (e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        await saveDisplay.run(async () => {
                            const res = await patchWeatherConfig({ display_daily_count: v });
                            if (res.ok) await onReload();
                            return res as { ok: boolean; error?: string };
                        }, { success: c.saved, error: c.offline });
                    }} />
                </div>

                <span className={cfgFieldLabel}>{c.weatherFieldsTitle}</span>
                <div className="flex flex-wrap gap-3">
                    {([
                        ["temperature", c.weatherFieldTemperature],
                        ["feels_like", c.weatherFieldFeelsLike],
                        ["humidity", c.weatherFieldHumidity],
                        ["precipitation", c.weatherFieldPrecip],
                        ["wind", c.weatherFieldWind],
                        ["pressure", c.weatherFieldPressure],
                        ["cloud_cover", c.weatherFieldCloudCover],
                        ["uv_index", c.weatherFieldUvIndex],
                        ["sunrise_sunset", c.weatherFieldSunriseSunset],
                    ] as const).map(([key, label]) => (
                        <Checkbox
                            key={key}
                            label={label}
                            checked={Boolean((display.fields as Record<string, boolean>)[key])}
                            onChange={async (e) => {
                                const v = e.target.checked;
                                await saveDisplay.run(async () => {
                                    const res = await patchWeatherConfig({ display_fields: { [key]: v } });
                                    if (res.ok) await onReload();
                                    return res as { ok: boolean; error?: string };
                                }, { success: c.saved, error: c.offline });
                            }}
                        />
                    ))}
                </div>
                {saveDisplay.message ? <FieldStatus status={saveDisplay.status} message={saveDisplay.message} /> : null}
            </Fold>

            <Fold summary={c.weatherAdvancedTitle}>
                <p className={cfgHint}>{c.weatherVarsHint}</p>

                <div className="flex flex-col gap-2">
                    <span className={cfgFieldLabel}>{c.weatherCurrentVars}</span>
                    <VarCheckboxes
                        vars={CURRENT_VARS}
                        selected={weather.current}
                        onToggle={async (v) => {
                            const next = weather.current.includes(v) ? weather.current.filter((x) => x !== v) : [...weather.current, v];
                            await saveVars.run(async () => {
                                const res = await patchWeatherConfig({ current: next });
                                if (res.ok) await onReload();
                                return res as { ok: boolean; error?: string };
                            }, { success: c.saved, error: c.offline });
                        }}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <span className={cfgFieldLabel}>{c.weatherHourlyVars}</span>
                    <VarCheckboxes
                        vars={HOURLY_VARS}
                        selected={weather.hourly}
                        onToggle={async (v) => {
                            const next = weather.hourly.includes(v) ? weather.hourly.filter((x) => x !== v) : [...weather.hourly, v];
                            await saveVars.run(async () => {
                                const res = await patchWeatherConfig({ hourly: next });
                                if (res.ok) await onReload();
                                return res as { ok: boolean; error?: string };
                            }, { success: c.saved, error: c.offline });
                        }}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <span className={cfgFieldLabel}>{c.weatherDailyVars}</span>
                    <VarCheckboxes
                        vars={DAILY_VARS}
                        selected={weather.daily}
                        onToggle={async (v) => {
                            const next = weather.daily.includes(v) ? weather.daily.filter((x) => x !== v) : [...weather.daily, v];
                            await saveVars.run(async () => {
                                const res = await patchWeatherConfig({ daily: next });
                                if (res.ok) await onReload();
                                return res as { ok: boolean; error?: string };
                            }, { success: c.saved, error: c.offline });
                        }}
                    />
                </div>
                {saveVars.message ? <FieldStatus status={saveVars.status} message={saveVars.message} /> : null}
            </Fold>

            <p className="m-0 text-xs text-ink3">
                <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {c.weatherPoweredBy} ↗
                </a>
            </p>
        </article>
    );
}
