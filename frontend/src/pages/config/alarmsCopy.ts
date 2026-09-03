import type { Lang } from "../../i18n";

export type AlarmsCopy = {
  title: string;
  lead: string;
  loadError: string;
  offline: string;
  retry: string;
  pushTitle: string;
  pushLead: string;
  pushUnsupported: string;
  pushDenied: string;
  pushOff: string;
  pushOn: string;
  enable: string;
  enabling: string;
  disable: string;
  disabling: string;
  sendTest: string;
  sendingTest: string;
  sendingTestIn: (s: number) => string;
  testSent: string;
  testFailed: string;
  secureContextNote: string;
  telegramTitle: string;
  telegramLead: string;
  telegramTokenPh: string;
  telegramSaveToken: string;
  telegramSavingToken: string;
  telegramBotFatherHint: string;
  telegramOpenBot: string;
  telegramConnectHint: string;
  telegramConnected: string;
  telegramNotConnected: string;
  telegramDisconnect: string;
  telegramDisconnecting: string;
  telegramChangeToken: string;
  telegramTestSent: string;
  telegramTestFailed: string;
  rulesTitle: string;
  rulesLead: string;
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
  suggestUsage: (provider: string, pct: number, metricLabel: string) => string;
  suggestBalance: (provider: string, amount: string, metricLabel: string) => string;
  edit: string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  cancel: string;
};

export const ALARMS_STR: Record<Lang, AlarmsCopy> = {
  pt: {
    title: "Alarmes",
    lead: "Avise quando uma cota passar de um limiar, ou o saldo de créditos ficar baixo — por notificação push.",
    loadError: "Não deu pra carregar os alarmes.",
    offline: "Não foi possível falar com o coletor.",
    retry: "Tentar de novo",
    pushTitle: "Notificações push",
    pushLead: "Ative neste navegador pra receber os alarmes mesmo com a aba fechada.",
    pushUnsupported: "Não suportado neste navegador/endereço",
    pushDenied: "Bloqueado nas permissões do navegador",
    pushOff: "Desativado",
    pushOn: "Ativo",
    enable: "Ativar notificações",
    enabling: "Ativando…",
    disable: "Desativar",
    disabling: "Desativando…",
    sendTest: "Enviar teste",
    sendingTest: "Enviando…",
    sendingTestIn: (s) => `Enviando em ${s}s…`,
    testSent: "Notificação de teste enviada",
    testFailed: "Falha ao enviar — ative as notificações primeiro",
    secureContextNote:
      "Push só funciona em contexto seguro: abrindo o painel em http://127.0.0.1:<porta> neste computador. Pelo IP da rede (ex. no celular) o navegador bloqueia a assinatura — dá pra configurar os alarmes normalmente, mas o push só chega aqui neste Mac.",
    telegramTitle: "Telegram",
    telegramLead: "Receba os alarmes no app do Telegram — funciona em qualquer dispositivo, sem depender do navegador.",
    telegramTokenPh: "Cole o token do @BotFather",
    telegramSaveToken: "Salvar token",
    telegramSavingToken: "Salvando…",
    telegramBotFatherHint: "Crie um bot com o @BotFather no Telegram, copie o token e cole aqui.",
    telegramOpenBot: "Abrir bot no Telegram",
    telegramConnectHint: "Abra o bot e mande qualquer mensagem (ex. /start) para conectar.",
    telegramConnected: "Conectado",
    telegramNotConnected: "Aguardando conexão",
    telegramDisconnect: "Desconectar",
    telegramDisconnecting: "Desconectando…",
    telegramChangeToken: "Trocar token",
    telegramTestSent: "Mensagem de teste enviada no Telegram",
    telegramTestFailed: "Falha ao enviar — conecte o bot primeiro",
    rulesTitle: "Regras",
    rulesLead: "Provedor + métrica + limiar. Dispara uma vez ao cruzar o limiar, não repete enquanto continuar do mesmo lado.",
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
    suggestUsage: (provider, pct, metricLabel) => `${provider} - Uso de ${pct}% da cota ${metricLabel}`,
    suggestBalance: (provider, amount, metricLabel) => `${provider} - Saldo de ${amount} da cota ${metricLabel}`,
    edit: "Editar",
    save: "Salvar",
    saving: "Salvando…",
    saved: "Alterações salvas",
    saveFailed: "Não foi possível salvar",
    cancel: "Cancelar",
  },
  en: {
    title: "Alarms",
    lead: "Get notified when a quota crosses a threshold, or a credit balance runs low — via push notification.",
    loadError: "Could not load alarms.",
    offline: "Could not reach the collector.",
    retry: "Retry",
    pushTitle: "Push notifications",
    pushLead: "Enable in this browser to receive alarms even with the tab closed.",
    pushUnsupported: "Not supported on this browser/address",
    pushDenied: "Blocked in browser permissions",
    pushOff: "Off",
    pushOn: "On",
    enable: "Enable notifications",
    enabling: "Enabling…",
    disable: "Disable",
    disabling: "Disabling…",
    sendTest: "Send test",
    sendingTest: "Sending…",
    sendingTestIn: (s) => `Sending in ${s}s…`,
    testSent: "Test notification sent",
    testFailed: "Failed to send — enable notifications first",
    secureContextNote:
      "Push only works in a secure context: opening the panel at http://127.0.0.1:<port> on this machine. From the LAN IP (e.g. a phone) the browser blocks the subscription — you can still set up alarms there, but push only arrives on this Mac.",
    telegramTitle: "Telegram",
    telegramLead: "Receive alarms in the Telegram app — works on any device, no browser restrictions.",
    telegramTokenPh: "Paste the @BotFather token",
    telegramSaveToken: "Save token",
    telegramSavingToken: "Saving…",
    telegramBotFatherHint: "Create a bot with @BotFather on Telegram, copy the token and paste it here.",
    telegramOpenBot: "Open bot in Telegram",
    telegramConnectHint: "Open the bot and send any message (e.g. /start) to connect.",
    telegramConnected: "Connected",
    telegramNotConnected: "Waiting for connection",
    telegramDisconnect: "Disconnect",
    telegramDisconnecting: "Disconnecting…",
    telegramChangeToken: "Change token",
    telegramTestSent: "Test message sent on Telegram",
    telegramTestFailed: "Failed to send — connect the bot first",
    rulesTitle: "Rules",
    rulesLead: "Provider + metric + threshold. Fires once when crossing the threshold, won't repeat while staying on the same side.",
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
    suggestUsage: (provider, pct, metricLabel) => `${provider} - ${pct}% usage of ${metricLabel}`,
    suggestBalance: (provider, amount, metricLabel) => `${provider} - ${metricLabel} balance at ${amount}`,
    edit: "Edit",
    save: "Save",
    saving: "Saving…",
    saved: "Changes saved",
    saveFailed: "Could not save",
    cancel: "Cancel",
  },
  es: {
    title: "Alarmas",
    lead: "Recibí un aviso cuando una cuota cruce un límite, o el saldo de créditos quede bajo — por notificación push.",
    loadError: "No se pudieron cargar las alarmas.",
    offline: "No se pudo contactar al colector.",
    retry: "Reintentar",
    pushTitle: "Notificaciones push",
    pushLead: "Activá en este navegador para recibir las alarmas aunque la pestaña esté cerrada.",
    pushUnsupported: "No soportado en este navegador/dirección",
    pushDenied: "Bloqueado en los permisos del navegador",
    pushOff: "Desactivado",
    pushOn: "Activo",
    enable: "Activar notificaciones",
    enabling: "Activando…",
    disable: "Desactivar",
    disabling: "Desactivando…",
    sendTest: "Enviar prueba",
    sendingTest: "Enviando…",
    sendingTestIn: (s) => `Enviando en ${s}s…`,
    testSent: "Notificación de prueba enviada",
    testFailed: "Error al enviar — activá las notificaciones primero",
    secureContextNote:
      "Push solo funciona en contexto seguro: abriendo el panel en http://127.0.0.1:<puerto> en esta máquina. Por la IP de la red (ej. el celular) el navegador bloquea la suscripción — podés configurar las alarmas igual, pero el push solo llega en esta Mac.",
    telegramTitle: "Telegram",
    telegramLead: "Recibí las alarmas en la app de Telegram — funciona en cualquier dispositivo, sin depender del navegador.",
    telegramTokenPh: "Pegá el token de @BotFather",
    telegramSaveToken: "Guardar token",
    telegramSavingToken: "Guardando…",
    telegramBotFatherHint: "Creá un bot con @BotFather en Telegram, copiá el token y pegalo acá.",
    telegramOpenBot: "Abrir bot en Telegram",
    telegramConnectHint: "Abrí el bot y mandá cualquier mensaje (ej. /start) para conectar.",
    telegramConnected: "Conectado",
    telegramNotConnected: "Esperando conexión",
    telegramDisconnect: "Desconectar",
    telegramDisconnecting: "Desconectando…",
    telegramChangeToken: "Cambiar token",
    telegramTestSent: "Mensaje de prueba enviado en Telegram",
    telegramTestFailed: "Error al enviar — conectá el bot primero",
    rulesTitle: "Reglas",
    rulesLead: "Proveedor + métrica + límite. Dispara una vez al cruzar el límite, no repite mientras siga del mismo lado.",
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
    suggestUsage: (provider, pct, metricLabel) => `${provider} - Uso de ${pct}% de la cuota ${metricLabel}`,
    suggestBalance: (provider, amount, metricLabel) => `${provider} - Saldo de ${amount} de la cuota ${metricLabel}`,
    edit: "Editar",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Cambios guardados",
    saveFailed: "No se pudo guardar",
    cancel: "Cancelar",
  },
};
