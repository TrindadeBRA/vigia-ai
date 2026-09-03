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
  addProvider: string;
  removeIcon: string;
  metric: string;
  metricNone: string;
  metricHint: string;
  iconStyle: string;
  iconStyleChip: string;
  iconStyleCard: string;
  iconStyleHint: string;
  elements: string;
  noIcons: string;
  wallpaperInUse: string;
  wallpaperNoneSelected: string;
  placed: string;
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
  deleteHint: string;
  apiKeysTool: string;
  debugTool: string;
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
  wallpapers: string;
  wallpapersLead: string;
  wallpapersUpload: string;
  wallpapersUploading: string;
  wallpapersEmpty: string;
  wallpapersRemove: string;
  wallpapersRemoving: string;
  wallpapersPreview: string;
  wallpaperSelected: string;
  wallpaperSelectHint: string;
  wallpaperSelectError: string;
  providers: string;
  providersLead: string;
  providerPexels: string;
  providerWallhaven: string;
  providerUnsplash: string;
  providerConfigured: string;
  providerNotConfigured: string;
  providerAvailable: string;
  providerKeySaved: string;
  providerNeedsKey: string;
  providerOptionalKey: string;
  providerKeyLabel: string;
  providerKeyPlaceholder: string;
  providerKeyReplacePlaceholder: string;
  providerKeySavedHint: string;
  providerRemoveKey: string;
  providerKeyRemoved: string;
  providerSave: string;
  providerSaving: string;
  providerSaved: string;
  providerError: string;
  searchNeedsKey: (name: string) => string;
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
};

export const THEME_STR: Record<Lang, ThemeCopy> = {
  pt: {
    title: "Tema da placa",
    lead:
      "Monte o fundo, o relógio e os provedores na tela cheia da placa. Cada ícone traz a cota ao vivo — escolha qual métrica mostrar. Salva no coletor; a placa aplica pelo botão de recarregar no header (ícone de download, abaixo do relógio).",
    loadError: "Não deu pra carregar as configurações do painel.",
    offline: "Coletor offline — confira se o ./dev up está rodando.",
    retry: "Tentar de novo",
    canvasTitle: "Canvas (proporção da tela da placa)",
    canvasHint: "Arraste pra posicionar. Clique num elemento (ou na lista ao lado) pra escolher a métrica, a cor e o tamanho.",
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
    addProvider: "Adicionar no canvas",
    removeIcon: "Remover ícone",
    metric: "Dado no ícone",
    metricNone: "Só o ícone",
    metricHint: "A placa desenha este valor ao lado do logo, atualizado a cada ciclo do coletor.",
    iconStyle: "Estilo",
    iconStyleChip: "Ícone simples",
    iconStyleCard: "Cartão completo",
    iconStyleHint: "O cartão mostra nome, conta e até 2 barras de uso — o mesmo mini-cartão da Início/Agora da placa.",
    elements: "No canvas",
    noIcons: "Nenhum provedor no tema ainda. Clique num card abaixo pra adicionar ícone + cota.",
    wallpaperInUse: "Papel de parede em uso",
    wallpaperNoneSelected: "Papéis cadastrados, mas nenhum selecionado",
    placed: "No tema",
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
    deleteHint: "Dica: a tecla Delete também remove o elemento selecionado.",
    apiKeysTool: "Chaves de API",
    debugTool: "Depuração da placa",
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
    wallpapers: "Papéis de parede",
    wallpapersLead: "Envie ou importe imagens e clique numa para usá-la como fundo do tema.",
    wallpapersUpload: "Enviar imagem",
    wallpapersUploading: "Enviando…",
    wallpapersEmpty: "Nenhum papel de parede ainda. Envie uma imagem ou importe de um provedor.",
    wallpapersRemove: "Remover",
    wallpapersRemoving: "Removendo…",
    wallpapersPreview: "Prévia",
    wallpaperSelected: "Em uso",
    wallpaperSelectHint: "Clique num papel de parede para usá-lo no tema e na placa.",
    wallpaperSelectError: "Falha ao selecionar papel de parede",
    providers: "Provedores externos",
    providersLead: "Busque e importe papéis de parede de serviços externos. Wallhaven funciona sem chave; Pexels e Unsplash precisam da sua própria API key.",
    providerPexels: "Pexels",
    providerWallhaven: "Wallhaven",
    providerUnsplash: "Unsplash",
    providerConfigured: "Configurado",
    providerNotConfigured: "Não configurado",
    providerAvailable: "Disponível",
    providerKeySaved: "Chave salva",
    providerNeedsKey: "Precisa de API key",
    providerOptionalKey: "Chave opcional (para conteúdo NSFW/sketchy)",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "Cole sua API key…",
    providerKeyReplacePlaceholder: "Cole uma nova API key para substituir…",
    providerKeySavedHint: "Chave salva no coletor. Cole uma nova para substituir, ou remova.",
    providerRemoveKey: "Remover chave",
    providerKeyRemoved: "Chave removida",
    providerSave: "Salvar chaves",
    providerSaving: "Salvando…",
    providerSaved: "Chaves salvas",
    providerError: "Falha ao salvar chaves",
    searchNeedsKey: (name) => `Configure a API key do ${name} no final da página para buscar.`,
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
  },
  en: {
    title: "Board theme",
    lead:
      "Build the background, clock and providers for the board's full-screen view. Each icon shows live quota — pick which metric to display. It saves to the collector; the board applies it via the reload button in the header (download icon, below the clock).",
    loadError: "Couldn't load the panel settings.",
    offline: "Collector offline — check that ./dev up is running.",
    retry: "Retry",
    canvasTitle: "Canvas (board screen proportions)",
    canvasHint: "Drag to position. Click an element (or the list beside the canvas) to pick its metric, color and size.",
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
    addProvider: "Add to canvas",
    removeIcon: "Remove icon",
    metric: "Data on the icon",
    metricNone: "Icon only",
    metricHint: "The board draws this value next to the logo, updated each collector cycle.",
    iconStyle: "Style",
    iconStyleChip: "Simple icon",
    iconStyleCard: "Full card",
    iconStyleHint: "The card shows name, account and up to 2 usage bars — the same mini-card from the board's Home/Now screens.",
    elements: "On canvas",
    noIcons: "No providers on the theme yet. Click a card below to add icon + quota.",
    wallpaperInUse: "Wallpaper in use",
    wallpaperNoneSelected: "Wallpapers saved, but none selected",
    placed: "On theme",
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
    deleteHint: "Tip: the Delete key also removes the selected element.",
    apiKeysTool: "API keys",
    debugTool: "Board debugging",
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
    wallpapers: "Wallpapers",
    wallpapersLead: "Upload or import images and click one to use it as the theme background.",
    wallpapersUpload: "Upload image",
    wallpapersUploading: "Uploading…",
    wallpapersEmpty: "No wallpapers yet. Upload an image or import from a provider.",
    wallpapersRemove: "Remove",
    wallpapersRemoving: "Removing…",
    wallpapersPreview: "Preview",
    wallpaperSelected: "In use",
    wallpaperSelectHint: "Click a wallpaper to use it on the theme and on the board.",
    wallpaperSelectError: "Failed to select wallpaper",
    providers: "External providers",
    providersLead: "Search and import wallpapers from external services. Wallhaven works without a key; Pexels and Unsplash need your own API key.",
    providerPexels: "Pexels",
    providerWallhaven: "Wallhaven",
    providerUnsplash: "Unsplash",
    providerConfigured: "Configured",
    providerNotConfigured: "Not configured",
    providerAvailable: "Available",
    providerKeySaved: "Key saved",
    providerNeedsKey: "Needs API key",
    providerOptionalKey: "Optional key (for NSFW/sketchy content)",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "Paste your API key…",
    providerKeyReplacePlaceholder: "Paste a new API key to replace…",
    providerKeySavedHint: "Key saved on the collector. Paste a new one to replace it, or remove it.",
    providerRemoveKey: "Remove key",
    providerKeyRemoved: "Key removed",
    providerSave: "Save keys",
    providerSaving: "Saving…",
    providerSaved: "Keys saved",
    providerError: "Failed to save keys",
    searchNeedsKey: (name) => `Configure the ${name} API key at the bottom of the page to search.`,
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
  },
  es: {
    title: "Tema de la placa",
    lead:
      "Armá el fondo, el reloj y los proveedores para la pantalla completa de la placa. Cada ícono muestra la cuota en vivo — elegí qué métrica mostrar. Se guarda en el colector; la placa lo aplica con el botón de recargar en el header (ícono de descarga, debajo del reloj).",
    loadError: "No se pudo cargar la configuración del panel.",
    offline: "Colector fuera de línea — verificá que ./dev up esté corriendo.",
    retry: "Reintentar",
    canvasTitle: "Lienzo (proporción de la pantalla de la placa)",
    canvasHint: "Arrastrá para ubicar. Hacé clic en un elemento (o en la lista al lado) para elegir métrica, color y tamaño.",
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
    addProvider: "Agregar al lienzo",
    removeIcon: "Quitar ícono",
    metric: "Dato en el ícono",
    metricNone: "Solo el ícono",
    metricHint: "La placa dibuja este valor junto al logo, actualizado en cada ciclo del colector.",
    iconStyle: "Estilo",
    iconStyleChip: "Ícono simple",
    iconStyleCard: "Tarjeta completa",
    iconStyleHint: "La tarjeta muestra nombre, cuenta y hasta 2 barras de uso — la misma mini-tarjeta de Inicio/Ahora de la placa.",
    elements: "En el lienzo",
    noIcons: "Todavía sin proveedores en el tema. Hacé clic en una tarjeta abajo para agregar ícono + cuota.",
    wallpaperInUse: "Fondo en uso",
    wallpaperNoneSelected: "Fondos guardados, pero ninguno seleccionado",
    placed: "En el tema",
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
    deleteHint: "Consejo: la tecla Supr también quita el elemento seleccionado.",
    apiKeysTool: "Claves de API",
    debugTool: "Depuración de la placa",
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
    wallpapers: "Fondos",
    wallpapersLead: "Subí o importá imágenes y hacé clic en una para usarla como fondo del tema.",
    wallpapersUpload: "Subir imagen",
    wallpapersUploading: "Subiendo…",
    wallpapersEmpty: "Todavía sin fondos. Subí una imagen o importá de un proveedor.",
    wallpapersRemove: "Quitar",
    wallpapersRemoving: "Quitando…",
    wallpapersPreview: "Vista previa",
    wallpaperSelected: "En uso",
    wallpaperSelectHint: "Hacé clic en un fondo para usarlo en el tema y en la placa.",
    wallpaperSelectError: "Error al seleccionar el fondo",
    providers: "Proveedores externos",
    providersLead: "Buscá e importá fondos de servicios externos. Wallhaven funciona sin clave; Pexels y Unsplash necesitan tu propia API key.",
    providerPexels: "Pexels",
    providerWallhaven: "Wallhaven",
    providerUnsplash: "Unsplash",
    providerConfigured: "Configurado",
    providerNotConfigured: "No configurado",
    providerAvailable: "Disponible",
    providerKeySaved: "Clave guardada",
    providerNeedsKey: "Necesita API key",
    providerOptionalKey: "Clave opcional (para contenido NSFW/sketchy)",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "Pegá tu API key…",
    providerKeyReplacePlaceholder: "Pegá una nueva API key para reemplazar…",
    providerKeySavedHint: "Clave guardada en el colector. Pegá una nueva para reemplazarla, o quitala.",
    providerRemoveKey: "Quitar clave",
    providerKeyRemoved: "Clave quitada",
    providerSave: "Guardar claves",
    providerSaving: "Guardando…",
    providerSaved: "Claves guardadas",
    providerError: "Error al guardar claves",
    searchNeedsKey: (name) => `Configurá la API key de ${name} al final de la página para buscar.`,
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
  },
};
