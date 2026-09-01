/** Classes Tailwind reutilizadas (mesmo visual do CSS antigo). */

export const num = "font-mono tabular-nums";
export const viewFade = "animate-fade";

export const iconBtn =
  "flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] border-0 bg-transparent text-ink2 transition-colors duration-150 hover:bg-chip hover:text-ink";

export const iconChip =
  "flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]";

export const iconImg = "size-[19px] object-contain";

export const cardLabel = "mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-medium text-ink3";

export const errorText = "text-[13px] leading-[1.55] text-bad";

export const emptyNote = "px-5 py-12 text-center text-sm text-ink3";

export const accentLink = "font-[650] text-accent no-underline hover:underline";

export const barTrack =
  "h-[7px] overflow-hidden rounded-[5px] bg-surface shadow-[inset_0_1px_2px_rgba(0,0,0,.28)] [.flat_&]:shadow-none";

export const barFill =
  "h-full min-w-0 rounded-[5px] bg-gradient-to-b from-white/20 to-transparent bg-blend-overlay [.flat_&]:bg-none";

export const metricCard =
  "flex h-full min-w-0 flex-col rounded-2xl border border-edge bg-panel px-[18px] py-4 shadow-card [.flat_&]:shadow-none";

export const cfgCard =
  "flex h-full min-w-0 w-full flex-col gap-3 rounded-2xl border border-edge bg-panel px-[18px] py-4 shadow-card [.flat_&]:shadow-none";

export const cfgGrid =
  "grid w-full gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr))] [&>form]:contents";

export const overviewGrid =
  "grid w-full gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]";

export const metricsGrid =
  "grid w-full gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]";

export const cfgSkel =
  "box-border min-w-0 overflow-hidden rounded-2xl border border-edge bg-[linear-gradient(90deg,var(--card)_0%,var(--chip)_50%,var(--card)_100%)] bg-[length:200%_100%] animate-shimmer";

export const cfgFieldLabel = "text-[11.5px] font-[650] uppercase tracking-[.4px] text-ink3";

export const cfgHint = "m-0 text-[12.5px] leading-normal text-ink3";

export const cfgStatus = "m-0 min-h-[1.2em] text-[12.5px] text-ink3";

export const sideItem =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-[9px] py-2 text-left text-[13.5px] text-ink2 no-underline transition-colors duration-150 hover:bg-chip hover:text-ink";

export const sideItemActive =
  "bg-chip text-ink shadow-[inset_0_0_0_1px_var(--card-border),inset_2px_0_0_var(--accent)]";

export const shell = "flex min-h-screen flex-col bg-canvas";
