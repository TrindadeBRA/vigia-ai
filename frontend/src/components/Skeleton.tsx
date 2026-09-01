import { cn } from "../cn";
import { cfgGrid, cfgSkel, metricsGrid, overviewGrid, pageCol, skelShine, viewFade } from "../tw";

export type SkeletonPage = "overview" | "config" | "setup" | "account";

export function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md", skelShine, className)} />;
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

function Cards({ n, className, itemClass }: { n: number; className?: string; itemClass?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: n }, (_, i) => (
        <SkelCard key={i} className={itemClass} />
      ))}
    </div>
  );
}

function SectionLead() {
  return (
    <div className="mt-2 w-full">
      <Bone className="h-5 w-28" />
      <Bone className="mt-2 h-3.5 w-[min(100%,52ch)]" />
    </div>
  );
}

function OverviewBody() {
  return (
    <>
      <div className="flex w-full flex-wrap items-end justify-between gap-3">
        <Bone className="h-8 w-40" />
        <Bone className="h-4 w-52" />
      </div>
      <Cards n={4} className={overviewGrid} itemClass="col-span-2 row-span-2 min-h-[196px] aspect-square" />
    </>
  );
}

function ConfigBody() {
  return (
    <>
      <Bone className="h-8 w-44" />
      <Bone className="h-3.5 w-[min(100%,42ch)]" />
      <SectionLead />
      <Cards n={7} className={cfgGrid} />
    </>
  );
}

function SetupBody() {
  return (
    <>
      <Bone className="h-8 w-48" />
      <Bone className="h-3.5 w-[min(100%,48ch)]" />
      <SectionLead />
      <Cards n={5} className={cfgGrid} />
      <SectionLead />
      <div className={cn(cfgSkel, "h-[72px] w-full")} />
      <Cards n={4} className={cfgGrid} />
      <div className={cn(cfgSkel, "h-[88px] w-full")} />
    </>
  );
}

function AccountBody() {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Bone className="size-[42px] shrink-0 rounded-[13px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bone className="h-6 w-40" />
          <Bone className="h-3 w-24" />
        </div>
      </div>
      <Cards n={2} className={metricsGrid} />
    </>
  );
}

export function Skeleton({ page = "overview" }: { page?: SkeletonPage }) {
  return (
    <div className={`${pageCol} ${viewFade}`} aria-hidden aria-busy="true">
      {page === "overview" ? <OverviewBody /> : null}
      {page === "config" ? <ConfigBody /> : null}
      {page === "setup" ? <SetupBody /> : null}
      {page === "account" ? <AccountBody /> : null}
    </div>
  );
}

export function OverviewSkeleton() {
  return <Skeleton page="overview" />;
}

export function ConfigSkeleton() {
  return <Skeleton page="config" />;
}

export function SetupSkeleton() {
  return <Skeleton page="setup" />;
}

export function AccountSkeleton() {
  return <Skeleton page="account" />;
}
