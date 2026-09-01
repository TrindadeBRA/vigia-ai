import type { ConfigPublic } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { Button, Card, FieldStatus } from "./ui";

export function BoardCard({ cfg, c }: { cfg: ConfigPublic; c: ConfigCopy }) {
  const dl = useRequest();
  const copy = useRequest();

  return (
    <Card
      title={c.boardTitle}
      lead={c.boardLead}
      action={
        <Button
          loading={dl.busy}
          onClick={() =>
            dl.run(
              async () => {
                const blob = new Blob([cfg.urls.secrets_h_file], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "secrets.h";
                a.click();
                URL.revokeObjectURL(url);
                return { ok: true };
              },
              { success: c.boardOk, error: c.fail },
            )
          }
        >
          {dl.busy ? c.boardDownloading : c.boardDownload}
        </Button>
      }
    >
      {!cfg.urls.board_ok ? <p className="m-0 text-[12.5px] leading-normal text-warn">{c.boardNoIp}</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="m-0 flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11.5px] font-[650] uppercase tracking-[.4px] text-ink3">{c.boardUrlLabel}</span>
          <code className="break-all text-[12.5px] text-accent">{cfg.urls.usage_lan}</code>
        </div>
        <Button
          variant="ghost"
          loading={copy.busy}
          onClick={() =>
            copy.run(
              async () => {
                await navigator.clipboard.writeText(cfg.urls.usage_lan);
                return { ok: true };
              },
              { success: c.copied, error: c.fail },
            )
          }
        >
          {copy.busy ? "…" : c.copyUrl}
        </Button>
      </div>
      <FieldStatus status={dl.message ? dl.status : copy.status} message={dl.message || copy.message} />
    </Card>
  );
}
