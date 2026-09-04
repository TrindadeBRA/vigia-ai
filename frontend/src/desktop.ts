/**
 * Acesso à ponte do app Electron (`window.vigia`, ver desktop/src/preload.ts).
 *
 * Tudo aqui é opcional por construção: no navegador `window.vigia` não existe e
 * as funções viram no-op. É isso que mantém **um único build** do frontend
 * servindo a web e o desktop.
 */
import { useEffect, useState } from "react";

export type DesktopStatus = {
  version: string;
  collectorVersion: string | null;
  host: string;
  port: number;
  lan: string[];
  lanExposed: boolean;
  autostart: boolean;
  dataDir: string;
  logsDir: string;
  platform: string;
  packaged: boolean;
};

export type DesktopBridge = {
  isDesktop: true;
  appVersion: string;
  platform: string;
  getStatus(): Promise<DesktopStatus>;
  openExternal(url: string): Promise<boolean>;
  openDataFolder(): Promise<void>;
  openLogsFolder(): Promise<void>;
  restartCollector(): Promise<{ ok: boolean; error?: string }>;
  setLanExposure(enabled: boolean): Promise<{ ok: boolean; error?: string }>;
  getAutostart(): Promise<boolean>;
  setAutostart(enabled: boolean): Promise<boolean>;
  saveFile(name: string, contents: string): Promise<{ ok: boolean; path?: string }>;
  checkForUpdates(): Promise<{ ok: boolean; status: string; version?: string }>;
};

declare global {
  interface Window {
    vigia?: DesktopBridge;
  }
}

export function desktop(): DesktopBridge | null {
  return typeof window !== "undefined" && window.vigia?.isDesktop ? window.vigia : null;
}

export const isDesktop = (): boolean => desktop() !== null;

/** Status do app, recarregável. `null` no navegador. */
export function useDesktopStatus(): { status: DesktopStatus | null; reload: () => Promise<void> } {
  const [status, setStatus] = useState<DesktopStatus | null>(null);

  const reload = async () => {
    const api = desktop();
    if (!api) return;
    try {
      setStatus(await api.getStatus());
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, reload };
}

/**
 * Salva um arquivo: diálogo nativo no app, download do browser fora dele.
 * Usado pelo `secrets.h` da placa e pelo export de alarmes.
 */
export async function saveTextFile(name: string, contents: string, mime = "text/plain"): Promise<void> {
  const api = desktop();
  if (api) {
    await api.saveFile(name, contents);
    return;
  }
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Abre no navegador do sistema quando estamos no app; aba nova no browser. */
export function openExternal(url: string): void {
  const api = desktop();
  if (api) void api.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
