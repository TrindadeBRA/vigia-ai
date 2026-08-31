import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import type { RequestStatus } from "../../hooks/useRequest";

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
    <section className={["cfg-card", className].filter(Boolean).join(" ")}>
      <div className="cfg-card-head">
        <div className="cfg-card-copy">
          <h2 className="cfg-card-title">{title}</h2>
          {lead ? <p className="cfg-card-lead">{lead}</p> : null}
        </div>
        {action ? <div className="cfg-card-action">{action}</div> : null}
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
  const cls = ["cfg-btn", `cfg-btn-${variant}`, block ? "cfg-btn-block" : "", className || ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="cfg-spinner" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}

export function TextField({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="cfg-field">
      {label ? <span className="cfg-field-label">{label}</span> : null}
      <input className={["cfg-input", className || ""].filter(Boolean).join(" ")} {...rest} />
      {hint ? <span className="cfg-field-hint">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({
  label,
  busy,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; busy?: boolean }) {
  return (
    <label className={`cfg-check${busy ? " is-busy" : ""}`}>
      <input type="checkbox" {...rest} disabled={rest.disabled || busy} />
      <span>{label}</span>
      {busy ? <span className="cfg-spinner" aria-hidden /> : null}
    </label>
  );
}

export function Switch({
  label,
  busy,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; busy?: boolean }) {
  return (
    <label className={`cfg-switch${busy ? " is-busy" : ""}`}>
      <span className="cfg-switch-label">{label}</span>
      <span className="cfg-switch-ctl">
        <input type="checkbox" role="switch" {...rest} disabled={rest.disabled || busy} />
        {busy ? <span className="cfg-spinner" aria-hidden /> : null}
      </span>
    </label>
  );
}

export function Fold({ summary, defaultOpen, children }: { summary: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <details
      className="cfg-fold"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>{summary}</summary>
      <div className="cfg-fold-body">{children}</div>
    </details>
  );
}

export function StatusPill({ state, label }: { state: "ok" | "warn" | "missing"; label: string }) {
  return (
    <span className={`cfg-pill ${state}`}>
      <span className="cfg-pill-dot" />
      {label}
    </span>
  );
}

export function FieldStatus({ status, message }: { status: RequestStatus; message: string }) {
  if (!message) return null;
  const kind = status === "error" ? "err" : status === "success" ? "ok" : "";
  return (
    <p className={`cfg-status ${kind}`.trim()} role="status" aria-live="polite">
      {message}
    </p>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="cfg-row">{children}</div>;
}

export function Skeleton() {
  return (
    <div className="cfg-skel-page" aria-hidden>
      <div className="cfg-skel cfg-skel-lead" />
      <div className="cfg-skel cfg-skel-banner" />
      <div className="cfg-grid">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="cfg-skel cfg-skel-card" />
        ))}
      </div>
      <div className="cfg-grid">
        <div className="cfg-skel cfg-skel-card" />
        <div className="cfg-skel cfg-skel-card" />
      </div>
    </div>
  );
}
