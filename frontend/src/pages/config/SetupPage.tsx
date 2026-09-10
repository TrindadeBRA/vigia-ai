import { Link } from "react-router-dom";
import { PageBreadcrumb } from "../../components/PageBreadcrumb";
import { Skeleton } from "../../components/Skeleton";
import { cfgStatus, pageCol, viewFade } from "../../tw";
import { BoardCard } from "./BoardCard";
import { Button } from "./ui";
import { usePublicConfig } from "./usePublicConfig";

export default function SetupPage() {
  const { c, cfg, phase, reload, setPhase, lang } = usePublicConfig();

  if (phase === "loading" && !cfg) {
    return <Skeleton page="setup" />;
  }

  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <PageBreadcrumb current={c.toolsTitle} lang={lang} className="mb-2" />
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.toolsTitle}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button onClick={() => { setPhase("loading"); void reload(); }}>{c.retry}</Button>
      </div>
    );
  }

  if (!cfg) return null;

  return (
    <div className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <PageBreadcrumb current={c.toolsTitle} lang={lang} className="mb-2" />
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.toolsTitle}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.howLead}</p>
      </header>

      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-panel px-[18px] py-3.5 shadow-card [.flat_&]:shadow-none">
        <p className="m-0 text-[13.5px] leading-snug text-ink2">{c.howAccounts}</p>
        <Link
          to="/display/config"
          className="inline-flex shrink-0 items-center rounded-[10px] bg-transparent px-3.5 py-2 text-[13.5px] font-bold text-accent no-underline shadow-[inset_0_0_0_1px_var(--card-border)] hover:bg-chip"
        >
          {c.accountsCta}
        </Link>
      </div>

      <BoardCard cfg={cfg} c={c} />
    </div>
  );
}
