import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchHealth, fetchUsage, openUsageEvents } from "../api/client";
import type { AdsenseAccount, BitcoinAccount, ClaudeAccount, CreditsAccount, CursorAccount, GptAccount, OpenCodeAccount, UsagePayload } from "../api/types";
import { colsForWidth, sameBoard } from "../board";
import { cn } from "../cn";
import { AddWidgetModal, type WidgetKind } from "../components/AddWidgetModal";
import { GridWallpaperModal } from "../components/GridWallpaperModal";
import { MenuIcon, SettingsIcon } from "../components/icons";
import { Logo } from "../components/Logo";
import { PixDonateModal } from "../components/PixDonateModal";
import { Skeleton } from "../components/Skeleton";
import { FETCH_OK_FLASH_MS, FRESH_PAYLOAD_MS, POLL_MS, countdownSecs, fmtClock, nextFetchAtMs, payloadAgeMs } from "../format";
import { useGridBoards } from "../hooks/useGridBoards";
import { useGridWallpaper } from "../hooks/useGridWallpaper";
import { STR } from "../i18n";
import { ACCENTS, PALETTES, applyThemeVars } from "../theme";
import { emptyNote, iconBtn, num, shell } from "../tw";
import type { DisplayOutlet } from "./config/usePublicConfig";
import { AccountPage } from "./display/AccountPage";
import { baseIdForProvider, boardForCols, expandProvidersWithClones } from "./display/boardHelpers";
import { buildProviders, buildWidgetProviders } from "./display/buildProviders";
import { Badge } from "./display/MetricRow";
import { Overview } from "./display/Overview";
import { SettingsDrawer } from "./display/SettingsDrawer";
import { Sidebar } from "./display/Sidebar";
import type { ProviderMeta } from "./display/types";
import { usePrefs } from "./display/usePrefs";
import NowPage from "./NowPage";

export default function Display() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isConfig = pathname === "/display/config";
  const isSetup = pathname === "/display/setup";
  const isTheme = pathname === "/display/theme" || pathname === "/display/tema";
  const isCanvas = pathname === "/display/canvas";
  const isAlarms = pathname === "/display/alarms" || pathname === "/display/alarmes";
  const isNow = pathname === "/display/now";
  const isNested = isConfig || isSetup || isTheme || isCanvas || isAlarms || isNow;
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
  const [currentCols, setCurrentCols] = useState<number>(() => colsForWidth(window.innerWidth));
  const [boards, setBoards] = useGridBoards();
  const [gridWallpaperOpen, setGridWallpaperOpen] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const { gridId: gridWallpaperId } = useGridWallpaper();
  const pollMsRef = useRef(POLL_MS);
  const lastUpdatedAtRef = useRef<string | null>(null);
  pollMsRef.current = pollMs;

  const pal = PALETTES[prefs.theme];
  const flat = prefs.theme === "contrast";
  const accent = ACCENTS[prefs.theme][prefs.accent] || ACCENTS[prefs.theme][0];
  const t = STR[prefs.lang];
  const pageTitle = isConfig ? t.config : isSetup ? t.board : isTheme ? t.theme : isAlarms ? t.alarms : isNow ? t.now : null;
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
  const bpBoard = boardForCols(boards, currentCols);
  const boardProviders = data ? [...providers, ...buildWidgetProviders(prefs.widgets, t)] : providers;
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
    if (meta && meta.provider !== "weather" && meta.kind !== "weather" && meta.provider !== "currencies" && meta.kind !== "currencies" && meta.provider !== "git" && meta.kind !== "git" && meta.provider !== "retroachievements" && meta.kind !== "retroachievements" && meta.provider !== "calendar" && meta.kind !== "calendar" && meta.provider !== "rss" && meta.kind !== "rss") {
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

  const toggleFocus = () => {
    setPrefs((p) => ({ ...p, focus: !p.focus }));
  };

  const showOutlet = isCanvas || (isNested && !isNow);
  const focusMode = Boolean(prefs.focus) && !isNested;
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
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {pageTitle ? (
            <div className="ml-0.5 flex min-w-0 items-center gap-1.5 text-ink3 max-[520px]:hidden">
              <span aria-hidden className="text-[15px] leading-none">/</span>
              <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{pageTitle}</span>
            </div>
          ) : null}
        </div>
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
                  onColsChange={setCurrentCols}
                  onOpen={(id) => { setSection("account"); setSelectedId(id); }}
                  focus={focusMode}
                  onToggleFocus={toggleFocus}
                  gridWallpaperId={gridWallpaperId}
                  onOpenWallpaper={() => setGridWallpaperOpen(true)}
                  onOpenAddWidget={() => setAddWidgetOpen(true)}
                />
              ) : null}
              {section === "account" && meta ? <AccountPage key={meta.id} meta={meta} account={rawAccount} data={data} t={t} pal={pal} nowMs={now} /> : null}
            </>
          )}
        </main>
      </div>
      {!isCanvas && settingsOpen ? <SettingsDrawer prefs={prefs} setPrefs={setPrefs} t={t} onRefresh={() => void loadUsage()} data={data} refreshing={refreshing} fetchFailed={fetchFailed} onClose={() => setSettingsOpen(false)} /> : null}
      <GridWallpaperModal open={gridWallpaperOpen} onClose={() => setGridWallpaperOpen(false)} lang={prefs.lang} />
      <AddWidgetModal open={addWidgetOpen} onClose={() => setAddWidgetOpen(false)} enabled={prefs.widgets ?? []} onToggle={toggleWidget} t={t} />
      <PixDonateModal open={pixModalOpen} onClose={() => setPixModalOpen(false)} />
    </div>
  );
}
