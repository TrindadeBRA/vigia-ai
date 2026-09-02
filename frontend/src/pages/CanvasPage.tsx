import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { fetchConfig, openUsageEvents } from "../api/client";
import type { UsagePayload } from "../api/types";
import type { DisplayOutlet } from "./config/usePublicConfig";
import { ThemeCanvasView, loadThemeDraft, parseSavedThemeJson, type ThemeState } from "./config/ThemeCanvasView";

export default function CanvasPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext<DisplayOutlet | null>();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [theme, setTheme] = useState<ThemeState | null>(null);
  const [wallpaperId, setWallpaperId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 320 });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [driftMs, setDriftMs] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [themeRes, cfg] = await Promise.all([
          fetch("/api/theme", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)) as Promise<{
            active?: boolean;
            theme?: string | null;
            background_id?: string | null;
          } | null>,
          fetchConfig().catch(() => null),
        ]);
        if (cancelled) return;
        if (cfg?.device.width && cfg.device.height) {
          setCanvasSize({ width: cfg.device.width, height: cfg.device.height });
        }
        let next: ThemeState | null = null;
        if (themeRes?.active && themeRes.theme) {
          next = parseSavedThemeJson(themeRes.theme);
        }
        if (!next) next = loadThemeDraft();
        setTheme(next);
        setWallpaperId(themeRes?.background_id || null);
      } catch {
        if (!cancelled) setTheme(loadThemeDraft());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || loading || !theme) {
    return <div className="fixed inset-0 z-50 bg-[#10151a]" />;
  }

  return (
    <ThemeCanvasView
      theme={theme}
      usage={data}
      now={new Date(now + driftMs)}
      wallpaperId={wallpaperId}
      canvasSize={canvasSize}
      lang={outlet?.lang || "pt"}
      fullscreen
    />
  );
}
