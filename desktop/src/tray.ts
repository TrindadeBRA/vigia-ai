/** Ícone de bandeja: o app fica rodando para a placa mesmo com a janela fechada. */
import { Menu, Tray, nativeImage, shell } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { appVersion, isPackaged, repoRoot } from "./paths";

export type TrayDeps = {
  showWindow: () => void;
  urls: () => { local: string; lan: string | null; docs: string };
  quit: () => void;
};

let tray: Tray | null = null;

function icon(): Electron.NativeImage {
  const base = isPackaged ? process.resourcesPath : join(repoRoot(), "desktop", "build");
  const file = join(base, "trayTemplate.png");
  if (!existsSync(file)) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(file);
  // Template image = o macOS recolore sozinho no modo claro/escuro.
  if (process.platform === "darwin") img.setTemplateImage(true);
  return img;
}

export function createTray(deps: TrayDeps): Tray {
  tray = new Tray(icon());
  tray.setToolTip("Vigia AI");
  refreshTray(deps);
  tray.on("click", deps.showWindow);
  return tray;
}

export function refreshTray(deps: TrayDeps): void {
  if (!tray) return;
  const { local, lan, docs } = deps.urls();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o Vigia AI", click: deps.showWindow },
      { type: "separator" },
      { label: "Abrir no navegador", click: () => void shell.openExternal(local) },
      {
        label: lan ? `Copiar link da LAN (${lan})` : "Sem endereço na LAN",
        enabled: Boolean(lan),
        click: () => {
          if (lan) require("electron").clipboard.writeText(lan);
        },
      },
      { label: "Swagger (API)", click: () => void shell.openExternal(docs) },
      { type: "separator" },
      { label: `Versão ${appVersion()}`, enabled: false },
      { label: "Sair", click: deps.quit },
    ]),
  );
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
