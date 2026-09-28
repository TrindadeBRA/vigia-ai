import { useEffect, useState } from "react";
import { fetchSpTransPrevisao } from "../../api/client";
import type { SpTransLineForecast, SpTransPrevisao, SpTransStop } from "../../api/types";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import { cn } from "../../cn";
import type { T } from "../../i18n";
import { cardLabel, errorText, num } from "../../tw";

export function sptransAllowedSizes(): CardSize[] {
  return ["sm", "md", "lg", "wl", "wxl", "free"];
}

export function sptransSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.sptransNext;
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  if (s === "free") return t.cardFree;
  return t.cardXl;
}

const POLL_MS = 30000;

function useSpTransPrevisao(cp: number): SpTransPrevisao | null {
  const [state, setState] = useState<SpTransPrevisao | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (document.hidden) return;
      try {
        const data = await fetchSpTransPrevisao(cp);
        if (alive) setState(data);
      } catch {
        if (alive) {
          setState((prev) =>
            prev
              ? { ...prev, ok: false, error: "offline" }
              : { ok: false, error: "offline", updated_at: null, hr: null, cp, np: null, lines: [] },
          );
        }
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cp]);

  return state;
}

function fmtEta(mins: number | null, t: T): string {
  if (mins === null) return "--";
  if (mins <= 1) return t.sptransArriving;
  return `${mins} ${t.sptransMin}`;
}

function Icon({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]", compact ? "size-7 text-[15px]" : "size-[42px] text-[22px]")}>
      <span role="img" aria-label="ônibus">🚌</span>
    </div>
  );
}

function SpTransHeader({ stop, t, compact }: { stop: SpTransStop; t: T; compact?: boolean }) {
  const title = stop.nickname.trim() || stop.name || `${t.sptransTitle} ${stop.cp}`;
  return (
    <div className={cn("flex min-w-0 shrink-0 items-center", compact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>
      <div className="relative shrink-0">
        <Icon compact={compact} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>{title}</div>
        <div className={cardLabel}>{stop.name && stop.nickname.trim() ? stop.name : t.sptransTitle}</div>
      </div>
    </div>
  );
}

function LineRow({ line, t, big }: { line: SpTransLineForecast; t: T; big?: boolean }) {
  const dest = line.lt0 || line.lt1 || line.c;
  const eta = line.next ? fmtEta(line.next.mins, t) : t.sptransNoForecast;
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2", big ? "text-[13.5px]" : "text-[12px]")}>
      <span className="min-w-0 flex-1">
        <span className={cn("block overflow-hidden text-ellipsis whitespace-nowrap font-bold text-ink", num)}>{line.c}</span>
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{dest}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn(num, "block font-[800] leading-tight text-ink", big ? "text-[16px]" : "text-[13px]")}>{eta}</span>
        {line.next?.t ? (
          <span className={cn(num, "block leading-none text-ink3", big ? "text-[11px]" : "text-[10px]")}>
            {line.next.t}{line.next.a ? " · ♿" : ""} · {line.next.p}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function SpTransBoardCard({
  stop,
  t,
  size,
}: {
  stop: SpTransStop;
  t: T;
  size: CardSize;
}) {
  const previsao = useSpTransPrevisao(stop.cp);
  const ns = normalizeSize(size);
  const isCompact = ns === "sm";

  if (!stop.lines.length) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <SpTransHeader stop={stop} t={t} compact={isCompact} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{t.sptransNoLines}</div>
        </div>
      </div>
    );
  }

  if (!previsao) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <SpTransHeader stop={stop} t={t} compact={isCompact} />
        <div className="flex flex-1 items-center">
          <div className={cn(cardLabel, "animate-pulse")}>…</div>
        </div>
      </div>
    );
  }

  if (!previsao.ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <SpTransHeader stop={stop} t={t} compact={isCompact} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{previsao.error || t.sptransNoForecast}</div>
        </div>
      </div>
    );
  }

  const byCl = new Map(previsao.lines.map((l) => [l.cl, l]));
  const ordered: SpTransLineForecast[] = stop.lines.map((m) => byCl.get(m.cl)).filter((l): l is SpTransLineForecast => Boolean(l));
  for (const l of previsao.lines) {
    if (!ordered.some((o) => o.cl === l.cl)) ordered.push(l);
  }

  if (ns === "sm") {
    const line = ordered[0];
    if (!line) {
      return (
        <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
          <Icon />
          <div className={cn(errorText, "text-[11px] leading-snug")}>{t.sptransNoForecast}</div>
        </div>
      );
    }
    const dest = line.lt0 || line.lt1 || line.c;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <Icon />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden">
          <div className={cn(num, "overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[800] leading-tight")}>{line.c}</div>
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{dest}</div>
          <div className={cn(num, "mt-1 text-[15px] font-[800] leading-tight text-ink")}>
            {line.next ? fmtEta(line.next.mins, t) : t.sptransNoForecast}
            {line.next?.t ? <span className="ml-1.5 text-[11px] font-semibold text-ink3">{line.next.t}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  if (ns === "md") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <SpTransHeader stop={stop} t={t} />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
          {ordered.slice(0, 3).map((line) => (
            <LineRow key={line.cl} line={line} t={t} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <SpTransHeader stop={stop} t={t} />
      <div className="flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-hidden pt-1">
        {ordered.map((line) => (
          <LineRow key={line.cl} line={line} t={t} big />
        ))}
      </div>
    </div>
  );
}
