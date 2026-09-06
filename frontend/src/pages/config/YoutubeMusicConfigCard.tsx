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

export function YoutubeMusicConfigCard({ p, listenPort, inDocker, c, onReload }: Props) {
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
    const status = q.get("youtubemusic");
    if (!status) return;
    const reason = q.get("reason");
    q.delete("youtubemusic");
    q.delete("reason");
    const next = `${window.location.pathname}${q.toString() ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    if (status === "ok") {
      setOauthFlash({ status: "success", message: c.ytmusicOauthOk });
      void onReload();
    } else if (status === "denied") {
      setOauthFlash({ status: "error", message: reason ? `${c.ytmusicOauthDenied} — ${reason.slice(0, 280)}` : c.ytmusicOauthDenied });
    } else {
      const msg = reason ? `${c.ytmusicOauthError} — ${reason.slice(0, 320)}` : c.ytmusicOauthError;
      setOauthFlash({ status: "error", message: msg });
    }
  }, [onReload, c.ytmusicOauthOk, c.ytmusicOauthDenied, c.ytmusicOauthError]);

  const credsReady = Boolean(clientId.trim()) && clientId !== MASK && Boolean(clientSecret.trim()) && clientSecret !== MASK;
  const hint = p.mode === "need_paste" ? p.label : connectionHint(p, c, inDocker, false);
  const redirect = `http://127.0.0.1:${listenPort}/api/oauth/youtubemusic/callback`;
  const redirectAlt = `http://localhost:${listenPort}/api/oauth/youtubemusic/callback`;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copie o Redirect URI:", text);
    }
  };
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
            <img className={iconImg} src={PROVIDER_ICON.youtubemusic} alt="" draggable={false} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[15.5px] font-bold">YouTube Music</h3>
              <StatusPill state={b.state} label={b.text} />
            </div>
            <p className="mb-0 mt-[3px] text-[12.5px] leading-[1.45] text-ink3">{hint}</p>
          </div>
        </div>
      </div>

      {!p.configured ? <p className={cfgHint}>{c.ytmusicBlurb}</p> : null}

      <Fold summary={c.ytmusicCredsFold}>
        <p className={cfgHint}>
          {c.ytmusicCredsIntro}{" "}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {c.ytmusicDashboardCta} ↗
          </a>
        </p>
        <p className={cfgHint}>{c.ytmusicRedirectHint(redirect)}</p>
        <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-chip px-3 py-2.5">
          <div className="text-[12px] font-semibold text-ink2">Redirect URIs — cadastre as duas em Google Cloud → Credentials → OAuth Client → Authorized redirect URIs → Save</div>
          <div className="flex flex-col gap-1.5">
            {[redirect, redirectAlt].map((u) => (
              <div key={u} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-panel px-2 py-1.5 text-[12px] text-ink">{u}</code>
                <Button variant="ghost" onClick={() => void copy(u)}>{copied === u ? c.copied : c.copyUrl}</Button>
              </div>
            ))}
          </div>
          <p className="m-0 text-[12px] leading-snug text-ink3">O Google valida a URI exata — <span className="font-semibold">127.0.0.1 ≠ localhost</span>. O erro mais comum é <code>redirect_uri_mismatch</code>. Se aparecer, confira porta ({listenPort}) e salve as duas URIs.</p>
        </div>
        <p className={cfgHint}>Ative também a <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">YouTube Data API v3</a> no mesmo projeto.</p>
        <ActionRow>
          <TextField
            label={c.ytmusicClientId}
            autoComplete="off"
            placeholder={c.ytmusicClientIdPh}
            value={clientId}
            onFocus={() => {
              if (clientId === MASK) setClientId("");
            }}
            onChange={(e) => setClientId(e.target.value)}
          />
          <TextField
            label={c.ytmusicClientSecret}
            type="password"
            autoComplete="off"
            placeholder={c.ytmusicClientSecretPh}
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
                  const res = await patchConfig({ youtubemusic_client_id: clientId.trim(), youtubemusic_client_secret: clientSecret.trim() });
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
                  const saved = await patchConfig({ youtubemusic_client_id: clientId.trim(), youtubemusic_client_secret: clientSecret.trim() });
                  if (!saved.ok) return saved;
                }
                const returnTo = `${window.location.origin}/display/config`;
                const res = await fetch(`/api/oauth/youtubemusic/start?return_to=${encodeURIComponent(returnTo)}`);
                const data = (await res.json().catch(() => ({}))) as { url?: string; detail?: string; error?: string };
                const detail = typeof data.detail === "string" ? data.detail : null;
                if (!res.ok || !data.url) {
                  return { ok: false, error: detail || data.error || c.offline };
                }
                window.location.href = data.url;
                return { ok: true };
              },
              { success: c.ytmusicLogin, error: c.offline },
            )
          }
        >
          {login.busy ? c.saving : c.ytmusicLogin}
        </Button>
        <Button
          variant="ghost"
          loading={logout.busy}
          disabled={!p.configured}
          onClick={() =>
            logout.run(
              async () => {
                const res = await fetch("/api/oauth/youtubemusic/disconnect", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                if (res.ok && data.ok) await onReload();
                return { ok: Boolean(res.ok && data.ok), error: data.error };
              },
              { success: c.ytmusicLogoutOk, error: c.offline },
            )
          }
        >
          {logout.busy ? c.removing : c.ytmusicLogout}
        </Button>
      </ActionRow>

      {!hasClient && !credsReady ? <p className={cfgHint}>{c.ytmusicNeedCreds}</p> : null}
      {p.configured ? <p className={cfgHint}>{c.ytmusicAddCardHint}</p> : null}

      {lastMsg ? <FieldStatus status={lastMsg.status} message={lastMsg.message} /> : null}
    </article>
  );
}
