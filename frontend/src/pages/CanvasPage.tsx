import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { fetchConfig, fetchUsage, openUsageEvents } from "../api/client";
import type { UsagePayload } from "../api/types";
import type { DisplayOutlet } from "./config/usePublicConfig";
import { ThemeCanvasView, loadThemeDraft, parseSavedThemeJson, type ThemeState } from "./config/ThemeCanvasView";

const THEME_POLL_MS = 60_000;

const RELOAD_LABEL = { pt: "Recarregar", en: "Reload", es: "Recargar" } as const;

export default function CanvasPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext<DisplayOutlet | null>();
  const [search] = useSearchParams();
  // Canvas de um aparelho (?monitor=<id>&orientation=portrait|landscape):
  // busca o tema daquele canvas em vez do global da placa. Sem params,
  // comportamento original (tema global + tamanho da placa).
  const monitorId = search.get("monitor");
  const monitorOrientation = search.get("orientation") === "landscape" ? "landscape" : "portrait";
  // dream=1: daydream do app Android — sem botão de recarregar (só no modo normal).
  const isDream = search.get("dream") === "1";
  const [data, setData] = useState<UsagePayload | null>(null);
  const [theme, setTheme] = useState<ThemeState | null>(null);
  const [wallpaperId, setWallpaperId] = useState<string | null>(null);
  const [wallpaperKind, setWallpaperKind] = useState<string | null>(null);
  const [wallpaperOriginalUrl, setWallpaperOriginalUrl] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 320 });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [driftMs, setDriftMs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTick = useRef(0);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/display");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const stop = openUsageEvents(
      (json) => {
        setData(json);
        const serverMs = Date.parse(json.updated_at);
        if (!Number.isNaN(serverMs)) {
          setDriftMs(serverMs - Date.now());
        }
      },
      () => {},
    );
    return stop;
  }, []);

  const loadTheme = useCallback(
    async (opts?: { silent?: boolean }) => {
      const tick = ++refreshTick.current;
      if (!opts?.silent) setRefreshing(true);
      try {
        const themeUrl = monitorId
          ? `/api/monitors/${monitorId}/theme?orientation=${monitorOrientation}`
          : "/api/theme";
        const [themeRes, cfg, usage] = await Promise.all([
          fetch(themeUrl, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)) as Promise<{
            active?: boolean;
            theme?: string | null;
            background_id?: string | null;
            screenW?: number;
            screenH?: number;
          } | null>,
          fetchConfig().catch(() => null),
          // No celular o SSE pode morrer com a tela bloqueada — o GET /usage
          // garante dado fresco a cada ciclo de 1 min e no toque manual.
          fetchUsage().catch(() => null),
        ]);
        if (refreshTick.current !== tick) return;
        if (usage) {
          setData(usage);
          const serverMs = Date.parse(usage.updated_at);
          if (!Number.isNaN(serverMs)) setDriftMs(serverMs - Date.now());
        }
        if (monitorId && themeRes?.screenW && themeRes?.screenH) {
          setCanvasSize({ width: themeRes.screenW, height: themeRes.screenH });
        } else if (cfg?.device.width && cfg.device.height) {
          setCanvasSize({ width: cfg.device.width, height: cfg.device.height });
        }
        let next: ThemeState | null = null;
        if (themeRes?.active && themeRes.theme) {
          next = parseSavedThemeJson(themeRes.theme);
        }
        if (!next) next = await loadThemeDraft();
        if (refreshTick.current !== tick) return;
        setTheme(next);
        const bgId = themeRes?.background_id || null;
        setWallpaperId(bgId);
        if (bgId) {
          try {
            const wr = await fetch("/api/wallpapers?scope=theme", { cache: "no-store" });
            const wj = wr.ok ? ((await wr.json()) as { wallpapers?: Array<{ id: string; kind?: string; original_url?: string | null }> }) : null;
            const found = (wj?.wallpapers || []).find((w) => w.id === bgId);
            if (refreshTick.current !== tick) return;
            setWallpaperKind(found?.kind ?? null);
            setWallpaperOriginalUrl(found?.original_url ?? null);
          } catch {
            if (refreshTick.current !== tick) return;
            setWallpaperKind(null);
            setWallpaperOriginalUrl(null);
          }
        } else {
          setWallpaperKind(null);
          setWallpaperOriginalUrl(null);
        }
      } catch {
        if (refreshTick.current !== tick) return;
        try {
          const draft = await loadThemeDraft();
          if (refreshTick.current !== tick) return;
          setTheme((prev) => prev ?? draft);
        } catch {
          // mantém tema atual; próxima tentativa em 1 min
        }
      } finally {
        if (refreshTick.current === tick) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [monitorId, monitorOrientation],
  );

  useEffect(() => {
    void loadTheme();
  }, [loadTheme]);

  // Atualização minuto a minuto (tema + cotas), mesmo com SSE instável.
  useEffect(() => {
    const id = window.setInterval(() => void loadTheme({ silent: true }), THEME_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadTheme({ silent: true });
    };
    const onOnline = () => void loadTheme({ silent: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [loadTheme]);

  if (!data || loading || !theme) {
    return <div className="fixed inset-0 z-50 bg-[#0f0f0f]" />;
  }

  const lang = outlet?.lang || "pt";
  const reloadLabel = RELOAD_LABEL[lang] ?? RELOAD_LABEL.pt;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <ThemeCanvasView
        theme={theme}
        usage={data}
        now={new Date(now + driftMs)}
        wallpaperId={wallpaperId}
        wallpaperKind={wallpaperKind}
        wallpaperOriginalUrl={wallpaperOriginalUrl}
        canvasSize={canvasSize}
        lang={lang}
        fullscreen
      />
      {!isDream ? (
        <button
          type="button"
          onClick={() => void loadTheme()}
          disabled={refreshing}
          aria-label={reloadLabel}
          className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[60] flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-black/60 px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/25 backdrop-blur transition active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden className={refreshing ? "inline-block animate-spin" : "inline-block"}>
            ⟳
          </span>
          {reloadLabel}
        </button>
      ) : null}
    </div>
  );
}
