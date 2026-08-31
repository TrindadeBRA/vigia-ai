import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { d?: string; size?: number };

export function Svg({ d, size, viewBox, stroke, fill, className, children, ...rest }: IconProps) {
  return (
    <svg width={size || 16} height={size || 16} viewBox={viewBox || "0 0 24 24"} className={className} fill={fill || "none"} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...rest}>
      {children || (d ? <path d={d} stroke={stroke || "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null)}
    </svg>
  );
}

export function CheckIcon(props: { size?: number; stroke?: string }) {
  return <Svg {...props} d="M5 13l4 4L19 7" />;
}

export function CloseIcon(props: { size?: number }) {
  return <Svg {...props} d="M6 6l12 12M18 6L6 18" />;
}

export function MenuIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <line x1={4} y1={7} x2={20} y2={7} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1={4} y1={12} x2={20} y2={12} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1={4} y1={17} x2={20} y2={17} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function SettingsIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <line x1={4} y1={6} x2={20} y2={6} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={9} cy={6} r={2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
      <line x1={4} y1={12} x2={20} y2={12} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={15} cy={12} r={2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
      <line x1={4} y1={18} x2={20} y2={18} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={11} cy={18} r={2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
    </Svg>
  );
}

export function GridIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <rect x={4} y={4} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <rect x={13} y={4} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <rect x={4} y={13} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <rect x={13} y={13} width={7} height={7} rx={1.6} stroke="currentColor" strokeWidth={2} />
    </Svg>
  );
}

export function ClockIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={2} />
      <path d="M12 7.5V12l3.2 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SlidersIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <rect x={4} y={5} width={16} height={3} rx={1.5} stroke="currentColor" strokeWidth={2} />
      <rect x={4} y={10.5} width={16} height={3} rx={1.5} stroke="currentColor" strokeWidth={2} />
      <rect x={4} y={16} width={16} height={3} rx={1.5} stroke="currentColor" strokeWidth={2} />
      <circle cx={9} cy={6.5} r={2.2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
      <circle cx={15} cy={12} r={2.2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
      <circle cx={11} cy={17.5} r={2.2} fill="var(--bg)" stroke="currentColor" strokeWidth={2} />
    </Svg>
  );
}
