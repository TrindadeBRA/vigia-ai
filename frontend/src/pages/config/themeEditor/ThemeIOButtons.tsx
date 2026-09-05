import { useRef, useState, type ChangeEvent } from "react";
import { DownloadIcon, UploadIcon } from "../../../components/icons";
import type { ThemeCopy } from "../themeCopy";
import { downloadThemeJson, parseThemeJson, type ThemeState } from "./themeState";

export function ThemeIOButtons({
  theme,
  hasWallpaper,
  onImport,
  c,
}: {
  theme: ThemeState;
  hasWallpaper: boolean;
  onImport: (t: ThemeState) => void;
  c: ThemeCopy;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function flash(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg((m) => (m === text ? null : m)), 3000);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseThemeJson(String(reader.result || ""));
      if (!parsed) {
        flash(c.themeImportError);
        return;
      }
      onImport(parsed);
      flash(c.themeImported);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink"
        title={c.exportTheme}
        aria-label={c.exportTheme}
        onClick={() => downloadThemeJson(theme, hasWallpaper)}
      >
        <DownloadIcon size={14} />
      </button>
      <button
        type="button"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge bg-chip text-ink3 hover:border-accent hover:text-ink"
        title={c.importTheme}
        aria-label={c.importTheme}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon size={14} />
      </button>
      <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={handleFile} />
      {msg ? <span className="text-[11.5px] text-ink3">{msg}</span> : null}
    </div>
  );
}
