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

export function GitHubIcon(props: { size?: number }) {
  return (
    <Svg {...props} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.7 5.47 7.78.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.38-2.53-.5-2.7-.96-.09-.24-.48-.96-.82-1.16-.28-.15-.68-.53-.01-.54.63-.01 1.08.6 1.23.85.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.1-1.78-.2-3.64-.91-3.64-4.05 0-.89.31-1.63.82-2.2-.08-.2-.36-1.05.08-2.18 0 0 .67-.22 2.2.85a7.34 7.34 0 0 1 4 0c1.53-1.07 2.2-.85 2.2-.85.44 1.13.16 1.98.08 2.18.51.57.82 1.3.82 2.2 0 3.15-1.87 3.85-3.65 4.05.29.26.54.76.54 1.53 0 1.11-.01 2-.01 2.27 0 .22.15.48.55.4A8.22 8.22 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </Svg>
  );
}

export function ChipIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <rect x={7} y={7} width={10} height={10} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function GripIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx={9} cy={7} r={1.35} fill="currentColor" />
      <circle cx={15} cy={7} r={1.35} fill="currentColor" />
      <circle cx={9} cy={12} r={1.35} fill="currentColor" />
      <circle cx={15} cy={12} r={1.35} fill="currentColor" />
      <circle cx={9} cy={17} r={1.35} fill="currentColor" />
      <circle cx={15} cy={17} r={1.35} fill="currentColor" />
    </Svg>
  );
}

export function CanvasIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <rect x={3.5} y={5} width={17} height={14} rx={2.2} stroke="currentColor" strokeWidth={2} />
      <circle cx={8.5} cy={10} r={1.4} fill="currentColor" />
      <circle cx={12} cy={14.5} r={1.4} fill="currentColor" />
      <path d="M15.5 9.5h3.5M17.25 8v3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function PaletteIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <path
        d="M12 4a8 8 0 1 0 0 16h1.5a1.8 1.8 0 0 0 1.3-3.1 1.8 1.8 0 0 1 1.3-3.1H17a3 3 0 0 0 3-3c0-3.8-3.6-6.8-8-6.8Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={8} cy={11} r={1.2} fill="currentColor" />
      <circle cx={11} cy={8} r={1.2} fill="currentColor" />
      <circle cx={15} cy={9} r={1.2} fill="currentColor" />
    </Svg>
  );
}

export function BellIcon(props: { size?: number }) {
  return (
    <Svg {...props}>
      <path
        d="M12 4.5a5 5 0 0 0-5 5v2.4c0 .9-.32 1.77-.9 2.46L5 15.8h14l-1.1-1.44a3.9 3.9 0 0 1-.9-2.46V9.5a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
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

export function ArrowLeftIcon(props: { size?: number; className?: string }) {
  return <Svg {...props} d="M19 12H5M12 19l-7-7 7-7" />;
}

export function ChevronRightIcon(props: { size?: number; className?: string }) {
  return <Svg {...props} d="M9 18l6-6-6-6" />;
}

export function CopyIcon(props: { size?: number; className?: string }) {
  return (
    <Svg {...props}>
      <rect x={9} y={9} width={10} height={10} rx={1.6} stroke="currentColor" strokeWidth={2} />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon(props: { size?: number; className?: string }) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7l.5 9.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v4M14 11v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
