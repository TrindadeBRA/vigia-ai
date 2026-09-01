import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { cn } from "../../cn";
import type { RequestStatus } from "../../hooks/useRequest";
import { cfgCard, cfgFieldLabel, cfgGrid, cfgSkel, cfgStatus } from "../../tw";

export function Card({
  title,
  lead,
  action,
  className,
  children,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(cfgCard, className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[15.5px] font-bold">{title}</h2>
          {lead ? <p className="mb-0 mt-1 text-[13.5px] leading-[1.55] text-ink2">{lead}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
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
        className={cn(
          "w-full rounded-[10px] border border-edge bg-canvas px-3 py-2.5 text-sm text-ink focus:border-transparent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-55",
          className,
        )}
        {...rest}
      />
      {hint ? <span className="text-xs leading-[1.45] text-ink3">{hint}</span> : null}
    </label>
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
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; busy?: boolean }) {
  return (
    <label className={cn("flex shrink-0 cursor-pointer select-none flex-col items-end gap-[5px]", busy && "cursor-wait opacity-70")}>
      <span className="text-[10.5px] font-bold uppercase tracking-[.45px] text-ink3">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="checkbox"
          role="switch"
          className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-edge bg-surface transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:block after:size-3.5 after:rounded-full after:bg-ink after:transition-transform after:duration-150 checked:border-accent checked:bg-accent checked:after:translate-x-4 checked:after:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          {...rest}
          disabled={rest.disabled || busy}
        />
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

export function Skeleton() {
  return (
    <div className="flex w-full flex-col gap-[14px]" aria-hidden>
      <div className={cn(cfgSkel, "h-11")} />
      <div className={cn(cfgSkel, "h-[92px]")} />
      <div className={cfgGrid}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cn(cfgSkel, "h-[172px]")} />
        ))}
      </div>
      <div className={cfgGrid}>
        <div className={cn(cfgSkel, "h-[172px]")} />
        <div className={cn(cfgSkel, "h-[172px]")} />
      </div>
    </div>
  );
}
