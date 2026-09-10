import { useEffect, useState } from "react";
import { patchConfig } from "../../api/client";
import type { ProviderCardPublic } from "../../api/types";
import { useRequest, type RequestStatus } from "../../hooks/useRequest";
import { MUSIC_CONFIG_UPDATED_EVENT } from "../display/buildProviders";
import { PROVIDER_ICON } from "../../theme";
import { cfgCard, cfgHint, iconChip, iconImg } from "../../tw";
import { badgeOf, connectionHint, type ConfigCopy } from "./copy";
import { ActionRow, Button, FieldStatus, Fold, StatusPill, Switch, TextField } from "./ui";

function notifyMusicConfigChanged() {
  window.dispatchEvent(new Event(MUSIC_CONFIG_UPDATED_EVENT));
}

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
  const [hidden, setHidden] = useState(p.hidden);
  const saveCreds = useRequest();
  const login = useRequest();
  const logout = useRequest();
  const hide = useRequest();
  const [oauthFlash, setOauthFlash] = useState<{ status: RequestStatus; message: string } | null>(null);

  useEffect(() => {
    setClientId(hasClient ? MASK : "");
    setClientSecret(hasClient ? MASK : "");
  }, [hasClient]);

  useEffect(() => {
    setHidden(p.hidden);
  }, [p.hidden]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const status = q.get("spotify");
    if (!status) return;
    const reason = q.get("reason");
    q.delete("spotify");
    q.delete("reason");
    const next = `${window.location.pathname}${q.toString() ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    if (status === "ok") {
      setOauthFlash({ status: "success", message: c.spotifyOauthOk });
      void onReload();
      notifyMusicConfigChanged();
    } else if (status === "denied") {
      setOauthFlash({ status: "error", message: reason ? `${c.spotifyOauthDenied} — ${reason.slice(0, 280)}` : c.spotifyOauthDenied });
    } else {
      const msg = reason ? `${c.spotifyOauthError} — ${reason.slice(0, 320)}` : c.spotifyOauthError;
      setOauthFlash({ status: "error", message: msg });
    }
  }, [onReload, c.spotifyOauthOk, c.spotifyOauthDenied, c.spotifyOauthError]);

  const credsReady = Boolean(clientId.trim()) && clientId !== MASK && Boolean(clientSecret.trim()) && clientSecret !== MASK;
  const hint = p.mode === "need_paste" ? p.label : connectionHint(p, c, inDocker, false);
  const redirect = `http://127.0.0.1:${listenPort}/api/oauth/spotify/callback`;
  const redirectAlt = `http://localhost:${listenPort}/api/oauth/spotify/callback`;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // fallback: seleciona via prompt
      window.prompt("Copie o Redirect URI:", text);
    }
  };
  const lastMsg =
    oauthFlash || saveCreds.message || login.message || logout.message || hide.message
      ? oauthFlash || {
        status: saveCreds.message ? saveCreds.status : login.message ? login.status : logout.message ? logout.status : hide.status,
        message: saveCreds.message || login.message || logout.message || hide.message,
      }
      : null;

  return (
    <article id="cfg-spotify" className={`${cfgCard} gap-3`}>
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
        {p.configured ? (
          <Switch
            label={c.showOnBoard}
            busy={hide.busy}
            checked={!hidden}
            onChange={async (e) => {
              const nextHidden = !e.target.checked;
              setHidden(nextHidden);
              const out = await hide.run(
                async () => {
                  const res = await patchConfig({ spotify_hidden: nextHidden });
                  if (res.ok) {
                    await onReload();
                    notifyMusicConfigChanged();
                  }
                  return res;
                },
                { success: nextHidden ? c.hiddenOn : c.hiddenOff, error: c.offline },
              );
              if (!out?.ok) setHidden(!nextHidden);
            }}
          />
        ) : null}
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
        <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-chip px-3 py-2.5">
          <div className="text-[12px] font-semibold text-ink2">Redirect URIs — cadastre as duas no Spotify Dashboard → Settings → Redirect URIs → Save</div>
          <div className="flex flex-col gap-1.5">
            {[redirect, redirectAlt].map((u) => (
              <div key={u} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-panel px-2 py-1.5 text-[12px] text-ink">{u}</code>
                <Button variant="ghost" onClick={() => void copy(u)}>{copied === u ? c.copied : c.copyUrl}</Button>
              </div>
            ))}
          </div>
          <p className="m-0 text-[12px] leading-snug text-ink3">O Spotify valida a URI exata — <span className="font-semibold">127.0.0.1 ≠ localhost</span>. O erro mais comum é <code>redirect_uri_mismatch / INVALID_CLIENT</code>. Se aparecer, confira porta ({listenPort}) e salve as duas URIs.</p>
        </div>
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
                if (res.ok && data.ok) {
                  await onReload();
                  notifyMusicConfigChanged();
                }
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
