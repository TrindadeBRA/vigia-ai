import { cn } from "../cn";
import { pageCol, viewFade } from "../tw";
import { AccountBody, AlarmsBody, ConfigBody, NowBody, OverviewBody, SetupBody, ThemeBody } from "./skeleton/bodies";

export type SkeletonPage = "overview" | "config" | "setup" | "account" | "alarms" | "theme" | "now";

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
