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
  clock: string;
  clockEnabled: string;
  clockFormat24h: string;
  clockShowBackground: string;
  clockAutoColor: string;
  clockAutoColorHint: string;
  clockAutoColorActive: string;
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
  ntcTitle: string;
  ntcPlaceholder: string;
  ntcHint: string;
  ntcApply: string;
  ntcGenerated: string;
  ntcName: string;
  ntcLoading: string;
  ntcError: string;
  ntcBrowse: string;
  ntcSearch: string;
  ntcNoMatch: string;
  ntcBaseColors: string;
  ntcAnyString: string;
  ntcDocs: string;
  ntcPick: string;
  ntcClear: string;
  slideshow: string;
  slideshowLead: string;
  slideshowEnabled: string;
  slideshowInterval: string;
  slideshowIntervalHint: string;
  slideshowOrder: string;
  slideshowEmpty: string;
  slideshowCount: string;
  slideshowSaving: string;
  slideshowSaved: string;
  slideshowError: string;
  wallpapers: string;
  wallpapersLead: string;
  wallpapersUpload: string;
  wallpapersUploading: string;
  wallpapersEmpty: string;
  wallpapersRemove: string;
  wallpapersRemoving: string;
  wallpapersPreview: string;
  providers: string;
  providersLead: string;
  providerPexels: string;
  providerWallhaven: string;
  providerUnsplash: string;
  providerConfigured: string;
  providerNotConfigured: string;
  providerNeedsKey: string;
  providerOptionalKey: string;
  providerKeyLabel: string;
  providerKeyPlaceholder: string;
  providerSave: string;
  providerSaving: string;
  providerSaved: string;
  providerError: string;
  searchPlaceholder: string;
  searchButton: string;
  searching: string;
  searchResults: string;
  searchNoResults: string;
  searchError: string;
  importButton: string;
  importing: string;
  imported: string;
  importError: string;
  dragHint: string;
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
    backgroundColor: "Cor de fundo",
    clock: "Relógio",
    clockEnabled: "Mostrar relógio",
    clockFormat24h: "Formato 24h",
    clockShowBackground: "Mostrar fundo do relógio",
    clockAutoColor: "Cor automática (a partir do fundo)",
    clockAutoColorHint: "Usa generateReadableColor do NameToColor para escolher uma cor legível sobre o fundo.",
    clockAutoColorActive: "Cor automática ativa — cor manual ignorada",
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
    ntcTitle: "Cor por nome/texto (NameToColor)",
    ntcPlaceholder: "Digite qualquer texto — ex: \"vermelho\", \"oceano\", \"#ff00aa\", \"Lucas\"",
    ntcHint: "Qualquer string vira uma cor determinística via zonaro.github.io/NameToColor (CDN). Aceita nomes em PT/EN, HEX, RGB, índices e texto livre.",
    ntcApply: "Aplicar",
    ntcGenerated: "Cor gerada",
    ntcName: "Nome mais próximo",
    ntcLoading: "Carregando paleta…",
    ntcError: "Não foi possível carregar a biblioteca de cores.",
    ntcBrowse: "Navegar base de cores",
    ntcSearch: "Buscar cor…",
    ntcNoMatch: "Nenhuma cor encontrada.",
    ntcBaseColors: "Cores da base",
    ntcAnyString: "Qualquer texto vira cor — ex: \"BeatFellas\", \"café\", \"42\"",
    ntcDocs: "Ver documentação",
    ntcPick: "Usar esta cor",
    ntcClear: "Limpar",
    slideshow: "Slideshow",
    slideshowLead: "Troca automática entre vários papéis de parede. Configure o intervalo e a ordem.",
    slideshowEnabled: "Ativar slideshow",
    slideshowInterval: "Intervalo (minutos)",
    slideshowIntervalHint: "1 a 120 minutos entre cada troca",
    slideshowOrder: "Ordem dos papéis de parede",
    slideshowEmpty: "Adicione pelo menos 2 papéis de parede para usar o slideshow.",
    slideshowCount: "papéis de parede no slideshow",
    slideshowSaving: "Salvando…",
    slideshowSaved: "Slideshow salvo",
    slideshowError: "Falha ao salvar slideshow",
    wallpapers: "Papéis de parede",
    wallpapersLead: "Gerencie seus papéis de parede. Arraste para reordenar quando o slideshow estiver ativo.",
    wallpapersUpload: "Enviar imagem",
    wallpapersUploading: "Enviando…",
    wallpapersEmpty: "Nenhum papel de parede ainda. Envie uma imagem ou importe de um provedor.",
    wallpapersRemove: "Remover",
    wallpapersRemoving: "Removendo…",
    wallpapersPreview: "Prévia",
    providers: "Provedores externos",
    providersLead: "Busque e importe papéis de parede de serviços externos. Wallhaven funciona sem chave; Pexels e Unsplash precisam da sua própria API key.",
    providerPexels: "Pexels",
    providerWallhaven: "Wallhaven",
    providerUnsplash: "Unsplash",
    providerConfigured: "Configurado",
    providerNotConfigured: "Não configurado",
    providerNeedsKey: "Precisa de API key",
    providerOptionalKey: "Chave opcional (para conteúdo NSFW/sketchy)",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "Cole sua API key…",
    providerSave: "Salvar chaves",
    providerSaving: "Salvando…",
    providerSaved: "Chaves salvas",
    providerError: "Falha ao salvar chaves",
    searchPlaceholder: "Buscar papéis de parede… ex: natureza, cidade, abstrato",
    searchButton: "Buscar",
    searching: "Buscando…",
    searchResults: "Resultados",
    searchNoResults: "Nenhum resultado encontrado.",
    searchError: "Falha na busca",
    importButton: "Importar",
    importing: "Importando…",
    imported: "Importado com sucesso",
    importError: "Falha ao importar",
    dragHint: "Arraste para reordenar",
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
    backgroundColor: "Background color",
    clock: "Clock",
    clockEnabled: "Show clock",
    clockFormat24h: "24h format",
    clockShowBackground: "Show clock background",
    clockAutoColor: "Auto color (from background)",
    clockAutoColorHint: "Uses NameToColor generateReadableColor to pick a readable color over the background.",
    clockAutoColorActive: "Auto color active — manual color ignored",
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
    ntcTitle: "Color from any text (NameToColor)",
    ntcPlaceholder: "Type any text — e.g. \"red\", \"ocean\", \"#ff00aa\", \"Lucas\"",
    ntcHint: "Any string becomes a deterministic color via zonaro.github.io/NameToColor (CDN). Supports PT/EN names, HEX, RGB, indexes and free text.",
    ntcApply: "Apply",
    ntcGenerated: "Generated color",
    ntcName: "Closest name",
    ntcLoading: "Loading palette…",
    ntcError: "Could not load the color library.",
    ntcBrowse: "Browse color database",
    ntcSearch: "Search color…",
    ntcNoMatch: "No colors found.",
    ntcBaseColors: "Database colors",
    ntcAnyString: "Any text becomes a color — e.g. \"BeatFellas\", \"coffee\", \"42\"",
    ntcDocs: "View docs",
    ntcPick: "Use this color",
    ntcClear: "Clear",
    slideshow: "Slideshow",
    slideshowLead: "Auto-rotate between multiple wallpapers. Set the interval and order.",
    slideshowEnabled: "Enable slideshow",
    slideshowInterval: "Interval (minutes)",
    slideshowIntervalHint: "1 to 120 minutes between each change",
    slideshowOrder: "Wallpaper order",
    slideshowEmpty: "Add at least 2 wallpapers to use slideshow.",
    slideshowCount: "wallpapers in slideshow",
    slideshowSaving: "Saving…",
    slideshowSaved: "Slideshow saved",
    slideshowError: "Failed to save slideshow",
    wallpapers: "Wallpapers",
    wallpapersLead: "Manage your wallpapers. Drag to reorder when slideshow is active.",
    wallpapersUpload: "Upload image",
    wallpapersUploading: "Uploading…",
    wallpapersEmpty: "No wallpapers yet. Upload an image or import from a provider.",
    wallpapersRemove: "Remove",
    wallpapersRemoving: "Removing…",
    wallpapersPreview: "Preview",
    providers: "External providers",
    providersLead: "Search and import wallpapers from external services. Wallhaven works without a key; Pexels and Unsplash need your own API key.",
    providerPexels: "Pexels",
    providerWallhaven: "Wallhaven",
    providerUnsplash: "Unsplash",
    providerConfigured: "Configured",
    providerNotConfigured: "Not configured",
    providerNeedsKey: "Needs API key",
    providerOptionalKey: "Optional key (for NSFW/sketchy content)",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "Paste your API key…",
    providerSave: "Save keys",
    providerSaving: "Saving…",
    providerSaved: "Keys saved",
    providerError: "Failed to save keys",
    searchPlaceholder: "Search wallpapers… e.g. nature, city, abstract",
    searchButton: "Search",
    searching: "Searching…",
    searchResults: "Results",
    searchNoResults: "No results found.",
    searchError: "Search failed",
    importButton: "Import",
    importing: "Importing…",
    imported: "Imported successfully",
    importError: "Failed to import",
    dragHint: "Drag to reorder",
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
    backgroundColor: "Color de fondo",
    clock: "Reloj",
    clockEnabled: "Mostrar reloj",
    clockFormat24h: "Formato 24h",
    clockShowBackground: "Mostrar fondo del reloj",
    clockAutoColor: "Color automático (desde el fondo)",
    clockAutoColorHint: "Usa generateReadableColor de NameToColor para elegir un color legible sobre el fondo.",
    clockAutoColorActive: "Color automático activo — color manual ignorado",
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
    ntcTitle: "Color desde cualquier texto (NameToColor)",
    ntcPlaceholder: "Escribí cualquier texto — ej: \"rojo\", \"océano\", \"#ff00aa\", \"Lucas\"",
    ntcHint: "Cualquier texto se vuelve un color determinístico vía zonaro.github.io/NameToColor (CDN). Acepta nombres en PT/EN, HEX, RGB, índices y texto libre.",
    ntcApply: "Aplicar",
    ntcGenerated: "Color generado",
    ntcName: "Nombre más cercano",
    ntcLoading: "Cargando paleta…",
    ntcError: "No se pudo cargar la biblioteca de colores.",
    ntcBrowse: "Navegar base de colores",
    ntcSearch: "Buscar color…",
    ntcNoMatch: "Ningún color encontrado.",
    ntcBaseColors: "Colores de la base",
    ntcAnyString: "Cualquier texto se vuelve color — ej: \"BeatFellas\", \"café\", \"42\"",
    ntcDocs: "Ver documentación",
    ntcPick: "Usar este color",
    ntcClear: "Limpiar",
    slideshow: "Slideshow",
    slideshowLead: "Rotación automática entre varios fondos. Configurá el intervalo y el orden.",
    slideshowEnabled: "Activar slideshow",
    slideshowInterval: "Intervalo (minutos)",
    slideshowIntervalHint: "1 a 120 minutos entre cada cambio",
    slideshowOrder: "Orden de los fondos",
    slideshowEmpty: "Agregá al menos 2 fondos para usar el slideshow.",
    slideshowCount: "fondos en el slideshow",
    slideshowSaving: "Guardando…",
    slideshowSaved: "Slideshow guardado",
    slideshowError: "Error al guardar slideshow",
    wallpapers: "Fondos",
    wallpapersLead: "Gestioná tus fondos. Arrastrá para reordenar cuando el slideshow esté activo.",
    wallpapersUpload: "Subir imagen",
    wallpapersUploading: "Subiendo…",
    wallpapersEmpty: "Todavía sin fondos. Subí una imagen o importá de un proveedor.",
    wallpapersRemove: "Quitar",
    wallpapersRemoving: "Quitando…",
    wallpapersPreview: "Vista previa",
    providers: "Proveedores externos",
    providersLead: "Buscá e importá fondos de servicios externos. Wallhaven funciona sin clave; Pexels y Unsplash necesitan tu propia API key.",
    providerPexels: "Pexels",
    providerWallhaven: "Wallhaven",
    providerUnsplash: "Unsplash",
    providerConfigured: "Configurado",
    providerNotConfigured: "No configurado",
    providerNeedsKey: "Necesita API key",
    providerOptionalKey: "Clave opcional (para contenido NSFW/sketchy)",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "Pegá tu API key…",
    providerSave: "Guardar claves",
    providerSaving: "Guardando…",
    providerSaved: "Claves guardadas",
    providerError: "Error al guardar claves",
    searchPlaceholder: "Buscar fondos… ej: naturaleza, ciudad, abstracto",
    searchButton: "Buscar",
    searching: "Buscando…",
    searchResults: "Resultados",
    searchNoResults: "No se encontraron resultados.",
    searchError: "Falló la búsqueda",
    importButton: "Importar",
    importing: "Importando…",
    imported: "Importado con éxito",
    importError: "Error al importar",
    dragHint: "Arrastrá para reordenar",
  },
};
