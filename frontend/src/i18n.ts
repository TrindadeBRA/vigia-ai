export type Lang = "pt" | "en" | "es";

export const WEEKDAYS: Record<Lang, string[]> = {
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
};

type Strings = {
  overview: string;
  accounts: string;
  settings: string;
  session5h: string;
  resetIn: string;
  week: string;
  weekLimit: string;
  rolling: string;
  monthLimit: string;
  cursorModels: string;
  otherModels: string;
  credits: string;
  accountCredits: string;
  remainingPrefix: string;
  resetPrefix: string;
  bonusPrefix: string;
  remainMoney: string;
  noCredits: string;
  ofSep: string;
  updated: string;
  used: string;
  left: string;
  reset: string;
  window5h: string;
  sonnetWeek: string;
  opusWeek: string;
  plan: string;
  cycle: string;
  ondemand: string;
  cap: string;
  bonus: string;
  requestsLegacy: string;
  usedCount: string;
  limit: string;
  allKeysNote: string;
  percent: string;
  themeSection: string;
  dark: string;
  light: string;
  contrast: string;
  accentSection: string;
  langSection: string;
  refreshSection: string;
  refreshNow: string;
  noData: string;
  noProviders: string;
  allOk: string;
  errorsCount: (n: number) => string;
  agoNow: string;
  agoSecs: (s: number) => string;
  autoNote: () => string;
  fetchFail: string;
  now: string;
  closeSettings: string;
  config: string;
  setup: string;
  board: string;
  tema: string;
  alarms: string;
  configCta: string;
  cardSmall: string;
  cardNormal: string;
  cardLarge: string;
  cardXl: string;
  cardWl: string;
  cardWxl: string;
  dragCard: string;
  resetLayout: string;
  // Weather
  weather: string;
  weatherCurrent: string;
  weatherHourly: string;
  weatherDaily: string;
  weatherNoLocation: string;
  weatherTemp: string;
  weatherFeelsLike: string;
  weatherHumidity: string;
  weatherPrecip: string;
  weatherWind: string;
  weatherPressure: string;
  weatherCloudCover: string;
  weatherUvIndex: string;
  weatherSunrise: string;
  weatherSunset: string;
  weatherHigh: string;
  weatherLow: string;
  weatherRainProb: string;
  // Bitcoin
  bitcoinBalance: string;
  bitcoinValue: string;
};

export const STR: Record<Lang, Strings> = {
  pt: {
    overview: "Visão geral",
    accounts: "Contas",
    settings: "Aparência",
    session5h: "Sessão 5h",
    resetIn: "Reset em",
    week: "Semana",
    weekLimit: "Limite semanal",
    rolling: "Janela rolling",
    monthLimit: "Limite mensal",
    cursorModels: "Modelos Cursor",
    otherModels: "Outros modelos",
    credits: "Créditos",
    accountCredits: "Créditos da conta",
    remainingPrefix: "resta ",
    resetPrefix: "reset ",
    bonusPrefix: "bônus ",
    remainMoney: "restam ",
    noCredits: "sem créditos comprados",
    ofSep: " de ",
    updated: "atualizado",
    used: "usado",
    left: "resta",
    reset: "reset",
    window5h: "Janela de 5 horas",
    sonnetWeek: "Sonnet (semana)",
    opusWeek: "Opus (semana)",
    plan: "plano",
    cycle: "ciclo",
    ondemand: "On-demand (USD)",
    cap: "teto",
    bonus: "bônus",
    requestsLegacy: "Pedidos (legado)",
    usedCount: "usados",
    limit: "limite",
    allKeysNote: "Créditos da conta (todas as keys)",
    percent: "percentual",
    themeSection: "Tema",
    dark: "Escuro",
    light: "Claro",
    contrast: "Contraste",
    accentSection: "Cor",
    langSection: "Idioma",
    refreshSection: "Dados de uso",
    refreshNow: "Atualizar consumo",
    noData: "sem dados",
    noProviders: "Nenhuma conta visível.",
    allOk: "Tudo certo",
    errorsCount: (n) => (n === 1 ? "1 provedor com erro" : `${n} provedores com erro`),
    agoNow: "agora mesmo",
    agoSecs: (s) => `atualizado há ${s}s`,
    autoNote: () => "Ao vivo (SSE). Toque para forçar uma consulta agora.",
    fetchFail: "Não foi possível falar com o coletor.",
    now: "Agora",
    closeSettings: "Fechar",
    config: "Configurações",
    setup: "Ajustes",
    board: "Placa e rede",
    tema: "Tema",
    alarms: "Alarmes",
    configCta: "Configurar contas",
    cardSmall: "Card pequeno",
    cardNormal: "Card normal",
    cardLarge: "Card grande",
    cardXl: "Card extra grande",
    cardWl: "Card largo (1×4)",
    cardWxl: "Card super largo (2×4)",
    dragCard: "Arrastar",
    resetLayout: "Redefinir grade",
    weather: "Clima",
    weatherCurrent: "Agora",
    weatherHourly: "Próximas horas",
    weatherDaily: "Próximos dias",
    weatherNoLocation: "Configure a cidade nas configurações.",
    weatherTemp: "Temperatura",
    weatherFeelsLike: "Sensação",
    weatherHumidity: "Umidade",
    weatherPrecip: "Precipitação",
    weatherWind: "Vento",
    weatherPressure: "Pressão",
    weatherCloudCover: "Nuvens",
    weatherUvIndex: "Índice UV",
    weatherSunrise: "Nascer do sol",
    weatherSunset: "Pôr do sol",
    weatherHigh: "Máx",
    weatherLow: "Mín",
    weatherRainProb: "Chuva",
    bitcoinBalance: "Saldo",
    bitcoinValue: "Valor",
  },
  en: {
    overview: "Overview",
    accounts: "Accounts",
    settings: "Appearance",
    session5h: "5h session",
    resetIn: "Resets in",
    week: "Week",
    weekLimit: "Weekly limit",
    rolling: "Rolling window",
    monthLimit: "Monthly limit",
    cursorModels: "Cursor models",
    otherModels: "Other models",
    credits: "Credits",
    accountCredits: "Account credits",
    remainingPrefix: "left ",
    resetPrefix: "reset ",
    bonusPrefix: "bonus ",
    remainMoney: "left ",
    noCredits: "no purchased credits",
    ofSep: " of ",
    updated: "updated",
    used: "used",
    left: "left",
    reset: "reset",
    window5h: "5-hour window",
    sonnetWeek: "Sonnet (week)",
    opusWeek: "Opus (week)",
    plan: "plan",
    cycle: "cycle",
    ondemand: "On-demand (USD)",
    cap: "cap",
    bonus: "bonus",
    requestsLegacy: "Requests (legacy)",
    usedCount: "used",
    limit: "limit",
    allKeysNote: "Account credits (all keys)",
    percent: "percent",
    themeSection: "Theme",
    dark: "Dark",
    light: "Light",
    contrast: "Contrast",
    accentSection: "Color",
    langSection: "Language",
    refreshSection: "Usage data",
    refreshNow: "Fetch usage now",
    noData: "no data",
    noProviders: "No accounts visible.",
    allOk: "All good",
    errorsCount: (n) => (n === 1 ? "1 provider failing" : `${n} providers failing`),
    agoNow: "just now",
    agoSecs: (s) => `updated ${s}s ago`,
    autoNote: () => "Live (SSE). Tap to force a fetch now.",
    fetchFail: "Could not reach the collector.",
    now: "Now",
    closeSettings: "Close",
    config: "Settings",
    setup: "Setup",
    board: "Board and network",
    tema: "Theme",
    alarms: "Alarms",
    configCta: "Set up accounts",
    cardSmall: "Small card",
    cardNormal: "Normal card",
    cardLarge: "Large card",
    cardXl: "Extra large card",
    cardWl: "Wide card (1×4)",
    cardWxl: "Super wide card (2×4)",
    dragCard: "Drag",
    resetLayout: "Reset layout",
    weather: "Weather",
    weatherCurrent: "Now",
    weatherHourly: "Next hours",
    weatherDaily: "Next days",
    weatherNoLocation: "Set the city in settings.",
    weatherTemp: "Temperature",
    weatherFeelsLike: "Feels like",
    weatherHumidity: "Humidity",
    weatherPrecip: "Precipitation",
    weatherWind: "Wind",
    weatherPressure: "Pressure",
    weatherCloudCover: "Clouds",
    weatherUvIndex: "UV index",
    weatherSunrise: "Sunrise",
    weatherSunset: "Sunset",
    weatherHigh: "High",
    weatherLow: "Low",
    weatherRainProb: "Rain",
    bitcoinBalance: "Balance",
    bitcoinValue: "Value",
  },
  es: {
    overview: "Resumen",
    accounts: "Cuentas",
    settings: "Apariencia",
    session5h: "Sesión 5h",
    resetIn: "Reset en",
    week: "Semana",
    weekLimit: "Límite semanal",
    rolling: "Ventana rolling",
    monthLimit: "Límite mensual",
    cursorModels: "Modelos Cursor",
    otherModels: "Otros modelos",
    credits: "Créditos",
    accountCredits: "Créditos de la cuenta",
    remainingPrefix: "queda ",
    resetPrefix: "reset ",
    bonusPrefix: "bono ",
    remainMoney: "quedan ",
    noCredits: "sin créditos comprados",
    ofSep: " de ",
    updated: "actualizado",
    used: "usado",
    left: "queda",
    reset: "reset",
    window5h: "Ventana de 5 horas",
    sonnetWeek: "Sonnet (semana)",
    opusWeek: "Opus (semana)",
    plan: "plan",
    cycle: "ciclo",
    ondemand: "On-demand (USD)",
    cap: "tope",
    bonus: "bono",
    requestsLegacy: "Pedidos (legado)",
    usedCount: "usados",
    limit: "límite",
    allKeysNote: "Créditos de la cuenta (todas las keys)",
    percent: "porcentaje",
    themeSection: "Tema",
    dark: "Oscuro",
    light: "Claro",
    contrast: "Contraste",
    accentSection: "Color",
    langSection: "Idioma",
    refreshSection: "Datos de uso",
    refreshNow: "Actualizar consumo",
    noData: "sin datos",
    noProviders: "Ninguna cuenta visible.",
    allOk: "Todo bien",
    errorsCount: (n) => (n === 1 ? "1 proveedor con error" : `${n} proveedores con error`),
    agoNow: "recién",
    agoSecs: (s) => `actualizado hace ${s}s`,
    autoNote: () => "En vivo (SSE). Toca para forzar una consulta ahora.",
    fetchFail: "No se pudo contactar al colector.",
    now: "Ahora",
    closeSettings: "Cerrar",
    config: "Configuración",
    setup: "Ajustes",
    board: "Placa y red",
    tema: "Tema",
    alarms: "Alarmas",
    configCta: "Configurar cuentas",
    cardSmall: "Card pequeño",
    cardNormal: "Card normal",
    cardLarge: "Card grande",
    cardXl: "Card extra grande",
    cardWl: "Card ancho (1×4)",
    cardWxl: "Card super ancho (2×4)",
    dragCard: "Arrastrar",
    resetLayout: "Restablecer cuadrícula",
    weather: "Clima",
    weatherCurrent: "Ahora",
    weatherHourly: "Próximas horas",
    weatherDaily: "Próximos días",
    weatherNoLocation: "Configura la ciudad en ajustes.",
    weatherTemp: "Temperatura",
    weatherFeelsLike: "Sensación",
    weatherHumidity: "Humedad",
    weatherPrecip: "Precipitación",
    weatherWind: "Viento",
    weatherPressure: "Presión",
    weatherCloudCover: "Nubes",
    weatherUvIndex: "Índice UV",
    weatherSunrise: "Amanecer",
    weatherSunset: "Atardecer",
    weatherHigh: "Máx",
    weatherLow: "Mín",
    weatherRainProb: "Lluvia",
    bitcoinBalance: "Saldo",
    bitcoinValue: "Valor",
  },
};

export type T = Strings;
