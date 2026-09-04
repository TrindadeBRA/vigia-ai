import { cn } from "../cn";
import { cfgCard, cfgGrid, metricCard, metricsGrid, overviewGrid, pageCol, skelShine, viewFade } from "../tw";

export type SkeletonPage = "overview" | "config" | "setup" | "account" | "alarms" | "theme" | "now";

export function Bone({ className, delay }: { className?: string; delay?: number }) {
  return (
    <div
      className={cn("rounded-md", skelShine, className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

function PageHeader({ lines = 1, titleW = "w-44" }: { lines?: number; titleW?: string }) {
  return (
    <header className="w-full">
      <Bone className={cn("h-[21px]", titleW)} />
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={cn("mt-2 h-3.5", i === 0 ? "w-[min(100%,52ch)]" : "w-[min(100%,40ch)]")} delay={40 * (i + 1)} />
      ))}
    </header>
  );
}

function SectionLead({ lead = true }: { lead?: boolean }) {
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

function TileSkel({ delay = 0 }: { delay?: number }) {
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

function MetricRowSkel({ delay = 0 }: { delay?: number }) {
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

function StepSkel() {
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

function PanelSkel({ fields = 2, action }: { fields?: number; action?: boolean }) {
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

function MetricCardSkel() {
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

function OverviewBody() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mb-[18px] flex w-full flex-wrap items-end justify-between gap-3">
        <Bone className="h-[21px] w-36 max-[860px]:h-[19px]" />
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="size-[7px] shrink-0 rounded-full" />
          <Bone className="h-3 w-20" delay={40} />
          <Bone className="h-3 w-24" delay={60} />
          <Bone className="ml-1 h-7 w-[5.5rem] rounded-lg" delay={80} />
        </div>
      </div>
      <div className={overviewGrid}>
        {Array.from({ length: 8 }, (_, i) => (
          <TileSkel key={i} delay={i * 50} />
        ))}
      </div>
    </div>
  );
}

function ConfigBody() {
  return (
    <>
      <PageHeader lines={2} titleW="w-40" />
      <SectionLead />
      <div className={cfgGrid}>
        {Array.from({ length: 7 }, (_, i) => (
          <SkelCard key={i} />
        ))}
      </div>
      <SectionLead />
      <div className={cfgGrid}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkelCard key={i} />
        ))}
      </div>
      <SectionLead />
      <div className={cfgGrid}>
        <SkelCard />
      </div>
    </>
  );
}

function SetupBody() {
  return (
    <>
      <PageHeader lines={1} titleW="w-48" />
      <SectionLead />
      <ol className={`${cfgGrid} m-0 list-none p-0`}>
        {Array.from({ length: 5 }, (_, i) => (
          <StepSkel key={i} />
        ))}
      </ol>
      <SectionLead lead={false} />
      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-panel px-[18px] py-3.5 shadow-card [.flat_&]:shadow-none">
        <Bone className="h-3.5 w-[min(100%,36ch)]" />
        <Bone className="h-9 w-28 shrink-0 rounded-[10px]" delay={40} />
      </div>
      <div className={cfgGrid}>
        <PanelSkel fields={2} action />
        <PanelSkel fields={1} />
        <PanelSkel fields={1} action />
        <PanelSkel fields={2} action />
      </div>
      <PanelSkel fields={1} />
    </>
  );
}

function AccountBody() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-3">
        <Bone className="size-[42px] shrink-0 rounded-[13px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bone className="h-[19px] w-36" delay={40} />
          <Bone className="h-2.5 w-20" delay={80} />
        </div>
      </div>
      <div className="flex w-full flex-col gap-[14px]">
        <div className="grid w-full overflow-hidden rounded-2xl border border-edge bg-edge [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-px">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3" key={i}>
              <Bone className="h-2.5 w-16" delay={i * 40} />
              <Bone className="h-[15px] w-24" delay={40 + i * 40} />
            </div>
          ))}
        </div>
        <div className={metricsGrid}>
          <MetricCardSkel />
          <MetricCardSkel />
          <MetricCardSkel />
        </div>
      </div>
    </div>
  );
}

function AlarmsBody() {
  return (
    <>
      <PageHeader lines={1} titleW="w-40" />
      <section className={cfgCard}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Bone className="h-4 w-44" />
            <Bone className="mt-1 h-3.5 w-[min(100%,48ch)]" delay={40} />
          </div>
          <Bone className="h-[22px] w-24 shrink-0 rounded-full" delay={60} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Bone className="h-[42px] w-28 rounded-[10px]" delay={80} />
          <Bone className="h-[42px] w-36 rounded-[10px]" delay={100} />
        </div>
        <Bone className="h-3 w-[min(100%,36ch)]" delay={120} />
      </section>
      <section className={cfgCard}>
        <div className="min-w-0">
          <Bone className="h-4 w-36" />
          <Bone className="mt-1 h-3.5 w-[min(100%,44ch)]" delay={40} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Bone className="h-2.5 w-16" />
            <Bone className="h-[42px] w-full rounded-[10px]" delay={40} />
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Bone className="h-2.5 w-14" />
            <Bone className="h-[42px] w-full rounded-[10px]" delay={60} />
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Bone className="h-2.5 w-12" />
            <Bone className="h-[42px] w-full rounded-[10px]" delay={80} />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <Bone className="h-2.5 w-16" />
            <Bone className="h-[42px] w-full rounded-[10px]" delay={100} />
          </div>
          <Bone className="h-[42px] w-[4.5rem] rounded-[10px]" delay={120} />
        </div>
        <div className="mt-6 w-full overflow-hidden rounded-xl border border-edge bg-canvas/25 p-2">
          <div className="flex items-center justify-between gap-3 border-b border-edge px-2 pb-2 pt-1">
            <Bone className="h-3.5 w-28" />
            <Bone className="h-[42px] w-36 rounded-[10px]" delay={40} />
          </div>
          <div className="divide-y divide-edge">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Bone className="size-[34px] shrink-0 rounded-[10px]" delay={i * 20} />
                <div className="min-w-0 flex-1">
                  <Bone className="h-3.5 w-32" delay={10 + i * 20} />
                  <Bone className="mt-1 h-2.5 w-40" delay={30 + i * 20} />
                </div>
                <Bone className="h-5 w-20 shrink-0 rounded-full" delay={50 + i * 20} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ThemeBody() {
  return (
    <>
      <header className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Bone className="h-[21px] w-36" />
          <Bone className="mt-2 h-3.5 w-[min(100%,52ch)]" delay={40} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-[42px] w-[4.5rem] rounded-[10px]" delay={60} />
          <Bone className="h-[42px] w-[5.5rem] rounded-[10px]" delay={80} />
        </div>
      </header>
      <div className="grid w-full items-start gap-[14px] lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <section className={cfgCard}>
          <Bone className="h-4 w-32" />
          <Bone className="mt-1 h-3.5 w-[min(100%,40ch)]" delay={40} />
          <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[14px] border border-edge" style={{ aspectRatio: "480 / 320" }}>
            <div className={cn("size-full", skelShine)} />
          </div>
        </section>
        <div className="flex flex-col gap-[14px]">
          <section className={cfgCard}>
            <Bone className="h-4 w-28" />
            {Array.from({ length: 4 }, (_, i) => (
              <Bone key={i} className="h-10 w-full rounded-[10px]" delay={40 + i * 40} />
            ))}
          </section>
          <section className={cfgCard}>
            <Bone className="h-4 w-36" />
            <Bone className="h-3.5 w-full" delay={40} />
            <Bone className="h-10 w-full rounded-[10px]" delay={80} />
          </section>
        </div>
      </div>
      <section className={cfgCard}>
        <Bone className="h-4 w-40" />
        <Bone className="h-3.5 w-[min(100%,36ch)]" delay={40} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-[12px] border border-edge bg-canvas px-3 py-2.5">
              <Bone className="size-[22px] shrink-0 rounded-md" delay={i * 30} />
              <div className="min-w-0 flex-1">
                <Bone className="h-3 w-16" delay={20 + i * 30} />
                <Bone className="mt-1 h-2.5 w-10" delay={40 + i * 30} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className={cfgGrid}>
        <section className={cfgCard}>
          <Bone className="h-4 w-28" />
          <div className="flex items-center gap-3">
            <Bone className="size-10 rounded-full" delay={40} />
            <Bone className="h-3.5 w-20" delay={60} />
          </div>
          <Bone className="h-10 w-full rounded-[10px]" delay={80} />
        </section>
        <section className={cfgCard}>
          <Bone className="h-4 w-20" />
          <Bone className="h-4 w-40" delay={40} />
          <Bone className="h-3 w-32" delay={60} />
        </section>
      </div>
    </>
  );
}

function NowBody() {
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="mb-6 flex items-center justify-between gap-4 max-[860px]:mb-4">
        <Bone className="h-8 w-24 rounded-lg" />
      </div>
      <div className="mb-8 flex flex-col items-center justify-center rounded-3xl border border-edge bg-panel px-6 py-12 shadow-card [.flat_&]:shadow-none max-[860px]:py-8">
        <Bone className="mb-2 h-[clamp(56px,14vw,96px)] w-[min(90%,420px)] rounded-2xl" />
        <Bone className="mb-6 h-4 w-40" delay={40} />
        <div className="flex flex-wrap items-center justify-center gap-4 max-[860px]:gap-3">
          <Bone className="h-[42px] w-32 rounded-xl" delay={60} />
          <Bone className="h-[42px] w-24 rounded-xl" delay={80} />
        </div>
      </div>
      <div className="mb-6 flex items-baseline justify-between gap-4 max-[860px]:mb-4">
        <Bone className="h-[21px] w-24" />
        <Bone className="h-3 w-20" delay={40} />
      </div>
      <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))] max-[860px]:gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <TileSkel key={i} delay={i * 50} />
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ page = "overview" }: { page?: SkeletonPage }) {
  const nested = page !== "overview" && page !== "account" && page !== "now";
  return (
    <div className={cn(viewFade, nested ? pageCol : "w-full")} aria-hidden aria-busy="true">
      {page === "overview" ? <OverviewBody /> : null}
      {page === "config" ? <ConfigBody /> : null}
      {page === "setup" ? <SetupBody /> : null}
      {page === "account" ? <AccountBody /> : null}
      {page === "alarms" ? <AlarmsBody /> : null}
      {page === "theme" ? <ThemeBody /> : null}
      {page === "now" ? <NowBody /> : null}
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

export function AlarmsSkeleton() {
  return <Skeleton page="alarms" />;
}

export function ThemeSkeleton() {
  return <Skeleton page="theme" />;
}

export function NowSkeleton() {
  return <Skeleton page="now" />;
}
