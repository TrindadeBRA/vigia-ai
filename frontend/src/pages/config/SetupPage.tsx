import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton";
import { cfgGrid, cfgStatus, pageCol, viewFade } from "../../tw";
import { BoardCard } from "./BoardCard";
import { NetworkCard } from "./NetworkCard";
import { Button, Card, CodeRow } from "./ui";
import { UsageCheck } from "./UsageCheck";
import { usePublicConfig } from "./usePublicConfig";

export default function SetupPage() {
  const { c, cfg, phase, reload, setPhase } = usePublicConfig();

  if (phase === "loading" && !cfg) {
    return <Skeleton page="setup" />;
  }

  if (phase === "error" && !cfg) {
    return (
      <div className={`${pageCol} ${viewFade}`}>
        <header className="w-full">
          <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.toolsTitle}</h1>
          <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.loadError}</p>
        </header>
        <p className={`${cfgStatus} text-bad`}>{c.offline}</p>
        <Button onClick={() => { setPhase("loading"); void reload(); }}>{c.retry}</Button>
      </div>
    );
  }

  if (!cfg) return null;

  const steps = [
    { n: "1", title: c.how1Title, body: c.how1Body },
    { n: "2", title: c.how2Title, body: c.how2Body },
    { n: "3", title: c.how3Title, body: c.how3Body },
    { n: "4", title: c.how4Title, body: c.how4Body },
    { n: "5", title: c.how5Title, body: c.how5Body },
  ];

  return (
    <div className={`${pageCol} ${viewFade}`}>
      <header className="w-full">
        <h1 className="m-0 text-[21px] font-[750] tracking-[-.2px]">{c.toolsTitle}</h1>
        <p className="mb-1 mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">{c.howLead}</p>
      </header>

      <div className="mt-2 w-full">
        <h2 className="mb-1 mt-0 text-base font-bold">{c.howTitle}</h2>
        <p className="m-0 max-w-[72ch] text-[13.5px] leading-[1.55] text-ink2">{c.howIntro}</p>
      </div>

      <ol className={`${cfgGrid} m-0 list-none p-0`}>
        {steps.map((s) => (
          <li key={s.n} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-edge bg-panel px-[18px] py-4 shadow-card [.flat_&]:shadow-none">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chip text-[13px] font-bold text-accent shadow-[inset_0_0_0_1px_var(--card-border)]">{s.n}</span>
              <h3 className="m-0 text-[14.5px] font-bold">{s.title}</h3>
            </div>
            <p className="mb-0 mt-0 text-[13.5px] leading-[1.55] text-ink2">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-2 w-full">
        <h2 className="mb-1 mt-0 text-base font-bold">{c.doNowTitle}</h2>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-panel px-[18px] py-3.5 shadow-card [.flat_&]:shadow-none">
        <p className="m-0 text-[13.5px] leading-snug text-ink2">{c.howAccounts}</p>
        <Link
          to="/display/config"
          className="inline-flex shrink-0 items-center rounded-[10px] bg-accent px-3.5 py-2 text-[13.5px] font-bold text-accent-ink no-underline shadow-btn hover:-translate-y-px [.flat_&]:shadow-none"
        >
          {c.accountsCta}
        </Link>
      </div>

      <div className={cfgGrid}>
        <BoardCard cfg={cfg} c={c} />
        <Card title={c.how4Title} lead={c.how4Body}>
          <CodeRow value={c.flashCmd} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
        </Card>
        <UsageCheck c={c} />
        <NetworkCard cfg={cfg} c={c} onReload={reload} />
      </div>

      <Card title={c.simTitle} lead={c.simLead}>
        <CodeRow value={c.wokwiCmd} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
      </Card>
    </div>
  );
}
