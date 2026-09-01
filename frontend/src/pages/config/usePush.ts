import { useCallback, useEffect, useState } from "react";
import { fetchVapidPublicKey, subscribePush, testPush, unsubscribePush } from "../../api/client";

export type PushSupport = "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && window.isSecureContext;
}

export function usePush() {
  const [state, setState] = useState<PushSupport>("off");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupported()) return { ok: false, error: "unsupported" };
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return { ok: false, error: permission };
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { public_key } = await fetchVapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
      });
      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth) return { ok: false, error: "invalid subscription" };
      const res = await subscribePush({
        endpoint: raw.endpoint,
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth,
        ua: navigator.userAgent,
      });
      if (!res.ok) return { ok: false, error: res.error };
      setState("on");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => testPush(), []);

  return { state, busy, subscribe, unsubscribe, sendTest };
}
