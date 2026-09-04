/**
 * Ponte desktop. O frontend faz feature-detection (`if (window.vigia)`), então o
 * mesmo build serve para o navegador e para o app.
 *
 * Só o que está aqui é exposto — nada de ipcRenderer cru no renderer.
 */
import { contextBridge, ipcRenderer } from "electron";

export type AppStatus = {
  version: string;
  collectorVersion: string | null;
  host: string;
  port: number;
  lan: string[];
  lanExposed: boolean;
  autostart: boolean;
  dataDir: string;
  logsDir: string;
  platform: NodeJS.Platform;
  packaged: boolean;
};

const api = {
  isDesktop: true as const,
  appVersion: process.env.VIGIA_APP_VERSION ?? "",
  platform: process.platform,

  getStatus: (): Promise<AppStatus> => ipcRenderer.invoke("vigia:status"),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("vigia:open-external", url),
  openDataFolder: (): Promise<void> => ipcRenderer.invoke("vigia:open-data"),
  openLogsFolder: (): Promise<void> => ipcRenderer.invoke("vigia:open-logs"),
  restartCollector: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("vigia:restart-collector"),
  setLanExposure: (enabled: boolean): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("vigia:set-lan", enabled),
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke("vigia:get-autostart"),
  setAutostart: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("vigia:set-autostart", enabled),
  /** Diálogo nativo de salvar — o secrets.h da placa e o export de alarmes. */
  saveFile: (name: string, contents: string): Promise<{ ok: boolean; path?: string }> =>
    ipcRenderer.invoke("vigia:save-file", { name, contents }),
  checkForUpdates: (): Promise<{ ok: boolean; status: string; version?: string }> =>
    ipcRenderer.invoke("vigia:check-updates"),
};

contextBridge.exposeInMainWorld("vigia", api);

export type VigiaBridge = typeof api;
