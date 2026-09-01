import { useState } from "react";
import { fetchUsage } from "../../api/client";
import type { UsagePayload } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { cn } from "../../cn";
import { cfgStatus } from "../../tw";
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
      {req.status === "error" && req.message ? <p className={`${cfgStatus} text-bad`}>{req.message}</p> : null}
      {test ? (
        <div className="flex flex-wrap gap-2">
          {NAMES.map((name) => {
            const list = test[name] || [];
            const title = titleOf(name);
            if (!list.length) {
              return (
                <div key={name} className="flex-[1_1_140px] rounded-xl border border-edge bg-canvas px-3 py-2.5 opacity-70">
                  <p className="m-0 text-[13px] font-[650]">{title}</p>
                  <p className="mb-0 mt-1 text-xs text-ink2">{c.checkHidden}</p>
                </div>
              );
            }
            return list.map((b) => (
              <div
                key={`${name}-${b.id}`}
                className={cn(
                  "flex-[1_1_140px] rounded-xl border bg-canvas px-3 py-2.5",
                  b.ok ? "border-[color-mix(in_srgb,var(--good)_40%,var(--card-border))]" : "border-[color-mix(in_srgb,var(--bad)_40%,var(--card-border))]",
                )}
              >
                <p className="m-0 text-[13px] font-[650]">{b.label ? `${title} · ${b.label}` : title}</p>
                <p className={cn("mb-0 mt-1 text-xs", b.ok ? "text-good" : "text-bad")}>
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
