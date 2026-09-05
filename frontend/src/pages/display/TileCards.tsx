import type { CSSProperties } from "react";
import { useState } from "react";
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
import { ImageBoardCard, imageAllowedSizes, imageSizeLabel } from "../../components/cards/ImageCard";
import { NoteBoardCard, noteAllowedSizes, noteSizeLabel } from "../../components/cards/NoteCard";
import { RetroAchievementsBoardCard, retroAllowedSizes, retroSizeLabel } from "../../components/cards/RetroAchievementsCard";
import { RssBoardCard, rssAllowedSizes, rssSizeLabel } from "../../components/cards/RssCard";
import { WeatherBoardCard, weatherAllowedSizes, weatherSizeLabel } from "../../components/cards/WeatherCard";
import { ntcGenerateReadableColor, useNameToColor } from "../../hooks/useNameToColor";
import type { T } from "../../i18n";
import { viewFade } from "../../tw";
import { SizeMenu, TileChrome } from "./SizeMenu";
import { TileColorPicker } from "./TileColorPicker";
import type { Pal, ProviderMeta } from "./types";

function tileFg(bg: string | null | undefined): string | null {
  if (!bg) return null;
  const pair = ntcGenerateReadableColor(bg);
  if (pair) return pair[0];
  // fallback: simple luminance
  const hex = bg.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return lum > 0.5 ? "#000000" : "#ffffff";
}

function useTileStyle(bg: string | null | undefined): CSSProperties | undefined {
  const { ready } = useNameToColor();
  void ready;
  if (!bg) return undefined;
  const fg = tileFg(bg);
  if (!fg) return { backgroundColor: bg } as CSSProperties;
  const toRgba = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  };
  return {
    backgroundColor: bg,
    color: fg,
    ["--card" as unknown as string]: bg,
    ["--card-border" as unknown as string]: toRgba(fg, 0.14),
    ["--chip" as unknown as string]: toRgba(fg, 0.1),
    ["--text" as unknown as string]: fg,
    ["--text-dim" as unknown as string]: toRgba(fg, 0.78),
    ["--text-muted" as unknown as string]: toRgba(fg, 0.58),
    borderColor: toRgba(fg, 0.14),
  } as CSSProperties;
}

const TILE_BASE = "group/tile relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border bg-panel shadow-card";
const TILE_STATE = (dragging?: boolean, lifted?: boolean) => cn(
  lifted && "border-accent shadow-card-hover rotate-[1.5deg] cursor-grabbing",
  dragging && !lifted && "border-dashed border-edge opacity-35",
  !dragging && !lifted && "border-edge transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover",
  "[.flat_&]:shadow-none [.flat_&]:hover:translate-y-0 [.flat_&]:rotate-0",
);

export function WeatherTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = weatherAllowedSizes(p.weather);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => weatherSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <WeatherBoardCard weather={p.weather} config={p.weatherConfig} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function CurrenciesTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = currenciesAllowedSizes(p.currencies?.items);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => currenciesSizeLabel(s, t, p.currencies?.items)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <CurrenciesBoardCard currencies={p.currencies} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function ClockTileCard({ p, size, dragging, lifted, t, nowMs, grip, bg, readonly, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs: number; grip?: object; bg?: string | null; readonly?: boolean; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = clockAllowedSizes();
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => clockSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <ClockBoardCard nowMs={nowMs} size={size} />
    </div>
  );
}

export function EyeTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = eyeAllowedSizes();
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => eyeSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <EyeBoardCard size={size} />
    </div>
  );
}

export function ClaudeTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = claudeAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => claudeSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <ClaudeBoardCard metrics={p.metrics} label={p.label} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function CursorTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw" || normalizeSize(size) === "sx";
  const allowed = cursorAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => cursorSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <CursorBoardCard metrics={p.metrics} label={p.label} title={p.title} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function GptTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = gptAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => gptSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <GptBoardCard metrics={p.metrics} label={p.label} title={p.title} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function CreditsTileCard({ p, pal, size, dragging, lifted, t, nowMs, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; nowMs?: number; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = creditsAllowedSizes(p.metrics);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => creditsSizeLabel(s, t, p.metrics)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <CreditsBoardCard providerId={p.provider} metrics={p.metrics} label={p.label} title={p.title} ok={p.ok} error={p.error} t={t} pal={pal} nowMs={nowMs} size={size} onOpen={onOpen} />
    </div>
  );
}

export function BitcoinTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = bitcoinAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => bitcoinSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <BitcoinBoardCard metrics={p.metrics} label={p.label} ok={p.ok} error={p.error} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function AdsenseTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; pal: Pal; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const sm = normalizeSize(size) === "sm" || normalizeSize(size) === "sw";
  const allowed = adsenseAllowedSizes(null, p.metrics);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, sm ? "px-2.5 py-2" : "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => adsenseSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <AdsenseBoardCard metrics={p.metrics} label={p.label} ok={p.ok} error={p.error} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function GitTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = gitAllowedSizes(p.gitRepo ?? null);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => gitSizeLabel(s, t, p.gitRepo ?? null)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <GitBoardCard repo={p.gitRepo ?? null} git={p.git} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function RetroAchievementsTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = retroAllowedSizes(p.retroachievements ?? null);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => retroSizeLabel(s, t)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <RetroAchievementsBoardCard account={p.retroachievements!} metrics={p.metrics} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function RssTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onOpen, onSetSize, onDuplicate, onRemove, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onOpen: () => void; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  const allowed = rssAllowedSizes(p.rss);
  const isClone = isCloneId(p.id);
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={allowed} getLabel={(s) => rssSizeLabel(s, t, p.rss)} isClone={isClone} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <RssBoardCard rss={p.rss} t={t} size={size} onOpen={onOpen} />
    </div>
  );
}

export function NoteTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onSetSize, onDuplicate, onRemove, onUpdate, onSetBg, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onUpdate?: (id: string, patch: { text?: string; color?: string }) => void; onSetBg?: (id: string, next: string | null) => void; onFree?: (id: string) => void }) {
  void imageAllowedSizes;
  const style = useTileStyle(bg);
  const [editing, setEditing] = useState(false);
  const chromeHidden = readonly || editing || Boolean(lifted);
  return (
    <div className={cn(TILE_BASE, "px-3.5 pb-3 pt-3", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!chromeHidden ? (
        <TileChrome id={p.id} t={t} grip={grip} size={size} onSetSize={onSetSize} allowed={noteAllowedSizes()} getLabel={(s) => noteSizeLabel(s, t)} isClone={true} onDuplicate={onDuplicate} onRemove={onRemove} bg={bg} onSetBg={onSetBg} onFree={onFree} />
      ) : null}
      <NoteBoardCard text={p.note?.text ?? ""} colorId={p.note?.color ?? "yellow"} size={size} t={t} readonly={readonly} onUpdate={(patch) => onUpdate?.(p.id, patch)} onEditingChange={setEditing} />
    </div>
  );
}

export function ImageTileCard({ p, size, dragging, lifted, t, grip, bg, readonly, onSetSize, onDuplicate, onRemove, onEdit, onSetBg, onTransformChange, onFree }: { p: ProviderMeta; size: CardSize; dragging?: boolean; lifted?: boolean; t: T; grip?: object; bg?: string | null; readonly?: boolean; onSetSize: (next: CardSize) => void; onDuplicate?: (id: string) => void; onRemove?: (id: string) => void; onEdit?: (id: string) => void; onSetBg?: (id: string, next: string | null) => void; onTransformChange?: (id: string, next: { x: number; y: number; scale: number }) => void; onFree?: (id: string) => void }) {
  // image widgets are always removable (not clones only) — show remove for all
  const showRemove = true;
  const style = useTileStyle(bg);
  return (
    <div className={cn(TILE_BASE, "p-2", TILE_STATE(dragging, lifted), !lifted && viewFade)} style={style}>
      {!lifted && !readonly ? (
        <div className="absolute inset-0 z-[3] pointer-events-none">
          <div className="absolute left-1 top-1 flex items-center rounded-lg border border-edge bg-chip pointer-events-auto opacity-0 group-hover/tile:opacity-100 group-hover/tile:pointer-events-auto transition-opacity max-[860px]:opacity-100 max-[860px]:pointer-events-auto">
            <button type="button" className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink3 touch-none hover:bg-chip hover:text-ink active:cursor-grabbing" aria-label={t.dragCard} title={t.dragCard} {...grip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="19" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="19" r="1.2" fill="currentColor" stroke="none" /></svg>
            </button>
          </div>
          <div className="absolute right-1 top-1 flex items-center rounded-lg border border-edge bg-chip pointer-events-auto opacity-0 group-hover/tile:opacity-100 group-hover/tile:pointer-events-auto transition-opacity max-[860px]:opacity-100 max-[860px]:pointer-events-auto">
            {onEdit ? <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink3 hover:bg-chip hover:text-ink" title={t.imageEditTitle ?? "Editar"} aria-label={t.imageEditTitle ?? "Editar"} onClick={(e) => { e.stopPropagation(); onEdit(p.id); }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button> : null}
            {onDuplicate ? <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink3 hover:bg-chip hover:text-ink" title="Duplicar" aria-label="Duplicar" onClick={(e) => { e.stopPropagation(); onDuplicate(p.id); }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" /></svg></button> : null}
            {onSetBg ? <span className="flex items-center"><span className="mx-0.5 h-4 w-px bg-edge" aria-hidden /><span className="flex size-7 items-center justify-center"><TileColorPicker value={bg ?? null} onChange={(next: string | null) => onSetBg(p.id, next)} /></span></span> : null}
            <SizeMenu size={size} t={t} onChange={onSetSize} allowed={imageAllowedSizes()} getLabel={(s) => imageSizeLabel(s, t)} onFree={onFree ? () => onFree(p.id) : undefined} />
            {showRemove && onRemove ? <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-bad hover:bg-chip" title="Remover" aria-label="Remover" onClick={(e) => { e.stopPropagation(); onRemove(p.id); }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg></button> : null}
          </div>
        </div>
      ) : null}
      <ImageBoardCard src={p.imageSrc} fit={p.imageFit} transform={p.imageTransform} t={t} size={size} readonly={readonly} onConfigure={() => onEdit?.(p.id)} onTransformChange={!readonly && onTransformChange ? (next) => onTransformChange(p.id, next) : undefined} />
    </div>
  );
}
