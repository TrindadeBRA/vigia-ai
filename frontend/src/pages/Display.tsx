import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchHealth, fetchUsage, openUsageEvents } from "../api/client";
import type { AdsenseAccount, BitcoinAccount, ClaudeAccount, CreditsAccount, CursorAccount, GptAccount, OpenCodeAccount, UsagePayload } from "../api/types";
import { colsForWidth, sameBoard } from "../board";
import { cn } from "../cn";
import { AddWidgetModal, type WidgetKind } from "../components/AddWidgetModal";
import { GamepadLegend } from "../components/GamepadLegend";
import { GridWallpaperModal } from "../components/GridWallpaperModal";
import { MenuIcon, SettingsIcon } from "../components/icons";
import { ImageWidgetModal } from "../components/ImageWidgetModal";
import { Logo } from "../components/Logo";
import { PageBreadcrumb } from "../components/PageBreadcrumb";
import { PixDonateModal } from "../components/PixDonateModal";
import { Skeleton } from "../components/Skeleton";
import { FETCH_OK_FLASH_MS, FRESH_PAYLOAD_MS, POLL_MS, countdownSecs, fmtClock, nextFetchAtMs, payloadAgeMs } from "../format";
import { GAMEPAD_CSS, gamepadScrollMain, gamepadZoom, isGamepadTypingActive, useGamepad } from "../hooks/useGamepad";
import { useGridBoards } from "../hooks/useGridBoards";
import { useGridWallpaper } from "../hooks/useGridWallpaper";
import { useImageWidgets } from "../hooks/useImageWidgets";
import { useCameras } from "../hooks/useCameras";
import { useServerNotes } from "../hooks/useServerNotes";
import { STR } from "../i18n";
import { ACCENTS, PALETTES, applyThemeVars, getSystemTheme, resolveTheme } from "../theme";
import { emptyNote, iconBtn, num, shell } from "../tw";
import type { DisplayOutlet } from "./config/usePublicConfig";
import { AccountPage } from "./display/AccountPage";
import { baseIdForProvider, boardForCols, expandProvidersWithClones } from "./display/boardHelpers";
import { buildCameraProviders, buildEmulatorProviders, buildImageProviders, buildNoteProviders, buildProviders, buildWidgetProviders } from "./display/buildProviders";
import { Badge } from "./display/MetricRow";
import { Overview } from "./display/Overview";
import { SettingsDrawer } from "./display/SettingsDrawer";
import { Sidebar } from "./display/Sidebar";
import type { ProviderMeta } from "./display/types";
import { usePrefs } from "./display/usePrefs";
import NowPage from "./NowPage";

export default function Display() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const isKiosk = (() => {
    const v = new URLSearchParams(search).get("kiosk");
    return v === "1" || v?.toLowerCase() === "true";
  })();
  const isConfig = pathname === "/display/config";
  const isSetup = pathname === "/display/setup";
  const isTheme = pathname === "/display/theme" || pathname === "/display/tema";
  const isCanvas = pathname === "/display/canvas";
  const isAlarms = pathname === "/display/alarms" || pathname === "/display/alarmes";
  const isMining = pathname === "/display/mining" || pathname === "/display/mineracao";
  const isNow = pathname === "/display/now";
  const isNested = isConfig || isSetup || isTheme || isCanvas || isAlarms || isMining || isNow;
  const [prefs, setPrefs] = usePrefs();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [section, setSection] = useState<"overview" | "account">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pollMs, setPollMs] = useState(POLL_MS);
  const [nextFetchAt, setNextFetchAt] = useState(Date.now() + POLL_MS);
  const [okFlashAt, setOkFlashAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [driftMs, setDriftMs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [currentCols, setCurrentCols] = useState<number>(() => colsForWidth(window.innerWidth));
  const [boards, setBoards] = useGridBoards();
  const [gridWallpaperOpen, setGridWallpaperOpen] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const { gridId: gridWallpaperId } = useGridWallpaper();
  const imageWidgets = useImageWidgets();
  const serverNotes = useServerNotes();
  const cameras = useCameras();
  const pollMsRef = useRef(POLL_MS);
  const lastUpdatedAtRef = useRef<string | null>(null);
  pollMsRef.current = pollMs;

  const [emulatorConfig, setEmulatorConfig] = useState<import("../api/types").EmulatorConfig | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/emulator/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setEmulatorConfig(j as import("../api/types").EmulatorConfig); })
      .catch(() => { });
    const onUpdate = () => {
      fetch("/api/emulator/config", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (alive) setEmulatorConfig(j as import("../api/types").EmulatorConfig); })
        .catch(() => { });
    };
    window.addEventListener("vigia:emulator-config-updated", onUpdate);
    return () => { alive = false; window.removeEventListener("vigia:emulator-config-updated", onUpdate); };
  }, []);

  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(mql.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const resolvedTheme = resolveTheme(prefs.theme);
  // Quando em "auto", o tema efetivo segue o sistema; caso contrário usa o escolhido.
  const effectiveTheme = prefs.theme === "auto" ? systemTheme : resolvedTheme;
  const pal = PALETTES[effectiveTheme];
  const flat = effectiveTheme === "contrast";
  const accent = prefs.accentCustom || ACCENTS[effectiveTheme][prefs.accent] || ACCENTS[effectiveTheme][0];
  const t = STR[prefs.lang];
  const outlet: DisplayOutlet = { lang: prefs.lang, data, nowMs: now, driftMs };
  const shellClass = cn(shell, flat && "flat");
  const pollS = pollMs / 1000;
  const showCheck = Boolean(okFlashAt && now - okFlashAt < FETCH_OK_FLASH_MS);
  const secsLeft = countdownSecs(nextFetchAt, now, pollS);

  useEffect(() => {
    applyThemeVars(pal, accent, flat);
  }, [pal, accent, flat]);

  useEffect(() => {
    // Estimativa pela largura da janela — usada fora do grid (ex.: página de
    // conta) ou até o Overview medir a largura real do grid e corrigir via
    // onColsChange (a barra lateral reduz a área útil em telas largas).
    const update = () => setCurrentCols(colsForWidth(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchHealth()
      .then((h) => {
        if (typeof h.interval_s === "number" && h.interval_s >= 15) {
          setPollMs(h.interval_s * 1000);
        }
        if (typeof h.version === "string") setBackendVersion(h.version);
        setFirmwareVersion(h.firmware_version ?? null);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const updatedAt = lastUpdatedAtRef.current;
    if (!updatedAt) return;
    setNextFetchAt(nextFetchAtMs(updatedAt, pollMs));
  }, [pollMs]);

  async function loadUsage() {
    setRefreshing(true);
    try {
      const json = await fetchUsage();
      applyPayload(json);
    } catch {
      setFetchFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  // olho tonto (circular ao redor) equivale a tocar no Badge: força GET /usage
  useEffect(() => {
    const onDizzy = () => void loadUsage();
    window.addEventListener("vigia:eye-dizzy", onDizzy as EventListener);
    return () => window.removeEventListener("vigia:eye-dizzy", onDizzy as EventListener);
  }, []);

  function applyPayload(json: UsagePayload) {
    const isNew = json.updated_at !== lastUpdatedAtRef.current;
    lastUpdatedAtRef.current = json.updated_at;
    setData(json);
    setFetchFailed(false);
    const intervalMs = pollMsRef.current;
    const serverMs = Date.parse(json.updated_at);
    if (!Number.isNaN(serverMs)) setDriftMs(serverMs - Date.now());
    setNextFetchAt(nextFetchAtMs(json.updated_at, intervalMs));
    const age = payloadAgeMs(json.updated_at);
    if (isNew && (age == null || age < FRESH_PAYLOAD_MS)) setOkFlashAt(Date.now());
  }

  useEffect(() => {
    let got = false;
    const stop = openUsageEvents((json) => {
      got = true;
      applyPayload(json);
    }, () => setFetchFailed(true));
    const watchdog = window.setTimeout(() => {
      if (!got) setFetchFailed(true);
    }, 12000);
    return () => {
      window.clearTimeout(watchdog);
      stop();
    };
  }, []);

  useEffect(() => {
    if (!data || section !== "account") return;
    const base = buildProviders(data, t);
    const bpBoard = boardForCols(boards, currentCols);
    const expanded = expandProvidersWithClones(base, bpBoard);
    if (!expanded.some((p) => p.id === selectedId) && !base.some((p) => p.id === baseIdForProvider(selectedId || ""))) setSection("overview");
  }, [data, section, selectedId, t, boards, currentCols]);

  function goOverview() {
    navigate("/display");
    setSection("overview");
  }

  const providers = data ? buildProviders(data, t, now) : [];
  const imageProvidersRaw = buildImageProviders(imageWidgets.items, t);
  const imageProviders = imageProvidersRaw.map((p) => Object.assign(p, {
    _onImageTransform: (id: string, next: { x: number; y: number; scale: number }) => void imageWidgets.update(id, { transform: next }),
  }));
  // Notas: uma única fonte, no backend (/api/notes) — compartilhadas entre
  // qualquer navegador/dispositivo/app que aponte pro mesmo servidor.
  const noteProviders = buildNoteProviders(serverNotes.items as unknown as Array<{ id: string; text: string; color: string }>, t);
  // Câmeras: cada uma cadastrada em Configurações vira seu próprio bloco,
  // igual às notas — sem toggle único de "ativar câmera".
  const cameraProviders = buildCameraProviders(cameras.items, t);
  const emulatorProviders = buildEmulatorProviders(emulatorConfig, t).map((p) => Object.assign(p, {
    _emulatorConfig: emulatorConfig ? {
      cdnVersion: emulatorConfig.cdnVersion,
      cacheEnabled: emulatorConfig.cacheEnabled,
      volume: emulatorConfig.volume,
      startOnLoaded: emulatorConfig.startOnLoaded,
      fullscreenOnLoad: emulatorConfig.fullscreenOnLoad,
      color: emulatorConfig.color,
      backgroundBlur: emulatorConfig.backgroundBlur,
      softLoad: emulatorConfig.softLoad,
      disableCue: emulatorConfig.disableCue,
      language: emulatorConfig.language,
      saveFolder: emulatorConfig.saveFolder,
      biosFolder: emulatorConfig.biosFolder,
      defaultOptions: emulatorConfig.defaultOptions,
      disableAutoUnload: emulatorConfig.disableAutoUnload,
      disableBatchBootup: emulatorConfig.disableBatchBootup,
      noAutoFocus: emulatorConfig.noAutoFocus,
      hideSettings: emulatorConfig.hideSettings,
    } : null,
  }));
  const bpBoard = boardForCols(boards, currentCols);
  const boardProviders = data
    ? [...providers, ...buildWidgetProviders(prefs.widgets, t), ...imageProviders, ...noteProviders, ...cameraProviders, ...emulatorProviders]
    : [...imageProviders, ...noteProviders, ...cameraProviders, ...buildWidgetProviders(prefs.widgets, t), ...emulatorProviders];
  const displayProviders = expandProvidersWithClones(boardProviders, bpBoard);
  const toggleWidget = (kind: WidgetKind) =>
    setPrefs((p) => {
      const cur = p.widgets ?? [];
      const next = cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind];
      return { ...p, widgets: next };
    });
  let meta: ProviderMeta | null = null;
  let rawAccount: ClaudeAccount | GptAccount | CursorAccount | CreditsAccount | OpenCodeAccount | BitcoinAccount | AdsenseAccount | null = null;
  if (data && section === "account") {
    // clones usam id "base::clone:N" — resolve para base para buscar ProviderMeta e conta
    const baseSelected = selectedId ? baseIdForProvider(selectedId) : null;
    meta = (baseSelected ? displayProviders.find((p) => p.id === selectedId) || providers.find((p) => p.id === baseSelected) : null) || null;
    if (meta && meta.provider !== "weather" && meta.kind !== "weather" && meta.provider !== "currencies" && meta.kind !== "currencies" && meta.provider !== "git" && meta.kind !== "git" && meta.provider !== "retroachievements" && meta.kind !== "retroachievements" && meta.provider !== "calendar" && meta.kind !== "calendar" && meta.provider !== "rss" && meta.kind !== "rss" && meta.provider !== "github" && meta.kind !== "github" && meta.provider !== "iss" && meta.kind !== "iss" && meta.provider !== "emulator" && meta.kind !== "emulator") {
      const baseId = baseIdForProvider(meta.id);
      const idx = baseId.indexOf(":");
      const accountId = baseId.slice(idx + 1);
      const key = meta.provider as "claude" | "gpt" | "cursor" | "openrouter" | "deepseek" | "opencode" | "fal" | "bitcoin" | "adsense";
      rawAccount = (data[key] || []).find((a) => a.id === accountId) ?? null;
    }
  }

  useEffect(() => {
    if (!prefs.focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrefs((p) => ({ ...p, focus: false }));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prefs.focus, setPrefs]);

  // Kiosk: tenta entrar em fullscreen real (para embeds). Browsers exigem gesto do usuário,
  // então tenta de imediato e também na primeira interação.
  useEffect(() => {
    if (!isKiosk) return;
    const tryFs = () => {
      if (document.fullscreenElement) return;
      document.documentElement.requestFullscreen?.().catch(() => { });
    };
    tryFs();
    const onFirstInteract = () => {
      tryFs();
      document.removeEventListener("click", onFirstInteract);
      document.removeEventListener("keydown", onFirstInteract);
    };
    document.addEventListener("click", onFirstInteract);
    document.addEventListener("keydown", onFirstInteract);
    return () => {
      document.removeEventListener("click", onFirstInteract);
      document.removeEventListener("keydown", onFirstInteract);
    };
  }, [isKiosk]);

  const toggleFocus = () => {
    setPrefs((p) => ({ ...p, focus: !p.focus }));
  };

  // ── Gamepad: CSS de foco ──
  useEffect(() => {
    const id = "gamepad-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = GAMEPAD_CSS;
    document.head.appendChild(style);
  }, []);

  // ── Gamepad: navegação global ──
  const gamepadInsideRef = useRef(false);
  const gamepadSidebarFocusRef = useRef(false);
  const [gamepadTick, setGamepadTick] = useState(0);
  const bumpGamepadTick = () => setGamepadTick((n) => n + 1);

  useGamepad({
    onTick: (a) => {
      if (isGamepadTypingActive()) return;
      // analógico direito = scroll sempre
      if (Math.abs(a.rightX) > 0.15 || Math.abs(a.rightY) > 0.15) {
        gamepadScrollMain(a.rightX, a.rightY);
      }
      // L2/R2 = zoom só nos cards do dashboard (não na página toda)
      // só quando estiver no overview (dashboard principal)
      if ((a.l2 || a.r2) && section === "overview" && !isNested) {
        const delta = (a.r2 ? 0.012 : 0) + (a.l2 ? -0.012 : 0);
        if (delta !== 0) gamepadZoom(delta);
      }
    },
    onAction: (a) => {
      if (isGamepadTypingActive()) return;

      // HOME = volta pro dashboard (overview)
      if (a.homeJust) {
        navigate("/display");
        setSection("overview");
        setSelectedId(null);
        gamepadInsideRef.current = false;
        gamepadSidebarFocusRef.current = false;
        return;
      }

      // START+SELECT = fullscreen toggle
      if (a.comboStartSelect) {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { });
        else document.documentElement.requestFullscreen?.().catch(() => { });
        return;
      }

      // SELECT = modo foco on/off (só no overview)
      if (a.selectJust && !a.start && section === "overview" && !isNested) {
        setPrefs((p) => ({ ...p, focus: !p.focus }));
        return;
      }

      // START = foco pro menu lateral (e sai do modo foco se estiver)
      if (a.startJust && !a.select) {
        if (prefs.focus) setPrefs((p) => ({ ...p, focus: false }));
        // abre sidebar em mobile, foca primeiro item
        setSidebarOpen(true);
        gamepadSidebarFocusRef.current = true;
        // foca primeiro link da sidebar
        setTimeout(() => {
          const first = document.querySelector("nav a, nav button") as HTMLElement | null;
          first?.focus();
        }, 80);
        return;
      }

      // L1 = refresh + reinicia contador
      if (a.l1Just) {
        void loadUsage();
        return;
      }

      // Se estiver dentro de um card (account view), B volta
      if (section === "account" && a.bJust) {
        setSection("overview");
        gamepadInsideRef.current = false;
        return;
      }

      // Se estiver em rota aninhada (config/theme/etc), B volta pro overview, A seleciona focado
      if (isNested) {
        if (a.bJust) {
          navigate("/display");
          return;
        }
        if (a.aJust) {
          (document.activeElement as HTMLElement | null)?.click();
          return;
        }
        // Dpad/analógico navega entre focáveis
        if (a.dpadDownJust || a.dpadRightJust) {
          const els = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => {
            const s = window.getComputedStyle(el);
            if (s.display === "none" || s.visibility === "hidden") return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 || r.height > 0;
          });
          const idx = els.indexOf(document.activeElement as HTMLElement);
          const next = idx >= 0 ? (idx + 1) % els.length : 0;
          els[next]?.focus();
          els[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        if (a.dpadUpJust || a.dpadLeftJust) {
          const els = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => {
            const s = window.getComputedStyle(el);
            if (s.display === "none" || s.visibility === "hidden") return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 || r.height > 0;
          });
          const idx = els.indexOf(document.activeElement as HTMLElement);
          const prev = idx >= 0 ? (idx - 1 + els.length) % els.length : els.length - 1;
          els[prev]?.focus();
          els[prev]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        return;
      }

      // ── Overview: navegação entre cards ──
      if (section === "overview") {
        // Se estiver com foco na sidebar, Dpad navega lá
        if (gamepadSidebarFocusRef.current) {
          if (a.bJust) {
            gamepadSidebarFocusRef.current = false;
            // volta foco pros cards
            const firstCard = document.querySelector("[data-gamepad-card]") as HTMLElement | null;
            firstCard?.focus();
            return;
          }
          if (a.dpadDownJust || a.dpadRightJust) {
            const els = Array.from(document.querySelectorAll<HTMLElement>("nav a, nav button")).filter((el) => {
              const s = window.getComputedStyle(el);
              return s.display !== "none" && s.visibility !== "hidden";
            });
            const idx = els.indexOf(document.activeElement as HTMLElement);
            const next = idx >= 0 ? (idx + 1) % els.length : 0;
            els[next]?.focus();
            return;
          }
          if (a.dpadUpJust || a.dpadLeftJust) {
            const els = Array.from(document.querySelectorAll<HTMLElement>("nav a, nav button")).filter((el) => {
              const s = window.getComputedStyle(el);
              return s.display !== "none" && s.visibility !== "hidden";
            });
            const idx = els.indexOf(document.activeElement as HTMLElement);
            const prev = idx >= 0 ? (idx - 1 + els.length) % els.length : els.length - 1;
            els[prev]?.focus();
            return;
          }
          if (a.aJust) {
            (document.activeElement as HTMLElement | null)?.click();
            gamepadSidebarFocusRef.current = false;
            return;
          }
          return;
        }

        // R1 segurado + Dpad/analógico = move widget
        if (a.r1) {
          const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
          const cardId = focused?.getAttribute("data-gamepad-card");
          if (cardId) {
            let dir: "up" | "down" | "left" | "right" | null = null;
            if (a.dpadUpJust) dir = "up";
            else if (a.dpadDownJust) dir = "down";
            else if (a.dpadLeftJust) dir = "left";
            else if (a.dpadRightJust) dir = "right";
            if (dir) {
              // dispara evento custom que o Overview escuta para mover
              window.dispatchEvent(new CustomEvent("vigia:gamepad-move", { detail: { id: cardId, dir } }));
            }
          }
          return;
        }

        // X = alterna tamanho do card focado
        if (a.xJust) {
          const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
          const cardId = focused?.getAttribute("data-gamepad-card");
          if (cardId) {
            window.dispatchEvent(new CustomEvent("vigia:gamepad-size", { detail: { id: cardId } }));
          }
          return;
        }

        // Y = abre seletor de cores do card focado e foca dentro dele
        if (a.yJust) {
          const colorDlgAlready = document.querySelector('[aria-label="Seletor de cor do card"]') as HTMLElement | null;
          if (colorDlgAlready) {
            // já aberto: foca dentro
            const first = colorDlgAlready.querySelector<HTMLElement>('input, button:not([disabled])');
            first?.focus();
            return;
          }
          const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
          const cardId = focused?.getAttribute("data-gamepad-card");
          if (cardId) {
            window.dispatchEvent(new CustomEvent("vigia:gamepad-color", { detail: { id: cardId } }));
            bumpGamepadTick();
          }
          return;
        }

        // A = entra no conteúdo do card (não nos mini controles)
        // Se o seletor de cor estiver aberto, A confirma dentro dele
        if (a.aJust) {
          const colorDlg = document.querySelector('[aria-label="Seletor de cor do card"]') as HTMLElement | null;
          if (colorDlg) {
            const active = document.activeElement as HTMLElement | null;
            // se estiver num input do seletor, A confirma (Aplicar) ou age como Enter
            if (active && colorDlg.contains(active)) {
              if (active.tagName === "INPUT") {
                if (active.getAttribute("type") !== "text" && active.getAttribute("type") !== "color") {
                  active.click();
                } else {
                  const apply = Array.from(colorDlg.querySelectorAll<HTMLElement>("button")).find((b) => b.textContent?.includes("Aplicar"));
                  apply?.focus();
                }
                return;
              }
              active.click();
              return;
            }
            // foca o primeiro focável do seletor
            const first = colorDlg.querySelector<HTMLElement>('input, button:not([disabled])');
            first?.focus();
            return;
          }

          if (gamepadInsideRef.current) {
            const active = document.activeElement as HTMLElement | null;
            const card = document.querySelector("[data-gamepad-inside]") as HTMLElement | null;
            if (active && card?.contains(active)) {
              active.click();
            } else {
              const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
              const cardId = focused?.getAttribute("data-gamepad-card");
              if (cardId) {
                const c = document.querySelector(`[data-gamepad-card="${cardId}"]`) as HTMLElement | null;
                const inner = c?.querySelector<HTMLElement>("[data-gamepad-content] button, [data-gamepad-content] a, [data-gamepad-content] [data-gamepad-focusable]");
                if (inner) {
                  c?.setAttribute("data-gamepad-inside", "true");
                  inner.focus();
                } else {
                  const openBtn = c?.querySelector<HTMLElement>("[data-gamepad-open]");
                  openBtn?.click();
                }
              }
            }
            bumpGamepadTick();
            return;
          }
          const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
          const cardId = focused?.getAttribute("data-gamepad-card");
          if (cardId) {
            const card = document.querySelector(`[data-gamepad-card="${cardId}"]`) as HTMLElement | null;
            const innerFocusable = card?.querySelector<HTMLElement>("[data-gamepad-content] button, [data-gamepad-content] a, [data-gamepad-content] [data-gamepad-focusable]");
            if (innerFocusable && card) {
              gamepadInsideRef.current = true;
              card.setAttribute("data-gamepad-inside", "true");
              innerFocusable.focus();
              bumpGamepadTick();
            } else {
              const openBtn = card?.querySelector<HTMLElement>("[data-gamepad-open]");
              if (openBtn) openBtn.click();
              else if (cardId) {
                setSection("account");
                setSelectedId(cardId);
              }
              bumpGamepadTick();
            }
          } else {
            const first = document.querySelector("[data-gamepad-card]") as HTMLElement | null;
            if (first) {
              document.querySelectorAll('[data-gamepad-focused="true"]').forEach((el) => el.removeAttribute("data-gamepad-focused"));
              first.setAttribute("data-gamepad-focused", "true");
              first.scrollIntoView({ block: "nearest", behavior: "smooth" });
              bumpGamepadTick();
            }
          }
          return;
        }

        // B = voltar (fecha seletor de cor, sai do card se estiver dentro, senão limpa foco)
        if (a.bJust) {
          const colorDlg = document.querySelector('[aria-label="Seletor de cor do card"]') as HTMLElement | null;
          if (colorDlg) {
            const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
            document.dispatchEvent(esc);
            document.body.click();
            window.setTimeout(() => {
              const still = document.querySelector('[aria-label="Seletor de cor do card"]');
              if (!still) {
                const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
                (focused as HTMLElement | null)?.focus();
              }
            }, 50);
            bumpGamepadTick();
            return;
          }
          if (gamepadInsideRef.current) {
            gamepadInsideRef.current = false;
            document.querySelectorAll("[data-gamepad-inside]").forEach((el) => el.removeAttribute("data-gamepad-inside"));
            const focused = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
            (focused as HTMLElement | null)?.focus();
            bumpGamepadTick();
            return;
          }
          const focused = document.querySelector('[data-gamepad-focused="true"]');
          if (focused) {
            focused.removeAttribute("data-gamepad-focused");
            bumpGamepadTick();
            return;
          }
        }

        // Dpad / analógico esquerdo = navega entre cards (spatial)
        // Se seletor de cor aberto, navega dentro dele
        const colorDlgOpen = document.querySelector('[aria-label="Seletor de cor do card"]') as HTMLElement | null;
        if (colorDlgOpen) {
          let dir2: "up" | "down" | "left" | "right" | null = null;
          if (a.dpadUpJust) dir2 = "up";
          else if (a.dpadDownJust) dir2 = "down";
          else if (a.dpadLeftJust) dir2 = "left";
          else if (a.dpadRightJust) dir2 = "right";
          if (dir2) {
            const focusables = Array.from(colorDlgOpen.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => {
              const s = window.getComputedStyle(el);
              return s.display !== "none" && s.visibility !== "hidden";
            });
            if (focusables.length) {
              const idx = focusables.indexOf(document.activeElement as HTMLElement);
              let next: HTMLElement | null = null;
              if (dir2 === "down" || dir2 === "right") next = focusables[(idx + 1) % focusables.length] || null;
              else next = focusables[(idx - 1 + focusables.length) % focusables.length] || null;
              next?.focus();
            }
          }
          return;
        }
        let dir: "up" | "down" | "left" | "right" | null = null;
        if (a.dpadUpJust) dir = "up";
        else if (a.dpadDownJust) dir = "down";
        else if (a.dpadLeftJust) dir = "left";
        else if (a.dpadRightJust) dir = "right";
        if (dir) {
          if (gamepadInsideRef.current) {
            // dentro do card: navega entre focáveis do conteúdo (ignora chrome)
            const card = document.querySelector("[data-gamepad-inside]") as HTMLElement | null;
            if (card) {
              const focusables = Array.from(card.querySelectorAll<HTMLElement>('[data-gamepad-content] button:not([disabled]), [data-gamepad-content] a[href], [data-gamepad-content] [tabindex]:not([tabindex="-1"]), [data-gamepad-content] [data-gamepad-focusable]')).filter((el) => {
                const s = window.getComputedStyle(el);
                return s.display !== "none" && s.visibility !== "hidden";
              });
              if (focusables.length) {
                const idx = focusables.indexOf(document.activeElement as HTMLElement);
                let next: HTMLElement | null = null;
                if (dir === "down" || dir === "right") next = focusables[(idx + 1) % focusables.length] || null;
                else next = focusables[(idx - 1 + focusables.length) % focusables.length] || null;
                next?.focus();
              }
            }
            return;
          }
          const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-gamepad-card]"));
          if (!cards.length) return;
          const current = document.querySelector('[data-gamepad-focused="true"]') as HTMLElement | null;
          // se nenhum focado, foca o primeiro
          if (!current) {
            cards[0]?.setAttribute("data-gamepad-focused", "true");
            cards[0]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            return;
          }
          // spatial nearest
          const curRect = current.getBoundingClientRect();
          const curCenter = { x: curRect.left + curRect.width / 2, y: curRect.top + curRect.height / 2 };
          let best: HTMLElement | null = null;
          let bestDist = Infinity;
          for (const card of cards) {
            if (card === current) continue;
            const r = card.getBoundingClientRect();
            const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const dx = c.x - curCenter.x;
            const dy = c.y - curCenter.y;
            let inDir = false;
            let primary = 0;
            let secondary = 0;
            if (dir === "up") { inDir = dy < -8; primary = -dy; secondary = Math.abs(dx); }
            else if (dir === "down") { inDir = dy > 8; primary = dy; secondary = Math.abs(dx); }
            else if (dir === "left") { inDir = dx < -8; primary = -dx; secondary = Math.abs(dy); }
            else if (dir === "right") { inDir = dx > 8; primary = dx; secondary = Math.abs(dy); }
            if (!inDir) continue;
            const dist = primary + secondary * 0.35;
            if (dist < bestDist) { bestDist = dist; best = card; }
          }
          if (!best) {
            const idx = cards.indexOf(current);
            best = dir === "right" || dir === "down" ? cards[(idx + 1) % cards.length] || null : cards[(idx - 1 + cards.length) % cards.length] || null;
          }
          if (best) {
            current.removeAttribute("data-gamepad-focused");
            best.setAttribute("data-gamepad-focused", "true");
            best.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }
      }
    },
  });

  const showOutlet = isCanvas || (isNested && !isNow);
  const focusMode = (Boolean(prefs.focus) || isKiosk) && !isNested;
  const hideChrome = focusMode || isCanvas;

  return (
    <div className={cn(shellClass, isCanvas && "fixed inset-0 z-50 overflow-hidden bg-black")}>
      {/* Punho para mover a janela no app quando o cabeçalho está recolhido. */}
      <div data-drag-handle aria-hidden />
      {/* ── Header ── */}
      <div
        data-app-header
        className={cn(
          "sticky top-0 z-30 flex shrink-0 items-center gap-2 bg-[var(--bg-translucent)] px-3 shadow-[0_1px_0_var(--card-border)] backdrop-blur-[14px] backdrop-saturate-150 [.flat_&]:bg-canvas [.flat_&]:backdrop-blur-none",
          "overflow-hidden transition-[height,opacity] duration-300 ease-in-out",
          hideChrome ? "h-0 opacity-0 pointer-events-none shadow-none" : "h-14",
        )}
      >
        <button className={`${iconBtn} -mr-1.5 hidden shrink-0 max-[860px]:flex`} onClick={() => setSidebarOpen(true)} title={t.overview} aria-label={t.overview}><MenuIcon size={19} /></button>
        <button data-app-brand className="group/brand -mr-1.5 flex shrink-0 cursor-pointer items-center gap-[9px] rounded-[9px] border-0 bg-transparent px-1.5 py-1 text-ink transition-colors duration-150 hover:bg-chip" onClick={goOverview}>
          <Logo size={38} showText={false} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-0.5" />
        <NavLink
          to="/display/now"
          className={({ isActive }) =>
            cn(
              num,
              "flex shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[9px] border-0 bg-transparent px-2.5 py-[7px] text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:bg-chip",
              isActive && "bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]",
            )
          }
          title={t.now}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-good shadow-[0_0_5px_var(--good)] [.flat_&]:shadow-none" />
          {fmtClock(now + driftMs)}
        </NavLink>
        <button className={cn(iconBtn, settingsOpen && "bg-chip text-accent")} onClick={() => setSettingsOpen((v) => !v)} title={t.settings}>
          <SettingsIcon size={19} />
        </button>
        <div className="mx-0.5 h-6 w-px shrink-0 bg-edge" aria-hidden />
        <Badge secs={secsLeft} total={pollS} showCheck={showCheck} pal={pal} onClick={() => void loadUsage()} />
      </div>
      {/* ── Body ── */}
      <div className={cn("flex min-h-0 flex-1", isCanvas && "h-full w-full")}>
        {!hideChrome && sidebarOpen ? <div className="fixed inset-x-0 bottom-0 top-14 z-[25] bg-black/45 min-[861px]:hidden" onClick={() => setSidebarOpen(false)} /> : null}
        <div
          className={cn(
            "shrink-0 transition-[width,opacity] duration-300 ease-in-out overflow-hidden",
            hideChrome ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100",
          )}
        >
          {!isCanvas ? (
            <Sidebar
              providers={providers}
              section={section}
              selectedId={selectedId}
              open={sidebarOpen}
              t={t}
              nowActive={isNow}
              configActive={isConfig}
              setupActive={isSetup}
              themeActive={isTheme}
              alarmsActive={isAlarms}
              miningActive={isMining}
              onOverview={goOverview}
              onSelect={(id) => { navigate("/display"); setSection("account"); setSelectedId(id); }}
              onClose={() => setSidebarOpen(false)}
              onOpenPix={() => setPixModalOpen(true)}
            />
          ) : null}
        </div>
        <main
          className={cn(
            "min-w-0 flex-1 relative",
            isCanvas ? "h-full overflow-hidden p-0" : "overflow-y-auto px-5 pb-12 pt-5 max-[860px]:px-4 max-[860px]:pb-16 max-[860px]:pt-[18px]",
          )}
        >
          {showOutlet ? (
            <Outlet context={outlet} />
          ) : isNow && data ? (
            <NowPage data={data} prefs={prefs} providers={providers} t={t} nowMs={now} driftMs={driftMs} />
          ) : !data ? (
            fetchFailed ? (
              <div className={emptyNote}>{t.fetchFail}</div>
            ) : (
              <Skeleton page={isNow ? "now" : section === "account" ? "account" : "overview"} />
            )
          ) : (
            <>
              {section === "overview" ? (
                <Overview
                  providers={displayProviders}
                  updatedAt={data.updated_at}
                  now={now}
                  t={t}
                  pal={pal}
                  board={boardForCols(boards, currentCols)}
                  onBoard={(fn) =>
                    setBoards((b) => {
                      const ids = displayProviders.map((x) => x.id);
                      const cur = boardForCols(b, currentCols);
                      const next = fn(cur);
                      if (sameBoard(cur, next, ids)) return b;
                      return { ...b, [currentCols]: next };
                    })
                  }
                  boards={boards}
                  onImportBoards={(imported) => setBoards((b) => ({ ...b, ...imported }))}
                  onColsChange={setCurrentCols}
                  onOpen={(id) => {
                    if (id.startsWith("img:")) {
                      setEditingImageId(id);
                      setImageModalOpen(true);
                      return;
                    }
                    setSection("account");
                    setSelectedId(id);
                  }}
                  focus={focusMode}
                  onToggleFocus={toggleFocus}
                  gridWallpaperId={gridWallpaperId}
                  wallpaperParallax={prefs.wallpaperParallax !== false}
                  onOpenWallpaper={() => setGridWallpaperOpen(true)}
                  onOpenAddWidget={() => setAddWidgetOpen(true)}
                  kiosk={isKiosk}
                  onRemoveImage={(id) => void imageWidgets.remove(id)}
                  onDuplicateImage={(id) => {
                    const src = imageWidgets.items.find((x) => x.id === id);
                    if (!src) return;
                    void imageWidgets.add(src.src, src.fit, src.label ?? undefined);
                  }}
                  onRemoveNote={(id) => void serverNotes.remove(id.replace(/^note:/, ""))}
                  onDuplicateNote={(id) => void serverNotes.duplicate(id.replace(/^note:/, ""))}
                  onUpdateNote={(id, patch) => void serverNotes.update(id.replace(/^note:/, ""), patch as never)}
                  onRemoveCamera={(id) => void cameras.remove(id.replace(/^widget:camera:/, ""))}
                />
              ) : null}
              {section === "account" && meta && !hideChrome ? (
                <PageBreadcrumb current={meta.title} lang={prefs.lang} onBack={goOverview} className="mb-3" />
              ) : null}
              {section === "account" && meta ? <AccountPage key={meta.id} meta={meta} account={rawAccount} data={data} t={t} pal={pal} nowMs={now} /> : null}
            </>
          )}
        </main>
      </div>
      {!isCanvas && settingsOpen ? <SettingsDrawer prefs={prefs} setPrefs={setPrefs} t={t} onRefresh={() => void loadUsage()} data={data} refreshing={refreshing} fetchFailed={fetchFailed} onClose={() => setSettingsOpen(false)} backendVersion={backendVersion} firmwareVersion={firmwareVersion} /> : null}
      <GridWallpaperModal
        open={gridWallpaperOpen}
        onClose={() => setGridWallpaperOpen(false)}
        lang={prefs.lang}
        parallax={prefs.wallpaperParallax !== false}
        onToggleParallax={(v) => setPrefs((p) => ({ ...p, wallpaperParallax: v }))}
      />
      <AddWidgetModal open={addWidgetOpen} onClose={() => setAddWidgetOpen(false)} enabled={prefs.widgets ?? []} onToggle={toggleWidget} t={t} onAddImage={() => { setEditingImageId(null); setImageModalOpen(true); }} onAddNote={() => void serverNotes.add("", "yellow")} />
      <ImageWidgetModal
        open={imageModalOpen}
        onClose={() => { setImageModalOpen(false); setEditingImageId(null); }}
        lang={prefs.lang}
        t={t}
        mode={editingImageId ? "edit" : "add"}
        editSrc={editingImageId ? imageWidgets.items.find((x) => x.id === editingImageId)?.src ?? null : null}
        editLabel={editingImageId ? imageWidgets.items.find((x) => x.id === editingImageId)?.label ?? null : null}
        onAdd={(src, fit, label) => { void imageWidgets.add(src, fit, label); }}
        onSaveEdit={(src, fit, label) => { if (editingImageId) void imageWidgets.update(editingImageId, { src, fit, label }); }}
      />
      <PixDonateModal open={pixModalOpen} onClose={() => setPixModalOpen(false)} />
      <GamepadLegend key={gamepadTick} section={section} isNested={isNested} insideCard={gamepadInsideRef.current} />
    </div>
  );
}
