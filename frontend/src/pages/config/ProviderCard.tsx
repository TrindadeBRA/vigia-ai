import { useEffect, useState, type ReactNode } from "react";
import { clearSecret, patchConfig } from "../../api/client";
import type { ProviderCardPublic } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { ExtraAccounts } from "./ExtraAccounts";
import { badgeOf, connectionHint, type ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, Fold, StatusPill, Switch, TextField } from "./ui";

const MASK = "•".repeat(24);

type Props = {
  title: string;
  blurb: string;
  providerId: string;
  p: ProviderCardPublic;
  pasteKey: string;
  hiddenKey: string;
  labelKey: string;
  placeholder: string;
  usesLocalApp: boolean;
  inDocker: boolean;
  c: ConfigCopy;
  children?: ReactNode;
  onReload: () => Promise<void>;
};

export function ProviderCard({
  title,
  blurb,
  providerId,
  p,
  pasteKey,
  hiddenKey,
  labelKey,
  placeholder,
  usesLocalApp,
  inDocker,
  c,
  children,
  onReload,
}: Props) {
  const b = badgeOf(p, c);
  const hasPaste = p.mode === "paste";
  const local = p.mode === "local";
  const editable = !local;
  const needsSecret = editable && !p.configured;
  const savedLabel = p.local_label || p.primary_label || "";
  const [secret, setSecret] = useState(hasPaste ? MASK : "");
  const [label, setLabel] = useState(savedLabel);
  const [hidden, setHidden] = useState(p.hidden);
  const hide = useRequest();
  const saveLabel = useRequest();
  const saveSecret = useRequest();
  const erase = useRequest();

  useEffect(() => {
    setSecret(hasPaste ? MASK : "");
    setLabel(savedLabel);
    setHidden(p.hidden);
  }, [hasPaste, savedLabel, p.hidden]);

  const labelDirty = label !== savedLabel;
  const secretReady = Boolean(secret.trim()) && secret !== MASK;
  const hint = connectionHint(p, c, inDocker, usesLocalApp);
  const lastMsg =
    hide.message || saveLabel.message || saveSecret.message || erase.message
      ? {
          status: hide.message ? hide.status : saveLabel.message ? saveLabel.status : saveSecret.message ? saveSecret.status : erase.status,
          message: hide.message || saveLabel.message || saveSecret.message || erase.message,
        }
      : null;

  return (
    <article className="cfg-card cfg-provider">
      <div className="cfg-provider-head">
        <div className="cfg-provider-id">
          <div className="icon-chip">
            <img className="icon-img" src={PROVIDER_ICON[providerId]} alt="" draggable={false} />
          </div>
          <div className="cfg-provider-meta">
            <div className="cfg-provider-title-row">
              <h3 className="cfg-provider-title">{title}</h3>
              <StatusPill state={b.state} label={b.text} />
            </div>
            <p className="cfg-provider-hint">{hint}</p>
          </div>
        </div>
        <Switch
          label={c.showOnBoard}
          busy={hide.busy}
          checked={!hidden}
          onChange={async (e) => {
            const nextHidden = !e.target.checked;
            setHidden(nextHidden);
            const out = await hide.run(
              async () => {
                const res = await patchConfig({ [hiddenKey]: nextHidden });
                if (res.ok) await onReload();
                return res;
              },
              { success: nextHidden ? c.hiddenOn : c.hiddenOff, error: c.offline },
            );
            if (!out?.ok) setHidden(!nextHidden);
          }}
        />
      </div>

      {!p.configured ? <p className="cfg-hint">{blurb}</p> : null}

      <ActionRow>
        <TextField label={c.nickname} placeholder={c.nicknamePh} value={label} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
        <Button
          loading={saveLabel.busy}
          disabled={!labelDirty}
          onClick={() =>
            saveLabel.run(
              async () => {
                const res = await patchConfig({ [labelKey]: label });
                if (res.ok) await onReload();
                return res;
              },
              { success: c.saved, error: c.offline },
            )
          }
        >
          {saveLabel.busy ? c.saving : c.save}
        </Button>
      </ActionRow>

      {editable ? (
        <Fold summary={c.secretFold} defaultOpen={needsSecret}>
          <ActionRow>
            <TextField
              type="password"
              autoComplete="off"
              placeholder={placeholder}
              value={secret}
              onFocus={() => {
                if (secret === MASK) setSecret("");
              }}
              onChange={(e) => setSecret(e.target.value)}
            />
            <Button
              loading={saveSecret.busy}
              disabled={!secretReady}
              onClick={async () => {
                const v = secret.trim();
                if (!v || v === MASK) return;
                const out = await saveSecret.run(
                  async () => {
                    const res = await patchConfig({ [pasteKey]: v });
                    if (res.ok) await onReload();
                    return res;
                  },
                  { success: c.savedSecret, error: c.offline },
                );
                if (out?.ok) setSecret("");
              }}
            >
              {saveSecret.busy ? c.saving : c.saveSecret}
            </Button>
            <Button
              variant="ghost"
              loading={erase.busy}
              disabled={!hasPaste}
              onClick={() =>
                erase.run(
                  async () => {
                    const res = await clearSecret(pasteKey);
                    if (res.ok) await onReload();
                    return res;
                  },
                  { success: c.removedSecret, error: c.offline },
                )
              }
            >
              {erase.busy ? c.removing : c.removeSecret}
            </Button>
          </ActionRow>
        </Fold>
      ) : null}

      {children}

      <Fold summary={p.accounts.length ? c.extraCount(p.accounts.length) : c.extraTitle} defaultOpen={p.accounts.length > 0}>
        <ExtraAccounts provider={providerId} accounts={p.accounts} placeholder={placeholder} c={c} offline={c.offline} onReload={onReload} />
      </Fold>

      {lastMsg ? <FieldStatus status={lastMsg.status} message={lastMsg.message} /> : null}
    </article>
  );
}
