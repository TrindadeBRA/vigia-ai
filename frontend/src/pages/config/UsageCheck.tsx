import { useState } from "react";
import { fetchUsage } from "../../api/client";
import type { UsagePayload } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { Button, Card } from "./ui";

const NAMES = ["claude", "gpt", "cursor", "openrouter", "deepseek"] as const;

function titleOf(name: (typeof NAMES)[number]): string {
  if (name === "openrouter") return "OpenRouter";
  if (name === "gpt") return "GPT";
  if (name === "deepseek") return "DeepSeek";
  return name[0].toUpperCase() + name.slice(1);
}

export function UsageCheck({ c }: { c: ConfigCopy }) {
  const req = useRequest();
  const [test, setTest] = useState<UsagePayload | null>(null);

  return (
    <Card
      title={c.checkTitle}
      lead={c.checkLead}
      action={
        <Button
          loading={req.busy}
          onClick={() =>
            req.run(
              async () => {
                const json = await fetchUsage();
                setTest(json);
                return { ok: true };
              },
              { error: c.offline },
            )
          }
        >
          {req.busy ? c.checking : c.checkBtn}
        </Button>
      }
    >
      {req.status === "error" && req.message ? <p className="cfg-status err">{req.message}</p> : null}
      {test ? (
        <div className="cfg-usage-grid">
          {NAMES.map((name) => {
            const list = test[name] || [];
            const title = titleOf(name);
            if (!list.length) {
              return (
                <div key={name} className="cfg-usage-cell muted">
                  <p className="cfg-usage-name">{title}</p>
                  <p className="cfg-usage-val">{c.checkHidden}</p>
                </div>
              );
            }
            return list.map((b) => (
              <div key={`${name}-${b.id}`} className={`cfg-usage-cell ${b.ok ? "ok" : "bad"}`}>
                <p className="cfg-usage-name">{b.label ? `${title} · ${b.label}` : title}</p>
                <p className="cfg-usage-val">
                  {b.ok
                    ? name === "claude" || name === "gpt"
                      ? `${(b as { session_percent?: number }).session_percent ?? "—"}%`
                      : `${(b as { percent?: number }).percent ?? "—"}%`
                    : b.error || c.checkFail}
                </p>
              </div>
            ));
          })}
        </div>
      ) : null}
    </Card>
  );
}
