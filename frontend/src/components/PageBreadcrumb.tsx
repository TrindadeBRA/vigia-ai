import { useNavigate } from "react-router-dom";
import { cn } from "../cn";
import { STR, type Lang } from "../i18n";
import { ArrowLeftIcon, ChevronRightIcon } from "./icons";

export function PageBreadcrumb(props: {
  current: string;
  lang: Lang;
  onBack?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const t = STR[props.lang];
  return (
    <nav aria-label="breadcrumb" className={cn("flex min-w-0 items-center gap-1.5 text-[12.5px]", props.className)}>
      <button
        type="button"
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-1 py-0.5 font-medium text-ink2 hover:text-accent"
        onClick={() => (props.onBack ? props.onBack() : navigate("/display"))}
      >
        <ArrowLeftIcon size={13} /> {t.overview}
      </button>
      <ChevronRightIcon size={13} className="shrink-0 text-ink3" />
      <span className="truncate text-ink3">{props.current}</span>
    </nav>
  );
}
