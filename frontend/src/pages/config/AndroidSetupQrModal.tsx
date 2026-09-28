import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CopyIcon, DownloadIcon } from "../../components/icons";
import { STR, type Lang } from "../../i18n";
import { Modal } from "./ui";
import type { ThemeCopy } from "./themeCopy";

export function buildAndroidSetupUrl(host: string, port: number): string {
  return `http://${host}:${port}/api/android/setup?host=${encodeURIComponent(host)}&port=${port}&v=1`;
}

export function AndroidSetupQrModal({
  open,
  onClose,
  lanIp,
  port,
  lang,
  c,
}: {
  open: boolean;
  onClose: () => void;
  lanIp: string | null;
  port: number;
  lang: Lang;
  c: ThemeCopy;
}) {
  if (!open) return null;
  return (
    <Modal title={c.androidQrTitle} onClose={onClose} closeLabel={STR[lang].closeSettings}>
      <AndroidSetupQrContent lanIp={lanIp} port={port} c={c} />
    </Modal>
  );
}

function AndroidSetupQrContent({ lanIp, port, c }: { lanIp: string | null; port: number; c: ThemeCopy }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const setupUrl = lanIp ? buildAndroidSetupUrl(lanIp, port) : null;
  const apkUrl = lanIp ? `http://${lanIp}:${port}/api/android/apk` : null;

  useEffect(() => {
    setCopied(false);
    if (!canvasRef.current || !setupUrl) return;
    QRCode.toCanvas(canvasRef.current, setupUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(() => {});
  }, [setupUrl]);

  if (!setupUrl || !apkUrl) {
    return <p className="m-0 text-sm leading-relaxed text-ink2">{c.androidQrNoLan}</p>;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(setupUrl as string);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = setupUrl as string;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="rounded-2xl border border-edge bg-white p-2.5 shadow-card">
          <canvas ref={canvasRef} width={200} height={200} className="block size-[200px]" />
        </div>
        <span className="max-w-[220px] break-all text-center font-mono text-[11px] leading-snug text-ink3">{setupUrl}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="m-0 text-[13px] leading-relaxed text-ink2">{c.androidQrLead}</p>
        <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-ink2">
          <li>{c.androidQrStepCamera}</li>
          <li>{c.androidQrStepApp}</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex items-center gap-1.5 rounded-[10px] border border-edge bg-canvas px-3 py-2 text-[13px] font-[650] text-ink hover:bg-chip"
          >
            <CopyIcon size={15} />
            {copied ? c.androidQrCopied : c.androidQrCopy}
          </button>
          <a
            href={apkUrl}
            className="flex items-center gap-1.5 rounded-[10px] border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] font-[650] text-accent hover:bg-accent/20"
          >
            <DownloadIcon size={15} />
            {c.androidQrDownloadApk}
          </a>
        </div>
      </div>
    </div>
  );
}
