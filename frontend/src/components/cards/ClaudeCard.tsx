import { cn } from "../../cn";
import type { ClaudeAccount } from "../../api/types";
import type { Metric } from "../../pages/Display";
import { barColor, barGlow, clamp, fmtCountdown, fmtPct, fmtRemain, fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { PROVIDER_ICON, type ThemeName, PALETTES } from "../../theme";
import { barFill, barTrack, cardLabel, errorText, metricCard, metricsGrid, num } from "../../tw";
import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";

/* ── Dados ──────────────────────────────────────────────────────────── */

// Re-exporta a lógica de métricas do Claude para reuso máximo (buildProviders usa equivalente)
// Mantém paridade com backend: 4 janelas opcionais.
export function getClaudeMetrics(c: ClaudeAccount, t: T): Metric[] {
  const out: Metric[] = [];
  if (c.session_percent != null || c.session_resets_at) {
    out.push({
      label: t.session5h,
      pct: c.session_percent,
      sub: c.session_percent != null ? t.remainingPrefix + fmtRemain(c.session_percent) : null,
      countdownAt: c.session_resets_at,
    });
  }
  if (c.weekly_percent != null || c.weekly_resets_at) {
    out.push({
      label: t.weekLimit,
      pct: c.weekly_percent,
      sub: c.weekly_percent != null ? t.remainingPrefix + fmtRemain(c.weekly_percent) : null,
      countdownAt: c.weekly_resets_at,
    });
  }
  if (c.sonnet_percent != null) {
    out.push({
      label: t.sonnetWeek,
      pct: c.sonnet_percent,
      sub: t.remainingPrefix + fmtRemain(c.sonnet_percent),
      countdownAt: c.sonnet_resets_at,
    });
  }
  if (c.opus_percent != null) {
    out.push({
      label: t.opusWeek,
      pct: c.opus_percent,
      sub: t.remainingPrefix + fmtRemain(c.opus_percent),
      countdownAt: c.opus_resets_at,
    });
  }
  if (!out.length) out.push({ label: t.session5h, pct: null, sub: t.noData });
  return out;
}

export function hasClaudeExtras(c: ClaudeAccount): boolean {
  return c.sonnet_percent != null || c.opus_percent != null;
}

// Quais tamanhos fazem sentido para esta conta?
// - sem Sonnet/Opus (2 janelas): sm/sw/md/lg bastam; xl/wl/wxl ficam com muito vazio
// - com Sonnet/Opus (3-4 janelas): wl é útil (1×4 alto mostra as 4); xl (2×2 extra grande) e wxl (2×4) não fazem sentido pro Claude
export function claudeAllowedSizes(c: ClaudeAccount | null, metrics?: Metric[]): CardSize[] {
  const count = metrics?.length ?? (c ? getClaudeMetrics(c, { session5h: "", weekLimit: "", sonnetWeek: "", opusWeek: "", remainingPrefix: "", noData: "" } as unknown as T).length : 2);
  // dois pequenos: sm = 5h, sw = semana
  if (count >= 3) return ["sm", "sw", "md", "lg", "wl"];
  return ["sm", "sw", "md", "lg"];
}

export const CLAUDE_ALLOWED_ALL: CardSize[] = ["sm", "sw", "md", "lg", "wl"];

export function claudeSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "sm") return t.cardSmall; // "Pequeno · 5h"
  if (s === "sw") return t.cardSmallWeek; // "Pequeno · semana"
  if (s === "md") return t.cardNormal;
  if (s === "lg") return t.cardLarge;
  if (s === "wl") return t.cardWl;
  if (s === "wxl") return t.cardWxl;
  return t.cardXl;
}

/* ── Primitivos visuais (reúso máximo) ─────────────────────────────── */

function barStyle(pct: number, pal: (typeof PALETTES)[ThemeName]) {
  const v = clamp(pct, 0, 100);
  return { width: `${v}%`, minWidth: v > 0 ? 7 : 0, background: barColor(pct, pal), boxShadow: barGlow(pct, pal) };
}

function Icon({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
        <img className="size-3.5 object-contain" src={PROVIDER_ICON.claude} alt="claude" draggable={false} />
      </div>
    );
  return (
    <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
      <img className="size-[23px] object-contain" src={PROVIDER_ICON.claude} alt="claude" draggable={false} />
    </div>
  );
}

function ClaudeHeader({
  label,
  compact,
  ok,
  onOpen,
}: {
  label: string;
  compact?: boolean;
  ok: boolean;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <div className="relative shrink-0">
        <Icon compact={compact} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-[650] leading-none", compact ? "text-[12.5px]" : "text-[14px]")}>Claude</div>
        {label ? <div className={cardLabel}>{label}</div> : null}
      </div>
    </>
  );
  if (onOpen) {
    return (
      <button type="button" className={cn("flex min-w-0 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-ink", compact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")} onClick={onOpen}>
        {inner}
      </button>
    );
  }
  return <div className={cn("flex min-w-0 shrink-0 items-center", compact ? "mb-1.5 gap-2" : "mb-2.5 gap-2.5")}>{inner}</div>;
}

/* ── Linhas de métrica ────────────────────────────────────────────── */

function CompactRow({ m, pal, t, nowMs }: { m: Metric; pal: (typeof PALETTES)[ThemeName]; t: T; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="mt-1.5 flex min-w-0 flex-col gap-1 first:mt-0">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none text-ink3">{m.label}</span>
        <span className={cn(num, "min-w-0 text-[15px] font-bold leading-tight")}>{m.sub || "--"}</span>
        {clock ? <span className={cn(num, "text-[11px] font-[550] text-ink2")}>{t.resetIn} {clock}</span> : null}
      </div>
    );
  }
  const extra = clock ? `${t.resetIn} ${clock}` : fmtRemain(m.pct) !== "--" ? `${t.left} ${fmtRemain(m.pct)}` : null;
  return (
    <div className="mt-1.5 min-w-0 first:mt-0">
      <div className="mb-1 flex items-baseline justify-between gap-1.5 text-[11px] leading-none">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">{m.label}</span>
        <span className={`${num} shrink-0 text-[12px] font-bold text-ink`}>{fmtPct(m.pct)}</span>
      </div>
      <div className={cn(barTrack, "h-[5px]")}>
        <div className={barFill} style={barStyle(m.pct, pal)} />
      </div>
      {extra ? <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[550] text-ink2")}>{extra}</div> : null}
    </div>
  );
}

function Row({ m, pal, t, nowMs }: { m: Metric; pal: (typeof PALETTES)[ThemeName]; t: T; nowMs?: number }) {
  const clock = m.countdownAt ? fmtCountdown(m.countdownAt, nowMs) : null;
  if (m.pct == null) {
    return (
      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        </div>
        <div className={cn(num, "text-[15px] font-bold")}>{m.sub || "--"}</div>
        {clock ? <div className={cn(num, "mt-1 text-[11.5px] font-[550] text-ink2")}>{t.resetIn} {clock}</div> : null}
      </div>
    );
  }
  const pctText = fmtPct(m.pct);
  const footerRemain = `${t.left} ${fmtRemain(m.pct)}`;
  const footerClock = clock ? `${t.resetIn} ${clock}` : null;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink2">{m.label}</span>
        <span className={`${num} shrink-0 text-sm font-bold`}>{pctText}</span>
      </div>
      <div className={barTrack}>
        <div className={barFill} style={barStyle(m.pct, pal)} />
      </div>
      <div className="mt-[5px] flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11.5px] leading-tight text-ink3">
        <span>{footerRemain}</span>
        {footerClock ? <span className={cn(num, "font-[550] text-ink2")}>· {footerClock}</span> : null}
      </div>
    </div>
  );
}

/* ── Board card ───────────────────────────────────────────────────── */

export function ClaudeBoardCard({
  account,
  metrics: metricsProp,
  label,
  ok,
  error,
  t,
  pal,
  nowMs,
  size,
  onOpen,
}: {
  account?: ClaudeAccount | null;
  metrics?: Metric[];
  label: string;
  ok: boolean;
  error: string | null;
  t: T;
  pal: (typeof PALETTES)[ThemeName];
  nowMs?: number;
  size: CardSize;
  onOpen: () => void;
}) {
  const metrics = metricsProp ?? (account ? getClaudeMetrics(account, t) : []);
  const ns = normalizeSize(size);
  const isCompact = ns === "sm" || ns === "sw";

  if (!ok) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <ClaudeHeader label={label} compact={isCompact} ok={ok} onOpen={onOpen} />
        <div className="flex flex-1 items-center">
          <div className={cn(errorText, isCompact && "text-[11px] leading-snug")}>{error || t.noData}</div>
        </div>
      </div>
    );
  }

  // sm/sw: pequenos 2×1 quarter — 1 contador cada, ícone à esquerda, usuário escolhe
  if (ns === "sm" || ns === "sw") {
    const isWeek = ns === "sw";
    const single = isWeek ? metrics[1] || metrics[0] : metrics[0];
    const clock = single?.countdownAt ? fmtCountdown(single.countdownAt, nowMs) : null;
    return (
      <div className="flex h-full min-h-0 w-full items-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]">
            <img className="size-[23px] object-contain" src={PROVIDER_ICON.claude} alt="claude" draggable={false} />
          </div>
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--panel)]", ok ? "bg-good" : "bg-bad")} />
        </div>
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {single ? (
            <>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-none text-ink3">{single.label}</div>
              <div className={cn(num, "mt-1 text-[18px] font-[800] leading-none")}>{single.pct != null ? fmtPct(single.pct) : "--"}</div>
              {single.pct != null ? (
                <div className={cn(barTrack, "mt-1 h-[4px]")}>
                  <div className={barFill} style={barStyle(single.pct, pal)} />
                </div>
              ) : null}
              <div className={cn(num, "mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-[550] leading-none text-ink2")}>{clock || single.sub || ""}</div>
            </>
          ) : null}
        </button>
      </div>
    );
  }

  // md: 1×1 normal — 2 métricas, precisa caber sem cortar (header grande + 1×1 ~160px)
  // Usa layout compacto (barra 5px, footer 1 linha) para não estourar a altura.
  if (ns === "md") {
    const shown = metrics.slice(0, 2);
    const hidden = metrics.length - shown.length;
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <ClaudeHeader label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-center gap-0 overflow-hidden border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-0 overflow-hidden">
            {shown.map((m, i) => (
              <CompactRow key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
            ))}
          </div>
          {hidden > 0 ? <span className="mt-1 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold leading-none text-accent">+{hidden} • {t.sonnetWeek} / {t.opusWeek}</span> : null}
        </button>
      </div>
    );
  }

  // lg: 2×1 largo baixo — 2 colunas lado a lado
  if (ns === "lg") {
    const shown = metrics.slice(0, 2);
    const extra = metrics.slice(2);
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <ClaudeHeader label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 gap-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {shown.map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
        {extra.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {extra.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-ink3">
                {m.label} <span className={cn(num, "font-bold text-ink")}>{fmtPct(m.pct)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // xl: 2×2 — até 4 métricas em grade 2×2 ou pilha, com espaçamento
  if (ns === "xl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <ClaudeHeader label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-1 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 4).map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  // wl: 1×4 alto estreito — pilha vertical espaçada, cada barra maior
  if (ns === "wl") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <ClaudeHeader label={label} ok={ok} onOpen={onOpen} />
        <button type="button" className="flex min-h-0 flex-1 cursor-pointer flex-col justify-evenly gap-2 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
          {metrics.slice(0, 4).map((m, i) => (
            <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
          ))}
        </button>
      </div>
    );
  }

  // wxl: 2×4 super largo (oculto por padrão, mas se usado: grade 2 colunas)
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ClaudeHeader label={label} ok={ok} onOpen={onOpen} />
      <button type="button" className="grid min-h-0 flex-1 cursor-pointer grid-cols-2 content-evenly gap-x-4 gap-y-3 border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        {metrics.slice(0, 4).map((m, i) => (
          <Row key={i} m={m} pal={pal} t={t} nowMs={nowMs} />
        ))}
      </button>
    </div>
  );
}

/* ── Detail page ──────────────────────────────────────────────────── */

function joinParts(...parts: Array<string | null | undefined>): string | null {
  const out = parts.filter((p): p is string => Boolean(p && p.trim()));
  return out.length ? out.join("  ·  ") : null;
}
function remainLine(t: T, pct: number | null | undefined, resetsAt?: string | null): string | null {
  if (pct == null) return null;
  return joinParts(`${t.left} ${fmtRemain(pct)}`, resetsAt ? `${t.resetPrefix}${fmtWhen(resetsAt)}` : null);
}

function DetailMetricCard({
  label,
  pct,
  pal,
  sub,
}: {
  label: string;
  pct: number | null | undefined;
  pal: (typeof PALETTES)[ThemeName];
  sub?: string | null;
}) {
  const display = pct != null ? fmtPct(pct) : null;
  return (
    <div className={metricCard}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="text-ink2">{label}</span>
        {display ? <span className={`${num} text-[22px] font-[750]`}>{display}</span> : null}
      </div>
      {pct != null ? (
        <div className={`${barTrack} h-[9px]`}>
          <div className={barFill} style={barStyle(pct, pal)} />
        </div>
      ) : null}
      {sub ? <div className="mt-2.5 text-[12.5px] text-ink3">{sub}</div> : null}
    </div>
  );
}

export function ClaudeDetail({
  account,
  updatedAt,
  t,
  pal,
  nowMs,
}: {
  account: ClaudeAccount;
  updatedAt: string;
  t: T;
  pal: (typeof PALETTES)[ThemeName];
  nowMs: number;
}) {
  const c = account;
  const sessionClock = fmtCountdown(c.session_resets_at, nowMs);
  return (
    <>
      <div className="grid w-full overflow-hidden rounded-2xl border border-edge bg-edge [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-px">
        <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
          <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">{t.updated}</span>
          <span className={`${num} overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]`}>{fmtWhen(updatedAt)}</span>
        </div>
        {c.label ? (
          <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
            <span className="text-[11px] font-[650] uppercase tracking-[.45px] text-ink3">Label</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[650]">{c.label}</span>
          </div>
        ) : null}
      </div>
      <div className={metricsGrid}>
        <DetailMetricCard
          label={t.window5h}
          pct={c.session_percent}
          pal={pal}
          sub={joinParts(
            c.session_percent != null ? `${t.left} ${fmtRemain(c.session_percent)}` : null,
            sessionClock ? `${t.resetIn} ${sessionClock}` : c.session_resets_at ? `${t.resetPrefix}${fmtWhen(c.session_resets_at)}` : null,
          )}
        />
        <DetailMetricCard label={t.weekLimit} pct={c.weekly_percent} pal={pal} sub={remainLine(t, c.weekly_percent, c.weekly_resets_at)} />
        {c.sonnet_percent != null ? <DetailMetricCard label={t.sonnetWeek} pct={c.sonnet_percent} pal={pal} sub={remainLine(t, c.sonnet_percent, c.sonnet_resets_at)} /> : null}
        {c.opus_percent != null ? <DetailMetricCard label={t.opusWeek} pct={c.opus_percent} pal={pal} sub={remainLine(t, c.opus_percent, c.opus_resets_at)} /> : null}
      </div>
    </>
  );
}
