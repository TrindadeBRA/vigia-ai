/** Handlers dos canais expostos em preload.ts — allowlist explícita. */
import { app, dialog, ipcMain, shell } from "electron";
import { writeFileSync } from "node:fs";

import { appVersion, logsDir, dataDir, isPackaged } from "./paths";
import { configuredHost, configuredPort } from "./ports";
import type { Sidecar } from "./sidecar";

export type IpcDeps = {
  sidecar: () => Sidecar;
  setLanExposure: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  restartCollector: () => Promise<{ ok: boolean; error?: string }>;
  checkForUpdates: () => Promise<{ ok: boolean; status: string; version?: string }>;
  log: (msg: string) => void;
};

/** Só abre http(s) — nunca file:// nem esquemas de app. */
function safeExternal(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function registerIpc(deps: IpcDeps): void {
  ipcMain.handle("vigia:status", () => {
    const info = deps.sidecar().info;
    const host = info?.host ?? configuredHost();
    return {
      version: appVersion(),
      collectorVersion: info?.version ?? null,
      host,
      port: info?.port ?? configuredPort(),
      lan: info?.lan ?? [],
      lanExposed: host === "0.0.0.0",
      autostart: app.getLoginItemSettings().openAtLogin,
      dataDir: dataDir(),
      logsDir: logsDir(),
      platform: process.platform,
      packaged: isPackaged,
    };
  });

  ipcMain.handle("vigia:open-external", (_e, url: unknown) => {
    if (typeof url !== "string" || !safeExternal(url)) return false;
    void shell.openExternal(url);
    return true;
  });

  ipcMain.handle("vigia:open-data", () => shell.openPath(dataDir()).then(() => undefined));
  ipcMain.handle("vigia:open-logs", () => shell.openPath(logsDir()).then(() => undefined));
  ipcMain.handle("vigia:restart-collector", () => deps.restartCollector());
  ipcMain.handle("vigia:check-updates", () => deps.checkForUpdates());

  ipcMain.handle("vigia:set-lan", (_e, enabled: unknown) => deps.setLanExposure(Boolean(enabled)));

  ipcMain.handle("vigia:get-autostart", () => app.getLoginItemSettings().openAtLogin);

  ipcMain.handle("vigia:set-autostart", (_e, enabled: unknown) => {
    const openAtLogin = Boolean(enabled);
    app.setLoginItemSettings({ openAtLogin, openAsHidden: true });
    deps.log(`autostart ${openAtLogin ? "ligado" : "desligado"}`);
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle("vigia:save-file", async (_e, payload: unknown) => {
    const { name, contents } = (payload ?? {}) as { name?: unknown; contents?: unknown };
    if (typeof name !== "string" || typeof contents !== "string") return { ok: false };
    const res = await dialog.showSaveDialog({ defaultPath: name });
    if (res.canceled || !res.filePath) return { ok: false };
    writeFileSync(res.filePath, contents, "utf8");
    deps.log(`arquivo salvo em ${res.filePath}`);
    return { ok: true, path: res.filePath };
  });
}
