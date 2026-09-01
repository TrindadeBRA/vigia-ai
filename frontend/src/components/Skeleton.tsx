import { cn } from "../cn";
import { cfgGrid, cfgSkel, overviewGrid, viewFade } from "../tw";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-chip/80", className)} />;
}

export function SkelCard({ className }: { className?: string }) {
  return (
    <div className={cn(cfgSkel, "flex min-h-[172px] flex-col gap-3 p-4", className)}>
      <div className="flex items-center gap-3">
        <Bone className="size-[34px] shrink-0 rounded-[10px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bone className="h-3.5 w-2/3" />
          <Bone className="h-2.5 w-1/3" />
        </div>
      </div>
      <Bone className="mt-1 h-2 w-full" />
      <Bone className="h-2 w-4/5" />
      <Bone className="mt-auto h-9 w-full rounded-[10px]" />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className={`flex w-full flex-col gap-[18px] ${viewFade}`} aria-hidden>
      <div className="flex w-full flex-wrap items-end justify-between gap-3">
        <Bone className="h-8 w-40" />
        <Bone className="h-4 w-52" />
      </div>
      <div className={overviewGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <SkelCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function ConfigSkeleton() {
  return (
    <div className="flex w-full flex-col gap-[14px]" aria-hidden>
      <Bone className="h-4 w-[min(100%,42ch)]" />
      <div className="mt-2">
        <Bone className="h-5 w-24" />
        <Bone className="mt-2 h-3.5 w-[min(100%,52ch)]" />
      </div>
      <div className={cfgGrid}>
        {Array.from({ length: 7 }, (_, i) => (
          <SkelCard key={i} />
        ))}
      </div>
      <div className="mt-2">
        <Bone className="h-5 w-32" />
        <Bone className="mt-2 h-3.5 w-[min(100%,48ch)]" />
      </div>
      <div className={cn(cfgSkel, "h-[92px] w-full")} />
      <div className={cfgGrid}>
        <SkelCard />
        <SkelCard />
      </div>
    </div>
  );
}
