import { useEffect, useMemo, useState } from "react";
import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { CheckIcon, CloseIcon } from "../../components/icons";
import { fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { ACCENTS, inverseOn, resolveTheme, type ThemeName } from "../../theme";
import { iconBtn } from "../../tw";
import { Kv } from "./AccountPage";
import { ntcGenerateColor, useNameToColor } from "../../hooks/useNameToColor";
import type { Prefs } from "./usePrefs";

function normalizeHexInput(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s.slice(1).split("").map((c) => c + c).join("").toLowerCase()}`;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return `#${s.slice(1, 7).toLowerCase()}`;
  return null;
}

export function SettingsDrawer({ prefs, setPrefs, t, onRefresh, data, refreshing, fetchFailed, onClose }: { prefs: Prefs; setPrefs: (fn: (p: Prefs) => Prefs) => void; t: T; onRefresh: () => void; data: UsagePayload | null; refreshing: boolean; fetchFailed: boolean; onClose: () => void }) {
  const effectiveTheme = resolveTheme(prefs.theme);
  const accents = ACCENTS[effectiveTheme];
  const { ready: ntcReady } = useNameToColor();
  const [customInput, setCustomInput] = useState(prefs.accentCustom || "");
  useEffect(() => {
    if (prefs.accentCustom) setCustomInput(prefs.accentCustom);
  }, [prefs.accentCustom]);
  const previewHex = useMemo(() => {
    const v = customInput.trim();
    if (!v) return null;
    const direct = normalizeHexInput(v);
    if (direct) return direct;
    if (!ntcReady) return null;
    return ntcGenerateColor(v);
  }, [customInput, ntcReady]);
  const isCustomActive = !!prefs.accentCustom;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 right-0 top-0 z-[41] w-[340px] max-w-[88vw] animate-slide-in overflow-y-auto border-l border-edge bg-panel px-[18px] pb-6 pt-4 shadow-drawer [.flat_&]:shadow-none">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="m-0 text-base font-[750]">{t.settings}</h2>
          <button className={iconBtn} onClick={onClose} title={t.closeSettings}>
            <CloseIcon size={18} />
          </button>
        </div>
        <Kv k={t.updated} v={data ? fmtWhen(data.updated_at) : "—"} />
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.themeSection}</div>
        <div className="flex gap-[3px] rounded-xl border border-edge bg-chip p-[3px]">
          {(["dark", "light", "contrast", "auto"] as ThemeName[]).map((k) => (
            <button
              key={k}
              className={cn(
                "flex-1 cursor-pointer rounded-[9px] border-0 bg-transparent px-1.5 py-[9px] text-[13px] font-semibold text-ink2 transition-[background-color,color,box-shadow] duration-150 hover:text-ink",
                prefs.theme === k && "bg-panel text-accent shadow-seg [.flat_&]:shadow-[inset_0_0_0_1.5px_var(--accent)]",
              )}
              onClick={() => setPrefs((p) => ({ ...p, theme: k }))}
            >
              {t[k]}
            </button>
          ))}
        </div>
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.accentSection}</div>
        <div className="flex flex-wrap gap-[9px]">
          {accents.map((c, i) => (
            <button
              key={i}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-[10px] border-2 border-transparent p-0 transition-[transform,border-color] duration-150 hover:-translate-y-px",
                !isCustomActive && prefs.accent === i && "border-ink",
              )}
              aria-label={`${t.accentSection} ${i + 1}`}
              style={{ background: c }}
              onClick={() => setPrefs((p) => ({ ...p, accent: i, accentCustom: null }))}
            >
              {!isCustomActive && prefs.accent === i ? <CheckIcon size={14} stroke={inverseOn(c)} /> : null}
            </button>
          ))}
          {isCustomActive ? (
            <button
              className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] border-2 border-ink p-0 transition-[transform,border-color] duration-150 hover:-translate-y-px"
              aria-label={t.accentCustomCurrent}
              style={{ background: prefs.accentCustom! }}
              title={prefs.accentCustom!}
            >
              <CheckIcon size={14} stroke={inverseOn(prefs.accentCustom!)} />
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-edge bg-canvas/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium leading-[1.4] text-ink3">{t.accentCustomHint}</span>
            <a href="https://github.com/zonaro/NameToColor" target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-[650] text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80">
              {t.accentNtcHint} ↗
            </a>
          </div>
          <div className="flex gap-2">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={t.accentCustomPlaceholder}
              className="min-w-0 flex-1 rounded-[10px] border border-edge bg-panel px-3 py-2 text-[13px] text-ink placeholder:text-ink3 focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            />
            <input
              type="color"
              value={normalizeHexInput(previewHex || prefs.accentCustom || accents[0] || "#e63931") || "#e63931"}
              onChange={(e) => setCustomInput(e.target.value)}
              className="size-[38px] shrink-0 cursor-pointer rounded-[10px] border border-edge bg-panel p-1"
              title="Seletor nativo"
            />
          </div>
          {previewHex ? (
            <div className="flex items-center gap-2.5 rounded-[10px] border border-edge bg-panel px-3 py-2">
              <span className="size-7 shrink-0 rounded-full border border-edge shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]" style={{ background: previewHex }} aria-hidden />
              <span className="font-mono text-[12px] font-bold text-ink">{previewHex.toUpperCase()}</span>
              <button
                type="button"
                disabled={!previewHex}
                onClick={() => previewHex && setPrefs((p) => ({ ...p, accentCustom: previewHex }))}
                className="ml-auto rounded-[9px] bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-ink shadow-btn hover:enabled:-translate-y-px disabled:opacity-40"
              >
                {t.accentCustomApply}
              </button>
            </div>
          ) : customInput.trim() ? (
            <p className="m-0 text-[11px] text-ink3">{ntcReady ? "—" : "Carregando NameToColor…"}</p>
          ) : null}
          {isCustomActive ? (
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="flex items-center gap-1.5 text-ink3">
                <span className="size-3 rounded-full border border-edge" style={{ background: prefs.accentCustom! }} aria-hidden />
                {t.accentCustomCurrent}: <span className="font-mono font-bold text-ink">{prefs.accentCustom!.toUpperCase()}</span>
              </span>
              <button type="button" onClick={() => setPrefs((p) => ({ ...p, accentCustom: null }))} className="ml-auto text-[11.5px] font-medium text-ink3 underline decoration-dotted underline-offset-2 hover:text-ink">
                {t.accentCustomClear}
              </button>
            </div>
          ) : null}
        </div>
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.langSection}</div>
        <div className="flex gap-[3px] rounded-xl border border-edge bg-chip p-[3px]">
          {([["pt", "PT"], ["en", "EN"], ["es", "ES"]] as const).map(([k, label]) => (
            <button
              key={k}
              className={cn(
                "flex-1 cursor-pointer rounded-[9px] border-0 bg-transparent px-1.5 py-[9px] text-[13px] font-semibold text-ink2 transition-[background-color,color,box-shadow] duration-150 hover:text-ink",
                prefs.lang === k && "bg-panel text-accent shadow-seg [.flat_&]:shadow-[inset_0_0_0_1.5px_var(--accent)]",
              )}
              onClick={() => setPrefs((p) => ({ ...p, lang: k }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-[9px] mt-5 text-[11.5px] font-[650] uppercase tracking-[.6px] text-ink3">{t.refreshSection}</div>
        <button className="w-full cursor-pointer rounded-xl border-0 bg-accent p-[13px] text-[14.5px] font-bold text-accent-ink shadow-btn transition-[transform,box-shadow,opacity] duration-100 hover:-translate-y-px active:translate-y-0 active:opacity-90 [.flat_&]:shadow-none" onClick={onRefresh}>{refreshing ? "…" : t.refreshNow}</button>
        <div className="mt-3 text-xs leading-[1.55] text-ink3">{t.autoNote()}</div>
        {fetchFailed ? <div className="mt-1.5 text-xs text-bad">{t.fetchFail}</div> : null}
      </div>
    </>
  );
}
