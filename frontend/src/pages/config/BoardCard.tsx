import type { ConfigPublic } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { Button, Card, CodeRow, FieldStatus } from "./ui";

export function BoardCard({ cfg, c }: { cfg: ConfigPublic; c: ConfigCopy }) {
  const dl = useRequest();

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
      <CodeRow label={c.boardDestLabel} value={c.boardDest} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
      <CodeRow label={c.boardUrlLabel} value={cfg.urls.usage_lan} copyLabel={c.copyUrl} copiedLabel={c.copied} failLabel={c.fail} />
      <FieldStatus status={dl.status} message={dl.message} />
    </Card>
  );
}
