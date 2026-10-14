import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fetchMonitors, openUsageEvents } from "../../api/client";
import type { MonitorDevice, UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { ChipIcon, ClockIcon, ImageIcon, MaximizeIcon, PlusCircleIcon, QrIcon, TextIcon } from "../../components/icons";
import { wallpaperMediaSrc } from "../../components/ProviderSearchGrid";
import { Logo } from "../../components/Logo";
import { PageBreadcrumb } from "../../components/PageBreadcrumb";
import { Skeleton } from "../../components/Skeleton";
import { useRequest } from "../../hooks/useRequest";
import { STR } from "../../i18n";
import { PROVIDER_ICON } from "../../theme";
import { cfgFieldLabel, cfgStatus, pageCol, viewFade } from "../../tw";
import { NameToColorPicker } from "./NameToColorPicker";
import { AndroidSetupQrModal } from "./AndroidSetupQrModal";
import { CanvasClockWidget, clockWidgetTitle } from "./themeCanvas/ClockWidgets";
import { CanvasSystemWidget, systemWidgetTitle } from "./themeCanvas/SystemWidget";
import { IconCard, providerSupportsCard, wallpaperImgStyle } from "./ThemeCanvasView";
import { THEME_STR } from "./themeCopy";
import { CanvasDot } from "./themeEditor/CanvasDot";
import { CanvasNudgeTrap, arrowDir, focusCanvasNudgeTrap, isCanvasNudgeTrap } from "./themeEditor/CanvasNudgeTrap";
import { ColorField, ColorSwatch, ScaleField } from "./themeEditor/fields";
import { IconChip } from "./themeEditor/IconChip";
import { ThemeIOButtons } from "./themeEditor/ThemeIOButtons";
import {
  clamp,
  clampPan,
  clampZoom,
  isBareLoopback,
  layerKey,
  normalizeLayerOrder,
  themeToJson,
  uid,
  useThemeDraft,
  THEME_MAX_CLOCKS,
  THEME_MAX_SYSTEMS,
  type CanvasClockMode,
  type ThemeClockWidget,
  type ThemeIcon,
  type ThemeSystemWidget,
  type ThemeText,
  type WallpaperItem,
} from "./themeEditor/themeState";
import { ToolButton, ToolPopover, ToolbarDivider } from "./themeEditor/Toolbar";
import {
  ICON_PROVIDERS,
  PROVIDER_METRICS,
  defaultMetric,
  formatThemeMetric,
  metricLabel,
  providerHasData,
  weatherEmoji,
  THEME_MAX_ICONS,
  type ThemeProvider,
} from "./themeMetrics";
import { Button, Card, Checkbox, FieldStatus, Modal, SelectField, StatusPill, Switch, TextField, TomSelectField } from "./ui";
import { CLOCK_TIMEZONES } from "../../components/cards/ClockCard";
import { parseThemeJson } from "./themeEditor/themeState";
import { usePublicConfig } from "./usePublicConfig";
import { WallpaperManager } from "./wallpaperManager/context";
import { WallpaperLibrary } from "./wallpaperManager/Library";

const RB_SWAP_STORAGE_KEY = "vigia:theme-debug:rb-swap";

function buildScreenshotUrl(ip: string, rbSwap: boolean) {
  return `http://${ip}/theme/screenshot?t=${Date.now()}&rb=${rbSwap ? 1 : 0}`;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function clampPomo(v: string, min: number, max: number, fallback: number): number {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Alvo do canvas: "board" ou "<monitorId>:portrait|landscape".
function splitTarget(t: string): { id: string; orientation: "portrait" | "landscape" } {
  const sep = t.lastIndexOf(":");
  return {
    id: t.slice(0, sep),
    orientation: t.slice(sep + 1) === "landscape" ? "landscape" : "portrait",
  };
}

export default function ThemeEditorPage() {
  const { cfg, phase, reload, setPhase, lang } = usePublicConfig();
  const c = THEME_STR[lang];

  const [theme, setTheme] = useThemeDraft();
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 320 });
  const [canvasKnown, setCanvasKnown] = useState(false);
  // Alvo do canvas: placa (firmware, default) ou um app Vigia registrado
  // (auto-registro via HTTP com o tamanho da tela — sem ADB).
  const [targetId, setTargetId] = useState<string>("board");
  const [monitors, setMonitors] = useState<MonitorDevice[]>([]);
  const [deviceIp, setDeviceIp] = useState("");
  const [ipTouched, setIpTouched] = useState(false);
  const [canvasRenderedW, setCanvasRenderedW] = useState(0);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotFullscreen, setScreenshotFullscreen] = useState(false);
  const [screenshotCapturedAt, setScreenshotCapturedAt] = useState<number | null>(null);
  const [rbSwap, setRbSwap] = useState(() => {
    try {
      return localStorage.getItem(RB_SWAP_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [now, setNow] = useState(() => new Date());
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [currentWallpaperId, setCurrentWallpaperId] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [wallpaperModalOpen, setWallpaperModalOpen] = useState(false);
  const [androidQrOpen, setAndroidQrOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const handleWallpaperSelected = useCallback((id: string | null) => {
    setCurrentWallpaperId(id);
  }, []);
  const hasWallpaperPreview = Boolean(localPreviewUrl || currentWallpaperId);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nudgeTrapRef = useRef<HTMLTextAreaElement>(null);
  const lastNudgeAt = useRef(0);
  const addProviderBtnRef = useRef<HTMLButtonElement>(null);
  const panRef = useRef<{ startX: number; startY: number; startOx: number; startOy: number; moved: boolean } | null>(null);
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
      .catch(() => { });
    const stop = openUsageEvents(
      (d) => {
        if (!cancelled) setUsage(d);
      },
      () => { },
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
    // A rotação automática troca o selecionado no coletor — acompanha sem reload.
    const id = window.setInterval(() => void fetchWallpapers(), 60000);
    const onUpdate = () => void fetchWallpapers();
    window.addEventListener("vigia:wallpapers-updated", onUpdate);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("vigia:wallpapers-updated", onUpdate);
    };
  }, [fetchWallpapers]);

  useEffect(() => {
    let cancelled = false;
    async function loadMonitors() {
      try {
        const list = await fetchMonitors();
        if (!cancelled) setMonitors(list);
      } catch { }
    }
    void loadMonitors();
    const id = window.setInterval(loadMonitors, 30000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  useEffect(() => {
    if (targetId !== "board") {
      const { id } = splitTarget(targetId);
      const m = monitors.find((x) => x.id === id);
      if (!m || !m.online) setTargetId("board");
    }
  }, [monitors, targetId]);

  useEffect(() => {
    if (targetId !== "board") {
      const { id, orientation } = splitTarget(targetId);
      const m = monitors.find((x) => x.id === id);
      if (m) {
        const dims = m[orientation] ?? { w: m.screenW, h: m.screenH };
        setCanvasSize({ width: dims.w, height: dims.h });
        setCanvasKnown(true);
      }
      return;
    }
    if (cfg?.device.width && cfg.device.height) {
      setCanvasSize({ width: cfg.device.width, height: cfg.device.height });
      setCanvasKnown(true);
    } else {
      setCanvasSize({ width: 480, height: 320 });
      setCanvasKnown(false);
    }
  }, [cfg?.device.width, cfg?.device.height, targetId, monitors]);

  useEffect(() => {
    let cancelled = false;
    async function loadTargetTheme() {
      try {
        const url = targetId === "board"
          ? "/api/theme"
          : (() => {
            const { id, orientation } = splitTarget(targetId);
            return `/api/monitors/${id}/theme?orientation=${orientation}`;
          })();
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { active?: boolean; theme?: string | null };
        if (j.active && j.theme) {
          const parsed = parseThemeJson(j.theme);
          if (parsed && !cancelled) setTheme(() => parsed);
        }
      } catch { }
    }
    void loadTargetTheme();
    return () => { cancelled = true; };
  }, [targetId]);

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
        .catch(() => { });
    }, 600);
    return () => window.clearTimeout(id);
  }, [deviceIp]);

  function updateIcon(id: string, patch: Partial<ThemeIcon>) {
    setTheme((t) => ({ ...t, icons: t.icons.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }
  function updateClockWidget(id: string, patch: Partial<ThemeClockWidget>) {
    setTheme((t) => ({ ...t, clocks: (t.clocks || []).map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  }
  function updateSystemWidget(id: string, patch: Partial<ThemeSystemWidget>) {
    setTheme((t) => ({ ...t, systems: (t.systems || []).map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  }
  function updateText(id: string, patch: Partial<ThemeText>) {
    setTheme((t) => ({ ...t, texts: t.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  const iconsFull = theme.icons.length >= THEME_MAX_ICONS;
  const clocksFull = (theme.clocks || []).length >= THEME_MAX_CLOCKS;
  const systemsFull = (theme.systems || []).length >= THEME_MAX_SYSTEMS;
  function addIcon(provider: ThemeProvider = "claude") {
    if (iconsFull) return;
    const id = uid();
    const n = theme.icons.length;
    const x = 0.22 + (n % 4) * 0.2;
    const y = 0.48 + Math.floor(n / 4) * 0.22;
    setTheme((t) => ({
      ...t,
      icons: [...t.icons, { id, provider, style: "chip", x, y, scale: 1, color: null, showBackground: true, bgColor: null, metric: defaultMetric(provider) }],
      layerOrder: [...normalizeLayerOrder(t, t.layerOrder), layerKey("icon", id)],
    }));
    selectItem(`icon:${id}`);
  }
  function removeIcon(id: string) {
    setTheme((t) => ({ ...t, icons: t.icons.filter((i) => i.id !== id), layerOrder: (t.layerOrder || []).filter((k) => k !== layerKey("icon", id)) }));
    setSelected(null);
  }
  function addText() {
    const id = uid();
    setTheme((t) => ({
      ...t,
      texts: [...t.texts, { id, text: "VIGIA AI", x: 0.5, y: 0.82, scale: 1, color: null }],
      layerOrder: [...normalizeLayerOrder(t, t.layerOrder), layerKey("text", id)],
    }));
    selectItem(`text:${id}`);
  }
  function addClockWidget(mode: CanvasClockMode = "clock") {
    if (clocksFull) return;
    const id = uid();
    const n = (theme.clocks || []).length;
    const x = 0.2 + (n % 3) * 0.3;
    const y = 0.3 + Math.floor(n / 3) * 0.3;
    setTheme((t) => ({
      ...t,
      clocks: [
        ...(t.clocks || []),
        {
          id,
          mode,
          x,
          y,
          scale: 1,
          label: null,
          timezone: null,
          format24h: true,
          showSeconds: true,
          showDate: true,
          countdownAt: null,
          countdownLabel: null,
          pomodoroFocusMin: 25,
          pomodoroShortMin: 5,
          pomodoroLongMin: 15,
          pomodoroCycles: 4,
          color: null,
          showBackground: true,
        },
      ],
      layerOrder: [...normalizeLayerOrder(t, t.layerOrder), layerKey("clock", id)],
    }));
    selectItem(`clock:${id}`);
  }
  function removeClockWidget(id: string) {
    setTheme((t) => ({ ...t, clocks: (t.clocks || []).filter((w) => w.id !== id), layerOrder: (t.layerOrder || []).filter((k) => k !== layerKey("clock", id)) }));
    setSelected(null);
  }
  function addSystemWidget() {
    if (systemsFull) return;
    const id = uid();
    const n = (theme.systems || []).length;
    setTheme((t) => ({
      ...t,
      systems: [...(t.systems || []), { id, x: 0.5, y: 0.3 + n * 0.3, scale: 1, detail: "compact", color: null, showBackground: true, bgColor: null }],
      layerOrder: [...normalizeLayerOrder(t, t.layerOrder), layerKey("system", id)],
    }));
    selectItem(`system:${id}`);
  }
  function removeSystemWidget(id: string) {
    setTheme((t) => ({ ...t, systems: (t.systems || []).filter((w) => w.id !== id), layerOrder: (t.layerOrder || []).filter((k) => k !== layerKey("system", id)) }));
    setSelected(null);
  }
  function removeText(id: string) {
    setTheme((t) => ({ ...t, texts: t.texts.filter((x) => x.id !== id), layerOrder: (t.layerOrder || []).filter((k) => k !== layerKey("text", id)) }));
    setSelected(null);
  }

  function selectItem(id: string) {
    setSelected(id);
    focusCanvasNudgeTrap(nudgeTrapRef);
  }

  function nudgeBy(dxPx: number, dyPx: number) {
    if (!selected || selected === "background") return;
    const now = performance.now();
    if (now - lastNudgeAt.current < 12) return;
    lastNudgeAt.current = now;
    const w = canvasSize.width || 480;
    const h = canvasSize.height || 320;
    const nx = dxPx / w;
    const ny = dyPx / h;
    if (selected.startsWith("icon:")) {
      const id = selected.slice(5);
      setTheme((t) => ({
        ...t,
        icons: t.icons.map((i) => (i.id === id ? { ...i, x: clamp(i.x + nx, 0, 1), y: clamp(i.y + ny, 0, 1) } : i)),
      }));
      return;
    }
    if (selected.startsWith("clock:")) {
      const id = selected.slice(6);
      setTheme((t) => ({
        ...t,
        clocks: (t.clocks || []).map((w) => (w.id === id ? { ...w, x: clamp(w.x + nx, 0, 1), y: clamp(w.y + ny, 0, 1) } : w)),
      }));
      return;
    }
    if (selected.startsWith("system:")) {
      const id = selected.slice(7);
      setTheme((t) => ({
        ...t,
        systems: (t.systems || []).map((w) => (w.id === id ? { ...w, x: clamp(w.x + nx, 0, 1), y: clamp(w.y + ny, 0, 1) } : w)),
      }));
      return;
    }
    if (selected.startsWith("text:")) {
      const id = selected.slice(5);
      setTheme((t) => ({
        ...t,
        texts: t.texts.map((x) => (x.id === id ? { ...x, x: clamp(x.x + nx, 0, 1), y: clamp(x.y + ny, 0, 1) } : x)),
      }));
    }
  }

  // Delete/Backspace remove o elemento selecionado; setas andam 1 px da TFT
  // (Shift = 10 px). Safari só dispara setas em campo editável — o textarea
  // invisível (CanvasNudgeTrap) segura o foco; o listener do document cobre o Chrome.
  useEffect(() => {
    function isTextEditing(el: EventTarget | null) {
      if (isCanvasNudgeTrap(el)) return false;
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag !== "INPUT") return false;
      const type = (el as HTMLInputElement).type;
      return type === "text" || type === "search" || type === "password" || type === "email" || type === "url" || type === "number" || type === "tel" || type === "";
    }
    function isFormControl(el: EventTarget | null) {
      if (isCanvasNudgeTrap(el)) return false;
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isFormControl(e.target) || isFormControl(document.activeElement)) return;
        if (selected?.startsWith("icon:")) {
          e.preventDefault();
          removeIcon(selected.slice(5));
        } else if (selected?.startsWith("clock:")) {
          e.preventDefault();
          removeClockWidget(selected.slice(6));
        } else if (selected?.startsWith("system:")) {
          e.preventDefault();
          removeSystemWidget(selected.slice(7));
        } else if (selected?.startsWith("text:")) {
          e.preventDefault();
          removeText(selected.slice(5));
        }
        return;
      }
      const dir = arrowDir(e);
      if (!dir) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!selected || selected === "background") return;
      if (isTextEditing(e.target) || isTextEditing(document.activeElement)) return;
      const step = e.shiftKey ? 10 : 1;
      e.preventDefault();
      nudgeBy(dir === "left" ? -step : dir === "right" ? step : 0, dir === "up" ? -step : dir === "down" ? step : 0);
    }
    document.addEventListener("keydown", onKeyDown, { capture: true, passive: false });
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [selected, canvasSize.width, canvasSize.height]);

  // Shift+scroll: com widget focado, escala (0.5–4×); com o papel focado,
  // zoom do papel (1–4×). Listener nativo com passive:false pra conseguir
  // preventDefault (o onWheel do React é passivo e deixaria a página rolar).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.shiftKey) return;
      e.preventDefault();
      const d = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      const factor = d < 0 ? 1.12 : 1 / 1.12;
      if (selected === "background") {
        if (!hasWallpaperPreview) return;
        setTheme((t) => {
          const zoom = Math.round(clampZoom(t.background.zoom * factor) * 100) / 100;
          return { ...t, background: { ...t.background, zoom, ox: clampPan(t.background.ox, zoom), oy: clampPan(t.background.oy, zoom) } };
        });
        return;
      }
      if (!selected) return;
      const scaleIt = (s: number) => clamp(Math.round(clamp(s * factor, 0.5, 4) * 100) / 100, 0.5, 4);
      if (selected.startsWith("clock:")) {
        const id = selected.slice(6);
        setTheme((t) => ({ ...t, clocks: (t.clocks || []).map((w) => (w.id === id ? { ...w, scale: scaleIt(w.scale) } : w)) }));
      } else if (selected.startsWith("system:")) {
        const id = selected.slice(7);
        setTheme((t) => ({ ...t, systems: (t.systems || []).map((w) => (w.id === id ? { ...w, scale: scaleIt(w.scale) } : w)) }));
      } else if (selected.startsWith("icon:")) {
        const id = selected.slice(5);
        setTheme((t) => ({ ...t, icons: t.icons.map((i) => (i.id === id ? { ...i, scale: scaleIt(i.scale) } : i)) }));
      } else if (selected.startsWith("text:")) {
        const id = selected.slice(5);
        setTheme((t) => ({ ...t, texts: t.texts.map((x) => (x.id === id ? { ...x, scale: scaleIt(x.scale) } : x)) }));
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [selected, hasWallpaperPreview, phase, cfg]);

  const currentWallpaper = wallpapers.find((w) => w.id === currentWallpaperId) ?? null;
  const gifMeta =
    currentWallpaper?.kind === "gif"
      ? { frame_count: currentWallpaper.frame_count ?? 2, frame_delay_ms: currentWallpaper.frame_delay_ms ?? 50 }
      : null;

  async function saveTheme() {
    const hasWallpaper = Boolean(currentWallpaperId);
    const metaUrl = targetId === "board"
      ? "/api/theme/meta"
      : (() => {
        const { id, orientation } = splitTarget(targetId);
        return `/api/monitors/${id}/theme/meta?orientation=${orientation}`;
      })();
    const r2 = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(themeToJson(theme, hasWallpaper, gifMeta)),
    });
    const j2 = (await r2.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    if (!j2.ok) return { ok: false, error: j2.error || c.saveError };
    return { ok: true };
  }

  async function removeSavedTheme() {
    const delUrl = targetId === "board"
      ? "/api/theme"
      : (() => {
        const { id, orientation } = splitTarget(targetId);
        return `/api/monitors/${id}/theme?orientation=${orientation}`;
      })();
    const r = await fetch(delUrl, { method: "DELETE" });
    const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.error || c.removeError };
  }

  const selectedIcon = selected?.startsWith("icon:") ? theme.icons.find((i) => i.id === selected.slice(5)) : undefined;
  const selectedClockWidget = selected?.startsWith("clock:") ? (theme.clocks || []).find((w) => w.id === selected.slice(6)) : undefined;
  const selectedSystemWidget = selected?.startsWith("system:") ? (theme.systems || []).find((w) => w.id === selected.slice(7)) : undefined;
  const selectedText = selected?.startsWith("text:") ? theme.texts.find((x) => x.id === selected.slice(5)) : undefined;
  const providerLabel = (p: ThemeProvider) => ICON_PROVIDERS.find((x) => x.id === p)?.label || p;
  const layerOrder = normalizeLayerOrder(theme, theme.layerOrder);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function handleLayerDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = layerOrder.findIndex((k) => k === String(active.id));
    const newIndex = layerOrder.findIndex((k) => k === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(layerOrder, oldIndex, newIndex);
    setTheme((t) => ({ ...t, layerOrder: next }));
  }

  if (phase === "loading" && !cfg) {
    return <Skeleton page="theme" />;
  }
  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <PageBreadcrumb current={c.title} lang={lang} className="mb-2" />
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
          <PageBreadcrumb current={c.title} lang={lang} className="mb-2" />
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.title}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.lead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeIOButtons theme={theme} hasWallpaper={Boolean(currentWallpaperId)} gif={gifMeta} onImport={(t) => setTheme(() => t)} c={c} />
          <Button onClick={() => void send.run(saveTheme, { success: targetId === "board" ? c.savedOk : c.savedOkMonitor, error: c.saveError })} loading={send.busy}>
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
          <ToolButton icon={<TextIcon size={19} />} label={c.addText} onClick={addText} />
          <ToolButton
            icon={<ClockIcon size={19} />}
            label={c.addClockWidget}
            active={selected?.startsWith("clock:") ?? false}
            disabled={clocksFull}
            onClick={() => addClockWidget("clock")}
          />
          <ToolButton
            icon={<ChipIcon size={19} />}
            label={c.addSystemWidget}
            active={selected?.startsWith("system:") ?? false}
            disabled={systemsFull}
            onClick={() => addSystemWidget()}
          />
          <ToolButton
            ref={addProviderBtnRef}
            icon={<PlusCircleIcon size={19} />}
            label={c.addProvider}
            active={addPopoverOpen}
            onClick={() => setAddPopoverOpen((v) => !v)}
          />
          <ToolbarDivider />
          <ToolButton icon={<ImageIcon size={19} />} label={c.wallpapers} onClick={() => setWallpaperModalOpen(true)} />
          <ToolButton icon={<QrIcon size={19} />} label={c.androidQrButton} onClick={() => setAndroidQrOpen(true)} />
          <ToolButton icon={<ChipIcon size={19} />} label={c.debugTool} onClick={() => setDebugModalOpen(true)} />
        </div>

        {/* Área de trabalho — o canvas fica centralizado, como o palco de um editor de imagem. */}
        <div className="flex min-h-[380px] flex-col gap-3 rounded-2xl border border-edge bg-surface p-4 shadow-[inset_0_1px_2px_rgba(0,0,0,.28)] [.flat_&]:shadow-none sm:p-6">
          <div className="flex flex-wrap items-end gap-2">
            <SelectField
              label={c.canvasTarget}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              options={[
                { value: "board", label: c.targetBoard },
                ...monitors.filter((m) => m.online).flatMap((m) => {
                  const name = m.label || m.model || m.id;
                  const p = m.portrait ?? { w: m.screenW, h: m.screenH };
                  const l = m.landscape ?? { w: m.screenH, h: m.screenW };
                  return [
                    { value: `${m.id}:portrait`, label: `${name} ${c.orientationPortrait} (${p.w}×${p.h})` },
                    { value: `${m.id}:landscape`, label: `${name} ${c.orientationLandscape} (${l.w}×${l.h})` },
                  ];
                }),
              ]}
              wrapperClassName="min-w-[220px] flex-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-ink3">
            <span>{!canvasKnown ? c.canvasNoDevice : c.canvasHint}</span>
            {currentWallpaperId || localPreviewUrl ? (
              <span className="text-ink2">{c.wallpaperInUse}</span>
            ) : wallpapers.length > 0 ? (
              <span className="text-warn">{c.wallpaperNoneSelected}</span>
            ) : null}
          </div>
          <div className="relative flex flex-1 items-center justify-center">
            <CanvasNudgeTrap
              active={Boolean(selected && selected !== "background")}
              trapRef={nudgeTrapRef}
              onNudge={nudgeBy}
            />
            <div
              ref={canvasRef}
              className="relative mx-auto w-full max-w-[720px] touch-none select-none overflow-hidden rounded-[14px] border border-edge shadow-card-hover"
              style={{
                aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                background: theme.background.color,
              }}
              onPointerDown={(e) => {
                // Clique no papel foca o papel (abre o card Fundo); widgets
                // param a propagação no CanvasDot e mantêm o próprio foco.
                setSelected("background");
                if (!hasWallpaperPreview) return;
                panRef.current = { startX: e.clientX, startY: e.clientY, startOx: theme.background.ox, startOy: theme.background.oy, moved: false };
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Safari pode recusar capture em div
                }
              }}
              onPointerMove={(e) => {
                const p = panRef.current;
                if (!p || !canvasRef.current || selected !== "background") return;
                const rect = canvasRef.current.getBoundingClientRect();
                const z = clampZoom(theme.background.zoom);
                if (!rect.width || !rect.height || z <= 1.001) return;
                if (Math.abs(e.clientX - p.startX) + Math.abs(e.clientY - p.startY) > 2) p.moved = true;
                if (!p.moved) return;
                const ox = clampPan(p.startOx - (e.clientX - p.startX) / (rect.width * z), z);
                const oy = clampPan(p.startOy - (e.clientY - p.startY) / (rect.height * z), z);
                setTheme((t) => ({ ...t, background: { ...t.background, ox, oy } }));
              }}
              onPointerUp={() => {
                panRef.current = null;
              }}
              onPointerCancel={() => {
                panRef.current = null;
              }}
            >
              {localPreviewUrl || currentWallpaperId ? (
                <img
                  key={localPreviewUrl || currentWallpaperId}
                  src={localPreviewUrl || (currentWallpaper ? wallpaperMediaSrc(currentWallpaper) : `/api/wallpapers/${currentWallpaperId}/original`)}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute object-cover"
                  style={{ ...wallpaperImgStyle(theme.background.zoom, theme.background.ox, theme.background.oy), imageRendering: "auto" }}
                  onError={(e) => {
                    if (localPreviewUrl) return;
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
              {(localPreviewUrl || currentWallpaperId) && theme.background.overlayOpacity > 0 ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 size-full"
                  style={{ background: theme.background.color, opacity: theme.background.overlayOpacity }}
                />
              ) : null}
              {layerOrder.map((key) => {
                const sep = key.indexOf(":");
                const kind = key.slice(0, sep);
                const id = key.slice(sep + 1);
                if (kind === "clock") {
                  const w = (theme.clocks || []).find((x) => x.id === id);
                  if (!w) return null;
                  return (
                    <CanvasDot
                      key={key}
                      x={w.x}
                  y={w.y}
                  canvasRef={canvasRef}
                  containerSize={containerSize}
                  selected={selected === `clock:${w.id}`}
                  title={clockWidgetTitle(w)}
                  onSelect={() => selectItem(`clock:${w.id}`)}
                  onActivate={() => focusCanvasNudgeTrap(nudgeTrapRef)}
                  onDrag={(x, y) => updateClockWidget(w.id, { x, y })}
                  onRemove={() => removeClockWidget(w.id)}
                  removeLabel={c.removeClockWidget}
                >
                  <CanvasClockWidget widget={w} now={now} zoom={zoom} />
                    </CanvasDot>
                  );
                }
                if (kind === "system") {
                  const w = (theme.systems || []).find((x) => x.id === id);
                  if (!w) return null;
                  return (
                    <CanvasDot
                      key={key}
                      x={w.x}
                  y={w.y}
                  canvasRef={canvasRef}
                  containerSize={containerSize}
                  selected={selected === `system:${w.id}`}
                  title={systemWidgetTitle(w)}
                  onSelect={() => selectItem(`system:${w.id}`)}
                  onActivate={() => focusCanvasNudgeTrap(nudgeTrapRef)}
                  onDrag={(x, y) => updateSystemWidget(w.id, { x, y })}
                  onRemove={() => removeSystemWidget(w.id)}
                  removeLabel={c.removeSystemWidget}
                >
                  <CanvasSystemWidget widget={w} zoom={zoom} />
                    </CanvasDot>
                  );
                }
                if (kind === "icon") {
                  const icon = theme.icons.find((x) => x.id === id);
                  if (!icon) return null;
                  return (
                    <CanvasDot
                      key={key}
                      x={icon.x}
                  y={icon.y}
                  canvasRef={canvasRef}
                  containerSize={containerSize}
                  selected={selected === `icon:${icon.id}`}
                  title={`${providerLabel(icon.provider)} ${formatThemeMetric(usage, icon.provider, icon.metric)}`}
                  onSelect={() => selectItem(`icon:${icon.id}`)}
                  onActivate={() => focusCanvasNudgeTrap(nudgeTrapRef)}
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
                      tftWidth={canvasSize.width}
                      />
                    )}
                    </CanvasDot>
                  );
                }
                const txt = theme.texts.find((x) => x.id === id);
                if (!txt) return null;
                return (
                  <CanvasDot
                    key={key}
                    x={txt.x}
                    y={txt.y}
                    canvasRef={canvasRef}
                    containerSize={containerSize}
                    selected={selected === `text:${txt.id}`}
                    title={txt.text}
                    onSelect={() => selectItem(`text:${txt.id}`)}
                    onActivate={() => focusCanvasNudgeTrap(nudgeTrapRef)}
                    onDrag={(x, y) => updateText(txt.id, { x, y })}
                    onRemove={() => removeText(txt.id)}
                    removeLabel={c.removeText}
                  >
                    <span className="whitespace-nowrap rounded-md bg-black/35 px-2 py-1 font-semibold text-white" style={{ color: txt.color || undefined, fontSize: `${12 * txt.scale * zoom}px` }}>
                      {txt.text || "…"}
                    </span>
                  </CanvasDot>
                );
              })}
            </div>
          </div>
        </div>

        {/* Painel de propriedades — camadas do tema + edição do item selecionado. */}
        <div className="flex flex-col gap-[14px]">
          <Card title={c.elements}>
            <div className="flex flex-col gap-1.5">
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleLayerDragEnd}>
                <SortableContext items={layerOrder} strategy={verticalListSortingStrategy}>
              {layerOrder.map((key) => {
                const sep = key.indexOf(":");
                const kind = key.slice(0, sep);
                const lid = key.slice(sep + 1);
                const gripLabel = lang === "pt" ? "Arrastar para reordenar" : lang === "es" ? "Arrastrar para reordenar" : "Drag to reorder";
                if (kind === "clock") {
                  const w = (theme.clocks || []).find((x) => x.id === lid);
                  if (!w) return null;
                  const isSelected = selected === `clock:${w.id}`;
                  return (
                    <SortableLayerRow
                      key={key}
                      id={key}
                      selected={isSelected}
                      onSelect={() => selectItem(`clock:${w.id}`)}
                      gripLabel={gripLabel}
                      icon={<ClockIcon size={14} />}
                      title={clockWidgetTitle(w)}
                      subtitle={c.clockModeLabel(w.mode)}
                      badge={
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-bold leading-none",
                            isSelected ? "border-accent/20 bg-accent/10 text-accent" : "border-edge bg-panel text-ink3",
                          )}
                        >
                          {w.scale.toFixed(1)}×
                        </span>
                      }
                    />
                  );
                }
                if (kind === "system") {
                  const w = (theme.systems || []).find((x) => x.id === lid);
                  if (!w) return null;
                  const isSelected = selected === `system:${w.id}`;
                  return (
                    <SortableLayerRow
                      key={key}
                      id={key}
                      selected={isSelected}
                      onSelect={() => selectItem(`system:${w.id}`)}
                      gripLabel={gripLabel}
                      icon={<ChipIcon size={14} />}
                      title={systemWidgetTitle(w)}
                      subtitle={c.systemDetailLabel(w.detail)}
                      badge={
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-bold leading-none",
                            isSelected ? "border-accent/20 bg-accent/10 text-accent" : "border-edge bg-panel text-ink3",
                          )}
                        >
                          {w.scale.toFixed(1)}×
                        </span>
                      }
                    />
                  );
                }
                if (kind === "icon") {
                  const icon = theme.icons.find((x) => x.id === lid);
                  if (!icon) return null;
                  const value = formatThemeMetric(usage, icon.provider, icon.metric);
                  const label = providerLabel(icon.provider);
                  const subtitle = icon.metric === "none" ? c.metricNone : metricLabel(icon.metric, lang);
                  const displayValue = value || "—";
                  const isSelected = selected === `icon:${icon.id}`;
                  return (
                    <SortableLayerRow
                      key={key}
                      id={key}
                      selected={isSelected}
                      onSelect={() => selectItem(`icon:${icon.id}`)}
                      gripLabel={gripLabel}
                      plainIcon
                      icon={
                        icon.provider === "brand" ? (
                          <Logo size={16} showText={false} />
                        ) : icon.provider === "weather" ? (
                          <span className="text-[15px] leading-none">{weatherEmoji(usage)}</span>
                        ) : (
                          <img src={PROVIDER_ICON[icon.provider]} alt="" className="size-5 object-contain" draggable={false} />
                        )
                      }
                      title={label}
                      subtitle={subtitle}
                      badge={
                        <span
                          className={cn(
                            "max-w-[88px] shrink-0 truncate rounded-full border px-2 py-0.5 text-right font-mono text-[11px] font-bold leading-none",
                            isSelected ? "border-accent/20 bg-accent/10 text-accent" : "border-edge bg-panel text-ink",
                          )}
                          title={displayValue}
                        >
                          {displayValue}
                        </span>
                      }
                    />
                  );
                }
                {
                  const txt = theme.texts.find((x) => x.id === lid);
                  if (!txt) return null;
                  const isSelected = selected === `text:${txt.id}`;
                  return (
                    <SortableLayerRow
                      key={key}
                      id={key}
                      selected={isSelected}
                      onSelect={() => selectItem(`text:${txt.id}`)}
                      gripLabel={gripLabel}
                      icon={<TextIcon size={13} />}
                      title={txt.text || "…"}
                      subtitle={c.texts}
                      badge={
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-bold leading-none",
                            isSelected ? "border-accent/20 bg-accent/10 text-accent" : "border-edge bg-panel text-ink3",
                          )}
                        >
                          {txt.scale.toFixed(1)}×
                        </span>
                      }
                    />
                  );
                }
              })}
                </SortableContext>
              </DndContext>
              {layerOrder.length === 0 ? (
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
                <TomSelectField
                  label={c.icons}
                  value={selectedIcon.provider}
                  onChange={(e) => {
                    const provider = e.target.value as ThemeProvider;
                    updateIcon(selectedIcon.id, { provider, metric: defaultMetric(provider) });
                  }}
                  options={ICON_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
                  placeholder="Buscar provedor..."
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
          ) : selectedClockWidget ? (
            <Card title={clockWidgetTitle(selectedClockWidget)}>
              <div className="flex flex-col gap-3">
                <div>
                  <span className={cfgFieldLabel}>{c.clockMode}</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["clock", "countdown", "stopwatch", "pomodoro"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateClockWidget(selectedClockWidget.id, { mode: m })}
                        className={cn(
                          "rounded-[10px] border px-3 py-2 text-sm font-[650]",
                          selectedClockWidget.mode === m ? "border-accent bg-chip" : "border-edge bg-canvas hover:bg-chip",
                        )}
                      >
                        {c.clockModeLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>
                <TextField
                  label={c.widgetLabel}
                  value={selectedClockWidget.label || ""}
                  maxLength={40}
                  placeholder={c.widgetLabelPh}
                  onChange={(e) => updateClockWidget(selectedClockWidget.id, { label: e.target.value.trim() ? e.target.value : null })}
                />
                {selectedClockWidget.mode === "clock" ? (
                  <>
                    <TomSelectField
                      label={c.timezone}
                      value={selectedClockWidget.timezone || ""}
                      onChange={(e) => updateClockWidget(selectedClockWidget.id, { timezone: e.target.value || null })}
                      options={[{ value: "", label: c.timezoneLocal }, ...CLOCK_TIMEZONES.map((z) => ({ value: z.tz, label: `${z.city} (${z.tz})` }))]}
                      placeholder={c.timezoneLocal}
                    />
                    <Checkbox
                      label={c.clockFormat24h}
                      checked={selectedClockWidget.format24h !== false}
                      onChange={(e) => updateClockWidget(selectedClockWidget.id, { format24h: e.target.checked })}
                    />
                    <Checkbox
                      label={c.showSeconds}
                      checked={selectedClockWidget.showSeconds !== false}
                      onChange={(e) => updateClockWidget(selectedClockWidget.id, { showSeconds: e.target.checked })}
                    />
                    <Checkbox
                      label={c.showDate}
                      checked={selectedClockWidget.showDate !== false}
                      onChange={(e) => updateClockWidget(selectedClockWidget.id, { showDate: e.target.checked })}
                    />
                  </>
                ) : null}
                {selectedClockWidget.mode === "countdown" ? (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className={cfgFieldLabel}>{c.countdownAt}</span>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(selectedClockWidget.countdownAt)}
                        onChange={(e) => updateClockWidget(selectedClockWidget.id, { countdownAt: fromDatetimeLocal(e.target.value) })}
                        className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink"
                      />
                    </label>
                    <TextField
                      label={c.countdownLabel}
                      value={selectedClockWidget.countdownLabel || ""}
                      maxLength={40}
                      placeholder={c.widgetLabelPh}
                      onChange={(e) => updateClockWidget(selectedClockWidget.id, { countdownLabel: e.target.value.trim() ? e.target.value : null })}
                    />
                  </>
                ) : null}
                {selectedClockWidget.mode === "pomodoro" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: "pomodoroFocusMin", label: c.pomoFocus, min: 1, max: 180 },
                        { key: "pomodoroShortMin", label: c.pomoShort, min: 1, max: 60 },
                        { key: "pomodoroLongMin", label: c.pomoLong, min: 1, max: 90 },
                        { key: "pomodoroCycles", label: c.pomoCycles, min: 2, max: 8 },
                      ] as const
                    ).map((f) => (
                      <label key={f.key} className="flex flex-col gap-1.5">
                        <span className={cfgFieldLabel}>{f.label}</span>
                        <input
                          type="number"
                          min={f.min}
                          max={f.max}
                          value={selectedClockWidget[f.key] ?? ""}
                          onChange={(e) => updateClockWidget(selectedClockWidget.id, { [f.key]: clampPomo(e.target.value, f.min, f.max, f.min) })}
                          className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                <ScaleField label={c.size} value={selectedClockWidget.scale} onChange={(v) => updateClockWidget(selectedClockWidget.id, { scale: v })} />
                <ColorField label={c.color} value={selectedClockWidget.color} onChange={(v) => updateClockWidget(selectedClockWidget.id, { color: v })} noneLabel={c.colorNone} lang={lang} />
                <Checkbox
                  label={c.iconShowBackground}
                  checked={selectedClockWidget.showBackground !== false}
                  onChange={(e) => updateClockWidget(selectedClockWidget.id, { showBackground: e.target.checked })}
                />
                <Button variant="ghost" onClick={() => removeClockWidget(selectedClockWidget.id)}>
                  {c.removeClockWidget}
                </Button>
                <span className="text-xs text-ink3">{c.deleteHint}</span>
              </div>
            </Card>
          ) : selectedSystemWidget ? (
            <Card title={systemWidgetTitle(selectedSystemWidget)}>
              <div className="flex flex-col gap-3">
                <SelectField
                  label={c.detail}
                  value={selectedSystemWidget.detail}
                  onChange={(e) => updateSystemWidget(selectedSystemWidget.id, { detail: e.target.value as ThemeSystemWidget["detail"] })}
                  options={[
                    { value: "minimal", label: c.detailMinimal },
                    { value: "compact", label: c.detailCompact },
                    { value: "full", label: c.detailFull },
                  ]}
                />
                <ScaleField label={c.size} value={selectedSystemWidget.scale} onChange={(v) => updateSystemWidget(selectedSystemWidget.id, { scale: v })} />
                <ColorField label={c.color} value={selectedSystemWidget.color} onChange={(v) => updateSystemWidget(selectedSystemWidget.id, { color: v })} noneLabel={c.colorNone} lang={lang} />
                <Checkbox
                  label={c.iconShowBackground}
                  checked={selectedSystemWidget.showBackground !== false}
                  onChange={(e) => updateSystemWidget(selectedSystemWidget.id, { showBackground: e.target.checked })}
                />
                <div className={selectedSystemWidget.showBackground ? "" : "pointer-events-none opacity-50"}>
                  <ColorField
                    label={c.iconBgColor}
                    value={selectedSystemWidget.bgColor}
                    onChange={(v) => updateSystemWidget(selectedSystemWidget.id, { bgColor: v })}
                    noneLabel={c.colorNone}
                    lang={lang}
                  />
                </div>
                <Button variant="ghost" onClick={() => removeSystemWidget(selectedSystemWidget.id)}>
                  {c.removeSystemWidget}
                </Button>
                <span className="text-xs text-ink3">{c.deleteHint}</span>
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
                <label className="flex flex-col gap-1.5">
                  <span className={cfgFieldLabel}>
                    {c.overlayOpacity} ({Math.round(theme.background.overlayOpacity * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(theme.background.overlayOpacity * 100)}
                    onChange={(e) => { const opacity = Number(e.target.value) / 100; setTheme((t) => ({ ...t, background: { ...t.background, overlayOpacity: opacity } })); }}
                    className="accent-accent"
                  />
                </label>
                <p className="text-xs leading-relaxed text-ink3">{c.overlayHint}</p>
                <div className="flex flex-col gap-1.5">
                  <span className={cfgFieldLabel}>
                    {c.wallpaperZoom} ({Math.round(theme.background.zoom * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={100}
                    max={400}
                    step={5}
                    value={Math.round(theme.background.zoom * 100)}
                    onChange={(e) => {
                      const zoom = clampZoom(Number(e.target.value) / 100);
                      setTheme((t) => ({ ...t, background: { ...t.background, zoom, ox: clampPan(t.background.ox, zoom), oy: clampPan(t.background.oy, zoom) } }));
                    }}
                    className="accent-accent"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setTheme((t) => ({ ...t, background: { ...t.background, zoom: 1, ox: 0.5, oy: 0.5 } }))}
                  >
                    {c.wallpaperReframe}
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-ink3">{c.wallpaperZoomHint}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className={cfgFieldLabel}>{c.rotateWallpapers}</span>
                  <Switch
                    compact
                    label={c.rotateWallpapers}
                    checked={theme.background.rotate}
                    onChange={(e) => { const checked = e.currentTarget.checked; setTheme((t) => ({ ...t, background: { ...t.background, rotate: checked } })); }}
                  />
                </div>
                {theme.background.rotate ? (
                  <SelectField
                    label={c.rotateInterval}
                    value={String(theme.background.rotateIntervalSec)}
                    onChange={(e) => { const intervalSec = Number(e.target.value); setTheme((t) => ({ ...t, background: { ...t.background, rotateIntervalSec: intervalSec } })); }}
                    options={[
                      { value: "60", label: "1 min" },
                      { value: "300", label: "5 min" },
                      { value: "900", label: "15 min" },
                    ]}
                  />
                ) : null}
                <p className="text-xs leading-relaxed text-ink3">{c.rotateHint}</p>
                {gifMeta ? <p className="text-xs leading-relaxed text-ink3">{c.gifBoardHint}</p> : null}
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
        {iconsFull ? <div className="mb-2 px-0.5 text-[11.5px] text-amber-300">{c.iconLimit(THEME_MAX_ICONS)}</div> : null}
        <div className="grid grid-cols-2 gap-2">
          {ICON_PROVIDERS.map((p) => {
            const value = formatThemeMetric(usage, p.id, defaultMetric(p.id));
            const onTheme = theme.icons.some((i) => i.provider === p.id);
            return (
              <button
                type="button"
                key={p.id}
                disabled={iconsFull}
                onClick={() => {
                  addIcon(p.id);
                  setAddPopoverOpen(false);
                }}
                className="flex items-center gap-2 rounded-[12px] border border-edge bg-canvas px-2.5 py-2 text-left hover:border-accent/50 hover:bg-chip disabled:cursor-not-allowed disabled:opacity-45"
              >
                {p.id === "brand" ? (
                  <Logo size={20} showText={false} />
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

      {androidQrOpen ? (
        <AndroidSetupQrModal
          open={androidQrOpen}
          onClose={() => setAndroidQrOpen(false)}
          lanIp={cfg?.lan_ips?.[0] ?? null}
          port={cfg?.listen?.port ?? 8787}
          lang={lang}
          c={c}
        />
      ) : null}

      {debugModalOpen ? (
        <Modal title={c.debugTool} onClose={() => setDebugModalOpen(false)} closeLabel={closeLabel} wide>
          <p className={cfgStatus}>{c.debugLead}</p>

          <div className="flex flex-col gap-2">
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
            ) : cfg?.device.last_seen_s != null ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill state="ok" label={c.deviceSeen(cfg.device.last_seen_s)} />
              </div>
            ) : null}
            {deviceIp && isBareLoopback(deviceIp) ? (
              <p className="m-0 rounded-[10px] border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] leading-[1.5] text-warn">
                {c.deviceLoopback}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-[14px] border border-edge bg-canvas/50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 min-w-[160px] flex-1 text-[12.5px] leading-[1.5] text-ink3">{c.screenshotHint}</p>
              <Button
                variant="secondary"
                disabled={!deviceIp.trim()}
                loading={screenshotLoading}
                onClick={() => {
                  setScreenshotLoading(true);
                  setScreenshotUrl(buildScreenshotUrl(deviceIp.trim(), rbSwap));
                }}
              >
                {screenshotLoading ? c.screenshotLoading : c.screenshotButton}
              </Button>
            </div>

            <div
              className="relative mx-auto flex w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[12px] border border-edge bg-black/30"
              style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
            >
              {screenshotLoading ? <div className="absolute inset-0 animate-pulse bg-white/5" /> : null}
              {screenshotUrl ? (
                <button
                  type="button"
                  className="absolute inset-0 cursor-zoom-in border-0 bg-transparent p-0"
                  onClick={() => setScreenshotFullscreen(true)}
                >
                  <img
                    src={screenshotUrl}
                    alt={c.screenshotButton}
                    className={cn("size-full object-contain transition-opacity duration-150", screenshotLoading && "opacity-0")}
                    onLoad={() => {
                      setScreenshotLoading(false);
                      setScreenshotCapturedAt(Date.now());
                    }}
                    onError={() => {
                      setScreenshotLoading(false);
                      setScreenshotUrl(null);
                      screenshot.fail(c.screenshotError);
                    }}
                  />
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-black/55 text-white">
                    <MaximizeIcon size={13} />
                  </span>
                </button>
              ) : !screenshotLoading ? (
                <p className="max-w-[220px] px-4 text-center text-[12px] leading-[1.5] text-ink3">{c.screenshotEmpty}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[12.5px] leading-[1.5] text-ink3">{c.colorSwapHint}</p>
              </div>
              <Switch
                label={c.colorSwapLabel}
                checked={rbSwap}
                onChange={(e) => {
                  const next = e.target.checked;
                  setRbSwap(next);
                  try {
                    localStorage.setItem(RB_SWAP_STORAGE_KEY, next ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                  if (deviceIp.trim() && screenshotUrl) {
                    setScreenshotLoading(true);
                    setScreenshotUrl(buildScreenshotUrl(deviceIp.trim(), next));
                  }
                }}
              />
            </div>

            {screenshotCapturedAt && screenshotUrl && !screenshotLoading ? (
              <p className="m-0 text-[11.5px] text-ink3">{c.screenshotUpdated(Math.max(0, Math.round((now.getTime() - screenshotCapturedAt) / 1000)))}</p>
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

function SortableLayerRow({
  id,
  selected,
  onSelect,
  gripLabel,
  icon,
  title,
  subtitle,
  badge,
  plainIcon = false,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  gripLabel: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  plainIcon?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <span
        {...attributes}
        {...listeners}
        title={gripLabel}
        aria-label={gripLabel}
        className="flex shrink-0 cursor-grab touch-none items-center rounded-md border border-edge bg-panel px-1 py-2 text-[10px] leading-none text-ink3 hover:text-ink active:cursor-grabbing"
      >
        ⋮⋮
      </span>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
          selected
            ? "border-accent bg-chip shadow-sm ring-1 ring-accent/20"
            : "border-edge bg-canvas hover:border-ink3/30 hover:bg-chip hover:shadow-sm",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            plainIcon
              ? selected
                ? "border-accent/30 bg-accent/10"
                : "border-edge bg-panel group-hover:border-ink3/20"
              : selected
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-edge bg-panel text-ink2 group-hover:border-ink3/20",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold leading-none">{title}</span>
          {subtitle ? <span className="block truncate text-[10.5px] leading-none text-ink3">{subtitle}</span> : null}
        </span>
        {badge}
      </button>
    </div>
  );
}
