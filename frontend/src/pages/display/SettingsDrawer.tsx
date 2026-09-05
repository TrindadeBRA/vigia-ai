import type { UsagePayload } from "../../api/types";
import { cn } from "../../cn";
import { CheckIcon, CloseIcon } from "../../components/icons";
import { fmtWhen } from "../../format";
import type { T } from "../../i18n";
import { ACCENTS, inverseOn, type ThemeName } from "../../theme";
import { iconBtn } from "../../tw";
import { Kv } from "./AccountPage";
import type { Prefs } from "./usePrefs";

export function SettingsDrawer({ prefs, setPrefs, t, onRefresh, data, refreshing, fetchFailed, onClose }: { prefs: Prefs; setPrefs: (fn: (p: Prefs) => Prefs) => void; t: T; onRefresh: () => void; data: UsagePayload | null; refreshing: boolean; fetchFailed: boolean; onClose: () => void }) {
  const accents = ACCENTS[prefs.theme];
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
          {(["dark", "light", "contrast"] as ThemeName[]).map((k) => (
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
                prefs.accent === i && "border-ink",
              )}
              aria-label={`${t.accentSection} ${i + 1}`}
              style={{ background: c }}
              onClick={() => setPrefs((p) => ({ ...p, accent: i }))}
            >
              {prefs.accent === i ? <CheckIcon size={14} stroke={inverseOn(c)} /> : null}
            </button>
          ))}
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
