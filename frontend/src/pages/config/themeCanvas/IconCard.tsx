import type { UsagePayload } from "../../../api/types";
import { cn } from "../../../cn";
import { Logo } from "../../../components/Logo";
import { barColor, clamp, fmtPct } from "../../../format";
import type { Lang } from "../../../i18n";
import { STR } from "../../../i18n";
import { PALETTES, PROVIDER_ICON } from "../../../theme";
import { buildProviders } from "../../display/buildProviders";
import { ICON_PROVIDERS, type ThemeProvider } from "../themeMetrics";

// Mini-cartão (nome + apelido + até 2 barras) — mesmo conteúdo por provedor
// que o firmware desenha em customtheme.cpp:themeCardContentFor(), só que
// construído em cima de buildProviders() (Display.tsx), que já é a mesma
// função por trás do card compacto do /display normal.
export function IconCard({
  provider,
  color,
  showBackground,
  bgColor,
  scale,
  zoom,
  usage,
  lang,
}: {
  provider: ThemeProvider;
  color: string | null;
  showBackground: boolean;
  bgColor: string | null;
  scale: number;
  zoom: number;
  usage: UsagePayload | null;
  lang: Lang;
}) {
  const t = STR[lang];
  const meta = usage ? buildProviders(usage, t).find((p) => p.provider === provider) : undefined;
  const s = scale * zoom;
  const iconPx = 20 * s;
  const rows = (meta?.metrics ?? []).slice(0, 2);
  const title = meta?.title || ICON_PROVIDERS.find((p) => p.id === provider)?.label || provider;
  return (
    <div
      className={cn("flex flex-col rounded-lg", showBackground && !bgColor && "bg-black/60")}
      style={{
        padding: 8 * s,
        minWidth: 128 * s,
        background: showBackground ? bgColor || undefined : "transparent",
        border: showBackground && color ? `1.5px solid ${color}` : undefined,
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: 6 * s }}>
        {provider === "brand" ? (
          <Logo size={iconPx} />
        ) : (
          <img src={PROVIDER_ICON[provider]} alt="" draggable={false} style={{ width: iconPx, height: iconPx, objectFit: "contain" }} />
        )}
        <div className="min-w-0 leading-tight">
          <div className="truncate font-bold text-white" style={{ fontSize: 12 * s, color: color || undefined }}>
            {title}
          </div>
          {meta?.label ? (
            <div className="truncate text-white/50" style={{ fontSize: 9 * s }}>
              {meta.label}
            </div>
          ) : null}
        </div>
      </div>
      {meta && !meta.ok ? (
        <div className="text-red-300" style={{ fontSize: 9.5 * s }}>
          {meta.error || t.noData}
        </div>
      ) : rows.length ? (
        rows.map((m, i) => (
          <div key={i} style={{ marginTop: i ? 6 * s : 0 }}>
            <div className="flex items-baseline justify-between gap-2" style={{ fontSize: 9.5 * s }}>
              <span className="text-white/60">{m.label}</span>
              <span className="font-bold text-white">{m.pct != null ? fmtPct(m.pct) : (m.value ?? m.sub ?? "--")}</span>
            </div>
            {m.pct != null ? (
              <div className="mt-1 overflow-hidden rounded-full bg-white/15" style={{ height: Math.max(3, 4 * s) }}>
                <div className="h-full rounded-full" style={{ width: `${clamp(m.pct, 0, 100)}%`, background: barColor(m.pct, PALETTES.dark) }} />
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="text-white/50" style={{ fontSize: 9.5 * s }}>
          --
        </div>
      )}
    </div>
  );
}
