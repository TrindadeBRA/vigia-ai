import { useState } from "react";
import { cn } from "../../../cn";
import { cfgFieldLabel } from "../../../tw";
import { NameToColorPicker } from "../NameToColorPicker";

export function ScaleField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
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

export function ColorSwatch({ value, onChange, size = 36 }: { value: string | null; onChange: (v: string) => void; size?: number }) {
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

export function ColorField({
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
