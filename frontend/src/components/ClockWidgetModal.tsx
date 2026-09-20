import { useEffect, useState, type ChangeEvent } from "react";
import { cn } from "../cn";
import type { T } from "../i18n";
import { Button, Modal, SelectField } from "../pages/config/ui";
import { CLOCK_TIMEZONES, type ClockConfig, type ClockMode } from "./cards/ClockCard";

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

function clampInt(v: number | undefined, min: number, max: number, fallback: number): number {
    if (typeof v !== "number" || Number.isNaN(v)) return fallback;
    return Math.min(max, Math.max(min, Math.round(v)));
}

const MODE_TABS: ClockMode[] = ["clock", "countdown", "stopwatch", "pomodoro"];

const inputClass = "w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink3";
const labelClass = "text-[11px] font-semibold text-ink2";

/** Modal de configuração do widget de relógio (por card — prefs.clockConfig[id]). */
export function ClockWidgetModal({
    open,
    onClose,
    t,
    initial,
    mode,
    onSave,
}: {
    open: boolean;
    onClose: () => void;
    t: T;
    initial: ClockConfig;
    mode: "add" | "edit";
    onSave: (config: ClockConfig) => void;
}) {
    const [draft, setDraft] = useState<ClockConfig>(initial);
    const [countdownLocal, setCountdownLocal] = useState(toDatetimeLocal(initial.countdownAt));

    useEffect(() => {
        if (open) {
            setDraft(initial);
            setCountdownLocal(toDatetimeLocal(initial.countdownAt));
        }
    }, [open, initial]);

    if (!open) return null;

    const set = (patch: Partial<ClockConfig>) => setDraft((d) => ({ ...d, ...patch }));

    const setPomodoro =
        (key: "pomodoroFocusMin" | "pomodoroShortMin" | "pomodoroLongMin" | "pomodoroCycles") =>
        (e: ChangeEvent<HTMLInputElement>) => {
            const n = parseInt(e.target.value, 10);
            set({ [key]: Number.isNaN(n) ? undefined : n });
        };

    const tabLabel: Record<ClockMode, string> = {
        clock: t.clockTabClock,
        countdown: t.clockTabCountdown,
        stopwatch: t.clockTabStopwatch,
        pomodoro: t.clockTabPomodoro,
    };

    function handleSave() {
        onSave({
            ...draft,
            label: draft.label?.trim() ? draft.label.trim() : null,
            countdownAt: fromDatetimeLocal(countdownLocal),
            countdownLabel: draft.countdownLabel?.trim() ? draft.countdownLabel.trim() : null,
            pomodoroFocusMin: clampInt(draft.pomodoroFocusMin, 1, 180, 25),
            pomodoroShortMin: clampInt(draft.pomodoroShortMin, 1, 60, 5),
            pomodoroLongMin: clampInt(draft.pomodoroLongMin, 1, 90, 15),
            pomodoroCycles: clampInt(draft.pomodoroCycles, 2, 8, 4),
        });
        onClose();
    }

    return (
        <Modal title={mode === "edit" ? t.clockEditTitle : t.clockAddTitle} onClose={onClose}>
            {/* Abas de modo */}
            <div className="flex gap-1 rounded-xl bg-surface p-1">
                {MODE_TABS.map((m) => (
                    <button
                        key={m}
                        type="button"
                        className={cn(
                            "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                            draft.mode === m ? "bg-panel text-ink shadow-sm" : "text-ink3 hover:text-ink",
                        )}
                        onClick={() => set({ mode: m })}
                    >
                        {tabLabel[m]}
                    </button>
                ))}
            </div>

            {/* Rótulo */}
            <label className="flex flex-col gap-1">
                <span className={labelClass}>{t.clockLabel}</span>
                <input
                    value={draft.label ?? ""}
                    onChange={(e) => set({ label: e.target.value })}
                    placeholder={t.clockLabelPh}
                    className={inputClass}
                />
            </label>

            {/* Fuso + segundos (modo relógio) */}
            {draft.mode === "clock" ? (
                <>
                    <SelectField
                        label={t.clockTimezone}
                        value={draft.timezone ?? ""}
                        onChange={(e) => set({ timezone: e.target.value || null })}
                        options={[
                            { value: "", label: t.clockTimezoneLocal },
                            ...CLOCK_TIMEZONES.map((c) => ({ value: c.tz, label: `${c.city} (${c.tz})` })),
                        ]}
                    />
                    <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                            type="checkbox"
                            checked={draft.showSeconds !== false}
                            onChange={(e) => set({ showSeconds: e.target.checked })}
                            className="size-4 accent-accent"
                        />
                        {t.clockShowSeconds}
                    </label>
                </>
            ) : null}

            {/* Countdown */}
            {draft.mode === "countdown" ? (
                <>
                    <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                        <label className="flex flex-col gap-1">
                            <span className={labelClass}>{t.imageCountdownAt ?? "Contagem regressiva"}</span>
                            <input
                                type="datetime-local"
                                value={countdownLocal}
                                onChange={(e) => setCountdownLocal(e.target.value)}
                                className={inputClass}
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className={labelClass}>{t.imageCountdownLabel ?? "Rótulo do cronômetro"}</span>
                            <input
                                value={draft.countdownLabel ?? ""}
                                onChange={(e) => set({ countdownLabel: e.target.value })}
                                placeholder={t.imageCountdownLabelPh ?? "Ex.: GTA VI"}
                                className={inputClass}
                            />
                        </label>
                    </div>
                    <p className="text-[11px] leading-relaxed text-ink3">
                        {t.imageCountdownHint ?? "Opcional — mostra um cronômetro centralizado sobre a imagem até a data escolhida."}
                    </p>
                </>
            ) : null}

            {/* Pomodoro */}
            {draft.mode === "pomodoro" ? (
                <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
                    <label className="flex flex-col gap-1">
                        <span className={labelClass}>{t.clockPomodoroFocusMin}</span>
                        <input
                            type="number"
                            min={1}
                            max={180}
                            value={draft.pomodoroFocusMin ?? 25}
                            onChange={setPomodoro("pomodoroFocusMin")}
                            className={inputClass}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={labelClass}>{t.clockPomodoroShortMin}</span>
                        <input
                            type="number"
                            min={1}
                            max={60}
                            value={draft.pomodoroShortMin ?? 5}
                            onChange={setPomodoro("pomodoroShortMin")}
                            className={inputClass}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={labelClass}>{t.clockPomodoroLongMin}</span>
                        <input
                            type="number"
                            min={1}
                            max={90}
                            value={draft.pomodoroLongMin ?? 15}
                            onChange={setPomodoro("pomodoroLongMin")}
                            className={inputClass}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={labelClass}>{t.clockPomodoroCycles}</span>
                        <input
                            type="number"
                            min={2}
                            max={8}
                            value={draft.pomodoroCycles ?? 4}
                            onChange={setPomodoro("pomodoroCycles")}
                            className={inputClass}
                        />
                    </label>
                </div>
            ) : null}

            {/* Ações */}
            <div className="flex justify-end gap-2 border-t border-edge pt-4">
                <Button variant="ghost" onClick={onClose}>
                    {t.widgetNoteCancel ?? "Cancelar"}
                </Button>
                <Button onClick={handleSave}>{t.save}</Button>
            </div>
        </Modal>
    );
}