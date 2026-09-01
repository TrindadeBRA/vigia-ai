import type { Lang } from "../../i18n";

export type ThemeCopy = {
  title: string;
  lead: string;
  loadError: string;
  offline: string;
  retry: string;
  canvasTitle: string;
  canvasHint: string;
  canvasNoDevice: string;
  background: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundUpload: string;
  backgroundClear: string;
  backgroundNoBytes: string;
  backgroundReplace: string;
  backgroundEmpty: string;
  clock: string;
  clockEnabled: string;
  clockFormat24h: string;
  icons: string;
  addIcon: string;
  removeIcon: string;
  texts: string;
  addText: string;
  removeText: string;
  textPh: string;
  color: string;
  colorNone: string;
  size: string;
  position: string;
  selectHint: string;
  save: string;
  saveLead: string;
  saving: string;
  savedOk: string;
  saveError: string;
  remove: string;
  removing: string;
  removedOk: string;
  removeError: string;
  resolutionMismatch: string;
  debugTitle: string;
  debugLead: string;
  deviceIpLabel: string;
  deviceIpHint: string;
  deviceUnknown: string;
  deviceSeen: (s: number) => string;
  deviceLoopback: string;
  screenshotButton: string;
  screenshotLoading: string;
  screenshotHint: string;
  screenshotError: string;
};

export const THEME_STR: Record<Lang, ThemeCopy> = {
  pt: {
    title: "Tema personalizado",
    lead:
      "Protótipo: monte um fundo, relógio e ícones dos provedores pra tela Início da placa. Salva no coletor — a placa busca sozinha pelo botão de recarregar no header (ícone de download, abaixo do relógio).",
    loadError: "Não deu pra carregar as configurações do painel.",
    offline: "Coletor offline — confira se o ./dev up está rodando.",
    retry: "Tentar de novo",
    canvasTitle: "Canvas (proporção da tela da placa)",
    canvasHint: "Arraste o relógio, os ícones e os textos pra posicionar. Clique num elemento pra editar cor e tamanho.",
    canvasNoDevice: "Sem contato com a placa ainda — editando na proporção padrão (480×320). Acerta sozinho assim que ela falar com o coletor.",
    background: "Fundo",
    backgroundColor: "Cor sólida",
    backgroundImage: "Imagem",
    backgroundUpload: "Escolher imagem…",
    backgroundClear: "Remover imagem",
    backgroundNoBytes: "Imagem ainda não carregada nesta sessão — escolha o arquivo de novo antes de salvar.",
    backgroundReplace: "Trocar imagem…",
    backgroundEmpty: "Nenhuma imagem escolhida ainda.",
    clock: "Relógio",
    clockEnabled: "Mostrar relógio",
    clockFormat24h: "Formato 24h",
    icons: "Ícones",
    addIcon: "Adicionar ícone",
    removeIcon: "Remover ícone",
    texts: "Textos",
    addText: "Adicionar texto",
    removeText: "Remover texto",
    textPh: "Texto…",
    color: "Cor",
    colorNone: "Padrão do tema",
    size: "Tamanho",
    position: "Posição: arraste no canvas",
    selectHint: "Selecione um elemento no canvas pra editar.",
    save: "Salvar tema",
    saveLead: "Salva no coletor (mesma rede, sem precisar do IP da placa). Depois toque no ícone de recarregar no header da placa pra aplicar.",
    saving: "Salvando…",
    savedOk: "Salvo — toque no ícone de recarregar (↓) no header da placa",
    saveError: "Falha ao salvar no coletor",
    remove: "Remover tema salvo",
    removing: "Removendo…",
    removedOk: "Tema removido do coletor",
    removeError: "Falha ao remover",
    resolutionMismatch: "A resolução mudou desde a última imagem enviada — suba a imagem de novo.",
    debugTitle: "Depuração da placa (opcional)",
    debugLead: "Só pra ajustar a proporção do canvas e conferir visualmente — não afeta o salvar/aplicar tema.",
    deviceIpLabel: "IP da placa",
    deviceIpHint: "Preenchido sozinho quando a placa fala com o coletor; edite se for outra placa.",
    deviceUnknown: "IP da placa ainda desconhecido — abra a tela Sistema na placa ou espere ela falar com o coletor.",
    deviceSeen: (s) => (s < 60 ? `visto há ${s}s` : `visto há ${Math.round(s / 60)}min`),
    deviceLoopback:
      "127.0.0.1 sem porta é o gateway do Wokwi na porta 80, onde não há nada. Testando no simulador? Rode ./dev wokwi (ele expõe a placa em 127.0.0.1:9080) e complete a porta aqui.",
    screenshotButton: "Ver tela da placa agora",
    screenshotLoading: "Lendo a tela…",
    screenshotHint: "Lê os pixels de verdade por SPI (mesma tela que a placa mostra) — leva alguns segundos.",
    screenshotError: "Não consegui ler a tela da placa.",
  },
  en: {
    title: "Custom theme",
    lead:
      "Prototype: build a background, clock and provider icons for the board's Home screen. It saves to the collector — the board fetches it itself via the reload button in the header (download icon, below the clock).",
    loadError: "Couldn't load the panel settings.",
    offline: "Collector offline — check that ./dev up is running.",
    retry: "Retry",
    canvasTitle: "Canvas (board screen proportions)",
    canvasHint: "Drag the clock, icons and texts to position them. Click an element to edit its color and size.",
    canvasNoDevice: "No contact with the board yet — editing at the default 480×320 proportions. Fixes itself once it talks to the collector.",
    background: "Background",
    backgroundColor: "Solid color",
    backgroundImage: "Image",
    backgroundUpload: "Choose image…",
    backgroundClear: "Remove image",
    backgroundNoBytes: "Image not loaded in this session yet — pick the file again before saving.",
    backgroundReplace: "Change image…",
    backgroundEmpty: "No image chosen yet.",
    clock: "Clock",
    clockEnabled: "Show clock",
    clockFormat24h: "24h format",
    icons: "Icons",
    addIcon: "Add icon",
    removeIcon: "Remove icon",
    texts: "Texts",
    addText: "Add text",
    removeText: "Remove text",
    textPh: "Text…",
    color: "Color",
    colorNone: "Theme default",
    size: "Size",
    position: "Position: drag on the canvas",
    selectHint: "Select an element on the canvas to edit it.",
    save: "Save theme",
    saveLead: "Saves to the collector (same network, no board IP needed). Then tap the reload icon in the board's header to apply it.",
    saving: "Saving…",
    savedOk: "Saved — tap the reload icon (↓) in the board's header",
    saveError: "Failed to save to the collector",
    remove: "Remove saved theme",
    removing: "Removing…",
    removedOk: "Theme removed from the collector",
    removeError: "Failed to remove",
    resolutionMismatch: "Resolution changed since the last upload — upload the image again.",
    debugTitle: "Board debugging (optional)",
    debugLead: "Only for matching the canvas proportions and checking visually — doesn't affect saving/applying the theme.",
    deviceIpLabel: "Board IP",
    deviceIpHint: "Auto-filled once the board talks to the collector; edit it for a different board.",
    deviceUnknown: "Board IP still unknown — open the System screen on the board or wait for it to talk to the collector.",
    deviceSeen: (s) => (s < 60 ? `seen ${s}s ago` : `seen ${Math.round(s / 60)}min ago`),
    deviceLoopback:
      "127.0.0.1 with no port is the Wokwi gateway on port 80, where nothing listens. Testing in the simulator? Run ./dev wokwi (it exposes the board at 127.0.0.1:9080) and add the port here.",
    screenshotButton: "View board screen now",
    screenshotLoading: "Reading the screen…",
    screenshotHint: "Reads the real pixels over SPI (same screen the board shows) — takes a few seconds.",
    screenshotError: "Couldn't read the board's screen.",
  },
  es: {
    title: "Tema personalizado",
    lead:
      "Prototipo: arma un fondo, reloj e íconos de los proveedores para la pantalla Inicio de la placa. Se guarda en el colector — la placa lo busca sola con el botón de recargar en el header (ícono de descarga, debajo del reloj).",
    loadError: "No se pudo cargar la configuración del panel.",
    offline: "Colector fuera de línea — verificá que ./dev up esté corriendo.",
    retry: "Reintentar",
    canvasTitle: "Lienzo (proporción de la pantalla de la placa)",
    canvasHint: "Arrastrá el reloj, los íconos y los textos para ubicarlos. Hacé clic en un elemento para editar su color y tamaño.",
    canvasNoDevice: "Todavía sin contacto con la placa — editando con la proporción por defecto (480×320). Se ajusta solo en cuanto hable con el colector.",
    background: "Fondo",
    backgroundColor: "Color sólido",
    backgroundImage: "Imagen",
    backgroundUpload: "Elegir imagen…",
    backgroundClear: "Quitar imagen",
    backgroundNoBytes: "Imagen no cargada en esta sesión — elegí el archivo de nuevo antes de guardar.",
    backgroundReplace: "Cambiar imagen…",
    backgroundEmpty: "Todavía no elegiste ninguna imagen.",
    clock: "Reloj",
    clockEnabled: "Mostrar reloj",
    clockFormat24h: "Formato 24h",
    icons: "Íconos",
    addIcon: "Agregar ícono",
    removeIcon: "Quitar ícono",
    texts: "Textos",
    addText: "Agregar texto",
    removeText: "Quitar texto",
    textPh: "Texto…",
    color: "Color",
    colorNone: "Color por defecto",
    size: "Tamaño",
    position: "Posición: arrastrá en el lienzo",
    selectHint: "Seleccioná un elemento en el lienzo para editarlo.",
    save: "Guardar tema",
    saveLead: "Se guarda en el colector (misma red, sin necesitar el IP de la placa). Después tocá el ícono de recargar en el header de la placa para aplicarlo.",
    saving: "Guardando…",
    savedOk: "Guardado — tocá el ícono de recargar (↓) en el header de la placa",
    saveError: "Falló al guardar en el colector",
    remove: "Quitar tema guardado",
    removing: "Quitando…",
    removedOk: "Tema quitado del colector",
    removeError: "Falló al quitar",
    resolutionMismatch: "La resolución cambió desde la última imagen enviada — subila de nuevo.",
    debugTitle: "Depuración de la placa (opcional)",
    debugLead: "Solo para ajustar la proporción del lienzo y revisar visualmente — no afecta guardar/aplicar el tema.",
    deviceIpLabel: "IP de la placa",
    deviceIpHint: "Se completa solo cuando la placa habla con el colector; editalo si es otra placa.",
    deviceUnknown: "IP de la placa aún desconocida — abrí la pantalla Sistema en la placa o esperá a que hable con el colector.",
    deviceSeen: (s) => (s < 60 ? `visto hace ${s}s` : `visto hace ${Math.round(s / 60)}min`),
    deviceLoopback:
      "127.0.0.1 sin puerto es el gateway de Wokwi en el puerto 80, donde no hay nada. ¿Probando en el simulador? Corré ./dev wokwi (expone la placa en 127.0.0.1:9080) y completá el puerto acá.",
    screenshotButton: "Ver pantalla de la placa ahora",
    screenshotLoading: "Leyendo la pantalla…",
    screenshotHint: "Lee los píxeles de verdad por SPI (la misma pantalla que muestra la placa) — tarda unos segundos.",
    screenshotError: "No se pudo leer la pantalla de la placa.",
  },
};
