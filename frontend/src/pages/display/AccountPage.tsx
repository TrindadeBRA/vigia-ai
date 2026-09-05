import type { ReactNode } from "react";
import type { AdsenseAccount, BitcoinAccount, ClaudeAccount, CreditsAccount, CursorAccount, GptAccount, OpenCodeAccount, RetroAchievementsAccount, UsagePayload, WeatherConfig } from "../../api/types";
import { AdsenseDetail } from "../../components/cards/AdsenseCard";
import { BitcoinDetail } from "../../components/cards/BitcoinCard";
import { CalendarDetail } from "../../components/cards/CalendarCard";
import { ClaudeDetail } from "../../components/cards/ClaudeCard";
import { CreditsDetail } from "../../components/cards/CreditsCard";
import { CurrenciesDetail } from "../../components/cards/CurrenciesCard";
import { CursorDetail } from "../../components/cards/CursorCard";
import { GitDetail } from "../../components/cards/GitCard";
import { GptDetail } from "../../components/cards/GptCard";
import { RetroAchievementsDetail } from "../../components/cards/RetroAchievementsCard";
import { RssDetail } from "../../components/cards/RssCard";
import { WeatherDetail } from "../../components/cards/WeatherCard";
import { ExternalLinkIcon } from "../../components/icons";
import type { T } from "../../i18n";
import { PROVIDER_SITE_URL } from "../../theme";
import { cardLabel, errorText, metricCard, num, viewFade } from "../../tw";
import { Icon } from "./MetricRow";
import type { Pal, ProviderMeta } from "./types";

export function Kv({ k, v }: { k: string; v: ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex justify-between gap-3 border-b border-surface py-2 text-sm last:border-b-0">
      <span className="text-ink3">{k}</span>
      <span className={`${num} text-right font-[550] text-ink`}>{v}</span>
    </div>
  );
}

function ClaudeBody({ data, account, t, pal, nowMs }: { data: UsagePayload; account: ClaudeAccount; t: T; pal: Pal; nowMs: number }) {
  return <ClaudeDetail account={account} updatedAt={data.updated_at} t={t} pal={pal} nowMs={nowMs} />;
}

function GptBody({ data, account, t, pal, nowMs }: { data: UsagePayload; account: GptAccount; t: T; pal: Pal; nowMs: number }) {
  return <GptDetail account={account} updatedAt={data.updated_at} t={t} pal={pal} nowMs={nowMs} />;
}

function CursorBody({ data, account, t, pal, nowMs }: { data: UsagePayload; account: CursorAccount; t: T; pal: Pal; nowMs: number }) {
  return <CursorDetail account={account} updatedAt={data.updated_at} t={t} pal={pal} nowMs={nowMs} />;
}

function BitcoinBody({ data, account, t }: { data: UsagePayload; account: BitcoinAccount; t: T }) {
  return <BitcoinDetail account={account} updatedAt={data.updated_at} t={t} />;
}

function AdsenseBody({ data, account, t }: { data: UsagePayload; account: AdsenseAccount; t: T }) {
  return <AdsenseDetail account={account} updatedAt={data.updated_at} t={t} />;
}

function WeatherAccountPage({ data, t }: { data: UsagePayload; t: T }) {
  const w = data.weather;
  // Busca config do weather via payload (location/units) — se não tiver, usa defaults
  const cfg: WeatherConfig | null = w?.location ? { enabled: true, hidden: false, location: w.location as WeatherConfig["location"], units: (w.units as WeatherConfig["units"]) || { temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" }, forecast_days: 7, past_days: 0, timezone: w.timezone || "auto", current: [], hourly: [], daily: [], display: { show_current: true, show_hourly: true, show_daily: true, hourly_count: 12, daily_count: 7, fields: { temperature: true, feels_like: true, humidity: true, precipitation: true, wind: true, pressure: true, cloud_cover: true, uv_index: true, sunrise_sunset: true } } } : null;
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id="weather" large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{t.weather}</div>
          {w?.location?.name ? <div className={cardLabel}>{w.location.name}{w.location.country ? `, ${w.location.country}` : ""}</div> : null}
        </div>
      </div>
      <WeatherDetail weather={w} config={cfg} t={t} />
    </div>
  );
}

function CurrenciesAccountPage({ data, t }: { data: UsagePayload; t: T }) {
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[28px] leading-none">💱</span>
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{t.currencies}</div>
        </div>
      </div>
      <CurrenciesDetail currencies={data.currencies} t={t} />
    </div>
  );
}

function GitAccountPage({ meta, t }: { meta: ProviderMeta; t: T }) {
  const repo = meta.gitRepo ?? meta.git?.repos?.find((r) => `git:${r.id}` === meta.id) ?? meta.git?.repos?.[0] ?? null;
  const name = repo ? (repo.label || repo.source.split("/").pop()?.replace(/\.git$/, "") || repo.source.slice(0, 24)) : t.git;
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id="git" large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{name}</div>
          {repo?.source ? <div className={cardLabel}>{repo.source}{repo.branch ? ` · ${repo.branch}` : ""}</div> : null}
        </div>
      </div>
      <GitDetail repo={repo} git={meta.git} t={t} />
    </div>
  );
}

function RetroAccountPage({ meta, t }: { meta: ProviderMeta; t: T }) {
  const ra = meta.retroachievements;
  if (!ra) return <div className={metricCard}><div className={errorText}>{t.noData}</div></div>;
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id="retroachievements" large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{ra.username ? `RetroAchievements · ${ra.username}` : "RetroAchievements"}</div>
          {ra.motto ? <div className={cardLabel}>{ra.motto}</div> : null}
        </div>
      </div>
      <div className="flex w-full flex-col gap-[14px]">
        {!ra.ok ? <div className={metricCard}><div className={errorText}>{ra.error || t.noData}</div></div> : <RetroAchievementsDetail account={ra} t={t} />}
      </div>
    </div>
  );
}

function CalendarAccountPage({ data, t }: { data: UsagePayload; t: T }) {
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id="calendar" large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{t.calendar}</div>
          {data.calendar?.calendars?.length ? <div className={cardLabel}>{data.calendar.calendars.length} calendário{data.calendar.calendars.length === 1 ? "" : "s"}</div> : null}
        </div>
      </div>
      <CalendarDetail calendar={data.calendar} t={t} />
    </div>
  );
}

function RssAccountPage({ data, t }: { data: UsagePayload; t: T }) {
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id="rss" large />
        <div>
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{t.rss}</div>
          {data.rss?.feeds?.length ? <div className={cardLabel}>{data.rss.feeds.length} feed{data.rss.feeds.length === 1 ? "" : "s"}</div> : null}
        </div>
      </div>
      <RssDetail rss={data.rss} t={t} />
    </div>
  );
}

export function AccountPage({ meta, account, data, t, pal, nowMs }: { meta: ProviderMeta; account: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | BitcoinAccount | AdsenseAccount | RetroAchievementsAccount | null; data: UsagePayload; t: T; pal: Pal; nowMs: number }) {
  // Weather, Moedas, Git e RetroAchievements têm página própria
  if (meta.provider === "weather" || meta.kind === "weather") {
    return <WeatherAccountPage data={data} t={t} />;
  }
  if (meta.provider === "currencies" || meta.kind === "currencies") {
    return <CurrenciesAccountPage data={data} t={t} />;
  }
  if (meta.provider === "git" || meta.kind === "git") {
    return <GitAccountPage meta={meta} t={t} />;
  }
  if (meta.provider === "retroachievements" || meta.kind === "retroachievements") {
    return <RetroAccountPage meta={meta} t={t} />;
  }
  if (meta.provider === "calendar" || meta.kind === "calendar") {
    return <CalendarAccountPage data={data} t={t} />;
  }
  if (meta.provider === "rss" || meta.kind === "rss") {
    return <RssAccountPage data={data} t={t} />;
  }
  let body: ReactNode = null;
  if (meta.ok && account) {
    if (meta.provider === "claude") body = <ClaudeBody data={data} account={account as ClaudeAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "gpt") body = <GptBody data={data} account={account as GptAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "cursor") body = <CursorBody data={data} account={account as CursorAccount} t={t} pal={pal} nowMs={nowMs} />;
    else if (meta.provider === "openrouter" || meta.provider === "deepseek" || meta.provider === "opencode" || meta.provider === "fal") {
      body = <CreditsDetail metrics={meta.metrics} updatedAt={data.updated_at} note={meta.provider === "openrouter" ? t.allKeysNote : null} t={t} pal={pal} nowMs={nowMs} />;
    }
    else if (meta.provider === "bitcoin") body = <BitcoinBody data={data} account={account as BitcoinAccount} t={t} />;
    else if (meta.provider === "adsense") body = <AdsenseBody data={data} account={account as AdsenseAccount} t={t} />;
  }
  const siteUrl = PROVIDER_SITE_URL[meta.provider];
  return (
    <div className={`w-full ${viewFade}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon id={meta.provider} large />
        <div className="flex-1">
          <div className="text-[19px] font-[750] leading-none tracking-[-.1px]">{meta.title}</div>
          {meta.label ? <div className={cardLabel}>{meta.label}</div> : null}
        </div>
        {siteUrl ? (
          <a
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-edge bg-chip px-2.5 py-1.5 text-[12.5px] font-medium text-ink2 no-underline transition-colors duration-150 hover:bg-chip/70 hover:text-ink"
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={t.openOfficialSite}
          >
            <ExternalLinkIcon size={14} /> {t.openOfficialSite}
          </a>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-[14px]">{!meta.ok ? <div className={metricCard}><div className={errorText}>{meta.error || t.noData}</div></div> : body}</div>
    </div>
  );
}
