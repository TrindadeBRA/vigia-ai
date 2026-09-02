import type { WeatherConfig, WeatherPayload } from "../api/types";
import { cn } from "../cn";
import { fmtDayLabel, fmtHourLabel, fmtHumidity, fmtPrecip, fmtPressure, fmtTemp, fmtWind, windDir, wmoEmoji, wmoLabel } from "../format";
import type { T } from "../i18n";
import { cardLabel, emptyNote, errorText, metricCard, metricsGrid, num } from "../tw";

function WeatherIcon({ code, size = 28 }: { code: number | null | undefined; size?: number }) {
    return <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden>{wmoEmoji(code)}</span>;
}

function MiniHour({ time, temp, code, precipProb, tempUnit }: { time: string; temp: number | null | undefined; code: number | null | undefined; precipProb: number | null | undefined; tempUnit: string }) {
    return (
        <div className="flex min-w-[56px] flex-col items-center gap-1 rounded-xl border border-edge bg-chip px-2 py-2">
            <span className="text-[11px] font-semibold text-ink3">{fmtHourLabel(time)}</span>
            <span className="text-[16px] leading-none">{wmoEmoji(code)}</span>
            <span className={cn(num, "text-[13px] font-bold")}>{fmtTemp(temp, tempUnit)}</span>
            {precipProb != null && precipProb > 5 ? <span className="text-[10px] font-semibold text-accent">{Math.round(precipProb)}%</span> : null}
        </div>
    );
}

function MiniDay({ time, max, min, code, precipProb, tempUnit }: { time: string; max: number | null | undefined; min: number | null | undefined; code: number | null | undefined; precipProb: number | null | undefined; tempUnit: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-edge bg-chip px-3 py-2.5">
            <span className="min-w-[44px] text-[12px] font-bold text-ink">{fmtDayLabel(time)}</span>
            <span className="text-[18px] leading-none">{wmoEmoji(code)}</span>
            <span className="min-w-0 flex-1 text-[11px] leading-tight text-ink3">{wmoLabel(code)}</span>
            <span className={cn(num, "text-[13px] font-bold")}>{fmtTemp(max, tempUnit)}</span>
            <span className={cn(num, "text-[12px] text-ink3")}>{fmtTemp(min, tempUnit)}</span>
            {precipProb != null && precipProb > 5 ? <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">{Math.round(precipProb)}%</span> : null}
        </div>
    );
}

// ── Card compacto para o board (grid) ────────────────────────────────

export function WeatherBoardCard({ weather, config, t, compact, onOpen }: { weather: WeatherPayload | null | undefined; config: WeatherConfig | null | undefined; t: T; compact?: boolean; onOpen?: () => void }) {
    const locName = weather?.location?.name || config?.location?.name || "";
    const tempUnit = weather?.current_units?.["temperature_2m"] || (config?.units.temperature_unit === "fahrenheit" ? "°F" : "°C");
    const windUnit = weather?.current_units?.["wind_speed_10m"] || config?.units.wind_speed_unit || "km/h";
    const fields = config?.display.fields;

    if (!weather || !weather.ok) {
        return (
            <div className={cn("flex h-full min-h-0 w-full flex-col rounded-2xl border border-edge bg-panel p-3.5 shadow-card", compact && "p-3")}>
                <div className="mb-2 flex items-center gap-2">
                    <span className="text-[18px]">🌤️</span>
                    <span className="text-[13px] font-bold">{t.weather}</span>
                    {locName ? <span className="text-xs text-ink3">{locName}</span> : null}
                </div>
                <div className={cn(errorText, compact && "text-xs")}>{weather?.error || t.weatherNoLocation}</div>
            </div>
        );
    }

    const cur = weather.current;
    const showTemp = !fields || fields.temperature;
    const showFeels = !fields || fields.feels_like;
    const showHumidity = !fields || fields.humidity;
    const showWind = !fields || fields.wind;
    const showPrecip = !fields || fields.precipitation;

    if (compact) {
        return (
            <button type="button" onClick={onOpen} className="flex h-full min-h-0 w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-edge bg-panel p-3 text-left shadow-card transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover">
                <div className="mb-1.5 flex items-center gap-2">
                    <WeatherIcon code={cur?.weather_code} size={22} />
                    <div className="min-w-0 flex-1">
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-bold leading-none">{locName || t.weather}</div>
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink3">{wmoLabel(cur?.weather_code)}</div>
                    </div>
                    {showTemp && cur?.temperature_2m != null ? <span className={cn(num, "shrink-0 text-[18px] font-[750]")}>{fmtTemp(cur.temperature_2m, tempUnit)}</span> : null}
                </div>
                <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-ink2">
                    {showFeels && cur?.apparent_temperature != null ? <span>{t.weatherFeelsLike} {fmtTemp(cur.apparent_temperature, tempUnit)}</span> : null}
                    {showHumidity && cur?.relative_humidity_2m != null ? <span>{fmtHumidity(cur.relative_humidity_2m)}</span> : null}
                    {showWind && cur?.wind_speed_10m != null ? <span>{fmtWind(cur.wind_speed_10m, windUnit)}{cur.wind_direction_10m != null ? ` ${windDir(cur.wind_direction_10m)}` : ""}</span> : null}
                    {showPrecip && cur?.precipitation != null && cur.precipitation > 0 ? <span>{fmtPrecip(cur.precipitation, "mm")}</span> : null}
                </div>
            </button>
        );
    }

    return (
        <button type="button" onClick={onOpen} className="flex h-full min-h-0 w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-edge bg-panel p-3.5 text-left shadow-card transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover">
            <div className="mb-2.5 flex items-center gap-2.5">
                <WeatherIcon code={cur?.weather_code} size={32} />
                <div className="min-w-0 flex-1">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-bold leading-none">{locName || t.weather}</div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-ink3">{wmoLabel(cur?.weather_code)}</div>
                </div>
                {showTemp && cur?.temperature_2m != null ? <span className={cn(num, "shrink-0 text-[26px] font-[750] leading-none")}>{fmtTemp(cur.temperature_2m, tempUnit)}</span> : null}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink2">
                {showFeels && cur?.apparent_temperature != null ? <span>{t.weatherFeelsLike} {fmtTemp(cur.apparent_temperature, tempUnit)}</span> : null}
                {showHumidity && cur?.relative_humidity_2m != null ? <span>{t.weatherHumidity} {fmtHumidity(cur.relative_humidity_2m)}</span> : null}
                {showWind && cur?.wind_speed_10m != null ? <span>{t.weatherWind} {fmtWind(cur.wind_speed_10m, windUnit)}{cur.wind_direction_10m != null ? ` ${windDir(cur.wind_direction_10m)}` : ""}</span> : null}
                {showPrecip && cur?.precipitation != null && cur.precipitation > 0 ? <span>{t.weatherPrecip} {fmtPrecip(cur.precipitation, "mm")}</span> : null}
                {fields?.pressure && cur?.pressure_msl != null ? <span>{t.weatherPressure} {fmtPressure(cur.pressure_msl)}</span> : null}
                {fields?.cloud_cover && cur?.cloud_cover != null ? <span>{t.weatherCloudCover} {fmtHumidity(cur.cloud_cover)}</span> : null}
            </div>
            {weather.daily?.time?.length ? (
                <div className="mt-2.5 flex min-h-0 flex-1 flex-wrap content-start items-start gap-1.5 overflow-hidden">
                    {weather.daily.time.slice(0, 4).map((d, i) => (
                        <span key={d} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-chip px-2 py-1 text-[11px] font-semibold">
                            <span>{fmtDayLabel(d)}</span>
                            <span>{wmoEmoji(weather.daily?.weather_code?.[i])}</span>
                            <span className={num}>{fmtTemp(weather.daily?.temperature_2m_max?.[i], tempUnit)}</span>
                        </span>
                    ))}
                </div>
            ) : null}
        </button>
    );
}

// ── Página de detalhe ────────────────────────────────────────────────

export function WeatherDetail({ weather, config, t }: { weather: WeatherPayload | null | undefined; config: WeatherConfig | null | undefined; t: T }) {
    if (!weather) {
        return <div className={emptyNote}>{t.weatherNoLocation}</div>;
    }
    if (!weather.ok) {
        return <div className={metricCard}><div className={errorText}>{weather.error || t.noData}</div></div>;
    }

    const cur = weather.current;
    const hourly = weather.hourly;
    const daily = weather.daily;
    const locName = weather.location?.name || config?.location?.name || "";
    const tempUnit = weather.current_units?.["temperature_2m"] || "°C";
    const windUnit = weather.current_units?.["wind_speed_10m"] || "km/h";
    const precipUnit = weather.current_units?.["precipitation"] || "mm";
    const fields = config?.display.fields;
    const showCurrent = config?.display.show_current ?? true;
    const showHourly = config?.display.show_hourly ?? true;
    const showDaily = config?.display.show_daily ?? true;
    const hourlyCount = config?.display.hourly_count ?? 12;
    const dailyCount = config?.display.daily_count ?? 7;

    return (
        <div className="flex w-full flex-col gap-[14px]">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="text-[28px] leading-none">{wmoEmoji(cur?.weather_code)}</span>
                <div className="min-w-0 flex-1">
                    <div className="text-[19px] font-[750] leading-none">{locName || t.weather}</div>
                    {cur?.weather_code != null ? <div className={cardLabel}>{wmoLabel(cur.weather_code)}</div> : null}
                    {weather.timezone ? <div className="text-xs text-ink3">{weather.timezone} · {weather.elevation != null ? `${Math.round(weather.elevation)} m` : ""}</div> : null}
                </div>
                {cur?.temperature_2m != null ? <span className={cn(num, "shrink-0 text-[32px] font-[750] leading-none")}>{fmtTemp(cur.temperature_2m, tempUnit)}</span> : null}
            </div>

            {/* Current */}
            {showCurrent && cur ? (
                <div className={metricsGrid}>
                    {(!fields || fields.temperature) && cur.temperature_2m != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherTemp}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{fmtTemp(cur.temperature_2m, tempUnit)}</div>
                        </div>
                    ) : null}
                    {(!fields || fields.feels_like) && cur.apparent_temperature != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherFeelsLike}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{fmtTemp(cur.apparent_temperature, tempUnit)}</div>
                        </div>
                    ) : null}
                    {(!fields || fields.humidity) && cur.relative_humidity_2m != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherHumidity}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{fmtHumidity(cur.relative_humidity_2m)}</div>
                        </div>
                    ) : null}
                    {(!fields || fields.wind) && cur.wind_speed_10m != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherWind}</div>
                            <div className={cn(num, "mt-1 text-[18px] font-[750]")}>{fmtWind(cur.wind_speed_10m, windUnit)} <span className="text-sm font-semibold text-ink3">{windDir(cur.wind_direction_10m)}</span></div>
                            {cur.wind_gusts_10m != null ? <div className="mt-1 text-xs text-ink3">Rajadas {fmtWind(cur.wind_gusts_10m, windUnit)}</div> : null}
                        </div>
                    ) : null}
                    {(!fields || fields.precipitation) && cur.precipitation != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherPrecip}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{fmtPrecip(cur.precipitation, precipUnit)}</div>
                        </div>
                    ) : null}
                    {(!fields || fields.pressure) && cur.pressure_msl != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherPressure}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{fmtPressure(cur.pressure_msl)}</div>
                        </div>
                    ) : null}
                    {(!fields || fields.cloud_cover) && cur.cloud_cover != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherCloudCover}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{fmtHumidity(cur.cloud_cover)}</div>
                        </div>
                    ) : null}
                    {(!fields || fields.uv_index) && cur.uv_index != null ? (
                        <div className={metricCard}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink3">{t.weatherUvIndex}</div>
                            <div className={cn(num, "mt-1 text-[22px] font-[750]")}>{cur.uv_index.toFixed(1)}</div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* Hourly */}
            {showHourly && hourly?.time?.length ? (
                <div className={metricCard}>
                    <div className="mb-3 text-[13px] font-bold">{t.weatherHourly}</div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {hourly.time.slice(0, hourlyCount).map((time, i) => (
                            <MiniHour
                                key={time}
                                time={time}
                                temp={hourly.temperature_2m?.[i]}
                                code={hourly.weather_code?.[i]}
                                precipProb={hourly.precipitation_probability?.[i]}
                                tempUnit={tempUnit}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Daily */}
            {showDaily && daily?.time?.length ? (
                <div className={metricCard}>
                    <div className="mb-3 text-[13px] font-bold">{t.weatherDaily}</div>
                    <div className="flex flex-col gap-1.5">
                        {daily.time.slice(0, dailyCount).map((time, i) => (
                            <MiniDay
                                key={time}
                                time={time}
                                max={daily.temperature_2m_max?.[i]}
                                min={daily.temperature_2m_min?.[i]}
                                code={daily.weather_code?.[i]}
                                precipProb={daily.precipitation_probability_max?.[i]}
                                tempUnit={tempUnit}
                            />
                        ))}
                    </div>
                    {(!fields || fields.sunrise_sunset) && daily.sunrise?.[0] && daily.sunset?.[0] ? (
                        <div className="mt-3 flex gap-4 border-t border-edge pt-3 text-xs text-ink3">
                            <span>🌅 {daily.sunrise[0].slice(11, 16)} · 🌇 {daily.sunset[0].slice(11, 16)}</span>
                            {daily.uv_index_max?.[0] != null ? <span>UV {daily.uv_index_max[0].toFixed(1)}</span> : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {weather.updated_at ? <div className="px-1 text-xs text-ink3">{t.updated} {weather.updated_at.slice(11, 16)} · {weather.timezone_abbreviation || weather.timezone || ""}</div> : null}
        </div>
    );
}
