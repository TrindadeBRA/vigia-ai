import { useEffect, useState } from "react";
import { patchConfig } from "../../api/client";
import type { ProviderCardPublic } from "../../api/types";
import { useRequest, type RequestStatus } from "../../hooks/useRequest";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, cfgHint, iconChip, iconImg } from "../../tw";
import { badgeOf, connectionHint, type ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, Fold, StatusPill, TextField } from "./ui";

const MASK = "•".repeat(24);

type Props = {
  p: ProviderCardPublic;
  listenPort: number;
  inDocker: boolean;
  c: ConfigCopy;
  onReload: () => Promise<void>;
};

export function SpotifyConfigCard({ p, listenPort, inDocker, c, onReload }: Props) {
  const b = badgeOf(p, c);
  const hasClient = p.mode === "oauth" || p.mode === "need_oauth";
  const [clientId, setClientId] = useState(hasClient ? MASK : "");
  const [clientSecret, setClientSecret] = useState(hasClient ? MASK : "");
  const saveCreds = useRequest();
  const login = useRequest();
  const logout = useRequest();
  const [oauthFlash, setOauthFlash] = useState<{ status: RequestStatus; message: string } | null>(null);

  useEffect(() => {
    setClientId(hasClient ? MASK : "");
    setClientSecret(hasClient ? MASK : "");
  }, [hasClient]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const status = q.get("spotify");
    if (!status) return;
    q.delete("spotify");
    const next = `${window.location.pathname}${q.toString() ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    if (status === "ok") {
      setOauthFlash({ status: "success", message: c.spotifyOauthOk });
      void onReload();
    } else if (status === "denied") {
      setOauthFlash({ status: "error", message: c.spotifyOauthDenied });
    } else {
      setOauthFlash({ status: "error", message: c.spotifyOauthError });
    }
  }, [onReload, c.spotifyOauthOk, c.spotifyOauthDenied, c.spotifyOauthError]);

  const credsReady = Boolean(clientId.trim()) && clientId !== MASK && Boolean(clientSecret.trim()) && clientSecret !== MASK;
  const hint = p.mode === "need_paste" ? p.label : connectionHint(p, c, inDocker, false);
  const redirect = `http://127.0.0.1:${listenPort}/api/oauth/spotify/callback`;
  const lastMsg =
    oauthFlash || saveCreds.message || login.message || logout.message
      ? oauthFlash || {
        status: saveCreds.message ? saveCreds.status : login.message ? login.status : logout.status,
        message: saveCreds.message || login.message || logout.message,
      }
      : null;

  return (
    <article className={`${cfgCard} gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={iconChip}>
            <img className={iconImg} src={PROVIDER_ICON.spotify} alt="" draggable={false} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[15.5px] font-bold">Spotify</h3>
              <StatusPill state={b.state} label={b.text} />
            </div>
            <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
          </div>
        </div>
      </div>

      {!p.configured ? <p className={cfgHint}>{c.spotifyBlurb}</p> : null}

      <Fold summary={c.spotifyCredsFold}>
        <p className={cfgHint}>
          {c.spotifyCredsIntro}{" "}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {c.spotifyDashboardCta} ↗
          </a>
        </p>
        <p className={cfgHint}>{c.spotifyRedirectHint(redirect)}</p>
        <ActionRow>
          <TextField
            label={c.spotifyClientId}
            autoComplete="off"
            placeholder={c.spotifyClientIdPh}
            value={clientId}
            onFocus={() => {
              if (clientId === MASK) setClientId("");
            }}
            onChange={(e) => setClientId(e.target.value)}
          />
          <TextField
            label={c.spotifyClientSecret}
            type="password"
            autoComplete="off"
            placeholder={c.spotifyClientSecretPh}
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
                  const res = await patchConfig({ spotify_client_id: clientId.trim(), spotify_client_secret: clientSecret.trim() });
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
                  const saved = await patchConfig({ spotify_client_id: clientId.trim(), spotify_client_secret: clientSecret.trim() });
                  if (!saved.ok) return saved;
                }
                const returnTo = `${window.location.origin}/display/config`;
                const res = await fetch(`/api/oauth/spotify/start?return_to=${encodeURIComponent(returnTo)}`);
                const data = (await res.json().catch(() => ({}))) as { url?: string; detail?: string; error?: string };
                const detail = typeof data.detail === "string" ? data.detail : null;
                if (!res.ok || !data.url) {
                  return { ok: false, error: detail || data.error || c.offline };
                }
                window.location.href = data.url;
                return { ok: true };
              },
              { success: c.spotifyLogin, error: c.offline },
            )
          }
        >
          {login.busy ? c.saving : c.spotifyLogin}
        </Button>
        <Button
          variant="ghost"
          loading={logout.busy}
          disabled={!p.configured}
          onClick={() =>
            logout.run(
              async () => {
                const res = await fetch("/api/oauth/spotify/disconnect", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                if (res.ok && data.ok) await onReload();
                return { ok: Boolean(res.ok && data.ok), error: data.error };
              },
              { success: c.spotifyLogoutOk, error: c.offline },
            )
          }
        >
          {logout.busy ? c.removing : c.spotifyLogout}
        </Button>
      </ActionRow>

      {!hasClient && !credsReady ? <p className={cfgHint}>{c.spotifyNeedCreds}</p> : null}
      {p.configured ? <p className={cfgHint}>{c.spotifyAddCardHint}</p> : null}

      {lastMsg ? <FieldStatus status={lastMsg.status} message={lastMsg.message} /> : null}
    </article>
  );
}
