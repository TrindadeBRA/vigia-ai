/** Menu nativo. "Abrir no navegador" é o requisito de continuar acessível pela web. */
import { Menu, MenuItemConstructorOptions, app, shell } from "electron";

export type MenuDeps = {
  urls: () => { local: string; lan: string | null; docs: string; config: string };
  reload: () => void;
  restartCollector: () => void;
  openLogs: () => void;
  openData: () => void;
};

export function buildMenu(deps: MenuDeps): void {
  const isMac = process.platform === "darwin";

  const macApp: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about", label: `Sobre o ${app.name}` },
            { type: "separator" },
            { role: "hide", label: "Ocultar" },
            { role: "hideOthers", label: "Ocultar outros" },
            { role: "unhide", label: "Mostrar todos" },
            { type: "separator" },
            { role: "quit", label: "Sair" },
          ],
        },
      ]
    : [];

  const template: MenuItemConstructorOptions[] = [
    ...macApp,
    {
      label: "Arquivo",
      submenu: [
        {
          label: "Configurações",
          accelerator: "CmdOrCtrl+,",
          click: () => void shell.openExternal(deps.urls().config),
        },
        { type: "separator" },
        isMac ? { role: "close", label: "Fechar janela" } : { role: "quit", label: "Sair" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar tudo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { label: "Recarregar", accelerator: "CmdOrCtrl+R", click: deps.reload },
        { role: "resetZoom", label: "Zoom normal" },
        { role: "zoomIn", label: "Aumentar zoom" },
        { role: "zoomOut", label: "Diminuir zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" },
        { role: "toggleDevTools", label: "Ferramentas de desenvolvedor" },
      ],
    },
    {
      label: "Coletor",
      submenu: [
        {
          label: "Abrir no navegador",
          click: () => void shell.openExternal(deps.urls().local),
        },
        {
          label: "Copiar link da LAN",
          click: () => {
            const lan = deps.urls().lan;
            if (lan) require("electron").clipboard.writeText(lan);
          },
        },
        { label: "Swagger (API)", click: () => void shell.openExternal(deps.urls().docs) },
        { type: "separator" },
        { label: "Reiniciar o coletor", click: deps.restartCollector },
        { label: "Abrir a pasta de dados", click: deps.openData },
        { label: "Abrir a pasta de logs", click: deps.openLogs },
      ],
    },
    {
      role: "help",
      label: "Ajuda",
      submenu: [
        {
          label: "Repositório no GitHub",
          click: () => void shell.openExternal("https://github.com/TrindadeBRA/vigia-ai"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
