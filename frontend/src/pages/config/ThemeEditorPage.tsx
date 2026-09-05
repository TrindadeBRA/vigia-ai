import { useCallback, useEffect, useRef, useState } from "react";
import { openUsageEvents } from "../../api/client";
import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { ChipIcon, ClockIcon, ImageIcon, PlusCircleIcon, TextIcon } from "../../components/icons";
import { Logo } from "../../components/Logo";
import { Skeleton } from "../../components/Skeleton";
import { ntcGenerateReadableColor } from "../../hooks/useNameToColor";
import { useRequest } from "../../hooks/useRequest";
import { STR } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cfgFieldLabel, cfgStatus, pageCol, viewFade } from "../../tw";
import { NameToColorPicker } from "./NameToColorPicker";
import { IconCard, providerSupportsCard } from "./ThemeCanvasView";
import { THEME_STR } from "./themeCopy";
import {
  ICON_PROVIDERS,
  PROVIDER_METRICS,
  defaultMetric,
  formatThemeMetric,
  metricLabel,
  providerHasData,
  weatherEmoji,
  type ThemeProvider,
} from "./themeMetrics";
import { CanvasDot } from "./themeEditor/CanvasDot";
import { ColorField, ColorSwatch, ScaleField } from "./themeEditor/fields";
import { IconChip } from "./themeEditor/IconChip";
import { ThemeIOButtons } from "./themeEditor/ThemeIOButtons";
import { ToolbarDivider, ToolButton, ToolPopover } from "./themeEditor/Toolbar";
import {
  MAX_ICONS,
  MAX_TEXTS,
  formatClock,
  isBareLoopback,
  themeToJson,
  uid,
  useThemeDraft,
  type ThemeIcon,
  type ThemeText,
  type WallpaperItem,
} from "./themeEditor/themeState";
import { Button, Card, Checkbox, FieldStatus, Modal, SelectField, TextField } from "./ui";
import { usePublicConfig } from "./usePublicConfig";
import { WallpaperLibrary } from "./wallpaperManager/Library";
import { WallpaperManager } from "./wallpaperManager/context";

export default function ThemeEditorPage() {
  const { cfg, phase, reload, setPhase, lang } = usePublicConfig();
  const c = THEME_STR[lang];

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
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [currentWallpaperId, setCurrentWallpaperId] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [wallpaperModalOpen, setWallpaperModalOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const handleWallpaperSelected = useCallback((id: string | null) => {
    setCurrentWallpaperId(id);
  }, []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const addProviderBtnRef = useRef<HTMLButtonElement>(null);
  const send = useRequest();
  const remove = useRequest();
  const screenshot = useRequest();
  const closeLabel = STR[lang].closeSettings;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ipTouched && cfg?.device.ip) setDeviceIp(cfg.device.ip);
  }, [cfg?.device.ip, ipTouched]);

  useEffect(() => {
    let cancelled = false;
    fetch("/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsagePayload | null) => {
        if (!cancelled && d) setUsage(d);
      })
      .catch(() => {});
    const stop = openUsageEvents(
      (d) => {
        if (!cancelled) setUsage(d);
      },
      () => {},
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

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

  useEffect(() => {
    if (cfg?.device.width && cfg.device.height) {
      setCanvasSize({ width: cfg.device.width, height: cfg.device.height });
      setCanvasKnown(true);
    }
  }, [cfg?.device.width, cfg?.device.height]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setCanvasRenderedW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase, cfg]);

  const zoom = canvasSize.width > 0 && canvasRenderedW > 0 ? canvasRenderedW / canvasSize.width : 1;
  const canvasRenderedH = canvasSize.width > 0 ? canvasRenderedW * (canvasSize.height / canvasSize.width) : 0;
  const containerSize = { width: canvasRenderedW, height: canvasRenderedH };

  useEffect(() => {
    if (!deviceIp) return;
    const id = window.setTimeout(() => {
      fetch(`http://${deviceIp}/theme`)
        .then((r) => (r.ok ? (r.json() as Promise<{ width?: number; height?: number }>) : null))
        .then((d) => {
          if (d?.width && d.height) {
            setCanvasSize({ width: d.width, height: d.height });
            setCanvasKnown(true);
          }
        })
        .catch(() => {});
    }, 600);
    return () => window.clearTimeout(id);
  }, [deviceIp]);

  function updateIcon(id: string, patch: Partial<ThemeIcon>) {
    setTheme((t) => ({ ...t, icons: t.icons.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }
  function updateText(id: string, patch: Partial<ThemeText>) {
    setTheme((t) => ({ ...t, texts: t.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  function addIcon(provider: ThemeProvider = "claude") {
    const id = uid();
    const n = theme.icons.length;
    const x = 0.22 + (n % 4) * 0.2;
    const y = 0.48 + Math.floor(n / 4) * 0.22;
    setTheme((t) =>
      t.icons.length >= MAX_ICONS
        ? t
        : { ...t, icons: [...t.icons, { id, provider, style: "chip", x, y, scale: 1, color: null, showBackground: true, bgColor: null, metric: defaultMetric(provider) }] },
    );
    setSelected(`icon:${id}`);
  }
  function removeIcon(id: string) {
    setTheme((t) => ({ ...t, icons: t.icons.filter((i) => i.id !== id) }));
    setSelected(null);
  }
  function addText() {
    const id = uid();
    setTheme((t) => (t.texts.length >= MAX_TEXTS ? t : { ...t, texts: [...t.texts, { id, text: "VIGIA AI", x: 0.5, y: 0.82, scale: 1, color: null }] }));
    setSelected(`text:${id}`);
  }
  function removeText(id: string) {
    setTheme((t) => ({ ...t, texts: t.texts.filter((x) => x.id !== id) }));
    setSelected(null);
  }

  // Delete/Backspace remove o elemento selecionado — como num editor de imagem —,
  // exceto quando o foco está num campo de texto (ex: editando o texto do próprio
  // elemento ou o IP da placa), onde a tecla deve só apagar caracteres.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) return;
      if (selected?.startsWith("icon:")) {
        e.preventDefault();
        removeIcon(selected.slice(5));
      } else if (selected?.startsWith("text:")) {
        e.preventDefault();
        removeText(selected.slice(5));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

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

  const selectedIcon = selected?.startsWith("icon:") ? theme.icons.find((i) => i.id === selected.slice(5)) : undefined;
  const selectedText = selected?.startsWith("text:") ? theme.texts.find((x) => x.id === selected.slice(5)) : undefined;
  const providerLabel = (p: ThemeProvider) => ICON_PROVIDERS.find((x) => x.id === p)?.label || p;

  if (phase === "loading" && !cfg) {
    return <Skeleton page="theme" />;
  }
  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button
          onClick={() => {
            setPhase("loading");
            void reload();
          }}
        >
          {c.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className={`${pageCol} ${viewFade}`}>
      <header className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeIOButtons theme={theme} hasWallpaper={Boolean(currentWallpaperId)} onImport={(t) => setTheme(() => t)} c={c} />
          <Button onClick={() => void send.run(saveTheme, { success: c.savedOk, error: c.saveError })} loading={send.busy}>
            {send.busy ? c.saving : c.save}
          </Button>
          <Button variant="ghost" onClick={() => void remove.run(removeSavedTheme, { success: c.removedOk, error: c.removeError })} loading={remove.busy}>
            {remove.busy ? c.removing : c.remove}
          </Button>
        </div>
      </header>
      <FieldStatus status={send.status} message={send.message} />
      <FieldStatus status={remove.status} message={remove.message} />

      <div className="grid w-full items-start gap-[14px] lg:grid-cols-[max-content_minmax(0,1fr)_336px]">
        {/* Barra de ferramentas — cada ícone é uma ação, como numa paleta de ferramentas de editor de imagem. */}
        <div className="flex w-full flex-row flex-wrap items-center justify-center gap-1 self-start rounded-2xl border border-edge bg-panel p-1.5 shadow-card [.flat_&]:shadow-none lg:w-max lg:flex-col lg:flex-nowrap">
          <ToolButton icon={<TextIcon size={19} />} label={c.addText} disabled={theme.texts.length >= MAX_TEXTS} onClick={addText} />
          <ToolButton
            icon={<ClockIcon size={19} />}
            label={c.clock}
            active={selected === "clock"}
            onClick={() => {
              if (!theme.clock.enabled) setTheme((t) => ({ ...t, clock: { ...t.clock, enabled: true } }));
              setSelected("clock");
            }}
          />
          <ToolButton
            ref={addProviderBtnRef}
            icon={<PlusCircleIcon size={19} />}
            label={c.addProvider}
            active={addPopoverOpen}
            disabled={theme.icons.length >= MAX_ICONS}
            onClick={() => setAddPopoverOpen((v) => !v)}
          />
          <ToolbarDivider />
          <ToolButton icon={<ImageIcon size={19} />} label={c.wallpapers} onClick={() => setWallpaperModalOpen(true)} />
          <ToolButton icon={<ChipIcon size={19} />} label={c.debugTool} onClick={() => setDebugModalOpen(true)} />
        </div>

        {/* Área de trabalho — o canvas fica centralizado, como o palco de um editor de imagem. */}
        <div className="flex min-h-[380px] flex-col gap-3 rounded-2xl border border-edge bg-surface p-4 shadow-[inset_0_1px_2px_rgba(0,0,0,.28)] [.flat_&]:shadow-none sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-ink3">
            <span>{!canvasKnown ? c.canvasNoDevice : c.canvasHint}</span>
            {currentWallpaperId || localPreviewUrl ? (
              <span className="text-ink2">{c.wallpaperInUse}</span>
            ) : wallpapers.length > 0 ? (
              <span className="text-warn">{c.wallpaperNoneSelected}</span>
            ) : null}
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div
              ref={canvasRef}
              className="relative mx-auto w-full max-w-[720px] touch-none select-none overflow-hidden rounded-[14px] border border-edge shadow-card-hover"
              style={{
                aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                background: theme.background.color,
              }}
              onPointerDown={() => setSelected(null)}
            >
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
                  containerSize={containerSize}
                  selected={selected === "clock"}
                  title={c.clock}
                  onSelect={() => setSelected("clock")}
                  onDrag={(x, y) => setTheme((t) => ({ ...t, clock: { ...t.clock, x, y } }))}
                >
                  {(() => {
                    const autoPair = theme.clock.autoColor ? ntcGenerateReadableColor(theme.background.color) : null;
                    const autoTextColor = autoPair ? autoPair[0] : null;
                    const effectiveColor = theme.clock.autoColor ? autoTextColor || theme.clock.color : theme.clock.color;
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
                  containerSize={containerSize}
                  selected={selected === `icon:${icon.id}`}
                  title={`${providerLabel(icon.provider)} ${formatThemeMetric(usage, icon.provider, icon.metric)}`}
                  onSelect={() => setSelected(`icon:${icon.id}`)}
                  onDrag={(x, y) => updateIcon(icon.id, { x, y })}
                  onRemove={() => removeIcon(icon.id)}
                  removeLabel={c.removeIcon}
                >
                  {icon.style === "card" && providerSupportsCard(icon.provider) ? (
                    <IconCard
                      provider={icon.provider}
                      color={icon.color}
                      showBackground={icon.showBackground}
                      bgColor={icon.bgColor}
                      scale={icon.scale}
                      zoom={zoom}
                      usage={usage}
                      lang={lang}
                    />
                  ) : (
                    <IconChip
                      provider={icon.provider}
                      metric={icon.metric}
                      color={icon.color}
                      showBackground={icon.showBackground}
                      bgColor={icon.bgColor}
                      scale={icon.scale}
                      zoom={zoom}
                      usage={usage}
                    />
                  )}
                </CanvasDot>
              ))}
              {theme.texts.map((txt) => (
                <CanvasDot
                  key={txt.id}
                  x={txt.x}
                  y={txt.y}
                  canvasRef={canvasRef}
                  containerSize={containerSize}
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
          </div>
        </div>

        {/* Painel de propriedades — camadas do tema + edição do item selecionado. */}
        <div className="flex flex-col gap-[14px]">
          <Card title={c.elements}>
            <div className="flex flex-col gap-1.5">
              {theme.clock.enabled ? (
                <button
                  type="button"
                  onClick={() => setSelected("clock")}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                    selected === "clock"
                      ? "border-accent bg-chip shadow-sm ring-1 ring-accent/20"
                      : "border-edge bg-canvas hover:border-ink3/30 hover:bg-chip hover:shadow-sm",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border",
                      selected === "clock" ? "border-accent/30 bg-accent/10 text-accent" : "border-edge bg-panel text-ink2 group-hover:border-ink3/20",
                    )}
                  >
                    <ClockIcon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold leading-none">{c.clock}</span>
                    <span className="block truncate text-[10.5px] leading-none text-ink3">
                      {theme.clock.format24h ? "24h" : "12h"} · {theme.clock.showBackground ? (lang === "pt" ? "com fundo" : lang === "es" ? "con fondo" : "with bg") : lang === "pt" ? "sem fundo" : lang === "es" ? "sin fondo" : "no bg"}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-edge bg-panel px-2 py-0.5 font-mono text-[11px] font-bold leading-none text-ink">
                    {formatClock(now, theme.clock.format24h)}
                  </span>
                </button>
              ) : null}
              {theme.icons.map((icon) => {
                const value = formatThemeMetric(usage, icon.provider, icon.metric);
                const label = providerLabel(icon.provider);
                const subtitle = icon.metric === "none" ? c.metricNone : metricLabel(icon.metric, lang);
                const displayValue = value || (icon.metric === "none" ? "—" : "—");
                const isSelected = selected === `icon:${icon.id}`;
                return (
                  <button
                    type="button"
                    key={icon.id}
                    onClick={() => setSelected(`icon:${icon.id}`)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                      isSelected
                        ? "border-accent bg-chip shadow-sm ring-1 ring-accent/20"
                        : "border-edge bg-canvas hover:border-ink3/30 hover:bg-chip hover:shadow-sm",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border",
                        isSelected ? "border-accent/30 bg-accent/10" : "border-edge bg-panel group-hover:border-ink3/20",
                      )}
                    >
                      {icon.provider === "brand" ? (
                        <Logo size={16} />
                      ) : icon.provider === "weather" ? (
                        <span className="text-[15px] leading-none">{weatherEmoji(usage)}</span>
                      ) : (
                        <img src={PROVIDER_ICON[icon.provider]} alt="" className="size-5 object-contain" draggable={false} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold leading-none">{label}</span>
                      <span className="block truncate text-[10.5px] leading-none text-ink3">{subtitle}</span>
                    </span>
                    <span
                      className={cn(
                        "max-w-[88px] shrink-0 truncate rounded-full border px-2 py-0.5 text-right font-mono text-[11px] font-bold leading-none",
                        isSelected ? "border-accent/20 bg-accent/10 text-accent" : "border-edge bg-panel text-ink",
                      )}
                      title={displayValue}
                    >
                      {displayValue}
                    </span>
                  </button>
                );
              })}
              {theme.texts.map((txt) => {
                const isSelected = selected === `text:${txt.id}`;
                return (
                  <button
                    type="button"
                    key={txt.id}
                    onClick={() => setSelected(`text:${txt.id}`)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                      isSelected
                        ? "border-accent bg-chip shadow-sm ring-1 ring-accent/20"
                        : "border-edge bg-canvas hover:border-ink3/30 hover:bg-chip hover:shadow-sm",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border",
                        isSelected ? "border-accent/30 bg-accent/10 text-accent" : "border-edge bg-panel text-ink2 group-hover:border-ink3/20",
                      )}
                    >
                      <TextIcon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold leading-none">{txt.text || "…"}</span>
                      <span className="block truncate text-[10.5px] leading-none text-ink3">{c.texts}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-bold leading-none",
                        isSelected ? "border-accent/20 bg-accent/10 text-accent" : "border-edge bg-panel text-ink3",
                      )}
                    >
                      {txt.scale.toFixed(1)}×
                    </span>
                  </button>
                );
              })}
              {!theme.clock.enabled && theme.icons.length === 0 && theme.texts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-edge bg-canvas/60 px-2.5 py-3 text-center text-[12px] leading-relaxed text-ink3">{c.noIcons}</div>
              ) : null}
              <div className="my-1 h-px bg-edge" aria-hidden />
              <button
                type="button"
                onClick={() => setSelected("background")}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                  selected === "background"
                    ? "border-accent bg-chip shadow-sm ring-1 ring-accent/20"
                    : "border-edge bg-canvas hover:border-ink3/30 hover:bg-chip hover:shadow-sm",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border",
                    selected === "background" ? "border-accent/30 bg-accent/10" : "border-edge bg-panel group-hover:border-ink3/20",
                  )}
                >
                  <span className="size-5 shrink-0 rounded-full border border-white/15 shadow-sm" style={{ background: theme.background.color }} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold leading-none">{c.background}</span>
                  <span className="block truncate text-[10.5px] leading-none text-ink3">{theme.background.color.toUpperCase()}</span>
                </span>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-edge bg-panel text-ink3">
                  <ImageIcon size={12} />
                </span>
              </button>
            </div>
          </Card>

          {selectedIcon ? (
            <Card title={providerLabel(selectedIcon.provider)}>
              <div className="flex flex-col gap-3">
                <SelectField
                  label={c.icons}
                  value={selectedIcon.provider}
                  onChange={(e) => {
                    const provider = e.target.value as ThemeProvider;
                    updateIcon(selectedIcon.id, { provider, metric: defaultMetric(provider) });
                  }}
                  options={ICON_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
                />
                {providerSupportsCard(selectedIcon.provider) ? (
                  <label className="flex flex-col gap-1.5">
                    <span className={cfgFieldLabel}>{c.iconStyle}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateIcon(selectedIcon.id, { style: "chip" })}
                        className={cn(
                          "flex-1 rounded-[10px] border px-3 py-2 text-sm font-[650]",
                          selectedIcon.style === "chip" ? "border-accent bg-chip" : "border-edge bg-canvas hover:bg-chip",
                        )}
                      >
                        {c.iconStyleChip}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateIcon(selectedIcon.id, { style: "card" })}
                        className={cn(
                          "flex-1 rounded-[10px] border px-3 py-2 text-sm font-[650]",
                          selectedIcon.style === "card" ? "border-accent bg-chip" : "border-edge bg-canvas hover:bg-chip",
                        )}
                      >
                        {c.iconStyleCard}
                      </button>
                    </div>
                    <span className="text-xs text-ink3">{c.iconStyleHint}</span>
                  </label>
                ) : null}
                {selectedIcon.style !== "card" && providerHasData(selectedIcon.provider) ? (
                  <SelectField
                    label={c.metric}
                    hint={c.metricHint}
                    value={selectedIcon.metric}
                    onChange={(e) => updateIcon(selectedIcon.id, { metric: e.target.value })}
                  >
                    {PROVIDER_METRICS[selectedIcon.provider].map((m) => (
                      <option key={m.key} value={m.key}>
                        {metricLabel(m.key, lang)} — {formatThemeMetric(usage, selectedIcon.provider, m.key)}
                      </option>
                    ))}
                    <option value="none">{c.metricNone}</option>
                  </SelectField>
                ) : null}
                <ScaleField label={c.size} value={selectedIcon.scale} onChange={(v) => updateIcon(selectedIcon.id, { scale: v })} />
                <ColorField label={c.color} value={selectedIcon.color} onChange={(v) => updateIcon(selectedIcon.id, { color: v })} noneLabel={c.colorNone} lang={lang} />
                <Checkbox
                  label={c.iconShowBackground}
                  checked={selectedIcon.showBackground}
                  onChange={(e) => updateIcon(selectedIcon.id, { showBackground: e.target.checked })}
                />
                <div className={selectedIcon.showBackground ? "" : "pointer-events-none opacity-50"}>
                  <ColorField
                    label={c.iconBgColor}
                    value={selectedIcon.bgColor}
                    onChange={(v) => updateIcon(selectedIcon.id, { bgColor: v })}
                    noneLabel={c.colorNone}
                    lang={lang}
                  />
                </div>
                <Button variant="ghost" onClick={() => removeIcon(selectedIcon.id)}>
                  {c.removeIcon}
                </Button>
                <span className="text-xs text-ink3">{c.deleteHint}</span>
              </div>
            </Card>
          ) : selected === "clock" ? (
            <Card title={c.clock}>
              <Checkbox label={c.clockEnabled} checked={theme.clock.enabled} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, enabled: e.target.checked } }))} />
              <Checkbox label={c.clockFormat24h} checked={theme.clock.format24h} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, format24h: e.target.checked } }))} />
              <Checkbox label={c.clockShowBackground} checked={theme.clock.showBackground} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, showBackground: e.target.checked } }))} />
              <Checkbox label={c.clockAutoColor} checked={theme.clock.autoColor} onChange={(e) => setTheme((t) => ({ ...t, clock: { ...t.clock, autoColor: e.target.checked } }))} />
              {theme.clock.autoColor ? <p className={`${cfgStatus} text-accent`}>{c.clockAutoColorActive}</p> : null}
              <ScaleField label={c.size} value={theme.clock.scale} onChange={(v) => setTheme((t) => ({ ...t, clock: { ...t.clock, scale: v } }))} />
              <div className={theme.clock.autoColor ? "pointer-events-none opacity-50" : ""}>
                <ColorField label={c.color} value={theme.clock.color} onChange={(v) => setTheme((t) => ({ ...t, clock: { ...t.clock, color: v } }))} noneLabel={c.colorNone} lang={lang} />
              </div>
            </Card>
          ) : selectedText ? (
            <Card title={c.texts}>
              <div className="flex flex-col gap-3">
                <TextField label={c.texts} value={selectedText.text} maxLength={23} placeholder={c.textPh} onChange={(e) => updateText(selectedText.id, { text: e.target.value })} />
                <ScaleField label={c.size} value={selectedText.scale} onChange={(v) => updateText(selectedText.id, { scale: v })} />
                <ColorField label={c.color} value={selectedText.color} onChange={(v) => updateText(selectedText.id, { color: v })} noneLabel={c.colorNone} lang={lang} />
                <Button variant="ghost" onClick={() => removeText(selectedText.id)}>
                  {c.removeText}
                </Button>
                <span className="text-xs text-ink3">{c.deleteHint}</span>
              </div>
            </Card>
          ) : selected === "background" ? (
            <Card title={c.background}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <ColorSwatch value={theme.background.color} onChange={(v) => setTheme((t) => ({ ...t, background: { ...t.background, color: v } }))} size={40} />
                  <span className="font-mono text-[13px] text-ink">{theme.background.color.toUpperCase()}</span>
                </div>
                <NameToColorPicker value={theme.background.color} onChange={(v) => v && setTheme((t) => ({ ...t, background: { ...t.background, color: v } }))} lang={lang} allowClear={false} />
              </div>
            </Card>
          ) : (
            <Card title={c.selectHint}>
              <p className={cfgStatus}>{c.canvasHint}</p>
            </Card>
          )}
        </div>
      </div>

      <ToolPopover anchorRef={addProviderBtnRef} open={addPopoverOpen} onClose={() => setAddPopoverOpen(false)} width={300}>
        <div className="mb-2 px-0.5 text-[11.5px] font-[650] uppercase tracking-[.4px] text-ink3">{c.addProvider}</div>
        <div className="grid grid-cols-2 gap-2">
          {ICON_PROVIDERS.map((p) => {
            const value = formatThemeMetric(usage, p.id, defaultMetric(p.id));
            const onTheme = theme.icons.some((i) => i.provider === p.id);
            const disabled = theme.icons.length >= MAX_ICONS;
            return (
              <button
                type="button"
                key={p.id}
                disabled={disabled}
                onClick={() => {
                  addIcon(p.id);
                  setAddPopoverOpen(false);
                }}
                className="flex items-center gap-2 rounded-[12px] border border-edge bg-canvas px-2.5 py-2 text-left hover:border-accent/50 hover:bg-chip disabled:cursor-not-allowed disabled:opacity-45"
              >
                {p.id === "brand" ? (
                  <Logo size={20} />
                ) : p.id === "weather" ? (
                  <span className="text-[16px]">{weatherEmoji(usage)}</span>
                ) : (
                  <img src={PROVIDER_ICON[p.id]} alt="" className="size-5 object-contain" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-[650]">{p.label}</span>
                  <span className="block truncate font-mono text-[10.5px] text-ink3">{value || (onTheme ? c.placed : c.metricNone)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </ToolPopover>

      <WallpaperManager lang={lang} onSelectedChange={handleWallpaperSelected} onLocalPreview={setLocalPreviewUrl}>
        {wallpaperModalOpen ? (
          <Modal title={c.wallpapers} onClose={() => setWallpaperModalOpen(false)} closeLabel={closeLabel} wide>
            <WallpaperLibrary />
          </Modal>
        ) : null}
      </WallpaperManager>

      {debugModalOpen ? (
        <Modal title={c.debugTool} onClose={() => setDebugModalOpen(false)} closeLabel={closeLabel} wide>
          <p className={cfgStatus}>{c.debugLead}</p>
          <TextField
            label={c.deviceIpLabel}
            value={deviceIp}
            placeholder="192.168.0.42"
            hint={c.deviceIpHint}
            onChange={(e) => {
              setIpTouched(true);
              setDeviceIp(e.target.value);
            }}
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
              <button type="button" className="w-fit cursor-zoom-in border-0 bg-transparent p-0" onClick={() => setScreenshotFullscreen(true)}>
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
        </Modal>
      ) : null}

      {screenshotFullscreen && screenshotUrl ? (
        <div className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-6" onClick={() => setScreenshotFullscreen(false)}>
          <img src={screenshotUrl} alt={c.screenshotButton} className="max-h-full max-w-full rounded-[10px] object-contain" />
        </div>
      ) : null}
    </div>
  );
}
