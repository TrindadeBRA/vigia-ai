import { cn } from "../../cn";
import type { WeatherConfig, WeatherPayload } from "../../api/types";
import { fmtDayLabel, fmtHourLabel, fmtHumidity, fmtPrecip, fmtPressure, fmtTemp, fmtWind, isSameWeatherDay, weatherTodayKey, windDir, wmoEmoji, wmoLabel } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cardLabel, emptyNote, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Tamanhos ───────────────────────────────────────────────────────── */

// sm = hero "agora" (temperatura atual); sw = hero "hoje" (máx/mín do dia,
// só faz sentido com previsão diária); md = resumo compacto; wm = lista
// vertical de dias (o maior tamanho oferecido — só o necessário, sem esticar
// pro tamanho de "wl"); xl/wxl = resumo completo com tira de horas + lista
// de dias (fallback defensivo, não oferecido no menu).
export function weatherAllowedSizes(weather?: WeatherPayload | null): CardSize[] {
  const hasDaily = (weather?.daily?.time?.length ?? 0) > 0;
  const out: CardSize[] = ["sm"];
  if (hasDaily) out.push("sw");
  out.push("md");
  if (hasDaily) out.push("wm");
  return out;
}

export const WEATHER_ALLOWED_ALL: CardSize[] = ["sm", "sw", "md", "wm"];

export function weatherSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return `${t.cardSmallPrefix} ${t.weatherCurrent}`;
  if (s === "sw") return `${t.cardSmallPrefix} ${t.weatherToday}`;
  if (s === "md") return t.cardNormal;
  if (s === "wm") return t.cardLarge;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

/* ── Primitivos ─────────────────────────────────────────────────────── */

function Icon({ code, compact }: { code: number | null | undefined; compact?: boolean }) {
  if (compact) {
    return (
      <div className="relative shrink-0">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
          <img className="size-3.5 object-contain" src={PROVIDER_ICON.weather} alt="" draggable={false} />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 flex size-[14px] items-center justify-center rounded-full bg-panel text-[10px] leading-none shadow-[0_0_0_1px_var(--card-border)]">{wmoEmoji(code)}</span>
      </div>
    );
  }
  return (
    <div className="relative shrink-0">
      <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-[23px] object-contain" src={PROVIDER_ICON.weather} alt="" draggable={false} />
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-panel text-[13px] leading-none shadow-[0_0_0_1px_var(--card-border)]">{wmoEmoji(code)}</span>
    </div>
  );
}

function WeatherHeader({ locName, code, compact, onOpen, className }: { locName: string; code: number | null | undefined; compact?: boolean; onOpen?: () => void; className?: string }) {
  const inner = (
    <>
      <Icon code={code} compact={compact} />
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{locName}</div>
        <div className={cardLabel}>{wmoLabel(code)}</div>
      </div>
    </>
  );
  const margin = className ?? (compact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5");
  if (onOpen) {
    return (
      <button type="button" className={cn("flex min-w-0 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-ink", margin)} onClick={onOpen}>
        {inner}
      </button>
    );
  }
  return <div className={cn("flex min-w-0 shrink-0 items-center", margin)}>{inner}</div>;
}

function HeroFact({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{label}</div>
      <div className={cn(num, "mt-1 text-[13px] font-[800] leading-tight py-0.5 [overflow-wrap:anywhere]")}>{value}</div>
      {sub ? <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-ink3">{sub}</div> : null}
    </>
  );
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

/* ── Board ──────────────────────────────────────────────────────────── */

export function WeatherBoardCard({
  weather,
  config,
  t,
  size,
  onOpen,
}: {
  weather: WeatherPayload | null | undefined;
  config: WeatherConfig | null | undefined;
  t: T;
  size: CardSize;
  onOpen: () => void;
}) {
  const locName = weather?.location?.name || config?.location?.name || "";
  const tempUnit = weather?.current_units?.["temperature_2m"] || (config?.units.temperature_unit === "fahrenheit" ? "°F" : "°C");
  const windUnit = weather?.current_units?.["wind_speed_10m"] || config?.units.wind_speed_unit || "km/h";
  const precipUnit = weather?.current_units?.["precipitation"] || "mm";
  const fields = config?.display.fields;
  const ns = normalizeSize(size);
  const isCompact = ns === "sm" || ns === "sw";
  const cur = weather?.current;
  const daily = weather?.daily;
  const hourly = weather?.hourly;

  if (!weather || !weather.ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <WeatherHeader locName={locName || t.weather} code={null} compact={isCompact} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{weather?.error || t.weatherNoLocation}</div>
        </div>
      </div>
    );
  }

  const showTemp = !fields || fields.temperature;
  const showFeels = !fields || fields.feels_like;
  const showHumidity = !fields || fields.humidity;
  const showWind = !fields || fields.wind;
  const showPrecip = !fields || fields.precipitation;
  const todayKey = weatherTodayKey(cur?.time, weather?.timezone);
  const todayIdx = Math.max(0, daily?.time?.findIndex((d) => isSameWeatherDay(d, todayKey)) ?? 0);

  const metaRow = (
    <>
      {showFeels && cur?.apparent_temperature != null ? <span>{t.weatherFeelsLike} {fmtTemp(cur.apparent_temperature, tempUnit)}</span> : null}
      {showHumidity && cur?.relative_humidity_2m != null ? <span>{t.weatherHumidity} {fmtHumidity(cur.relative_humidity_2m)}</span> : null}
      {showWind && cur?.wind_speed_10m != null ? <span>{t.weatherWind} {fmtWind(cur.wind_speed_10m, windUnit)}{cur.wind_direction_10m != null ? ` ${windDir(cur.wind_direction_10m)}` : ""}</span> : null}
      {showPrecip && cur?.precipitation != null && cur.precipitation > 0 ? <span>{t.weatherPrecip} {fmtPrecip(cur.precipitation, precipUnit)}</span> : null}
    </>
  );

  if (ns === "sm" || ns === "sw") {
    const isTodayCard = ns === "sw";
    const code = isTodayCard ? daily?.weather_code?.[todayIdx] : cur?.weather_code;
    const value = isTodayCard
      ? `${fmtTemp(daily?.temperature_2m_max?.[todayIdx], tempUnit)} / ${fmtTemp(daily?.temperature_2m_min?.[todayIdx], tempUnit)}`
      : fmtTemp(cur?.temperature_2m, tempUnit);
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <Icon code={code} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-visible border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <HeroFact label={isTodayCard ? t.weatherToday : t.weatherCurrent} value={value} sub={isTodayCard ? wmoLabel(code) : locName || null} />
        </button>
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <WeatherHeader locName={locName || t.weather} code={cur?.weather_code} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {showTemp && cur?.temperature_2m != null ? <div className={cn(num, "text-[22px] font-[800] leading-none")}>{fmtTemp(cur.temperature_2m, tempUnit)}</div> : null}
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-ink2">
            {showFeels && cur?.apparent_temperature != null ? <span>{fmtTemp(cur.apparent_temperature, tempUnit)}</span> : null}
            {showHumidity && cur?.relative_humidity_2m != null ? <span>{fmtHumidity(cur.relative_humidity_2m)}</span> : null}
            {showWind && cur?.wind_speed_10m != null ? <span>{fmtWind(cur.wind_speed_10m, windUnit)}{cur.wind_direction_10m != null ? ` ${windDir(cur.wind_direction_10m)}` : ""}</span> : null}
            {showPrecip && cur?.precipitation != null && cur.precipitation > 0 ? <span>{fmtPrecip(cur.precipitation, precipUnit)}</span> : null}
          </div>
        </button>
      </div>
    );
  }

  if (ns === "wm") {
    const days = (daily?.time ?? []).slice(0, 7);
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <WeatherHeader locName={locName || t.weather} code={cur?.weather_code} onOpen={onOpen} className="mb-3 gap-2.5" />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {showTemp && cur?.temperature_2m != null ? (
            <div className="mb-4 shrink-0 border-b border-edge pb-3">
              <div className={cn(num, "text-[28px] font-[800] leading-none")}>{fmtTemp(cur.temperature_2m, tempUnit)}</div>
              {showFeels && cur?.apparent_temperature != null ? (
                <div className="mt-1.5 text-[11px] text-ink3">{t.weatherFeelsLike} {fmtTemp(cur.apparent_temperature, tempUnit)}</div>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            {days.map((d, i) => {
              const isToday = isSameWeatherDay(d, todayKey);
              return (
                <div
                  key={d}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px]",
                    isToday && "bg-chip shadow-[inset_0_0_0_1px_var(--card-border),inset_2px_0_0_var(--accent)]",
                  )}
                >
                  <span className={cn("min-w-[34px] shrink-0 font-bold", isToday ? "text-ink" : "text-ink2")}>{fmtDayLabel(d)}</span>
                  <span className="shrink-0 text-[15px] leading-none">{wmoEmoji(daily?.weather_code?.[i])}</span>
                  <span className={cn(num, "ml-auto shrink-0 font-bold text-ink")}>{fmtTemp(daily?.temperature_2m_max?.[i], tempUnit)}</span>
                  <span className={cn(num, "shrink-0 text-[11px] text-ink3")}>{fmtTemp(daily?.temperature_2m_min?.[i], tempUnit)}</span>
                </div>
              );
            })}
          </div>
        </button>
      </div>
    );
  }

  // xl/wxl — resumo completo: header + temp + meta + tira de horas + lista de dias
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <WeatherHeader locName={locName || t.weather} code={cur?.weather_code} onOpen={onOpen} />
      <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col gap-2.5 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        <div className="flex items-center gap-3">
          {showTemp && cur?.temperature_2m != null ? <span className={cn(num, "shrink-0 text-[30px] font-[750] leading-none")}>{fmtTemp(cur.temperature_2m, tempUnit)}</span> : null}
          <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink2">{metaRow}</div>
        </div>
        {hourly?.time?.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {hourly.time.slice(0, 8).map((time, i) => (
              <MiniHour key={time} time={time} temp={hourly.temperature_2m?.[i]} code={hourly.weather_code?.[i]} precipProb={hourly.precipitation_probability?.[i]} tempUnit={tempUnit} />
            ))}
          </div>
        ) : null}
        {daily?.time?.length ? (
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            {daily.time.slice(0, 5).map((time, i) => (
              <MiniDay key={time} time={time} max={daily.temperature_2m_max?.[i]} min={daily.temperature_2m_min?.[i]} code={daily.weather_code?.[i]} precipProb={daily.precipitation_probability_max?.[i]} tempUnit={tempUnit} />
            ))}
          </div>
        ) : null}
      </button>
    </div>
  );
}

/* ── Detail ─────────────────────────────────────────────────────────── */

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
