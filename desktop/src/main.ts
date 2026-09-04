/**
 * Processo principal do Vigia AI Desktop.
 *
 * O app não reimplementa nada do produto: ele sobe o coletor FastAPI como
 * sidecar e carrega `http://127.0.0.1:<porta>/display`, que é o mesmo endereço
 * que o navegador e a ESP32 usam. Ver .agents/PLANO_ELECTRON.md.
 */
import { BrowserWindow, app, dialog, shell } from "electron";
import { join } from "node:path";

import { registerIpc } from "./ipc";
import { makeLogger, logFile } from "./logger";
import { buildMenu } from "./menu";
import { appVersion, frontendDist, migrateLegacyData, isPackaged } from "./paths";
import { configuredHost, configuredPort, probeVigia, suggestFreePort } from "./ports";
import { Sidecar, type SidecarFailure } from "./sidecar";
import { errorPage, loadingPage } from "./status";
import { createTray, destroyTray, refreshTray } from "./tray";
import { checkForUpdates, initUpdater } from "./updater";

const log = makeLogger("main");

let win: BrowserWindow | null = null;
let sidecar: Sidecar | null = null;
let quitting = false;
/** Porta de um coletor que já estava no ar (ex.: `./dev up` aberto em paralelo). */
let attachedPort: number | null = null;

function currentPort(): number {
  return attachedPort ?? sidecar?.info?.port ?? configuredPort();
}

function urls() {
  const port = currentPort();
  const lanIp = sidecar?.info?.lan?.[0];
  return {
    local: `http://127.0.0.1:${port}/display`,
    lan: lanIp ? `http://${lanIp}:${port}/display` : null,
    docs: `http://127.0.0.1:${port}/docs`,
    config: `http://127.0.0.1:${port}/display/config`,
  };
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 420,
    minHeight: 480,
    show: false,
    backgroundColor: "#0b1220",
    title: "Vigia AI",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  window.once("ready-to-show", () => window.show());

  // O renderer usa isso para recolher o espaço dos semáforos em tela cheia.
  const sendFullscreen = () => window.webContents.send("vigia:fullscreen", window.isFullScreen());
  window.on("enter-full-screen", sendFullscreen);
  window.on("leave-full-screen", sendFullscreen);
  window.webContents.on("did-finish-load", sendFullscreen);

  // A janela só navega no próprio coletor. Qualquer outro link vai pro navegador.
  const allowed = (target: string) => {
    try {
      const url = new URL(target);
      return url.protocol === "data:" || url.hostname === "127.0.0.1" || url.hostname === "localhost";
    } catch {
      return false;
    }
  };
  window.webContents.on("will-navigate", (event, target) => {
    if (!allowed(target)) {
      event.preventDefault();
      void shell.openExternal(target);
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Fechar a janela não encerra o coletor — a placa continua sendo servida.
  window.on("close", (event) => {
    if (quitting || process.platform !== "darwin") return;
    event.preventDefault();
    window.hide();
  });
  window.on("closed", () => {
    win = null;
  });

  return window;
}

function showWindow(): void {
  if (!win || win.isDestroyed()) {
    win = createWindow();
    void win.loadURL(urls().local);
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

async function onReady(port: number): Promise<void> {
  attachedPort = null;
  if (!win || win.isDestroyed()) win = createWindow();
  await win.loadURL(`http://127.0.0.1:${port}/display`);
  refreshTray(trayDeps());
}

async function onFailure(failure: SidecarFailure): Promise<void> {
  if (!win || win.isDestroyed()) win = createWindow();

  if (failure.code === "port_in_use") {
    const port = failure.port ?? configuredPort();
    // Se quem está na porta é outro Vigia, usa ele em vez de brigar pela porta.
    const existing = await probeVigia(port);
    if (existing) {
      log(`porta ${port} já tem um Vigia ${existing.version} — anexando`);
      attachedPort = port;
      await win.loadURL(`http://127.0.0.1:${port}/display`);
      refreshTray(trayDeps());
      return;
    }
    const free = await suggestFreePort(port);
    await win.loadURL(
      errorPage(
        `A porta ${port} está ocupada`,
        "Outro programa está usando essa porta e o coletor não conseguiu subir.",
        free
          ? `A porta <code>${free}</code> está livre. Trocar a porta exige regravar o ` +
              "<code>secrets.h</code> da ESP32, porque a placa guarda a URL do coletor."
          : "",
      ),
    );
    const answer = await dialog.showMessageBox(win, {
      type: "warning",
      title: "Porta ocupada",
      message: `A porta ${port} está ocupada.`,
      detail: free
        ? `Posso usar a porta ${free}. Atenção: a ESP32 guarda a URL do coletor no secrets.h — ` +
          "trocar a porta exige gerar e regravar esse arquivo pelo painel."
        : "Libere a porta e tente de novo.",
      buttons: free ? [`Usar a porta ${free}`, "Tentar de novo", "Ver log"] : ["Tentar de novo", "Ver log"],
      defaultId: 0,
      cancelId: free ? 1 : 0,
    });
    const choice = free ? answer.response : answer.response + 1;
    if (choice === 0 && free) {
      await sidecar?.restart({ port: free });
    } else if (choice === 1) {
      sidecar?.start();
    } else {
      void shell.openPath(logFile("main"));
    }
    return;
  }

  const titles: Record<SidecarFailure["code"], string> = {
    port_in_use: "Porta ocupada",
    bind_failed: "Não consegui abrir a porta",
    startup_failed: "O coletor não iniciou",
    missing_runtime: "Coletor não encontrado",
    timeout: "O coletor demorou demais",
    crashed: "O coletor parou",
  };
  await win.loadURL(errorPage(titles[failure.code], failure.detail));
  const answer = await dialog.showMessageBox(win, {
    type: "error",
    title: titles[failure.code],
    message: titles[failure.code],
    detail: failure.detail,
    buttons: ["Tentar de novo", "Ver log", "Sair"],
    defaultId: 0,
    cancelId: 1,
  });
  if (answer.response === 0) sidecar?.start();
  else if (answer.response === 1) void shell.openPath(logFile("main"));
  else app.quit();
}

function trayDeps() {
  return {
    showWindow,
    urls,
    quit: () => {
      quitting = true;
      app.quit();
    },
  };
}

/** Liga/desliga o bind em 0.0.0.0. Grava pelo próprio coletor e reinicia. */
async function setLanExposure(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const port = currentPort();
  const host = enabled ? "0.0.0.0" : "127.0.0.1";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, port }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  log(`acesso pela LAN ${enabled ? "ligado" : "desligado"} (host=${host})`);
  await sidecar?.restart({ host });
  return { ok: true };
}

async function restartCollector(): Promise<{ ok: boolean; error?: string }> {
  if (!sidecar) return { ok: false, error: "sem coletor" };
  await sidecar.restart({ host: configuredHost(), port: configuredPort() });
  return { ok: true };
}

async function bootstrap(): Promise<void> {
  migrateLegacyData(log);
  Sidecar.killOrphan(log);

  const port = configuredPort();
  const host = configuredHost();

  win = createWindow();
  await win.loadURL(loadingPage(port));

  // Um coletor já no ar (`./dev up`) é reaproveitado em vez de disputar a porta.
  const existing = await probeVigia(port);
  if (existing) {
    log(`coletor externo já responde em :${port} (v${existing.version}) — anexando`);
    attachedPort = port;
    await win.loadURL(`http://127.0.0.1:${port}/display`);
  } else {
    sidecar = new Sidecar({ host, port, log });
    sidecar.on("ready", (info) => void onReady(info.port));
    sidecar.on("failed", (failure) => void onFailure(failure));
    sidecar.on("restarting", (attempt, delay) => log(`tentativa ${attempt} em ${delay}ms`));
    sidecar.start();
  }

  createTray(trayDeps());
  buildMenu({
    urls,
    reload: () => win?.webContents.reload(),
    restartCollector: () => void restartCollector(),
    openLogs: () => void shell.openPath(logFile("main")),
    openData: () => void shell.openPath(join(app.getPath("userData"), "data")),
  });
  registerIpc({
    sidecar: () => sidecar!,
    setLanExposure,
    restartCollector,
    checkForUpdates,
    log,
  });
  initUpdater(log);
}

if (!app.requestSingleInstanceLock()) {
  // Segunda instância: traz a primeira para a frente e sai.
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", showWindow);

  app.on("before-quit", async (event) => {
    if (quitting) return;
    // Marcar ANTES de qualquer saída: é esta flag que libera o handler de
    // `close` da janela (que no macOS esconde em vez de fechar). Sair daqui
    // sem marcar deixava o app impossível de encerrar quando não havia
    // coletor nosso — o caso de se anexar a um `./dev up` já no ar.
    quitting = true;
    destroyTray();
    if (!sidecar) return; // anexado a um coletor externo: não é nosso para parar
    event.preventDefault();
    log("encerrando o coletor");
    await sidecar.stop();
    app.quit();
  });

  app.whenReady().then(() => {
    process.env.VIGIA_APP_VERSION = appVersion();
    log(`Vigia AI ${appVersion()} (${isPackaged ? "empacotado" : "dev"}) frontend=${frontendDist()}`);
    void bootstrap();
  });
}
