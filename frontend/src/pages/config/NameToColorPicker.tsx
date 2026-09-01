import { useEffect, useMemo, useState } from "react";
import { cn } from "../../cn";
import { useNameToColor, ntcGenerateColor, ntcClosestName, ntcListColors } from "../../hooks/useNameToColor";
import { cfgFieldLabel, cfgStatus } from "../../tw";
import { THEME_STR } from "./themeCopy";
import type { Lang } from "../../i18n";

function localeFor(lang: Lang): string | undefined {
  if (lang === "pt") return "pt-BR";
  return undefined; // en/es fallback to English (plugin only has en + pt-BR)
}

export function NameToColorPicker({
  value,
  onChange,
  lang,
  allowClear = true,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  lang: Lang;
  allowClear?: boolean;
}) {
  const c = THEME_STR[lang];
  const { ready, error } = useNameToColor();
  const [input, setInput] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 48;

  const locale = localeFor(lang);

  // preview from arbitrary string
  const preview = useMemo(() => {
    if (!ready || !input.trim()) return null;
    return ntcGenerateColor(input.trim());
  }, [ready, input]);

  const previewName = useMemo(() => {
    if (!ready || !input.trim() || !preview) return null;
    // closestName gives nearest DB name for any hex
    return ntcClosestName(preview, locale) ?? ntcClosestName(input.trim(), locale);
  }, [ready, input, preview, locale]);

  // base colors browsing
  const [baseData, setBaseData] = useState<{ items: { Color: string; Hexadecimal: string }[]; totalItems: number } | null>(null);
  const [baseLoading, setBaseLoading] = useState(false);

  useEffect(() => {
    if (!browseOpen || !ready) return;
    if (baseData) return;
    setBaseLoading(true);
    // load first 300 for quick browsing; user can search to filter
    const d = ntcListColors(1, 300, locale);
    if (d) {
      setBaseData({ items: d.items, totalItems: d.totalItems });
      setBaseLoading(false);
    } else {
      // fallback: try without locale
      const d2 = ntcListColors(1, 300, undefined);
      if (d2) setBaseData({ items: d2.items, totalItems: d2.totalItems });
      setBaseLoading(false);
    }
  }, [browseOpen, ready, baseData, locale]);

  const filtered = useMemo(() => {
    if (!baseData) return [];
    const q = search.trim().toLowerCase();
    if (!q) return baseData.items;
    return baseData.items.filter(
      (it) => it.Color.toLowerCase().includes(q) || it.Hexadecimal.toLowerCase().includes(q),
    );
  }, [baseData, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-edge bg-canvas/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cfgFieldLabel}>{c.ntcTitle}</span>
        <a
          href="https://zonaro.github.io/NameToColor/"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-[650] text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80"
        >
          {c.ntcDocs} ↗
        </a>
      </div>

      <p className="m-0 text-[11.5px] leading-[1.5] text-ink3">{c.ntcHint}</p>
      <p className="m-0 text-[11px] font-medium text-ink3">{c.ntcAnyString}</p>

      {!ready && !error ? <p className={cfgStatus}>{c.ntcLoading}</p> : null}
      {error ? <p className={`${cfgStatus} text-bad`}>{c.ntcError}</p> : null}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={c.ntcPlaceholder}
            disabled={!ready}
            className="min-w-0 flex-1 rounded-[10px] border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink3 focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!ready || !preview}
            onClick={() => preview && onChange(preview)}
            className="shrink-0 rounded-[10px] bg-accent px-3.5 py-2 text-[13px] font-bold text-accent-ink shadow-btn hover:enabled:-translate-y-px disabled:opacity-40"
          >
            {c.ntcApply}
          </button>
        </div>

        {input.trim() && preview ? (
          <div className="flex items-center gap-3 rounded-[10px] border border-edge bg-panel px-3 py-2">
            <span
              className="size-8 shrink-0 rounded-full border border-edge shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)]"
              style={{ background: preview }}
              aria-hidden
            />
            <div className="flex min-w-0 flex-col">
              <span className="font-mono text-[13px] font-bold text-ink">{preview.toUpperCase()}</span>
              {previewName ? (
                <span className="text-[11.5px] text-ink3">
                  {c.ntcName}: {previewName}
                </span>
              ) : null}
            </div>
            <span className="ml-auto hidden text-[11px] text-ink3 sm:inline">{c.ntcGenerated}</span>
          </div>
        ) : null}

        {value && allowClear ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-fit text-[11.5px] text-ink3 underline decoration-dotted underline-offset-2 hover:text-ink2"
          >
            {c.ntcClear} ({c.colorNone})
          </button>
        ) : null}
      </div>

      <div className="border-t border-edge pt-2">
        <button
          type="button"
          onClick={() => setBrowseOpen((v) => !v)}
          disabled={!ready}
          className="flex w-full items-center justify-between rounded-[10px] border border-edge bg-panel px-3 py-2 text-left text-[13px] font-[650] text-ink hover:bg-chip disabled:opacity-50"
        >
          <span>{c.ntcBrowse}</span>
          <span className={cn("text-[11px] text-ink3 transition-transform", browseOpen && "rotate-180")}>▾</span>
        </button>

        {browseOpen ? (
          <div className="mt-2 flex flex-col gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={c.ntcSearch}
              className="w-full rounded-[10px] border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink3 focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            />

            {baseLoading ? (
              <p className={cfgStatus}>{c.ntcLoading}</p>
            ) : filtered.length === 0 ? (
              <p className={cfgStatus}>{c.ntcNoMatch}</p>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                  {pageItems.map((it) => (
                    <button
                      key={`${it.Hexadecimal}-${it.Color}`}
                      type="button"
                      title={`${it.Color} ${it.Hexadecimal}`}
                      onClick={() => onChange(it.Hexadecimal)}
                      className={cn(
                        "group flex flex-col items-center gap-1 rounded-[10px] border p-1.5 transition hover:scale-[1.02] hover:shadow",
                        value?.toLowerCase() === it.Hexadecimal.toLowerCase()
                          ? "border-accent bg-accent/10"
                          : "border-edge bg-panel",
                      )}
                    >
                      <span
                        className="size-7 rounded-full border border-edge shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]"
                        style={{ background: it.Hexadecimal }}
                      />
                      <span className="line-clamp-1 w-full text-center text-[9px] font-[650] leading-none text-ink3 group-hover:text-ink">
                        {it.Color}
                      </span>
                      <span className="font-mono text-[8px] leading-none text-ink3">{it.Hexadecimal}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-ink3">
                    {filtered.length} {c.ntcBaseColors.toLowerCase()} · {page}/{totalPages}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-full border border-edge bg-panel px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-chip disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-full border border-edge bg-panel px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-chip disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
