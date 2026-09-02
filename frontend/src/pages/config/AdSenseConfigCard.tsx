import { useEffect, useState } from "react";
import { patchConfig } from "../../api/client";
import type { ProviderCardPublic } from "../../api/types";
import { useRequest, type RequestStatus } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, cfgHint, iconChip, iconImg } from "../../tw";
import { badgeOf, connectionHint, type ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, Fold, StatusPill, Switch, TextField } from "./ui";

const MASK = "•".repeat(24);

type Props = {
  p: ProviderCardPublic;
  listenPort: number;
  inDocker: boolean;
  c: ConfigCopy;
  onReload: () => Promise<void>;
};

export function AdSenseConfigCard({ p, listenPort, inDocker, c, onReload }: Props) {
  const b = badgeOf(p, c);
  const savedLabel = p.local_label || p.primary_label || "";
  const hasClient = p.mode === "oauth" || p.mode === "need_oauth";
  const [label, setLabel] = useState(savedLabel);
  const [hidden, setHidden] = useState(p.hidden);
  const [clientId, setClientId] = useState(hasClient ? MASK : "");
  const [clientSecret, setClientSecret] = useState(hasClient ? MASK : "");
  const hide = useRequest();
  const saveLabel = useRequest();
  const saveCreds = useRequest();
  const login = useRequest();
  const logout = useRequest();
  const [oauthFlash, setOauthFlash] = useState<{ status: RequestStatus; message: string } | null>(null);

  useEffect(() => {
    setLabel(savedLabel);
    setHidden(p.hidden);
    setClientId(hasClient ? MASK : "");
    setClientSecret(hasClient ? MASK : "");
  }, [savedLabel, p.hidden, hasClient]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const status = q.get("adsense");
    if (!status) return;
    q.delete("adsense");
    const next = `${window.location.pathname}${q.toString() ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    if (status === "ok") {
      setOauthFlash({ status: "success", message: c.adsenseOauthOk });
      void onReload();
    } else if (status === "denied") {
      setOauthFlash({ status: "error", message: c.adsenseOauthDenied });
    } else {
      setOauthFlash({ status: "error", message: c.adsenseOauthError });
    }
  }, [onReload, c.adsenseOauthOk, c.adsenseOauthDenied, c.adsenseOauthError]);

  const labelDirty = label !== savedLabel;
  const credsReady = Boolean(clientId.trim()) && clientId !== MASK && Boolean(clientSecret.trim()) && clientSecret !== MASK;
  const hint = p.mode === "need_paste" ? p.label : connectionHint(p, c, inDocker, false);
  const redirect = `http://127.0.0.1:${listenPort}/api/oauth/adsense/callback`;
  const lastMsg =
    oauthFlash || hide.message || saveLabel.message || saveCreds.message || login.message || logout.message
      ? oauthFlash
        ? oauthFlash
        : {
          status: hide.message
            ? hide.status
            : saveLabel.message
              ? saveLabel.status
              : saveCreds.message
                ? saveCreds.status
                : login.message
                  ? login.status
                  : logout.status,
          message: hide.message || saveLabel.message || saveCreds.message || login.message || logout.message,
        }
      : null;

  return (
    <article className={`${cfgCard} gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={iconChip}>
            <img className={iconImg} src={PROVIDER_ICON.adsense} alt="" draggable={false} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[15.5px] font-bold">AdSense</h3>
              <StatusPill state={b.state} label={b.text} />
            </div>
            <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
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
                const res = await patchConfig({ adsense_hidden: nextHidden });
                if (res.ok) await onReload();
                return res;
              },
              { success: nextHidden ? c.hiddenOn : c.hiddenOff, error: c.offline },
            );
            if (!out?.ok) setHidden(!nextHidden);
          }}
        />
      </div>

      {!p.configured ? <p className={cfgHint}>{c.adsenseBlurb}</p> : null}

      <ActionRow>
        <TextField label={c.nickname} placeholder={c.nicknamePh} value={label} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
        <Button
          loading={saveLabel.busy}
          disabled={!labelDirty}
          onClick={() =>
            saveLabel.run(
              async () => {
                const res = await patchConfig({ adsense_primary_label: label });
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

      <Fold summary={c.adsenseCredsFold}>
        <p className={cfgHint}>{c.adsenseRedirectHint(redirect)}</p>
        <ActionRow>
          <TextField
            label={c.adsenseClientId}
            autoComplete="off"
            placeholder={c.adsenseClientIdPh}
            value={clientId}
            onFocus={() => {
              if (clientId === MASK) setClientId("");
            }}
            onChange={(e) => setClientId(e.target.value)}
          />
          <TextField
            label={c.adsenseClientSecret}
            type="password"
            autoComplete="off"
            placeholder={c.adsenseClientSecretPh}
            value={clientSecret}
            onFocus={() => {
              if (clientSecret === MASK) setClientSecret("");
            }}
            onChange={(e) => setClientSecret(e.target.value)}
          />
          <Button
            loading={saveCreds.busy}
            disabled={!credsReady}
            onClick={async () => {
              const out = await saveCreds.run(
                async () => {
                  const res = await patchConfig({ adsense_client_id: clientId.trim(), adsense_client_secret: clientSecret.trim() });
                  if (res.ok) await onReload();
                  return res;
                },
                { success: c.savedSecret, error: c.offline },
              );
              if (out?.ok) {
                setClientId(MASK);
                setClientSecret(MASK);
              }
            }}
          >
            {saveCreds.busy ? c.saving : c.saveSecret}
          </Button>
        </ActionRow>
      </Fold>

      <ActionRow>
        <Button
          loading={login.busy}
          disabled={!hasClient && !credsReady}
          onClick={() =>
            login.run(
              async () => {
                if (credsReady) {
                  const saved = await patchConfig({ adsense_client_id: clientId.trim(), adsense_client_secret: clientSecret.trim() });
                  if (!saved.ok) return saved;
                }
                const returnTo = `${window.location.origin}/display/config`;
                const res = await fetch(`/api/oauth/adsense/start?return_to=${encodeURIComponent(returnTo)}`);
                const data = (await res.json().catch(() => ({}))) as { url?: string; detail?: string; error?: string };
                const detail = typeof data.detail === "string" ? data.detail : null;
                if (!res.ok || !data.url) {
                  return { ok: false, error: detail || data.error || c.offline };
                }
                window.location.href = data.url;
                return { ok: true };
              },
              { success: c.adsenseLogin, error: c.offline },
            )
          }
        >
          {login.busy ? c.saving : c.adsenseLogin}
        </Button>
        <Button
          variant="ghost"
          loading={logout.busy}
          disabled={!p.configured}
          onClick={() =>
            logout.run(
              async () => {
                const res = await fetch("/api/oauth/adsense/disconnect", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                if (res.ok && data.ok) await onReload();
                return { ok: Boolean(res.ok && data.ok), error: data.error };
              },
              { success: c.adsenseLogoutOk, error: c.offline },
            )
          }
        >
          {logout.busy ? c.removing : c.adsenseLogout}
        </Button>
      </ActionRow>

      {lastMsg ? <FieldStatus status={lastMsg.status} message={lastMsg.message} /> : null}
    </article>
  );
}
