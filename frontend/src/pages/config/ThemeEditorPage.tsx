import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { cn } from "../../cn";
import { Logo } from "../../components/Logo";
import { Skeleton } from "../../components/Skeleton";
import { fmtTemp, wmoEmoji } from "../../format";
import { ntcGenerateReadableColor } from "../../hooks/useNameToColor";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgFieldLabel, cfgGrid, cfgStatus, pageCol, viewFade } from "../../tw";
import { NameToColorPicker } from "./NameToColorPicker";
import { THEME_STR } from "./themeCopy";
import { Button, Card, Checkbox, FieldStatus, TextField } from "./ui";
import type { ConfigOutlet } from "./usePublicConfig";
import { usePublicConfig } from "./usePublicConfig";
import { WallpaperManager } from "./WallpaperManager";

type Provider = "claude" | "gpt" | "cursor" | "openrouter" | "deepseek" | "opencode" | "fal" | "brand" | "weather";

type ThemeIcon = { id: string; provider: Provider; x: number; y: number; scale: number; color: string | null };
type ThemeText = { id: string; x: number; y: number; scale: number; color: string | null; text: string };
type ThemeClock = { enabled: boolean; x: number; y: number; scale: number; color: string | null; format24h: boolean; showBackground: boolean; autoColor: boolean };
type ThemeBg = { color: string };
type ThemeState = { background: ThemeBg; clock: ThemeClock; icons: ThemeIcon[]; texts: ThemeText[] };

type WallpaperItem = { id: string; source: string; provider?: string | null; external_id?: string | null; preview_url?: string | null; created_at?: string | null; has_preview: boolean };

const ICON_PROVIDERS: { id: Provider; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "gpt", label: "GPT" },
  { id: "cursor", label: "Cursor" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "opencode", label: "OpenCode" },
  { id: "fal", label: "fal.ai" },
  { id: "weather", label: "Clima" },
  { id: "brand", label: "VIGIA AI" },
];

const DEFAULT_THEME: ThemeState = {
  background: { color: "#10151a" },
  clock: { enabled: true, x: 0.5, y: 0.16, scale: 2, color: null, format24h: true, showBackground: true, autoColor: false },
  icons: [],
  texts: [],
};

const STORAGE_KEY = "vigia_theme_draft_v1";
const MAX_ICONS = 8;
const MAX_TEXTS = 4;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// 127.0.0.1/localhost SEM porta é o gateway do Wokwi (wokwigw) na porta 80 —
// não existe nada lá. Com porta (ex. "127.0.0.1:8090") é válido: é o forward
// que `./dev wokwi` monta pra placa simulada. Ver docs/CONTRATO_TEMA.md.
function isBareLoopback(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  return v === "127.0.0.1" || v === "localhost" || v === "::1";
}

let uidCounter = 0;
function uid(): string {
  return `e${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
}

function formatClock(d: Date, format24h: boolean): string {
  let h = d.getHours();
  if (!format24h) {
    h = h % 12;
    if (h === 0) h = 12;
  }
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function migrateTheme(raw: Partial<ThemeState>): ThemeState {
  const merged = { ...DEFAULT_THEME, ...raw } as ThemeState;
  // Migração: campos novos do relógio (showBackground, autoColor) para drafts antigos
  if (merged.clock) {
    if (typeof merged.clock.showBackground !== "boolean") merged.clock.showBackground = DEFAULT_THEME.clock.showBackground;
    if (typeof merged.clock.autoColor !== "boolean") merged.clock.autoColor = DEFAULT_THEME.clock.autoColor;
  }
  return merged;
}

function useThemeDraft(): [ThemeState, (fn: (t: ThemeState) => ThemeState) => void] {
  const [theme, setTheme] = useState<ThemeState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrateTheme(JSON.parse(raw) as Partial<ThemeState>);
    } catch {
      /* ignore */
    }
    return DEFAULT_THEME;
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, (fn) => setTheme(fn)];
}

function themeToJson(t: ThemeState, hasWallpaper: boolean) {
  return {
    version: 1,
    background: { type: hasWallpaper ? "image" : "color", color: t.background.color },
    clock: {
      enabled: t.clock.enabled,
      x: t.clock.x,
      y: t.clock.y,
      scale: t.clock.scale,
      format24h: t.clock.format24h,
      showBackground: t.clock.showBackground,
      autoColor: t.clock.autoColor,
      ...(t.clock.color ? { color: t.clock.color } : {}),
    },
    icons: t.icons.map((i) => ({ provider: i.provider, x: i.x, y: i.y, scale: i.scale, ...(i.color ? { color: i.color } : {}) })),
    texts: t.texts.map((x) => ({ text: x.text, x: x.x, y: x.y, scale: x.scale, ...(x.color ? { color: x.color } : {}) })),
  };
}

function CanvasDot({
  x,
  y,
  canvasRef,
  selected,
  title,
  onSelect,
  onDrag,
  onRemove,
  removeLabel,
  children,
}: {
  x: number;
  y: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selected: boolean;
  title: string;
  onSelect: () => void;
  onDrag: (x: number, y: number) => void;
  onRemove?: () => void;
  removeLabel?: string;
  children: React.ReactNode;
}) {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onDrag(clamp((e.clientX - rect.left) / rect.width, 0, 1), clamp((e.clientY - rect.top) / rect.height, 0, 1));
  };
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      className={cn(
        "absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none items-center justify-center rounded-full outline-none active:cursor-grabbing",
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : "ring-1 ring-white/40",
      )}
    >
      {children}
      {selected && onRemove ? (
        <button
          type="button"
          title={removeLabel}
          aria-label={removeLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-2 -top-2 flex size-5 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-bad text-[12px] font-bold leading-none text-white shadow"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function ScaleField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cfgFieldLabel}>
        {label} ({value.toFixed(1)}×)
      </span>
      <input type="range" min={0.5} max={4} step={0.1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-accent" />
    </label>
  );
}

const checkerBg =
  "linear-gradient(45deg,#8888 25%,transparent 25%),linear-gradient(-45deg,#8888 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#8888 75%),linear-gradient(-45deg,transparent 75%,#8888 75%)";

// Círculo de cor + swatch clicável (o <input type=color> nativo fica
// invisível por cima, só pra abrir o seletor do SO) — reutilizado em fundo,
// relógio, ícones e textos.
function ColorSwatch({ value, onChange, size = 36 }: { value: string | null; onChange: (v: string) => void; size?: number }) {
  return (
    <label
      className="relative shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1.5px_var(--card-border)] transition-transform hover:scale-105"
      style={{
        width: size,
        height: size,
        background: value || checkerBg,
        backgroundSize: value ? undefined : "8px 8px",
        backgroundPosition: value ? undefined : "0 0, 0 4px, 4px -4px, -4px 0px",
      }}
    >
      <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
  noneLabel,
  lang,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  noneLabel: string;
  lang: "pt" | "en" | "es";
}) {
  const [showNtc, setShowNtc] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className={cfgFieldLabel}>{label}</span>
      <div className="flex items-center gap-3">
        <ColorSwatch value={value} onChange={onChange} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("font-mono text-[13px]", value ? "text-ink" : "text-ink3")}>{value ? value.toUpperCase() : noneLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            {value ? (
              <button type="button" className="w-fit text-[11.5px] text-ink3 underline decoration-dotted underline-offset-2 hover:text-ink2" onClick={() => onChange(null)}>
                {noneLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowNtc((v) => !v)}
              className="rounded-full border border-edge bg-panel px-2.5 py-1 text-[11px] font-[650] text-ink hover:bg-chip"
            >
              {showNtc ? "✕" : "🎨"} NameToColor
            </button>
          </div>
        </div>
      </div>
      {showNtc ? <NameToColorPicker value={value} onChange={onChange} lang={lang} /> : null}
    </div>
  );
}

export default function ThemeEditorPage() {
  const ctx = useOutletContext<ConfigOutlet | null>();
  const c = THEME_STR[ctx?.lang || "pt"];
  const { cfg, phase, reload, setPhase } = usePublicConfig();

  const [theme, setTheme] = useThemeDraft();
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 320 });
  const [canvasKnown, setCanvasKnown] = useState(false);
  const [deviceIp, setDeviceIp] = useState("");
  const [ipTouched, setIpTouched] = useState(false);
  const [canvasRenderedW, setCanvasRenderedW] = useState(0);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotFullscreen, setScreenshotFullscreen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [weatherPreview, setWeatherPreview] = useState<{ temp: number | null; code: number | null; unit: string } | null>(null);
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [currentWallpaperId, setCurrentWallpaperId] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const handleWallpaperSelected = useCallback((id: string | null) => {
    setCurrentWallpaperId(id);
  }, []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const send = useRequest();
  const remove = useRequest();
  const screenshot = useRequest();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ipTouched && cfg?.device.ip) setDeviceIp(cfg.device.ip);
  }, [cfg?.device.ip, ipTouched]);

  useEffect(() => {
    let cancelled = false;
    const applyUsage = (d: unknown) => {
      if (cancelled) return;
      const w = (d as { weather?: { current?: { temperature_2m?: number | null; weather_code?: number | null }; current_units?: Record<string, string> } })?.weather;
      if (w?.current) {
        setWeatherPreview({ temp: w.current.temperature_2m ?? null, code: w.current.weather_code ?? null, unit: w.current_units?.["temperature_2m"] || "°C" });
      }
    };
    fetch("/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(applyUsage)
      .catch(() => { });
    fetch("/api/weather", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        if (cancelled) return;
        const cur = (d as { current?: { temperature_2m?: number | null; weather_code?: number | null }; current_units?: Record<string, string> })?.current;
        if (cur) setWeatherPreview({ temp: cur.temperature_2m ?? null, code: cur.weather_code ?? null, unit: (d as { current_units?: Record<string, string> })?.current_units?.["temperature_2m"] || "°C" });
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  // Carrega wallpapers — o canvas mostra o papel selecionado (o mesmo que a placa baixa em GET /api/theme/background).
  const fetchWallpapers = useCallback(async () => {
    try {
      const r = await fetch("/api/wallpapers", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { wallpapers: WallpaperItem[]; selected_id?: string | null };
      const list = j.wallpapers || [];
      setWallpapers(list);
      setCurrentWallpaperId(j.selected_id || list[0]?.id || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchWallpapers();
    const onUpdate = () => void fetchWallpapers();
    window.addEventListener("vigia:wallpapers-updated", onUpdate);
    return () => window.removeEventListener("vigia:wallpapers-updated", onUpdate);
  }, [fetchWallpapers]);

  // Resolução real da placa reportada ao coletor (header X-Vigia-Screen em
  // GET /usage e /events, ver firmware/src/net/client.cpp) — acerta o
  // tamanho do fundo sem precisar digitar o IP (esse só é usado no card de
  // depuração, pra enviar direto e pro screenshot).
  useEffect(() => {
    if (cfg?.device.width && cfg.device.height) {
      setCanvasSize({ width: cfg.device.width, height: cfg.device.height });
      setCanvasKnown(true);
    }
  }, [cfg?.device.width, cfg?.device.height]);

  // Quantos px CSS o canvas de fato ocupa na tela vs. o tamanho real (em px
  // do device) — sem isso, ícone/relógio/texto ficam com tamanho fixo em CSS
  // e desproporcionais na placa de verdade (o canvas pode renderizar bem
  // maior ou menor que a resolução real dependendo da largura da janela).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setCanvasRenderedW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = canvasSize.width > 0 && canvasRenderedW > 0 ? canvasRenderedW / canvasSize.width : 1;

  useEffect(() => {
    if (!deviceIp) return;
    const id = window.setTimeout(() => {
      // Sem { cache: "no-store" } de propósito: essa opção faz o browser
      // injetar Cache-Control/Pragma no request, o que dispara um preflight
      // CORS extra — a placa já responde sem Content-Type: cache aqui é
      // inofensivo (é só o tamanho do canvas).
      fetch(`http://${deviceIp}/theme`)
        .then((r) => (r.ok ? (r.json() as Promise<{ width?: number; height?: number }>) : null))
        .then((d) => {
          if (d?.width && d.height) {
            setCanvasSize({ width: d.width, height: d.height });
            setCanvasKnown(true);
          }
        })
        .catch(() => {
          /* placa fora do ar ou CORS — segue com a proporção padrão */
        });
    }, 600);
    return () => window.clearTimeout(id);
  }, [deviceIp]);

  function updateIcon(id: string, patch: Partial<ThemeIcon>) {
    setTheme((t) => ({ ...t, icons: t.icons.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }
  function updateText(id: string, patch: Partial<ThemeText>) {
    setTheme((t) => ({ ...t, texts: t.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  function addIcon() {
    const id = uid();
    setTheme((t) => (t.icons.length >= MAX_ICONS ? t : { ...t, icons: [...t.icons, { id, provider: "claude", x: 0.5, y: 0.5, scale: 1, color: null }] }));
    setSelected(`icon:${id}`);
  }
  function removeIcon(id: string) {
    setTheme((t) => ({ ...t, icons: t.icons.filter((i) => i.id !== id) }));
    setSelected(null);
  }
  function addText() {
    const id = uid();
    setTheme((t) => (t.texts.length >= MAX_TEXTS ? t : { ...t, texts: [...t.texts, { id, text: "VIGIA AI", x: 0.5, y: 0.5, scale: 1, color: null }] }));
    setSelected(`text:${id}`);
  }
  function removeText(id: string) {
    setTheme((t) => ({ ...t, texts: t.texts.filter((x) => x.id !== id) }));
    setSelected(null);
  }

  // Salva no coletor (mesma origem do painel — sem CORS, sem IP da placa).
  // A placa é quem busca (botão de recarregar no header, ver
  // firmware/src/net/client.cpp:themeClientReload e docs/CONTRATO_TEMA.md).
  async function saveTheme() {
    const hasWallpaper = Boolean(currentWallpaperId);
    const r2 = await fetch("/api/theme/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(themeToJson(theme, hasWallpaper)),
    });
    const j2 = (await r2.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    if (!j2.ok) return { ok: false, error: j2.error || c.saveError };
    return { ok: true };
  }

  async function removeSavedTheme() {
    const r = await fetch("/api/theme", { method: "DELETE" });
    const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.error || c.removeError };
  }

  if (phase === "loading" && !cfg) {
    return <Skeleton page="config" />;
  }
  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button onClick={() => { setPhase("loading"); void reload(); }}>{c.retry}</Button>
      </div>
    );
  }

  return (
    <div className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
      </header>

      <Card title={c.canvasTitle} lead={c.canvasHint}>
        {!canvasKnown ? <p className={cfgStatus}>{c.canvasNoDevice}</p> : null}
        {currentWallpaperId || localPreviewUrl ? (
          <p className={cfgStatus}>
            Papel de parede em uso
          </p>
        ) : wallpapers.length > 0 ? (
          <p className={`${cfgStatus} text-warn`}>Papéis de parede cadastrados mas nenhum selecionado</p>
        ) : null}
        <div
          ref={canvasRef}
          className="relative mx-auto w-full max-w-[560px] touch-none select-none overflow-hidden rounded-[14px] border border-edge"
          style={{
            aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
            background: theme.background.color,
          }}
          onPointerDown={() => setSelected(null)}
        >
          {/* Fundo: exatamente como a placa — se há wallpaper, mostra a imagem com cover (mesmo crop do backend _image_to_raw); senão cor sólida */}
          {localPreviewUrl || currentWallpaperId ? (
            <img
              key={localPreviewUrl || currentWallpaperId}
              src={localPreviewUrl || `/api/wallpapers/${currentWallpaperId}/preview`}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 z-0 size-full object-cover"
              style={{ imageRendering: "auto" }}
              onError={(e) => {
                if (localPreviewUrl) return;
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          {theme.clock.enabled ? (
            <CanvasDot
              x={theme.clock.x}
              y={theme.clock.y}
              canvasRef={canvasRef}
              selected={selected === "clock"}
              title={c.clock}
              onSelect={() => setSelected("clock")}
              onDrag={(x, y) => setTheme((t) => ({ ...t, clock: { ...t.clock, x, y } }))}
            >
              {(() => {
                const autoPair = theme.clock.autoColor ? ntcGenerateReadableColor(theme.background.color) : null;
                const autoTextColor = autoPair ? autoPair[0] : null;
                const effectiveColor = theme.clock.autoColor ? (autoTextColor || theme.clock.color) : theme.clock.color;
                const bgClass = theme.clock.showBackground ? "bg-black/35" : "bg-transparent";
                return (
                  <span
                    className={`whitespace-nowrap rounded-md px-2 py-1 font-mono font-bold text-white ${bgClass}`}
                    style={{ color: effectiveColor || undefined, fontSize: `${13 * theme.clock.scale * zoom}px` }}
                  >
                    {formatClock(now, theme.clock.format24h)}
                  </span>
                );
              })()}
            </CanvasDot>
          ) : null}
          {theme.icons.map((icon) => (
            <CanvasDot
              key={icon.id}
              x={icon.x}
              y={icon.y}
              canvasRef={canvasRef}
              selected={selected === `icon:${icon.id}`}
              title={icon.provider}
              onSelect={() => setSelected(`icon:${icon.id}`)}
              onDrag={(x, y) => updateIcon(icon.id, { x, y })}
              onRemove={() => removeIcon(icon.id)}
              removeLabel={c.removeIcon}
            >
              {icon.provider === "weather" ? (
                <div
                  className="flex items-center gap-1 rounded-md bg-black/35 px-2 py-1"
                  style={{ border: icon.color ? `1.5px solid ${icon.color}` : undefined }}
                >
                  <span style={{ fontSize: `${14 * icon.scale * zoom}px`, lineHeight: 1 }}>{wmoEmoji(weatherPreview?.code)}</span>
                  <span
                    className="whitespace-nowrap font-mono font-bold text-white"
                    style={{ color: icon.color || undefined, fontSize: `${11 * icon.scale * zoom}px` }}
                  >
                    {weatherPreview?.temp != null ? fmtTemp(weatherPreview.temp, weatherPreview.unit) : "26°C"}
                  </span>
                </div>
              ) : (
                <div
                  className="rounded-full bg-black/25"
                  style={{ padding: Math.max(2, 4 * zoom), boxShadow: icon.color ? `0 0 0 2px ${icon.color}` : undefined }}
                >
                  {icon.provider === "brand" ? (
                    <Logo size={20 * icon.scale * zoom} />
                  ) : (
                    <img
                      src={PROVIDER_ICON[icon.provider]}
                      alt={icon.provider}
                      draggable={false}
                      style={{ width: 20 * icon.scale * zoom, height: 20 * icon.scale * zoom, objectFit: "contain" }}
                    />
                  )}
                </div>
              )}
            </CanvasDot>
          ))}
          {theme.texts.map((txt) => (
            <CanvasDot
              key={txt.id}
              x={txt.x}
              y={txt.y}
              canvasRef={canvasRef}
              selected={selected === `text:${txt.id}`}
              title={txt.text}
              onSelect={() => setSelected(`text:${txt.id}`)}
              onDrag={(x, y) => updateText(txt.id, { x, y })}
              onRemove={() => removeText(txt.id)}
              removeLabel={c.removeText}
            >
              <span className="whitespace-nowrap rounded-md bg-black/35 px-2 py-1 font-semibold text-white" style={{ color: txt.color || undefined, fontSize: `${12 * txt.scale * zoom}px` }}>
                {txt.text || "…"}
              </span>
            </CanvasDot>
          ))}
        </div>
      </Card>

      <div className={cfgGrid}>
        <Card title={c.background}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ColorSwatch value={theme.background.color} onChange={(v) => setTheme((t) => ({ ...t, background: { ...t.background, color: v } }))} size={40} />
              <span className="font-mono text-[13px] text-ink">{theme.background.color.toUpperCase()}</span>
            </div>
            <NameToColorPicker value={theme.background.color} onChange={(v) => v && setTheme((t) => ({ ...t, background: { ...t.background, color: v } }))} lang={ctx?.lang || "pt"} allowClear={false} />
          </div>
        </Card>

        <Card title={c.icons} action={<Button variant="secondary" onClick={addIcon} disabled={theme.icons.length >= MAX_ICONS}>{c.addIcon}</Button>}>
          {selected?.startsWith("icon:") ? (
            (() => {
              const id = selected.slice(5);
              const icon = theme.icons.find((i) => i.id === id);
              if (!icon) return <p className={cfgStatus}>{c.selectHint}</p>;
              return (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={cfgFieldLabel}>{c.icons}</span>
                    <select
                      className="rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink"
                      value={icon.provider}
                      onChange={(e) => updateIcon(id, { provider: e.target.value as Provider })}
                    >
                      {ICON_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <ScaleField label={c.size} value={icon.scale} onChange={(v) => updateIcon(id, { scale: v })} />
                  <ColorField label={c.color} value={icon.color} onChange={(v) => updateIcon(id, { color: v })} noneLabel={c.colorNone} lang={ctx?.lang || "pt"} />
                  <Button variant="ghost" onClick={() => removeIcon(id)}>{c.removeIcon}</Button>
                </div>
              );
            })()
          ) : (
            <p className={cfgStatus}>{c.selectHint}</p>
          )}
        </Card>

        <Card title={c.clock}>
          <Checkbox label={c.clockEnabled} checked={theme.clock.enabled} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, enabled: e.target.checked } }))} />
          <Checkbox label={c.clockFormat24h} checked={theme.clock.format24h} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, format24h: e.target.checked } }))} />
          <Checkbox label={c.clockShowBackground} checked={theme.clock.showBackground} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, showBackground: e.target.checked } }))} />
          <Checkbox label={c.clockAutoColor} checked={theme.clock.autoColor} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, autoColor: e.target.checked } }))} />
          {theme.clock.autoColor ? <p className={`${cfgStatus} text-accent`}>{c.clockAutoColorActive}</p> : null}
          {theme.clock.autoColor ? <p className={cfgStatus}>{c.clockAutoColorHint}</p> : null}
          {theme.clock.autoColor ? (
            (() => {
              const pair = ntcGenerateReadableColor(theme.background.color);
              return pair ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-edge bg-panel px-3 py-2">
                  <span className="size-6 shrink-0 rounded-full border border-edge" style={{ background: pair[0] }} aria-hidden />
                  <span className="font-mono text-[12px] text-ink">{pair[0].toUpperCase()}</span>
                  <span className="text-[11px] text-ink3">sobre {theme.background.color.toUpperCase()}</span>
                </div>
              ) : (
                <p className={`${cfgStatus} text-warn`}>{c.ntcLoading}</p>
              );
            })()
          ) : null}
          <ScaleField label={c.size} value={theme.clock.scale} onChange={(v) => setTheme((t) => ({ ...t, clock: { ...t.clock, scale: v } }))} />
          <div className={theme.clock.autoColor ? "opacity-50 pointer-events-none" : ""}>
            <ColorField label={c.color} value={theme.clock.color} onChange={(v) => setTheme((t) => ({ ...t, clock: { ...t.clock, color: v } }))} noneLabel={c.colorNone} lang={ctx?.lang || "pt"} />
          </div>
        </Card>

        <Card title={c.texts} action={<Button variant="secondary" onClick={addText} disabled={theme.texts.length >= MAX_TEXTS}>{c.addText}</Button>}>
          {selected?.startsWith("text:") ? (
            (() => {
              const id = selected.slice(5);
              const txt = theme.texts.find((x) => x.id === id);
              if (!txt) return <p className={cfgStatus}>{c.selectHint}</p>;
              return (
                <div className="flex flex-col gap-3">
                  <TextField label={c.texts} value={txt.text} maxLength={23} placeholder={c.textPh} onChange={(e) => updateText(id, { text: e.target.value })} />
                  <ScaleField label={c.size} value={txt.scale} onChange={(v) => updateText(id, { scale: v })} />
                  <ColorField label={c.color} value={txt.color} onChange={(v) => updateText(id, { color: v })} noneLabel={c.colorNone} lang={ctx?.lang || "pt"} />
                  <Button variant="ghost" onClick={() => removeText(id)}>{c.removeText}</Button>
                </div>
              );
            })()
          ) : (
            <p className={cfgStatus}>{c.selectHint}</p>
          )}
        </Card>

        <Card title={c.save} lead={c.saveLead}>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void send.run(saveTheme, { success: c.savedOk, error: c.saveError })} loading={send.busy}>
              {send.busy ? c.saving : c.save}
            </Button>
            <Button variant="ghost" onClick={() => void remove.run(removeSavedTheme, { success: c.removedOk, error: c.removeError })} loading={remove.busy}>
              {remove.busy ? c.removing : c.remove}
            </Button>
          </div>
          <FieldStatus status={send.status} message={send.message} />
          <FieldStatus status={remove.status} message={remove.message} />
        </Card>

        <div className="col-span-full">
          <WallpaperManager
            lang={ctx?.lang || "pt"}
            onSelectedChange={handleWallpaperSelected}
            onLocalPreview={setLocalPreviewUrl}
          />
        </div>

        <Card title={c.debugTitle} lead={c.debugLead}>
          <TextField
            label={c.deviceIpLabel}
            value={deviceIp}
            placeholder="192.168.0.42"
            hint={c.deviceIpHint}
            onChange={(e) => { setIpTouched(true); setDeviceIp(e.target.value); }}
          />
          {!deviceIp ? (
            <p className={cfgStatus}>{c.deviceUnknown}</p>
          ) : (
            <>
              {cfg?.device.last_seen_s != null ? <p className={cfgStatus}>{c.deviceSeen(cfg.device.last_seen_s)}</p> : null}
              {isBareLoopback(deviceIp) ? <p className={`${cfgStatus} text-warn`}>{c.deviceLoopback}</p> : null}
            </>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              disabled={!deviceIp.trim()}
              loading={screenshotLoading}
              onClick={() => {
                setScreenshotLoading(true);
                setScreenshotUrl(`http://${deviceIp.trim()}/theme/screenshot?t=${Date.now()}`);
              }}
            >
              {screenshotLoading ? c.screenshotLoading : c.screenshotButton}
            </Button>
            <p className={cfgStatus}>{c.screenshotHint}</p>
            {screenshotUrl ? (
              <button
                type="button"
                className="w-fit cursor-zoom-in border-0 bg-transparent p-0"
                onClick={() => setScreenshotFullscreen(true)}
              >
                <img
                  src={screenshotUrl}
                  alt={c.screenshotButton}
                  className="w-full max-w-[320px] rounded-[10px] border border-edge"
                  onLoad={() => setScreenshotLoading(false)}
                  onError={() => {
                    setScreenshotLoading(false);
                    setScreenshotUrl(null);
                    screenshot.fail(c.screenshotError);
                  }}
                />
              </button>
            ) : null}
            <FieldStatus status={screenshot.status} message={screenshot.message} />
          </div>
        </Card>
      </div>

      {screenshotFullscreen && screenshotUrl ? (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-6"
          onClick={() => setScreenshotFullscreen(false)}
        >
          <img src={screenshotUrl} alt={c.screenshotButton} className="max-h-full max-w-full rounded-[10px] object-contain" />
        </div>
      ) : null}
    </div>
  );
}
