import type { ConfigPublic } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { Button, Card, FieldStatus } from "./ui";

export function BoardCard({ cfg, c }: { cfg: ConfigPublic; c: ConfigCopy }) {
  const dl = useRequest();
  const copy = useRequest();

  return (
    <Card
      className="cfg-board"
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
      {!cfg.urls.board_ok ? <p className="cfg-warn">{c.boardNoIp}</p> : null}
      <div className="cfg-url-row">
        <div className="cfg-url">
          <span className="cfg-field-label">{c.boardUrlLabel}</span>
          <code>{cfg.urls.usage_lan}</code>
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
