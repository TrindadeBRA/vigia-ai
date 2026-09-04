import { cn } from "../../cn";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import type { T } from "../../i18n";
import { num } from "../../tw";

/** Widget de relógio — não vem de conta/backend, é só visual. */
export function clockAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg"];
}

export function clockSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.widgetSmall;
  if (s === "md") return t.cardNormal;
  return t.cardLarge;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function ClockBoardCard({ nowMs, size }: { nowMs: number; size: CardSize }) {
  const s = normalizeSize(size);
  const big = s !== "sm";
  const d = new Date(nowMs);
  const dateStr = d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1">
      <div className={cn(num, "font-[800] leading-none tabular-nums", big ? "text-[34px]" : "text-[22px]")}>
        {pad2(d.getHours())}:{pad2(d.getMinutes())}
        {big ? <span className="text-ink3">:{pad2(d.getSeconds())}</span> : null}
      </div>
      {big ? <div className="text-[12px] font-medium capitalize text-ink3">{dateStr}</div> : null}
    </div>
  );
}
