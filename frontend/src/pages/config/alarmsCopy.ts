import type { Lang } from "../../i18n";

export type AlarmsCopy = {
  title: string;
  lead: string;
  loadError: string;
  offline: string;
  retry: string;
  sendTest: string;
  sendingTest: string;
  telegramTitle: string;
  telegramLead: string;
  telegramTokenPh: string;
  telegramSaveToken: string;
  telegramSavingToken: string;
  telegramBotFatherHint: string;
  telegramOpenBot: string;
  telegramOpenBotShort: string;
  telegramConnectHint: string;
  telegramBotLabel: string;
  telegramRecipients: string;
  telegramConnected: string;
  telegramNotConnected: string;
  telegramDisconnect: string;
  telegramDisconnecting: string;
  telegramChangeToken: string;
  telegramTestSent: string;
  telegramTestFailed: string;
  rulesTitle: string;
  rulesLead: string;
  exportAlarms: string;
  importAlarms: string;
  alarmsImported: (n: number) => string;
  alarmsImportError: string;
  alarmsImportEmpty: string;
  provider: string;
  metric: string;
  threshold: string;
  label: string;
  labelPh: string;
  add: string;
  adding: string;
  added: string;
  addFailed: string;
  empty: string;
  remove: string;
  removing: string;
  removed: string;
  enabledLabel: string;
  triggerHintPercent: (n: number) => string;
  triggerHintCents: (n: number) => string;
  triggerHintCalendar: (n: number, unit: string) => string;
  suggestUsage: (provider: string, pct: number, metricLabel: string) => string;
  suggestBalance: (provider: string, amount: string, metricLabel: string) => string;
  suggestCalendar: (n: number, unit: string, metricLabel: string) => string;
  edit: string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  cancel: string;
  rulesSummary: (total: number, active: number) => string;
  filterAll: string;
  searchRules: string;
  rulesFilteredEmpty: string;
  calendarSectionTitle: string;
  calendarSectionLead: string;
  calendarKind: string;
  calendarKindEvent: string;
  calendarKindTask: string;
  calendarKindAll: string;
  calendarThreshold: string;
  calendarUnit: string;
  calendarUnitMinutes: string;
  calendarUnitHours: string;
  calendarUnitDays: string;
  calendarTarget: string;
  calendarTargetAll: string;
  calendarNoCalendars: string;
  calendarNoCalendarsHint: string;
  noProvidersConfigured: string;
  noProvidersHint: string;
};

export const ALARMS_STR: Record<Lang, AlarmsCopy> = {
  pt: {
    title: "Alarmes",
    lead: "Avise quando uma cota passar de um limiar, ou o saldo de créditos ficar baixo — por mensagem no Telegram.",
    loadError: "Não deu pra carregar os alarmes.",
    offline: "Não foi possível falar com o coletor.",
    retry: "Tentar de novo",
    sendTest: "Enviar teste",
    sendingTest: "Enviando…",
    telegramTitle: "Telegram",
    telegramLead: "Receba os alarmes no app do Telegram — funciona em qualquer dispositivo.",
    telegramTokenPh: "Cole o token do @BotFather",
    telegramSaveToken: "Salvar token",
    telegramSavingToken: "Salvando…",
    telegramBotFatherHint: "Crie um bot com o @BotFather no Telegram, copie o token e cole aqui.",
    telegramOpenBot: "Abrir bot no Telegram",
    telegramOpenBotShort: "Abrir no Telegram",
    telegramConnectHint: "Abra o bot e mande qualquer mensagem (ex. /start) para conectar.",
    telegramBotLabel: "Bot",
    telegramRecipients: "Destinatários",
    telegramConnected: "Conectado",
    telegramNotConnected: "Aguardando conexão",
    telegramDisconnect: "Desconectar",
    telegramDisconnecting: "Desconectando…",
    telegramChangeToken: "Trocar token",
    telegramTestSent: "Mensagem de teste enviada no Telegram",
    telegramTestFailed: "Falha ao enviar — conecte o bot primeiro",
    rulesTitle: "Regras",
    rulesLead: "Provedor + métrica + limiar. Dispara uma vez ao cruzar o limiar, não repete enquanto continuar do mesmo lado.",
    exportAlarms: "Exportar alarmes",
    importAlarms: "Importar alarmes",
    alarmsImported: (n) => (n === 1 ? "1 alarme importado" : `${n} alarmes importados`),
    alarmsImportError: "Não foi possível importar o arquivo.",
    alarmsImportEmpty: "Nenhum alarme válido encontrado no arquivo.",
    provider: "Provedor",
    metric: "Métrica",
    threshold: "Limiar",
    label: "Nome (opcional)",
    labelPh: "ex. Claude quase no teto",
    add: "Adicionar",
    adding: "Adicionando…",
    added: "Alarme criado",
    addFailed: "Não foi possível criar o alarme",
    empty: "Nenhum alarme configurado ainda.",
    remove: "Remover",
    removing: "Removendo…",
    removed: "Alarme removido",
    enabledLabel: "Ativo",
    triggerHintPercent: (n) => `dispara quando o uso chegar a ${n}%`,
    triggerHintCents: (n) => `dispara quando o saldo cair a $${(n / 100).toFixed(2)}`,
    triggerHintCalendar: (n, unit) => {
      const u = unit === "days" ? (n === 1 ? "1 dia" : `${n} dias`) : unit === "hours" ? (n === 1 ? "1 hora" : `${n} horas`) : n === 1 ? "1 minuto" : `${n} minutos`;
      return `dispara ${u} antes do evento/tarefa`;
    },
    suggestUsage: (provider, pct, metricLabel) => `${provider} - Uso de ${pct}% da cota ${metricLabel}`,
    suggestBalance: (provider, amount, metricLabel) => `${provider} - Saldo de ${amount} da cota ${metricLabel}`,
    suggestCalendar: (n, unit, metricLabel) => {
      const u = unit === "days" ? (n === 1 ? "1 dia" : `${n} dias`) : unit === "hours" ? (n === 1 ? "1 hora" : `${n} horas`) : n === 1 ? "1 minuto" : `${n} minutos`;
      return `Calendário · ${metricLabel} · ${u} antes`;
    },
    edit: "Editar",
    save: "Salvar",
    saving: "Salvando…",
    saved: "Alterações salvas",
    saveFailed: "Não foi possível salvar",
    cancel: "Cancelar",
    rulesSummary: (total, active) => `${total} regra${total === 1 ? "" : "s"} · ${active} ativa${active === 1 ? "" : "s"}`,
    filterAll: "Todos os provedores",
    searchRules: "Buscar regra…",
    rulesFilteredEmpty: "Nenhuma regra corresponde ao filtro.",
    calendarSectionTitle: "Calendário — eventos e tarefas",
    calendarSectionLead: "Receba um aviso X tempo antes de um evento ou tarefa do seu calendário (ICS). Escolha quanto tempo antes e a unidade (minutos, horas ou dias).",
    calendarKind: "Tipo",
    calendarKindEvent: "Eventos",
    calendarKindTask: "Tarefas",
    calendarKindAll: "Eventos e tarefas",
    calendarThreshold: "Antecedência",
    calendarUnit: "Unidade",
    calendarUnitMinutes: "Minutos",
    calendarUnitHours: "Horas",
    calendarUnitDays: "Dias",
    calendarTarget: "Calendário",
    calendarTargetAll: "Todos os calendários",
    calendarNoCalendars: "Nenhum calendário configurado",
    calendarNoCalendarsHint: "Adicione um calendário em Configurações → Calendário para criar alarmes de eventos/tarefas.",
    noProvidersConfigured: "Nenhum provedor com conta configurada",
    noProvidersHint: "Configure ao menos uma conta em Configurações para criar alarmes de cota. Alarmes de calendário continuam disponíveis abaixo.",
  },
  en: {
    title: "Alarms",
    lead: "Get notified when a quota crosses a threshold, or a credit balance runs low — via Telegram message.",
    loadError: "Could not load alarms.",
    offline: "Could not reach the collector.",
    retry: "Retry",
    sendTest: "Send test",
    sendingTest: "Sending…",
    telegramTitle: "Telegram",
    telegramLead: "Receive alarms in the Telegram app — works on any device.",
    telegramTokenPh: "Paste the @BotFather token",
    telegramSaveToken: "Save token",
    telegramSavingToken: "Saving…",
    telegramBotFatherHint: "Create a bot with @BotFather on Telegram, copy the token and paste it here.",
    telegramOpenBot: "Open bot in Telegram",
    telegramOpenBotShort: "Open in Telegram",
    telegramConnectHint: "Open the bot and send any message (e.g. /start) to connect.",
    telegramBotLabel: "Bot",
    telegramRecipients: "Recipients",
    telegramConnected: "Connected",
    telegramNotConnected: "Waiting for connection",
    telegramDisconnect: "Disconnect",
    telegramDisconnecting: "Disconnecting…",
    telegramChangeToken: "Change token",
    telegramTestSent: "Test message sent on Telegram",
    telegramTestFailed: "Failed to send — connect the bot first",
    rulesTitle: "Rules",
    rulesLead: "Provider + metric + threshold. Fires once when crossing the threshold, won't repeat while staying on the same side.",
    exportAlarms: "Export alarms",
    importAlarms: "Import alarms",
    alarmsImported: (n) => (n === 1 ? "1 alarm imported" : `${n} alarms imported`),
    alarmsImportError: "Could not import the file.",
    alarmsImportEmpty: "No valid alarms found in the file.",
    provider: "Provider",
    metric: "Metric",
    threshold: "Threshold",
    label: "Name (optional)",
    labelPh: "e.g. Claude near the cap",
    add: "Add",
    adding: "Adding…",
    added: "Alarm created",
    addFailed: "Could not create the alarm",
    empty: "No alarms configured yet.",
    remove: "Remove",
    removing: "Removing…",
    removed: "Alarm removed",
    enabledLabel: "Enabled",
    triggerHintPercent: (n) => `fires when usage reaches ${n}%`,
    triggerHintCents: (n) => `fires when the balance drops to $${(n / 100).toFixed(2)}`,
    triggerHintCalendar: (n, unit) => {
      const u = unit === "days" ? (n === 1 ? "1 day" : `${n} days`) : unit === "hours" ? (n === 1 ? "1 hour" : `${n} hours`) : n === 1 ? "1 minute" : `${n} minutes`;
      return `fires ${u} before the event/task`;
    },
    suggestUsage: (provider, pct, metricLabel) => `${provider} - ${pct}% usage of ${metricLabel}`,
    suggestBalance: (provider, amount, metricLabel) => `${provider} - ${metricLabel} balance at ${amount}`,
    suggestCalendar: (n, unit, metricLabel) => {
      const u = unit === "days" ? (n === 1 ? "1 day" : `${n} days`) : unit === "hours" ? (n === 1 ? "1 hour" : `${n} hours`) : n === 1 ? "1 minute" : `${n} minutes`;
      return `Calendar · ${metricLabel} · ${u} before`;
    },
    edit: "Edit",
    save: "Save",
    saving: "Saving…",
    saved: "Changes saved",
    saveFailed: "Could not save",
    cancel: "Cancel",
    rulesSummary: (total, active) => `${total} rule${total === 1 ? "" : "s"} · ${active} enabled`,
    filterAll: "All providers",
    searchRules: "Search rules…",
    rulesFilteredEmpty: "No rules match the filter.",
    calendarSectionTitle: "Calendar — events & tasks",
    calendarSectionLead: "Get notified X time before a calendar event or task (ICS). Choose how long before and the unit (minutes, hours or days).",
    calendarKind: "Type",
    calendarKindEvent: "Events",
    calendarKindTask: "Tasks",
    calendarKindAll: "Events & tasks",
    calendarThreshold: "Lead time",
    calendarUnit: "Unit",
    calendarUnitMinutes: "Minutes",
    calendarUnitHours: "Hours",
    calendarUnitDays: "Days",
    calendarTarget: "Calendar",
    calendarTargetAll: "All calendars",
    calendarNoCalendars: "No calendar configured",
    calendarNoCalendarsHint: "Add a calendar in Settings → Calendar to create event/task alarms.",
    noProvidersConfigured: "No provider with a configured account",
    noProvidersHint: "Configure at least one account in Settings to create quota alarms. Calendar alarms remain available below.",
  },
  es: {
    title: "Alarmas",
    lead: "Recibí un aviso cuando una cuota cruce un límite, o el saldo de créditos quede bajo — por mensaje en Telegram.",
    loadError: "No se pudieron cargar las alarmas.",
    offline: "No se pudo contactar al colector.",
    retry: "Reintentar",
    sendTest: "Enviar prueba",
    sendingTest: "Enviando…",
    telegramTitle: "Telegram",
    telegramLead: "Recibí las alarmas en la app de Telegram — funciona en cualquier dispositivo.",
    telegramTokenPh: "Pegá el token de @BotFather",
    telegramSaveToken: "Guardar token",
    telegramSavingToken: "Guardando…",
    telegramBotFatherHint: "Creá un bot con @BotFather en Telegram, copiá el token y pegalo acá.",
    telegramOpenBot: "Abrir bot en Telegram",
    telegramOpenBotShort: "Abrir en Telegram",
    telegramConnectHint: "Abrí el bot y mandá cualquier mensaje (ej. /start) para conectar.",
    telegramBotLabel: "Bot",
    telegramRecipients: "Destinatarios",
    telegramConnected: "Conectado",
    telegramNotConnected: "Esperando conexión",
    telegramDisconnect: "Desconectar",
    telegramDisconnecting: "Desconectando…",
    telegramChangeToken: "Cambiar token",
    telegramTestSent: "Mensaje de prueba enviado en Telegram",
    telegramTestFailed: "Error al enviar — conectá el bot primero",
    rulesTitle: "Reglas",
    rulesLead: "Proveedor + métrica + límite. Dispara una vez al cruzar el límite, no repite mientras siga del mismo lado.",
    exportAlarms: "Exportar alarmas",
    importAlarms: "Importar alarmas",
    alarmsImported: (n) => (n === 1 ? "1 alarma importada" : `${n} alarmas importadas`),
    alarmsImportError: "No se pudo importar el archivo.",
    alarmsImportEmpty: "No se encontró ninguna alarma válida en el archivo.",
    provider: "Proveedor",
    metric: "Métrica",
    threshold: "Límite",
    label: "Nombre (opcional)",
    labelPh: "ej. Claude cerca del tope",
    add: "Agregar",
    adding: "Agregando…",
    added: "Alarma creada",
    addFailed: "No se pudo crear la alarma",
    empty: "Todavía no hay alarmas configuradas.",
    remove: "Quitar",
    removing: "Quitando…",
    removed: "Alarma eliminada",
    enabledLabel: "Activa",
    triggerHintPercent: (n) => `dispara cuando el uso llegue a ${n}%`,
    triggerHintCents: (n) => `dispara cuando el saldo baje a $${(n / 100).toFixed(2)}`,
    triggerHintCalendar: (n, unit) => {
      const u = unit === "days" ? (n === 1 ? "1 día" : `${n} días`) : unit === "hours" ? (n === 1 ? "1 hora" : `${n} horas`) : n === 1 ? "1 minuto" : `${n} minutos`;
      return `dispara ${u} antes del evento/tarea`;
    },
    suggestUsage: (provider, pct, metricLabel) => `${provider} - Uso de ${pct}% de la cuota ${metricLabel}`,
    suggestBalance: (provider, amount, metricLabel) => `${provider} - Saldo de ${amount} de la cuota ${metricLabel}`,
    suggestCalendar: (n, unit, metricLabel) => {
      const u = unit === "days" ? (n === 1 ? "1 día" : `${n} días`) : unit === "hours" ? (n === 1 ? "1 hora" : `${n} horas`) : n === 1 ? "1 minuto" : `${n} minutos`;
      return `Calendario · ${metricLabel} · ${u} antes`;
    },
    edit: "Editar",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Cambios guardados",
    saveFailed: "No se pudo guardar",
    cancel: "Cancelar",
    rulesSummary: (total, active) => `${total} regla${total === 1 ? "" : "s"} · ${active} activa${active === 1 ? "" : "s"}`,
    filterAll: "Todos los proveedores",
    searchRules: "Buscar regla…",
    rulesFilteredEmpty: "Ninguna regla coincide con el filtro.",
    calendarSectionTitle: "Calendario — eventos y tareas",
    calendarSectionLead: "Recibí un aviso X tiempo antes de un evento o tarea de tu calendario (ICS). Elegí cuánto antes y la unidad (minutos, horas o días).",
    calendarKind: "Tipo",
    calendarKindEvent: "Eventos",
    calendarKindTask: "Tareas",
    calendarKindAll: "Eventos y tareas",
    calendarThreshold: "Anticipación",
    calendarUnit: "Unidad",
    calendarUnitMinutes: "Minutos",
    calendarUnitHours: "Horas",
    calendarUnitDays: "Días",
    calendarTarget: "Calendario",
    calendarTargetAll: "Todos los calendarios",
    calendarNoCalendars: "Ningún calendario configurado",
    calendarNoCalendarsHint: "Agregá un calendario en Configuración → Calendario para crear alarmas de eventos/tareas.",
    noProvidersConfigured: "Ningún proveedor con cuenta configurada",
    noProvidersHint: "Configurá al menos una cuenta en Configuración para crear alarmas de cuota. Las alarmas de calendario siguen disponibles abajo.",
  },
};
