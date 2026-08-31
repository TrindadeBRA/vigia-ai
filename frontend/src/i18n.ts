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
};

export const STR: Record<Lang, Strings> = {
  pt: {
    overview: "Visão geral",
    accounts: "Contas",
    settings: "Configurações",
    session5h: "Sessão 5h",
    resetIn: "Reset em",
    week: "Semana",
    weekLimit: "Limite semanal",
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
    noProviders: "Nenhum provedor configurado. Preencha no painel do coletor.",
    allOk: "Tudo certo",
    errorsCount: (n) => (n === 1 ? "1 provedor com erro" : `${n} provedores com erro`),
    agoNow: "agora mesmo",
    agoSecs: (s) => `atualizado há ${s}s`,
    autoNote: () => "Ao vivo (SSE). Toque para forçar uma consulta agora.",
    fetchFail: "Não foi possível falar com o coletor.",
    now: "Agora",
    closeSettings: "Fechar",
  },
  en: {
    overview: "Overview",
    accounts: "Accounts",
    settings: "Settings",
    session5h: "5h session",
    resetIn: "Resets in",
    week: "Week",
    weekLimit: "Weekly limit",
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
    noProviders: "No provider configured. Fill one in on the collector panel.",
    allOk: "All good",
    errorsCount: (n) => (n === 1 ? "1 provider failing" : `${n} providers failing`),
    agoNow: "just now",
    agoSecs: (s) => `updated ${s}s ago`,
    autoNote: () => "Live (SSE). Tap to force a fetch now.",
    fetchFail: "Could not reach the collector.",
    now: "Now",
    closeSettings: "Close",
  },
  es: {
    overview: "Resumen",
    accounts: "Cuentas",
    settings: "Configuración",
    session5h: "Sesión 5h",
    resetIn: "Reset en",
    week: "Semana",
    weekLimit: "Límite semanal",
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
    noProviders: "Ningún proveedor configurado. Complétalo en el panel del colector.",
    allOk: "Todo bien",
    errorsCount: (n) => (n === 1 ? "1 proveedor con error" : `${n} proveedores con error`),
    agoNow: "recién",
    agoSecs: (s) => `actualizado hace ${s}s`,
    autoNote: () => "En vivo (SSE). Toca para forzar una consulta ahora.",
    fetchFail: "No se pudo contactar al colector.",
    now: "Ahora",
    closeSettings: "Cerrar",
  },
};

export type T = Strings;
