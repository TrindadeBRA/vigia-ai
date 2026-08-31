import { useState } from "react";
import { addAccount, deleteAccount } from "../../api/client";
import type { AccountPublic } from "../../api/types";
import { useRequest } from "../../hooks/useRequest";
import type { ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, TextField } from "./ui";

export function ExtraAccounts({
  provider,
  accounts,
  placeholder,
  c,
  offline,
  onReload,
}: {
  provider: string;
  accounts: AccountPublic[];
  placeholder: string;
  c: ConfigCopy;
  offline: string;
  onReload: () => Promise<void>;
}) {
  const add = useRequest();
  const remove = useRequest();
  const [newLabel, setNewLabel] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  return (
    <div className="cfg-extra">
      {accounts.length ? (
        <ul className="cfg-extra-list">
          {accounts.map((a) => (
            <li key={a.id} className="cfg-extra-item">
              <div className="cfg-extra-meta">
                <p className="cfg-extra-name">{a.label || "—"}</p>
                <p className="cfg-extra-suffix">•••• {a.suffix || "----"}</p>
              </div>
              <Button
                variant="ghost"
                loading={remove.busy && removingId === a.id}
                disabled={remove.busy}
                onClick={async () => {
                  setRemovingId(a.id);
                  const out = await remove.run(
                    async () => {
                      const res = await deleteAccount(provider, a.id);
                      if (res.ok) await onReload();
                      return res;
                    },
                    { success: c.removed, error: offline },
                  );
                  if (out?.ok) setRemovingId(null);
                }}
              >
                {remove.busy && removingId === a.id ? c.removing : c.remove}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <ActionRow>
        <TextField placeholder={c.extraNickname} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} autoComplete="off" />
        <TextField type="password" placeholder={placeholder} value={newSecret} onChange={(e) => setNewSecret(e.target.value)} autoComplete="off" />
        <Button
          variant="secondary"
          loading={add.busy}
          onClick={async () => {
            if (!newSecret.trim()) {
              add.fail(c.needSecret);
              return;
            }
            const out = await add.run(
              async () => {
                const res = await addAccount(provider, newLabel, newSecret);
                if (res.ok) await onReload();
                return res;
              },
              { success: c.added, error: offline },
            );
            if (out?.ok) {
              setNewLabel("");
              setNewSecret("");
            }
          }}
        >
          {add.busy ? c.adding : c.addAccount}
        </Button>
      </ActionRow>
      <FieldStatus status={add.status !== "idle" ? add.status : remove.status} message={add.message || remove.message} />
    </div>
  );
}
