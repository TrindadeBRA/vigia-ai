import { isCloneId, normalizeSize, type CardSize } from "../../board";
import { cn } from "../../cn";
import { AdsenseBoardCard, adsenseAllowedSizes, adsenseSizeLabel } from "../../components/cards/AdsenseCard";
import { BitcoinBoardCard, bitcoinAllowedSizes, bitcoinSizeLabel } from "../../components/cards/BitcoinCard";
import { ClaudeBoardCard, claudeAllowedSizes, claudeSizeLabel } from "../../components/cards/ClaudeCard";
import { ClockBoardCard, clockAllowedSizes, clockSizeLabel } from "../../components/cards/ClockCard";
import { CreditsBoardCard, creditsAllowedSizes, creditsSizeLabel } from "../../components/cards/CreditsCard";
import { CurrenciesBoardCard, currenciesAllowedSizes, currenciesSizeLabel } from "../../components/cards/CurrenciesCard";
import { CursorBoardCard, cursorAllowedSizes, cursorSizeLabel } from "../../components/cards/CursorCard";
import { EyeBoardCard, eyeAllowedSizes, eyeSizeLabel } from "../../components/cards/EyeCard";
import { GitBoardCard, gitAllowedSizes, gitSizeLabel } from "../../components/cards/GitCard";
import { GptBoardCard, gptAllowedSizes, gptSizeLabel } from "../../components/cards/GptCard";
import { RetroAchievementsBoardCard, retroAllowedSizes, retroSizeLabel } from "../../components/cards/RetroAchievementsCard";
import { RssBoardCard, rssAllowedSizes, rssSizeLabel } from "../../components/cards/RssCard";
import { WeatherBoardCard, weatherAllowedSizes, weatherSizeLabel } from "../../components/cards/WeatherCard";
import type { T } from "../../i18n";
import { viewFade } from "../../tw";
import { TileChrome } from "./SizeMenu";
import type { Pal, ProviderMeta } from "./types";

const TILE_BASE = "group/tile relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border bg-panel shadow-card";
const TILE_STATE = (dragging?: boolean, lifted?: boolean) => cn(
  lifted && "border-accent shadow-card-hover rotate-[1.5deg] cursor-grabbing",
  dragging && !lifted && "border-dashed border-edge opacity-35",
  !dragging && !lifted && "border-edge transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover",
  "[.flat_&]:shadow-none [.flat_&]:hover:translate-y-0 [.flat_&]:rotate-0",
);

export function WeatherTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = weatherAllowedSizes(p.weather);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => weatherSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <WeatherBoardCard weather={p.weather} config={p.weatherConfig} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function CurrenciesTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = currenciesAllowedSizes(p.currencies?.items);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => currenciesSizeLabel(s, t, p.currencies?.items)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <CurrenciesBoardCard currencies={p.currencies} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function ClockTileCard({ p, size, dragging, lifted, t, nowMs, grip, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs: number; grip?: object; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = clockAllowedSizes();
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => clockSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <ClockBoardCard nowMs={nowMs} size={size} />
    </div>
  );
}

export function EyeTileCard({ p, size, dragging, lifted, t, grip, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = eyeAllowedSizes();
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => eyeSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <EyeBoardCard size={size} />
    </div>
  );
}

export function ClaudeTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = claudeAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => claudeSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <ClaudeBoardCard metrics={p.metrics} label={p.label} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function CursorTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw" || normalizeSize(size) === "sx";
  const allowed = cursorAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => cursorSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <CursorBoardCard metrics={p.metrics} label={p.label} title={p.title} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function GptTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = gptAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => gptSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <GptBoardCard metrics={p.metrics} label={p.label} title={p.title} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function CreditsTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = creditsAllowedSizes(p.metrics);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => creditsSizeLabel(s, t, p.metrics)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <CreditsBoardCard providerId={p.provider} metrics={p.metrics} label={p.label} title={p.title} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function BitcoinTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = bitcoinAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => bitcoinSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <BitcoinBoardCard metrics={p.metrics} label={p.label} ok={p.ok} error={p.error} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function AdsenseTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = adsenseAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => adsenseSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <AdsenseBoardCard metrics={p.metrics} label={p.label} ok={p.ok} error={p.error} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function GitTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = gitAllowedSizes(p.gitRepo ?? null);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => gitSizeLabel(s, t, p.gitRepo ?? null)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <GitBoardCard repo={p.gitRepo ?? null} git={p.git} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function RetroAchievementsTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = retroAllowedSizes(p.retroachievements ?? null);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => retroSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <RetroAchievementsBoardCard account={p.retroachievements!} metrics={p.metrics} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function RssTileCard({ p, size, dragging, lifted, t, grip, onOpen, onSetSize, onDuplicate, onRemove }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void }) {
  const allowed = rssAllowedSizes(p.rss);
  const isClone = isCloneId(p.id);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)}>
      {!lifted ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => rssSizeLabel(s, t, p.rss)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} />
      ) : null}
      <RssBoardCard rss={p.rss} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}
