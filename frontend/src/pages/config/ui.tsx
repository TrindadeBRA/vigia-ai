import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Select, { type GroupBase, type SingleValue, type StylesConfig } from "react-select";
import { cn } from "../../cn";
import { CloseIcon } from "../../components/icons";
import { useRequest, type RequestStatus } from "../../hooks/useRequest";
import { cfgCard, cfgFieldLabel, cfgStatus, iconBtn } from "../../tw";

export function StepBadge({ n }: { n: string }) {
  return (
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-chip text-[13px] font-bold text-accent shadow-[inset_0_0_0_1px_var(--card-border)]">
      {n}
    </span>
  );
}

export function Card({
  title,
  lead,
  action,
  step,
  className,
  children,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
  step?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(cfgCard, className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {step ? <StepBadge n={step} /> : null}
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[15.5px] font-bold">{title}</h2>
            {lead ? <p className="mb-0 mt-1 text-[13.5px] leading-[1.55] text-ink2">{lead}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="w-full min-w-0">{children}</div> : null}
    </section>
  );
}

export function Button({
  variant = "primary",
  loading,
  block,
  children,
  className,
  type = "button",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  block?: boolean;
}) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-bold transition-[transform,opacity,background-color] duration-100",
    variant === "primary" && "border-0 bg-accent text-accent-ink shadow-btn hover:enabled:-translate-y-px [.flat_&]:shadow-none",
    variant === "secondary" && "border border-edge bg-transparent text-ink hover:enabled:bg-chip",
    variant === "ghost" && "border border-edge bg-transparent text-ink2 hover:enabled:bg-chip hover:enabled:text-ink",
    block && "w-full",
    "disabled:cursor-not-allowed disabled:opacity-45 disabled:transform-none",
    className,
  );
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : null}
      <span>{children}</span>
    </button>
  );
}

function Spinner() {
  return <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}

const fieldControlClass =
  "box-border h-[42px] w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-55";

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%239ca3af' stroke-width='2' stroke-linecap='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

export type SelectOption = { value: string; label: string };

export function SelectField({
  label,
  hint,
  options,
  wrapperClassName,
  className,
  style,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  options?: SelectOption[];
  wrapperClassName?: string;
}) {
  return (
    <label className={cn("flex min-w-[140px] flex-1 flex-col gap-1.5", wrapperClassName)}>
      {label ? <span className={cfgFieldLabel}>{label}</span> : null}
      <select
        className={cn(
          fieldControlClass,
          "appearance-none bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10",
          className,
        )}
        style={{ backgroundImage: SELECT_CHEVRON, ...style }}
        {...rest}
      >
        {options
          ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
          : children}
      </select>
      {hint ? <span className="text-xs leading-[1.45] text-ink3">{hint}</span> : null}
    </label>
  );
}

/**
 * SearchableField — select pesquisável para listas longas/dinâmicas.
 * Regra: todo select com ≥ 8 opções ou dados dinâmicos (API) DEVE usar este componente.
 * Implementado com react-select (https://react-select.com/home).
 * Ver .agents/UI_SELECT.md
 */
export type SearchableFieldOption = SelectOption;

const rsStyles: StylesConfig<SelectOption, false, GroupBase<SelectOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    height: 42,
    borderRadius: 10,
    borderColor: state.isFocused ? "var(--accent, #e63931)" : "var(--card-border, #2e2e2e)",
    backgroundColor: "var(--chip, #232323)",
    color: "var(--text, #f5f5f5)",
    boxShadow: state.isFocused ? "0 0 0 2px var(--accent, #e63931)" : "none",
    "&:hover": { borderColor: state.isFocused ? "var(--accent, #e63931)" : "var(--card-border, #2e2e2e)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 8px" }),
  input: (base) => ({ ...base, color: "var(--text, #f5f5f5)", margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: "var(--text-muted, #737373)", fontSize: 13.5 }),
  singleValue: (base) => ({ ...base, color: "var(--text, #f5f5f5)", fontSize: 13.5 }),
  menu: (base) => ({
    ...base,
    backgroundColor: "var(--card, #1c1c1c)",
    border: "1px solid var(--card-border, #2e2e2e)",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    zIndex: 50,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menuList: (base) => ({ ...base, padding: 4 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--accent, #e63931)"
      : state.isFocused
        ? "color-mix(in srgb, var(--accent, #e63931) 14%, var(--card, #1c1c1c))"
        : "transparent",
    color: state.isSelected ? "var(--accent-ink, #fff)" : "var(--text, #f5f5f5)",
    fontSize: 13.5,
    padding: "7px 10px",
    borderRadius: 8,
    cursor: "pointer",
    ":active": { backgroundColor: "var(--accent, #e63931)", color: "var(--accent-ink, #fff)" },
  }),
  groupHeading: (base) => ({
    ...base,
    backgroundColor: "var(--chip, #232323)",
    color: "var(--text-dim, #a1a1a1)",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    padding: "6px 10px 4px",
    margin: 0,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: "var(--text-muted, #737373)",
    padding: 8,
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : undefined,
    transition: "transform 0.15s",
  }),
  clearIndicator: (base) => ({ ...base, color: "var(--text-muted, #737373)", padding: 8 }),
};

export function SearchableField({
  label,
  hint,
  options,
  wrapperClassName,
  placeholder,
  value,
  onChange,
  disabled,
  isClearable,
  noOptionsMessage,
}: {
  label?: string;
  hint?: string;
  options?: SelectOption[];
  wrapperClassName?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  isClearable?: boolean;
  noOptionsMessage?: string;
}) {
  const opts = options ?? [];
  const selected = opts.find((o) => o.value === (value ?? "")) ?? null;

  const handleChange = (opt: SingleValue<SelectOption>) => {
    const val = opt?.value ?? "";
    if (!onChange) return;
    const evt = { target: { value: val }, currentTarget: { value: val } } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange(evt);
  };

  return (
    <label className={cn("flex min-w-[140px] flex-1 flex-col gap-1.5", wrapperClassName)}>
      {label ? <span className={cfgFieldLabel}>{label}</span> : null}
      <Select<SelectOption, false, GroupBase<SelectOption>>
        options={opts}
        value={selected}
        onChange={handleChange}
        placeholder={placeholder || "Buscar..."}
        isDisabled={disabled}
        isClearable={isClearable}
        isSearchable
        menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
        menuPosition="fixed"
        styles={rsStyles}
        noOptionsMessage={() => noOptionsMessage ?? "Nenhum resultado"}
        aria-label={label}
      />
      {hint ? <span className="text-xs leading-[1.45] text-ink3">{hint}</span> : null}
    </label>
  );
}

/** Alias de compatibilidade — use SearchableField em código novo. */
export const TomSelectField = SearchableField;
export type TomSelectFieldProps = Parameters<typeof SearchableField>[0];

export function TextField({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
      {label ? <span className={cfgFieldLabel}>{label}</span> : null}
      <input
        className={cn(fieldControlClass, className)}
        {...rest}
      />
      {hint ? <span className="text-xs leading-[1.45] text-ink3">{hint}</span> : null}
    </label>
  );
}

export function SliderField({
  label,
  hint,
  min = 0,
  max = 1,
  step = 0.05,
  value,
  onChange,
  onCommit,
  disabled,
  className,
}: {
  label?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <label className={cn("flex min-w-[140px] flex-1 flex-col gap-1.5", className)}>
      {label ? <span className={cfgFieldLabel}>{label}</span> : null}
      <span className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
              onCommit?.(Number((e.target as HTMLInputElement).value));
            }
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full accent-accent disabled:cursor-not-allowed disabled:opacity-55"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--chip) ${pct}%, var(--chip) 100%)`,
          }}
        />
        <span className="min-w-[3.5ch] shrink-0 rounded-[8px] border border-edge bg-canvas px-2 py-1 text-center text-[12.5px] font-bold tabular-nums text-ink">
          {value.toFixed(2)}
        </span>
      </span>
      {hint ? <span className="text-xs leading-[1.45] text-ink3">{hint}</span> : null}
    </label>
  );
}

/** Campo de caminho/arquivo com botão "…" que só aparece no Electron. */
export function PathField({
  label,
  hint,
  className,
  kind = "folder",
  value,
  onChange,
  onPicked,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
  label?: string;
  hint?: string;
  kind?: "folder" | "file" | "both";
  value?: string;
  onPicked?: (v: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const isDesktopEnv = typeof window !== "undefined" && Boolean((window as unknown as { vigia?: { isDesktop?: boolean } }).vigia?.isDesktop);

  async function handlePick() {
    if (picking) return;
    setPicking(true);
    try {
      const mod = await import("../../desktop");
      const picked = await mod.pickPath({ defaultPath: typeof value === "string" ? value : undefined, kind });
      if (picked && onPicked) onPicked(picked);
      else if (picked && onChange) {
        // sintetiza evento para compatibilidade com onChange existente
        const el = document.createElement("input");
        el.value = picked;
        const evt = { target: { value: picked }, currentTarget: { value: picked } } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(evt);
      }
    } finally {
      setPicking(false);
    }
  }

  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
      {label ? <span className={cfgFieldLabel}>{label}</span> : null}
      <span className="flex min-w-0 gap-1.5">
        <input
          className={cn(fieldControlClass, "min-w-0 flex-1", className)}
          value={value}
          onChange={onChange}
          {...rest}
        />
        {isDesktopEnv ? (
          <button
            type="button"
            className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-[10px] border border-edge bg-chip px-3 text-[16px] font-bold leading-none text-ink hover:bg-surface disabled:opacity-45"
            onClick={handlePick}
            disabled={picking}
            title={kind === "file" ? "Escolher arquivo" : kind === "both" ? "Escolher pasta ou arquivo" : "Escolher pasta"}
            aria-label="Escolher"
          >
            {picking ? "…" : "…"}
          </button>
        ) : null}
      </span>
      {hint ? <span className="text-xs leading-[1.45] text-ink3">{hint}</span> : null}
    </label>
  );
}

export function CodeRow({
  label,
  value,
  copyLabel,
  copiedLabel,
  failLabel,
}: {
  label?: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
  failLabel: string;
}) {
  const copy = useRequest();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label ? <span className={cfgFieldLabel}>{label}</span> : null}
      <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-edge bg-canvas py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[12.5px] text-accent">{value}</code>
        <Button
          variant="ghost"
          className="shrink-0 px-2.5 py-1.5 text-[12.5px]"
          loading={copy.busy}
          onClick={() =>
            copy.run(
              async () => {
                await navigator.clipboard.writeText(value);
                return { ok: true };
              },
              { success: copiedLabel, error: failLabel },
            )
          }
        >
          {copy.status === "success" ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  );
}

export function Checkbox({
  label,
  busy,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; busy?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer select-none items-center gap-2 text-sm text-ink", busy && "cursor-wait opacity-70")}>
      <input type="checkbox" className="size-[15px] accent-accent" {...rest} disabled={rest.disabled || busy} />
      <span>{label}</span>
      {busy ? <Spinner /> : null}
    </label>
  );
}

export function Switch({
  label,
  busy,
  compact,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; busy?: boolean; compact?: boolean }) {
  const input = (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-edge bg-surface transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:block after:size-3.5 after:rounded-full after:bg-ink after:transition-transform after:duration-150 checked:border-accent checked:bg-accent checked:after:translate-x-4 checked:after:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      {...rest}
      disabled={rest.disabled || busy}
    />
  );

  if (compact) {
    return (
      <label className={cn("flex shrink-0 cursor-pointer select-none items-center", busy && "cursor-wait opacity-70")}>
        {input}
        {busy ? <Spinner /> : null}
      </label>
    );
  }

  return (
    <label className={cn("flex shrink-0 cursor-pointer select-none flex-col items-end gap-[5px]", busy && "cursor-wait opacity-70")}>
      <span className="text-[10.5px] font-bold uppercase tracking-[.45px] text-ink3">{label}</span>
      <span className="flex items-center gap-1.5">
        {input}
        {busy ? <Spinner /> : null}
      </span>
    </label>
  );
}

export function Fold({ summary, defaultOpen, children }: { summary: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <details
      className="group border-t border-edge pt-2.5"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[12.5px] font-[650] text-ink2 group-open:text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-block size-1.5 shrink-0 -rotate-45 border-b-[1.8px] border-r-[1.8px] border-current transition-transform duration-150 group-open:rotate-45" />
        {summary}
      </summary>
      <div className="mt-2.5 flex flex-col gap-2">{children}</div>
    </details>
  );
}

export function StatusPill({ state, label }: { state: "ok" | "warn" | "missing"; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-chip px-2 py-[3px] text-[11.5px] font-[650]",
        state === "ok" && "text-good",
        state === "warn" && "text-warn",
        state === "missing" && "text-bad",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function FieldStatus({ status, message }: { status: RequestStatus; message: string }) {
  if (!message) return null;
  return (
    <p
      className={cn(cfgStatus, status === "error" && "text-bad", status === "success" && "text-good")}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2">{children}</div>;
}

export function Modal({
  title,
  onClose,
  wide,
  closeLabel = "Fechar",
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  closeLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal pro <body>: renderizado inline, um "fixed inset-0" fica preso ao
  // viewport SÓ se nenhum ancestral tiver transform/filter/perspective (isso
  // vira containing block pro fixed) — páginas com uma animação de entrada
  // (ex.: animate-fade, que deixa um `transform` residual mesmo parado, ver
  // tailwind.config.js:fadeIn) quebram esse pressuposto e o overlay cobre só
  // aquele container, não a tela inteira. Portal evita depender disso.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex min-w-0 max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-card-hover",
          wide ? "max-w-[720px]" : "max-w-[480px]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
          <h2 className="m-0 text-[15.5px] font-bold">{title}</h2>
          <button type="button" className={iconBtn} onClick={onClose} title={closeLabel} aria-label={closeLabel}>
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
