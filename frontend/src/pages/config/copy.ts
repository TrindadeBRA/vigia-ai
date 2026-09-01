import type { ProviderCardPublic } from "../../api/types";
import type { Lang } from "../../i18n";

export type ConfigCopy = {
  title: string;
  lead: string;
  setup: string;
  retry: string;
  loadError: string;
  offline: string;
  fail: string;
  boardTitle: string;
  boardLead: string;
  boardDownload: string;
  boardDownloading: string;
  boardOk: string;
  boardNoIp: string;
  boardUrlLabel: string;
  accountsTitle: string;
  accountsLead: string;
  showOnBoard: string;
  hiddenOn: string;
  hiddenOff: string;
  nickname: string;
  nicknamePh: string;
  save: string;
  saving: string;
  saved: string;
  removeSecret: string;
  removing: string;
  removedSecret: string;
  connected: string;
  expired: string;
  missing: string;
  secretManaged: string;
  saveSecret: string;
  savedSecret: string;
  extraTitle: string;
  extraEmpty: string;
  extraCount: (n: number) => string;
  extraNickname: string;
  secretFold: string;
  toolsTitle: string;
  toolsLead: string;
  copyUrl: string;
  copied: string;
  addAccount: string;
  adding: string;
  added: string;
  remove: string;
  removed: string;
  needSecret: string;
  claudeBlurb: string;
  gptBlurb: string;
  cursorBlurb: string;
  openrouterBlurb: string;
  deepseekBlurb: string;
  opencodeBlurb: string;
  cursorHint: string;
  cursorAdvanced: string;
  modeLocal: string;
  modePaste: string;
  modeExpired: string;
  modeNeedLocal: string;
  modeNeedPaste: string;
  modeDocker: string;
  checkTitle: string;
  checkLead: string;
  checkBtn: string;
  checking: string;
  checkHidden: string;
  checkFail: string;
  netTitle: string;
  netLead: string;
  netPort: string;
  netHost: string;
  netHostHint: string;
  netMock: string;
  netRestart: string;
  netDocs: string;
  tokenPh: string;
  keyPh: string;
  orTokenPh: string;
  dsKeyPh: string;
  ocKeyPh: string;
  gptTokenPh: string;
  cursorTokenPh: string;
};

export const CONFIG_STR: Record<Lang, ConfigCopy> = {
  pt: {
    title: "Configurações",
    lead: "Escolha quais contas aparecem no painel da mesa. Os logins ficam só neste computador — a placa nunca vê senhas nem tokens.",
    setup: "Ajustes",
    retry: "Tentar de novo",
    loadError: "Não foi possível carregar as configurações.",
    offline: "Sem conexão com o Vigia. Confira se ele está rodando neste computador.",
    fail: "Não deu certo. Tente de novo.",
    boardTitle: "Arquivo da placa",
    boardLead: "A placa precisa saber de onde buscar os números. Baixe o arquivo, coloque na pasta do firmware e preencha o nome e a senha da sua Wi-Fi.",
    boardDownload: "Baixar arquivo da placa",
    boardDownloading: "Preparando…",
    boardOk: "Pronto. Mova o arquivo para firmware/src/secrets.h e preencha a Wi-Fi.",
    boardNoIp: "Não achamos um IP da sua Wi-Fi. Confira se este computador está na mesma rede da placa.",
    boardUrlLabel: "Endereço que a placa vai usar",
    accountsTitle: "Contas",
    accountsLead: "Se o Claude, o ChatGPT/Codex ou o Cursor já estão abertos e logados neste computador, a conta aparece sozinha. OpenRouter e DeepSeek pedem a chave da conta.",
    showOnBoard: "No painel",
    hiddenOn: "Essa conta some do painel. O login continua neste computador.",
    hiddenOff: "Essa conta volta a aparecer no painel.",
    nickname: "Nome na tela",
    nicknamePh: "ex.: Pessoal",
    save: "Salvar",
    saving: "Salvando…",
    saved: "Salvo.",
    removeSecret: "Remover chave",
    removing: "Removendo…",
    removedSecret: "Chave removida.",
    connected: "Conectado",
    expired: "Sessão expirada",
    missing: "Não conectado",
    secretManaged: "Login gerenciado pelo app neste computador",
    saveSecret: "Guardar",
    savedSecret: "Guardado.",
    extraTitle: "Adicionar outra conta",
    extraEmpty: "Nenhuma conta extra. Adicione se tiver, por exemplo, uma pessoal e outra do trabalho.",
    extraCount: (n) => (n === 1 ? "1 conta extra" : `${n} contas extras`),
    extraNickname: "Nome",
    addAccount: "Adicionar conta",
    adding: "Adicionando…",
    added: "Conta adicionada.",
    remove: "Remover",
    removed: "Conta removida.",
    needSecret: "Cole o token ou a chave antes de adicionar.",
    secretFold: "Colar uma chave",
    toolsTitle: "Placa e rede",
    toolsLead: "Arquivo da ESP32, teste na hora e o endereço neste computador.",
    copyUrl: "Copiar",
    copied: "Copiado.",
    claudeBlurb: "Usa o login do Claude Code neste computador. Não é a chave de API.",
    gptBlurb: "Usa o login do ChatGPT / Codex neste computador. Não é a chave de API.",
    cursorBlurb: "Usa o login do app Cursor neste computador.",
    openrouterBlurb: "Cole a chave da sua conta. Você cria em openrouter.ai, em Settings → Keys.",
    deepseekBlurb: "Cole a chave da sua conta. Você cria em platform.deepseek.com, em API Keys.",
    opencodeBlurb: "Cota da assinatura (janelas rolling, semanal e mensal) e saldo pago-conforme-uso. Crie a key em opencode.ai/auth.",
    cursorHint: "Se não aparecer sozinho: no Cursor, abra a conta, saia e entre de novo.",
    cursorAdvanced: "Opção avançada (Terminal)",
    modeLocal: "Encontramos o login neste computador.",
    modePaste: "Usando a chave que você colou aqui.",
    modeExpired: "A sessão expirou. Abra o app neste computador e entre de novo.",
    modeNeedLocal: "Abra o app neste computador e entre na sua conta.",
    modeNeedPaste: "Cole a chave abaixo para conectar.",
    modeDocker: "Neste modo o login do Mac não é lido. Cole o token abaixo, ou rode o Vigia fora do Docker.",
    checkTitle: "Conferir agora",
    checkLead: "Busca os números na hora, sem esperar a próxima atualização automática.",
    checkBtn: "Buscar cotas agora",
    checking: "Consultando…",
    checkHidden: "oculto no painel",
    checkFail: "falhou",
    netTitle: "Rede deste computador",
    netLead: "A placa precisa alcançar este computador na sua Wi-Fi. Na maioria das vezes, não é preciso mudar nada.",
    netPort: "Porta",
    netHost: "Endereço de escuta",
    netHostHint: "0.0.0.0 deixa a placa encontrar este computador na rede local.",
    netMock: "Usar dados de exemplo (não consulta as contas de verdade)",
    netRestart: "Salvo. Reinicie o Vigia para a nova porta valer.",
    netDocs: "Documentação técnica da API",
    tokenPh: "Token da sessão",
    keyPh: "Chave da API",
    orTokenPh: "sk-or-…",
    dsKeyPh: "sk-…",
    ocKeyPh: "sk-…",
    gptTokenPh: "Token do Codex",
    cursorTokenPh: "Token da sessão",
  },
  en: {
    title: "Settings",
    lead: "Choose which accounts show on the desk display. Logins stay on this computer — the board never sees passwords or tokens.",
    setup: "Setup",
    retry: "Try again",
    loadError: "Could not load settings.",
    offline: "Can't reach Vigia. Check that it's running on this computer.",
    fail: "That didn't work. Try again.",
    boardTitle: "Board file",
    boardLead: "The board needs to know where to fetch the numbers. Download the file, put it in the firmware folder, and fill in your Wi-Fi name and password.",
    boardDownload: "Download board file",
    boardDownloading: "Preparing…",
    boardOk: "Done. Move the file to firmware/src/secrets.h and fill in the Wi-Fi.",
    boardNoIp: "We couldn't find a Wi-Fi IP. Make sure this computer is on the same network as the board.",
    boardUrlLabel: "Address the board will use",
    accountsTitle: "Accounts",
    accountsLead: "If Claude, ChatGPT/Codex, or Cursor is already open and signed in on this computer, the account shows up on its own. OpenRouter and DeepSeek need the account key.",
    showOnBoard: "On display",
    hiddenOn: "This account is hidden from the display. The login stays on this computer.",
    hiddenOff: "This account shows on the display again.",
    nickname: "Name on screen",
    nicknamePh: "e.g. Personal",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    removeSecret: "Remove key",
    removing: "Removing…",
    removedSecret: "Key removed.",
    connected: "Connected",
    expired: "Session expired",
    missing: "Not connected",
    secretManaged: "Sign-in managed by the app on this computer",
    saveSecret: "Save",
    savedSecret: "Saved.",
    extraTitle: "Add another account",
    extraEmpty: "No extra accounts. Add one if you have, for example, a personal and a work login.",
    extraCount: (n) => (n === 1 ? "1 extra account" : `${n} extra accounts`),
    extraNickname: "Name",
    addAccount: "Add account",
    adding: "Adding…",
    added: "Account added.",
    remove: "Remove",
    removed: "Account removed.",
    needSecret: "Paste the token or key before adding.",
    secretFold: "Paste a key",
    toolsTitle: "Board and network",
    toolsLead: "ESP32 file, a live check, and this computer's address.",
    copyUrl: "Copy",
    copied: "Copied.",
    claudeBlurb: "Uses the Claude Code sign-in on this computer. Not the API key.",
    gptBlurb: "Uses the ChatGPT / Codex sign-in on this computer. Not the API key.",
    cursorBlurb: "Uses the Cursor app sign-in on this computer.",
    openrouterBlurb: "Paste your account key. Create one at openrouter.ai, under Settings → Keys.",
    deepseekBlurb: "Paste your account key. Create one at platform.deepseek.com, under API Keys.",
    opencodeBlurb: "Subscription quota (rolling, weekly and monthly windows) and pay-as-you-go balance. Create a key at opencode.ai/auth.",
    cursorHint: "If it doesn't show up: in Cursor, open the account, sign out, and sign back in.",
    cursorAdvanced: "Advanced (Terminal)",
    modeLocal: "We found the sign-in on this computer.",
    modePaste: "Using the key you pasted here.",
    modeExpired: "The session expired. Open the app on this computer and sign in again.",
    modeNeedLocal: "Open the app on this computer and sign in.",
    modeNeedPaste: "Paste the key below to connect.",
    modeDocker: "In this mode the Mac sign-in isn't read. Paste the token below, or run Vigia outside Docker.",
    checkTitle: "Check now",
    checkLead: "Fetches the numbers right away, without waiting for the next automatic update.",
    checkBtn: "Fetch usage now",
    checking: "Checking…",
    checkHidden: "hidden on display",
    checkFail: "failed",
    netTitle: "This computer's network",
    netLead: "The board needs to reach this computer on your Wi-Fi. Most of the time you don't need to change anything.",
    netPort: "Port",
    netHost: "Listen address",
    netHostHint: "0.0.0.0 lets the board find this computer on the local network.",
    netMock: "Use sample data (doesn't call the real accounts)",
    netRestart: "Saved. Restart Vigia for the new port to apply.",
    netDocs: "Technical API docs",
    tokenPh: "Session token",
    keyPh: "API key",
    orTokenPh: "sk-or-…",
    dsKeyPh: "sk-…",
    ocKeyPh: "sk-…",
    gptTokenPh: "Codex token",
    cursorTokenPh: "Session token",
  },
  es: {
    title: "Configuración",
    lead: "Elige qué cuentas aparecen en el panel de mesa. Los inicios de sesión quedan solo en este computador — la placa nunca ve contraseñas ni tokens.",
    setup: "Ajustes",
    retry: "Intentar de nuevo",
    loadError: "No se pudo cargar la configuración.",
    offline: "Sin conexión con Vigia. Comprueba que esté en marcha en este computador.",
    fail: "No funcionó. Inténtalo de nuevo.",
    boardTitle: "Archivo de la placa",
    boardLead: "La placa necesita saber de dónde tomar los números. Descarga el archivo, ponlo en la carpeta del firmware y completa el nombre y la contraseña de tu Wi-Fi.",
    boardDownload: "Descargar archivo de la placa",
    boardDownloading: "Preparando…",
    boardOk: "Listo. Mueve el archivo a firmware/src/secrets.h y completa el Wi-Fi.",
    boardNoIp: "No encontramos una IP de tu Wi-Fi. Comprueba que este computador esté en la misma red que la placa.",
    boardUrlLabel: "Dirección que usará la placa",
    accountsTitle: "Cuentas",
    accountsLead: "Si Claude, ChatGPT/Codex o Cursor ya están abiertos e iniciados en este computador, la cuenta aparece sola. OpenRouter y DeepSeek piden la clave de la cuenta.",
    showOnBoard: "En el panel",
    hiddenOn: "Esta cuenta desaparece del panel. El inicio de sesión sigue en este computador.",
    hiddenOff: "Esta cuenta vuelve a aparecer en el panel.",
    nickname: "Nombre en pantalla",
    nicknamePh: "ej.: Personal",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Guardado.",
    removeSecret: "Quitar clave",
    removing: "Quitando…",
    removedSecret: "Clave quitada.",
    connected: "Conectado",
    expired: "Sesión caducada",
    missing: "Sin conectar",
    secretManaged: "Inicio de sesión gestionado por la app en este computador",
    saveSecret: "Guardar",
    savedSecret: "Guardado.",
    extraTitle: "Añadir otra cuenta",
    extraEmpty: "Ninguna cuenta extra. Añade una si tienes, por ejemplo, una personal y otra del trabajo.",
    extraCount: (n) => (n === 1 ? "1 cuenta extra" : `${n} cuentas extras`),
    extraNickname: "Nombre",
    addAccount: "Añadir cuenta",
    adding: "Añadiendo…",
    added: "Cuenta añadida.",
    remove: "Quitar",
    removed: "Cuenta quitada.",
    needSecret: "Pega el token o la clave antes de añadir.",
    secretFold: "Pegar una clave",
    toolsTitle: "Placa y red",
    toolsLead: "Archivo de la ESP32, una comprobación al momento y la dirección de este computador.",
    copyUrl: "Copiar",
    copied: "Copiado.",
    claudeBlurb: "Usa el inicio de sesión de Claude Code en este computador. No es la clave de API.",
    gptBlurb: "Usa el inicio de sesión de ChatGPT / Codex en este computador. No es la clave de API.",
    cursorBlurb: "Usa el inicio de sesión de la app Cursor en este computador.",
    openrouterBlurb: "Pega la clave de tu cuenta. La creas en openrouter.ai, en Settings → Keys.",
    deepseekBlurb: "Pega la clave de tu cuenta. La creas en platform.deepseek.com, en API Keys.",
    opencodeBlurb: "Cuota de la suscripción (ventanas rolling, semanal y mensual) y saldo de pago por uso. Crea una clave en opencode.ai/auth.",
    cursorHint: "Si no aparece solo: en Cursor, abre la cuenta, cierra sesión y vuelve a entrar.",
    cursorAdvanced: "Opción avanzada (Terminal)",
    modeLocal: "Encontramos el inicio de sesión en este computador.",
    modePaste: "Usando la clave que pegaste aquí.",
    modeExpired: "La sesión caducó. Abre la app en este computador y entra de nuevo.",
    modeNeedLocal: "Abre la app en este computador e inicia sesión.",
    modeNeedPaste: "Pega la clave abajo para conectar.",
    modeDocker: "En este modo no se lee el inicio de sesión del Mac. Pega el token abajo, o ejecuta Vigia fuera de Docker.",
    checkTitle: "Comprobar ahora",
    checkLead: "Busca los números al momento, sin esperar la próxima actualización automática.",
    checkBtn: "Buscar cuotas ahora",
    checking: "Consultando…",
    checkHidden: "oculto en el panel",
    checkFail: "falló",
    netTitle: "Red de este computador",
    netLead: "La placa necesita alcanzar este computador en tu Wi-Fi. Casi nunca hace falta cambiar nada.",
    netPort: "Puerto",
    netHost: "Dirección de escucha",
    netHostHint: "0.0.0.0 deja que la placa encuentre este computador en la red local.",
    netMock: "Usar datos de ejemplo (no consulta las cuentas de verdad)",
    netRestart: "Guardado. Reinicia Vigia para que el puerto nuevo valga.",
    netDocs: "Documentación técnica de la API",
    tokenPh: "Token de sesión",
    keyPh: "Clave de API",
    orTokenPh: "sk-or-…",
    dsKeyPh: "sk-…",
    ocKeyPh: "sk-…",
    gptTokenPh: "Token de Codex",
    cursorTokenPh: "Token de sesión",
  },
};

export function badgeOf(p: ProviderCardPublic, c: ConfigCopy): { state: "ok" | "warn" | "missing"; text: string } {
  if (p.configured) return { state: "ok", text: c.connected };
  if (p.source === "expired") return { state: "warn", text: c.expired };
  return { state: "missing", text: c.missing };
}

export function connectionHint(p: ProviderCardPublic, c: ConfigCopy, inDocker: boolean, usesLocalApp: boolean): string {
  if (p.source === "expired") return c.modeExpired;
  if (p.mode === "local") return c.modeLocal;
  if (p.mode === "paste") return c.modePaste;
  if (p.mode === "need_paste" && inDocker && usesLocalApp) return c.modeDocker;
  if (p.mode === "need_paste") return c.modeNeedPaste;
  if (p.mode === "need_local") return c.modeNeedLocal;
  return p.label;
}
