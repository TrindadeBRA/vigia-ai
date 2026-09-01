import { useEffect, useState, type FormEvent } from "react";
import { patchConfig } from "../../api/client";
import type { ConfigPublic } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { Button, Card, Checkbox, FieldStatus, TextField } from "./ui";

export function NetworkCard({ cfg, c, onReload }: { cfg: ConfigPublic; c: ConfigCopy; onReload: () => Promise<void> }) {
  const save = useRequest();
  const [host, setHost] = useState(cfg.listen.host);
  const [port, setPort] = useState(String(cfg.listen.port));
  const [mock, setMock] = useState(cfg.mock);

  useEffect(() => {
    setHost(cfg.listen.host);
    setPort(String(cfg.listen.port));
    setMock(cfg.mock);
  }, [cfg.listen.host, cfg.listen.port, cfg.mock]);

  const dirty = host !== cfg.listen.host || port !== String(cfg.listen.port) || mock !== cfg.mock;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await save.run(
      async () => {
        const out = await patchConfig({ host, port: Number(port), mock });
        if (out.ok) await onReload();
        return out;
      },
      { success: (out) => (out.restart_needed_for_port ? c.netRestart : c.saved), error: c.offline },
    );
  };

  return (
    <form onSubmit={onSubmit}>
      <Card title={c.netTitle} lead={c.netLead}>
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
          <TextField label={c.netPort} type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} />
          <TextField label={c.netHost} value={host} onChange={(e) => setHost(e.target.value)} hint={c.netHostHint} />
        </div>
        <Checkbox label={c.netMock} checked={mock} onChange={(e) => setMock(e.target.checked)} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!dirty ? <p className="m-0 max-w-[48ch] text-xs leading-[1.45] text-ink3">{c.netIdleHint}</p> : <span />}
          <Button type="submit" variant={dirty ? "primary" : "secondary"} loading={save.busy} disabled={!dirty}>
            {save.busy ? c.saving : c.save}
          </Button>
        </div>
        <FieldStatus status={save.status} message={save.message} />
        <p className="mb-0 mt-1 text-[12.5px]">
          <a className="text-accent" href="/docs" target="_blank" rel="noreferrer">
            {c.netDocs} ↗
          </a>
        </p>
      </Card>
    </form>
  );
}
