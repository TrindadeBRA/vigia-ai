import { cn } from "../../cn";
import { cfgCard, metricCard, skelShine } from "../../tw";

export function Bone({ className, delay }: { className?: string; delay?: number }) {
  return (
    <div
      className={cn("rounded-md", skelShine, className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

export function PageHeader({ lines = 1, titleW = "w-44" }: { lines?: number; titleW?: string }) {
  return (
    <header className="w-full">
      <Bone className={cn("h-[21px]", titleW)} />
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={cn("mt-2 h-3.5", i === 0 ? "w-[min(100%,52ch)]" : "w-[min(100%,40ch)]")} delay={40 * (i + 1)} />
      ))}
    </header>
  );
}

export function SectionLead({ lead = true }: { lead?: boolean }) {
  return (
    <div className="mt-2 w-full">
      <Bone className="h-4 w-24" />
      {lead ? <Bone className="mt-2 h-3.5 w-[min(100%,48ch)]" delay={40} /> : null}
    </div>
  );
}

/** Card de conta do painel: ícone, título, pill, switch, campo + botão, fold. */
export function SkelCard({ className }: { className?: string }) {
  return (
    <article className={cn(cfgCard, "gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Bone className="size-[34px] shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Bone className="h-4 w-24" />
              <Bone className="h-[22px] w-[4.75rem] rounded-full" delay={50} />
            </div>
            <Bone className="mt-1.5 h-3 w-[min(100%,18ch)]" delay={80} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[5px]">
          <Bone className="h-2.5 w-14" />
          <Bone className="h-5 w-9 rounded-full" delay={40} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <Bone className="h-2.5 w-20" />
          <Bone className="h-[42px] w-full rounded-[10px]" delay={60} />
        </div>
        <Bone className="h-[42px] w-[4.5rem] rounded-[10px]" delay={80} />
      </div>
      <div className="border-t border-edge pt-2.5">
        <Bone className="h-3 w-36" delay={100} />
      </div>
    </article>
  );
}

export function MetricRowSkel({ delay = 0 }: { delay?: number }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between">
        <Bone className="h-2.5 w-16" delay={delay} />
        <Bone className="h-3.5 w-8" delay={delay + 40} />
      </div>
      <Bone className="h-[7px] w-full rounded-[5px]" delay={delay + 60} />
      <Bone className="mt-[5px] h-2.5 w-[70%]" delay={delay + 80} />
    </div>
  );
}

export function TileSkel({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex min-h-[160px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel px-3.5 pb-3 pt-3 shadow-card [.flat_&]:shadow-none">
      <div className="mb-2.5 flex items-center gap-2.5">
        <Bone className="size-[42px] shrink-0 rounded-[13px]" delay={delay} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Bone className="h-3.5 w-16" delay={delay + 40} />
          <Bone className="h-2.5 w-12" delay={delay + 80} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
        <MetricRowSkel delay={delay + 80} />
        <MetricRowSkel delay={delay + 140} />
      </div>
    </div>
  );
}

export function StepSkel() {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-2xl border border-edge bg-panel px-[18px] py-4 shadow-card [.flat_&]:shadow-none">
      <div className="flex items-center gap-2.5">
        <Bone className="size-7 shrink-0 rounded-lg" />
        <Bone className="h-3.5 w-32" delay={40} />
      </div>
      <Bone className="h-3 w-full" delay={60} />
      <Bone className="h-3 w-4/5" delay={80} />
    </li>
  );
}

export function PanelSkel({ fields = 2, action }: { fields?: number; action?: boolean }) {
  return (
    <section className={cfgCard}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Bone className="h-4 w-36" />
          <Bone className="mt-1 h-3.5 w-[min(100%,36ch)]" delay={40} />
        </div>
        {action ? <Bone className="h-[42px] w-[7.5rem] shrink-0 rounded-[10px]" delay={60} /> : null}
      </div>
      {Array.from({ length: fields }, (_, i) => (
        <Bone key={i} className="h-10 w-full rounded-[10px]" delay={80 + i * 40} />
      ))}
    </section>
  );
}

export function MetricCardSkel() {
  return (
    <div className={metricCard}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <Bone className="h-3.5 w-24" />
        <Bone className="h-[22px] w-12" delay={40} />
      </div>
      <Bone className="h-[9px] w-full rounded-[5px]" delay={60} />
      <Bone className="mt-2.5 h-3 w-32" delay={80} />
    </div>
  );
}
