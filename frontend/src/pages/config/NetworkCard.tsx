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
        <div className="cfg-grid-2">
          <TextField label={c.netPort} type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} />
          <TextField label={c.netHost} value={host} onChange={(e) => setHost(e.target.value)} hint={c.netHostHint} />
        </div>
        <Checkbox label={c.netMock} checked={mock} onChange={(e) => setMock(e.target.checked)} />
        <Button type="submit" variant="secondary" loading={save.busy} disabled={!dirty}>
          {save.busy ? c.saving : c.save}
        </Button>
        <FieldStatus status={save.status} message={save.message} />
        <p className="cfg-docs">
          <a href="/docs" target="_blank" rel="noreferrer">
            {c.netDocs} ↗
          </a>
        </p>
      </Card>
    </form>
  );
}
