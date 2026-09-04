/** Auto-update via electron-updater. Silencioso: só age quando há release novo. */
import { app, dialog } from "electron";

type Logger = (msg: string) => void;

let log: Logger = () => {};
let ready = false;

/** Import tardio: em dev o updater não existe e não deve derrubar o boot. */
function updater(): typeof import("electron-updater").autoUpdater | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("electron-updater").autoUpdater;
  } catch {
    return null;
  }
}

export function initUpdater(logger: Logger): void {
  log = logger;
  if (!app.isPackaged) {
    log("updater desligado (dev)");
    return;
  }
  const au = updater();
  if (!au) return;
  au.autoDownload = true;
  au.autoInstallOnAppQuit = true;
  au.on("error", (err) => log(`updater: ${err.message}`));
  au.on("update-available", (info) => log(`update disponível: ${info.version}`));
  au.on("update-downloaded", (info) => {
    ready = true;
    log(`update ${info.version} baixado`);
    void dialog
      .showMessageBox({
        type: "info",
        title: "Atualização disponível",
        message: `A versão ${info.version} do Vigia AI foi baixada.`,
        detail: "Reinicie para aplicar. O coletor volta sozinho depois do reinício.",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((res) => {
        if (res.response === 0) au.quitAndInstall();
      });
  });
  void au.checkForUpdates().catch((err: Error) => log(`updater: ${err.message}`));
}

export async function checkForUpdates(): Promise<{ ok: boolean; status: string; version?: string }> {
  if (!app.isPackaged) return { ok: false, status: "indisponível em desenvolvimento" };
  const au = updater();
  if (!au) return { ok: false, status: "updater não disponível" };
  if (ready) return { ok: true, status: "atualização baixada — reinicie para aplicar" };
  try {
    const res = await au.checkForUpdates();
    const version = res?.updateInfo?.version;
    if (version && version !== app.getVersion()) {
      return { ok: true, status: "baixando atualização", version };
    }
    return { ok: true, status: "você já está na versão mais recente", version: app.getVersion() };
  } catch (err) {
    return { ok: false, status: (err as Error).message };
  }
}
