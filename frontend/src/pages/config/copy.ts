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
  configSetupHint: string;
  howTitle: string;
  howLead: string;
  howIntro: string;
  how1Title: string;
  how1Body: string;
  how2Title: string;
  how2Body: string;
  how3Title: string;
  how3Body: string;
  how4Title: string;
  how4Body: string;
  how5Title: string;
  how5Body: string;
  howAccounts: string;
  accountsCta: string;
  doNowTitle: string;
  boardDestLabel: string;
  boardDest: string;
  flashCmd: string;
  wokwiCmd: string;
  netIdleHint: string;
  simTitle: string;
  simLead: string;
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
  falBlurb: string;
  bitcoinBlurb: string;
  adsenseBlurb: string;
  adsenseCredsFold: string;
  adsenseClientId: string;
  adsenseClientSecret: string;
  adsenseClientIdPh: string;
  adsenseClientSecretPh: string;
  adsenseRedirectHint: (url: string) => string;
  adsenseLogin: string;
  adsenseNeedCreds: string;
  adsenseLogout: string;
  adsenseLogoutOk: string;
  adsenseOauthOk: string;
  adsenseOauthDenied: string;
  adsenseOauthError: string;
  cursorHint: string;
  cursorAdvanced: string;
  modeLocal: string;
  modePaste: string;
  modeExpired: string;
  modeNeedLocal: string;
  modeNeedPaste: string;
  modeOauth: string;
  modeNeedOauth: string;
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
  falKeyPh: string;
  bitcoinAddressPh: string;
  gptTokenPh: string;
  cursorTokenPh: string;
  // Weather
  weatherTitle: string;
  weatherLead: string;
  weatherEnabled: string;
  weatherCityLabel: string;
  weatherCityPh: string;
  weatherSearching: string;
  weatherNoResults: string;
  weatherSelected: string;
  weatherChangeCity: string;
  weatherUnitsTitle: string;
  weatherTempUnit: string;
  weatherWindUnit: string;
  weatherPrecipUnit: string;
  weatherForecastDays: string;
  weatherDisplayTitle: string;
  weatherShowCurrent: string;
  weatherShowHourly: string;
  weatherShowDaily: string;
  weatherHourlyCount: string;
  weatherDailyCount: string;
  weatherFieldsTitle: string;
  weatherFieldTemperature: string;
  weatherFieldFeelsLike: string;
  weatherFieldHumidity: string;
  weatherFieldPrecip: string;
  weatherFieldWind: string;
  weatherFieldPressure: string;
  weatherFieldCloudCover: string;
  weatherFieldUvIndex: string;
  weatherFieldSunriseSunset: string;
  weatherAdvancedTitle: string;
  weatherCurrentVars: string;
  weatherHourlyVars: string;
  weatherDailyVars: string;
  weatherVarsHint: string;
  weatherNotConfigured: string;
  weatherPoweredBy: string;
  // Financeiro
  financeiroTitle: string;
  financeiroLead: string;
  currenciesTitle: string;
  currenciesLead: string;
  currenciesEnabled: string;
  currenciesBaseLabel: string;
  currenciesListLabel: string;
  currenciesEmpty: string;
  currenciesAddTitle: string;
  currenciesKindFiat: string;
  currenciesKindCrypto: string;
  currenciesAdd: string;
  currenciesSearchPh: string;
  currenciesSearch: string;
  currenciesSearching: string;
  currenciesNoResults: string;
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
    configSetupHint: "Para gravar a ESP32 e conferir a rede, abra",
    howTitle: "Como fazer",
    howLead: "A placa só mostra porcentagens. Tokens e senhas ficam neste computador. Siga os passos na ordem — a placa e o Mac precisam estar na mesma Wi-Fi.",
    howIntro: "O coletor neste computador busca as cotas. A ESP32 só pede o JSON na rede local. Nada de login vai para a placa.",
    how1Title: "Deixe o Vigia ligado",
    how1Body: "Neste computador, rode ./dev up. O coletor precisa estar no ar para a placa achar os números.",
    how2Title: "Ligue as contas",
    how2Body: "Em Configurações, deixe Claude, GPT e Cursor logados neste Mac, ou cole as chaves dos outros provedores.",
    how3Title: "Baixe o arquivo da placa",
    how3Body: "O secrets.h diz à ESP32 o endereço deste computador. Mova o arquivo para firmware/src/secrets.h e preencha o nome e a senha da Wi-Fi.",
    how4Title: "Grave o firmware",
    how4Body: "Com o cabo USB: ./dev firmware flash. Sem placa física, use o simulador no passo abaixo.",
    how5Title: "Confira na hora",
    how5Body: "Use “Buscar cotas agora”. Se a placa não achar o computador, confira IP, porta e se os dois estão na mesma rede.",
    howAccounts: "Ainda não ligou as contas?",
    accountsCta: "Abrir configurações",
    doNowTitle: "Na placa",
    boardDestLabel: "Coloque o arquivo aqui",
    boardDest: "firmware/src/secrets.h",
    flashCmd: "./dev firmware flash",
    wokwiCmd: "./dev wokwi",
    netIdleHint: "Pode deixar como está. Só salve se mudar porta, endereço ou o modo de exemplo.",
    simTitle: "Sem placa física",
    simLead: "O Wokwi simula a tela neste computador. A Wi-Fi da placa é virtual — o coletor continua neste Mac.",
    copyUrl: "Copiar",
    copied: "Copiado.",
    claudeBlurb: "Usa o login do Claude Code neste computador. Não é a chave de API.",
    gptBlurb: "Usa o login do ChatGPT / Codex neste computador. Não é a chave de API.",
    cursorBlurb: "Usa o login do app Cursor neste computador.",
    openrouterBlurb: "Cole a chave da sua conta. Você cria em openrouter.ai, em Settings → Keys.",
    deepseekBlurb: "Cole a chave da sua conta. Você cria em platform.deepseek.com, em API Keys.",
    opencodeBlurb: "Cota da assinatura (janelas rolling, semanal e mensal) e saldo pago-conforme-uso. Crie a key em opencode.ai/auth.",
    falBlurb: "Saldo de créditos. Crie uma key com escopo Admin em fal.ai/dashboard/keys (uma key comum não lê o saldo).",
    bitcoinBlurb: "Cole o endereço público da carteira (nunca a chave privada ou a seed). Mostra o saldo on-chain e o valor em dólar e em real.",
    adsenseBlurb: "Ganhos de hoje (estimativa) e saldo não pago da conta AdSense. Exige um Client ID OAuth no Google Cloud (tipo Web) e o login Google neste computador.",
    adsenseCredsFold: "Credenciais do Google Cloud",
    adsenseClientId: "CLIENT ID",
    adsenseClientSecret: "CLIENT SECRET",
    adsenseClientIdPh: "xxxx.apps.googleusercontent.com",
    adsenseClientSecretPh: "GOCSPX-…",
    adsenseRedirectHint: (url) => `URI de redirecionamento (cadastrar no cliente OAuth Web): ${url}`,
    adsenseLogin: "Entrar com Google",
    adsenseNeedCreds: "Cole o Client ID e o Client Secret reais no fold acima (o texto cinza é só exemplo). Depois o botão liga.",
    adsenseLogout: "Sair do Google",
    adsenseLogoutOk: "Login Google apagado.",
    adsenseOauthOk: "AdSense conectado.",
    adsenseOauthDenied: "Login Google cancelado.",
    adsenseOauthError: "Não deu para conectar o AdSense.",
    cursorHint: "Se não aparecer sozinho: no Cursor, abra a conta, saia e entre de novo.",
    cursorAdvanced: "Opção avançada (Terminal)",
    modeLocal: "Encontramos o login neste computador.",
    modePaste: "Usando a chave que você colou aqui.",
    modeExpired: "A sessão expirou. Abra o app neste computador e entre de novo.",
    modeNeedLocal: "Abra o app neste computador e entre na sua conta.",
    modeNeedPaste: "Cole a chave abaixo para conectar.",
    modeOauth: "Login Google gravado neste coletor.",
    modeNeedOauth: "Credenciais salvas — entre com o Google.",
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
    falKeyPh: "id:secret",
    bitcoinAddressPh: "bc1… ou endereço legado",
    gptTokenPh: "Token do Codex",
    cursorTokenPh: "Token da sessão",
    weatherTitle: "Clima",
    weatherLead: "Veja a previsão do tempo no painel. Escolha a cidade e o que mostrar no widget.",
    weatherEnabled: "Mostrar clima no painel",
    weatherCityLabel: "Cidade",
    weatherCityPh: "ex.: São Paulo",
    weatherSearching: "Buscando…",
    weatherNoResults: "Nenhuma cidade encontrada.",
    weatherSelected: "Selecionada",
    weatherChangeCity: "Trocar cidade",
    weatherUnitsTitle: "Unidades",
    weatherTempUnit: "Temperatura",
    weatherWindUnit: "Vento",
    weatherPrecipUnit: "Precipitação",
    weatherForecastDays: "Dias de previsão",
    weatherDisplayTitle: "O que mostrar no widget",
    weatherShowCurrent: "Condições atuais",
    weatherShowHourly: "Próximas horas",
    weatherShowDaily: "Próximos dias",
    weatherHourlyCount: "Horas à frente",
    weatherDailyCount: "Dias à frente",
    weatherFieldsTitle: "Campos no widget",
    weatherFieldTemperature: "Temperatura",
    weatherFieldFeelsLike: "Sensação térmica",
    weatherFieldHumidity: "Umidade",
    weatherFieldPrecip: "Precipitação",
    weatherFieldWind: "Vento",
    weatherFieldPressure: "Pressão",
    weatherFieldCloudCover: "Nuvens",
    weatherFieldUvIndex: "Índice UV",
    weatherFieldSunriseSunset: "Nascer/pôr do sol",
    weatherAdvancedTitle: "Variáveis avançadas (Open-Meteo)",
    weatherCurrentVars: "Variáveis atuais",
    weatherHourlyVars: "Variáveis por hora",
    weatherDailyVars: "Variáveis por dia",
    weatherVarsHint: "Escolha quais dados o coletor busca no Open-Meteo. Todas as opções da API estão disponíveis.",
    weatherNotConfigured: "Configure a cidade para ver o clima.",
    weatherPoweredBy: "Dados por Open-Meteo.com",
    financeiroTitle: "Financeiro",
    financeiroLead: "Carteira Bitcoin, AdSense e cotação de moedas — dólar, euro, cripto, o que você quiser acompanhar.",
    currenciesTitle: "Cotação de moedas",
    currenciesLead: "Adicione quantas moedas quiser — fiat (dólar, euro...) ou cripto — e veja a cotação convertida para a moeda base.",
    currenciesEnabled: "Mostrar no painel",
    currenciesBaseLabel: "Moeda base (cotações convertidas para)",
    currenciesListLabel: "Moedas acompanhadas",
    currenciesEmpty: "Nenhuma moeda adicionada ainda.",
    currenciesAddTitle: "Adicionar moeda",
    currenciesKindFiat: "Moeda (câmbio)",
    currenciesKindCrypto: "Criptomoeda",
    currenciesAdd: "Adicionar",
    currenciesSearchPh: "ex.: ethereum, solana...",
    currenciesSearch: "Buscar",
    currenciesSearching: "Buscando…",
    currenciesNoResults: "Nenhuma criptomoeda encontrada.",
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
    configSetupHint: "To flash the ESP32 and check the network, open",
    howTitle: "How to set it up",
    howLead: "The board only shows percentages. Tokens and passwords stay on this computer. Follow the steps in order — the board and this Mac must share the same Wi-Fi.",
    howIntro: "The collector on this computer fetches usage. The ESP32 only requests JSON on the local network. No sign-in ever goes to the board.",
    how1Title: "Keep Vigia running",
    how1Body: "On this computer, run ./dev up. The collector must be up for the board to find the numbers.",
    how2Title: "Connect the accounts",
    how2Body: "In Settings, leave Claude, GPT, and Cursor signed in on this Mac, or paste keys for the other providers.",
    how3Title: "Download the board file",
    how3Body: "secrets.h tells the ESP32 this computer's address. Move the file to firmware/src/secrets.h and fill in the Wi-Fi name and password.",
    how4Title: "Flash the firmware",
    how4Body: "With the USB cable: ./dev firmware flash. No physical board? Use the simulator below.",
    how5Title: "Check right away",
    how5Body: "Use “Fetch usage now”. If the board can't find this computer, check IP, port, and that both are on the same network.",
    howAccounts: "Haven't connected accounts yet?",
    accountsCta: "Open settings",
    doNowTitle: "On the board",
    boardDestLabel: "Where to put the file",
    boardDest: "firmware/src/secrets.h",
    flashCmd: "./dev firmware flash",
    wokwiCmd: "./dev wokwi",
    netIdleHint: "You can leave this as is. Only save if you change the port, address, or sample-data mode.",
    simTitle: "No physical board",
    simLead: "Wokwi simulates the screen on this computer. The board's Wi-Fi is virtual — the collector still runs on this Mac.",
    copyUrl: "Copy",
    copied: "Copied.",
    claudeBlurb: "Uses the Claude Code sign-in on this computer. Not the API key.",
    gptBlurb: "Uses the ChatGPT / Codex sign-in on this computer. Not the API key.",
    cursorBlurb: "Uses the Cursor app sign-in on this computer.",
    openrouterBlurb: "Paste your account key. Create one at openrouter.ai, under Settings → Keys.",
    deepseekBlurb: "Paste your account key. Create one at platform.deepseek.com, under API Keys.",
    opencodeBlurb: "Subscription quota (rolling, weekly and monthly windows) and pay-as-you-go balance. Create a key at opencode.ai/auth.",
    falBlurb: "Credit balance. Create an Admin-scope key at fal.ai/dashboard/keys (a regular API key can't read the balance).",
    bitcoinBlurb: "Paste the wallet's public address (never the private key or seed phrase). Shows the on-chain balance and its value in USD and BRL.",
    adsenseBlurb: "Today's estimated earnings and unpaid AdSense balance. Needs a Google Cloud OAuth Web client and a Google login on this computer.",
    adsenseCredsFold: "Google Cloud credentials",
    adsenseClientId: "CLIENT ID",
    adsenseClientSecret: "CLIENT SECRET",
    adsenseClientIdPh: "xxxx.apps.googleusercontent.com",
    adsenseClientSecretPh: "GOCSPX-…",
    adsenseRedirectHint: (url) => `Redirect URI (register it on the Web OAuth client): ${url}`,
    adsenseLogin: "Sign in with Google",
    adsenseNeedCreds: "Paste the real Client ID and Client Secret in the fold above (the gray text is only an example). Then the button turns on.",
    adsenseLogout: "Sign out of Google",
    adsenseLogoutOk: "Google login cleared.",
    adsenseOauthOk: "AdSense connected.",
    adsenseOauthDenied: "Google sign-in cancelled.",
    adsenseOauthError: "Could not connect AdSense.",
    cursorHint: "If it doesn't show up: in Cursor, open the account, sign out, and sign back in.",
    cursorAdvanced: "Advanced (Terminal)",
    modeLocal: "We found the sign-in on this computer.",
    modePaste: "Using the key you pasted here.",
    modeExpired: "The session expired. Open the app on this computer and sign in again.",
    modeNeedLocal: "Open the app on this computer and sign in.",
    modeNeedPaste: "Paste the key below to connect.",
    modeOauth: "Google login stored in this collector.",
    modeNeedOauth: "Credentials saved — sign in with Google.",
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
    falKeyPh: "id:secret",
    bitcoinAddressPh: "bc1… or legacy address",
    gptTokenPh: "Codex token",
    cursorTokenPh: "Session token",
    weatherTitle: "Weather",
    weatherLead: "See the forecast on the desk display. Pick the city and what to show.",
    weatherEnabled: "Show weather on display",
    weatherCityLabel: "City",
    weatherCityPh: "e.g. São Paulo",
    weatherSearching: "Searching…",
    weatherNoResults: "No city found.",
    weatherSelected: "Selected",
    weatherChangeCity: "Change city",
    weatherUnitsTitle: "Units",
    weatherTempUnit: "Temperature",
    weatherWindUnit: "Wind",
    weatherPrecipUnit: "Precipitation",
    weatherForecastDays: "Forecast days",
    weatherDisplayTitle: "What to show on widget",
    weatherShowCurrent: "Current conditions",
    weatherShowHourly: "Next hours",
    weatherShowDaily: "Next days",
    weatherHourlyCount: "Hours ahead",
    weatherDailyCount: "Days ahead",
    weatherFieldsTitle: "Fields on widget",
    weatherFieldTemperature: "Temperature",
    weatherFieldFeelsLike: "Feels like",
    weatherFieldHumidity: "Humidity",
    weatherFieldPrecip: "Precipitation",
    weatherFieldWind: "Wind",
    weatherFieldPressure: "Pressure",
    weatherFieldCloudCover: "Clouds",
    weatherFieldUvIndex: "UV index",
    weatherFieldSunriseSunset: "Sunrise/sunset",
    weatherAdvancedTitle: "Advanced variables (Open-Meteo)",
    weatherCurrentVars: "Current variables",
    weatherHourlyVars: "Hourly variables",
    weatherDailyVars: "Daily variables",
    weatherVarsHint: "Choose which data the collector fetches from Open-Meteo. All API options are available.",
    weatherNotConfigured: "Set the city to see the weather.",
    weatherPoweredBy: "Data by Open-Meteo.com",
    financeiroTitle: "Finance",
    financeiroLead: "Bitcoin wallet, AdSense and currency quotes — dollar, euro, crypto, whatever you want to track.",
    currenciesTitle: "Currency quotes",
    currenciesLead: "Add as many currencies as you want — fiat (dollar, euro...) or crypto — and see the rate converted to your base currency.",
    currenciesEnabled: "Show on display",
    currenciesBaseLabel: "Base currency (quotes converted to)",
    currenciesListLabel: "Tracked currencies",
    currenciesEmpty: "No currency added yet.",
    currenciesAddTitle: "Add currency",
    currenciesKindFiat: "Currency (forex)",
    currenciesKindCrypto: "Cryptocurrency",
    currenciesAdd: "Add",
    currenciesSearchPh: "e.g. ethereum, solana...",
    currenciesSearch: "Search",
    currenciesSearching: "Searching…",
    currenciesNoResults: "No cryptocurrency found.",
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
    configSetupHint: "Para grabar la ESP32 y comprobar la red, abre",
    howTitle: "Cómo hacerlo",
    howLead: "La placa solo muestra porcentajes. Tokens y contraseñas quedan en este computador. Sigue los pasos en orden — la placa y este Mac deben estar en el mismo Wi-Fi.",
    howIntro: "El colector en este computador busca las cuotas. La ESP32 solo pide el JSON en la red local. Ningún inicio de sesión va a la placa.",
    how1Title: "Deja Vigia en marcha",
    how1Body: "En este computador, ejecuta ./dev up. El colector tiene que estar activo para que la placa encuentre los números.",
    how2Title: "Conecta las cuentas",
    how2Body: "En Configuración, deja Claude, GPT y Cursor iniciados en este Mac, o pega las claves de los otros proveedores.",
    how3Title: "Descarga el archivo de la placa",
    how3Body: "secrets.h indica a la ESP32 la dirección de este computador. Muévelo a firmware/src/secrets.h y completa el nombre y la contraseña del Wi-Fi.",
    how4Title: "Graba el firmware",
    how4Body: "Con el cable USB: ./dev firmware flash. Sin placa física, usa el simulador más abajo.",
    how5Title: "Comprueba al momento",
    how5Body: "Usa “Buscar cuotas ahora”. Si la placa no encuentra el computador, revisa IP, puerto y que ambos estén en la misma red.",
    howAccounts: "¿Aún no conectaste las cuentas?",
    accountsCta: "Abrir configuración",
    doNowTitle: "En la placa",
    boardDestLabel: "Dónde poner el archivo",
    boardDest: "firmware/src/secrets.h",
    flashCmd: "./dev firmware flash",
    wokwiCmd: "./dev wokwi",
    netIdleHint: "Puedes dejarlo así. Solo guarda si cambias puerto, dirección o el modo de ejemplo.",
    simTitle: "Sin placa física",
    simLead: "Wokwi simula la pantalla en este computador. El Wi-Fi de la placa es virtual — el colector sigue en este Mac.",
    copyUrl: "Copiar",
    copied: "Copiado.",
    claudeBlurb: "Usa el inicio de sesión de Claude Code en este computador. No es la clave de API.",
    gptBlurb: "Usa el inicio de sesión de ChatGPT / Codex en este computador. No es la clave de API.",
    cursorBlurb: "Usa el inicio de sesión de la app Cursor en este computador.",
    openrouterBlurb: "Pega la clave de tu cuenta. La creas en openrouter.ai, en Settings → Keys.",
    deepseekBlurb: "Pega la clave de tu cuenta. La creas en platform.deepseek.com, en API Keys.",
    opencodeBlurb: "Cuota de la suscripción (ventanas rolling, semanal y mensual) y saldo de pago por uso. Crea una clave en opencode.ai/auth.",
    falBlurb: "Saldo de créditos. Crea una clave con alcance Admin en fal.ai/dashboard/keys (una clave normal no puede leer el saldo).",
    bitcoinBlurb: "Pega la dirección pública de la billetera (nunca la clave privada ni la semilla). Muestra el saldo on-chain y el valor en dólares y en reales.",
    adsenseBlurb: "Ganancias de hoy (estimadas) y saldo impago de AdSense. Requiere un Client ID OAuth de Google Cloud (tipo Web) y el login de Google en este equipo.",
    adsenseCredsFold: "Credenciales de Google Cloud",
    adsenseClientId: "CLIENT ID",
    adsenseClientSecret: "CLIENT SECRET",
    adsenseClientIdPh: "xxxx.apps.googleusercontent.com",
    adsenseClientSecretPh: "GOCSPX-…",
    adsenseRedirectHint: (url) => `URI de redirección (registrar en el cliente OAuth Web): ${url}`,
    adsenseLogin: "Entrar con Google",
    adsenseNeedCreds: "Pega el Client ID y el Client Secret reales en el fold de arriba (el texto gris es solo un ejemplo). Después se activa el botón.",
    adsenseLogout: "Salir de Google",
    adsenseLogoutOk: "Login de Google borrado.",
    adsenseOauthOk: "AdSense conectado.",
    adsenseOauthDenied: "Inicio de sesión de Google cancelado.",
    adsenseOauthError: "No se pudo conectar AdSense.",
    cursorHint: "Si no aparece solo: en Cursor, abre la cuenta, cierra sesión y vuelve a entrar.",
    cursorAdvanced: "Opción avanzada (Terminal)",
    modeLocal: "Encontramos el inicio de sesión en este computador.",
    modePaste: "Usando la clave que pegaste aquí.",
    modeExpired: "La sesión caducó. Abre la app en este computador y entra de nuevo.",
    modeNeedLocal: "Abre la app en este computador e inicia sesión.",
    modeNeedPaste: "Pega la clave abajo para conectar.",
    modeOauth: "Login de Google guardado en este colector.",
    modeNeedOauth: "Credenciales guardadas — entra con Google.",
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
    falKeyPh: "id:secret",
    bitcoinAddressPh: "bc1… o dirección antigua",
    gptTokenPh: "Token de Codex",
    cursorTokenPh: "Token de sesión",
    weatherTitle: "Clima",
    weatherLead: "Ve la previsión en el panel de mesa. Elige la ciudad y qué mostrar.",
    weatherEnabled: "Mostrar clima en el panel",
    weatherCityLabel: "Ciudad",
    weatherCityPh: "ej.: São Paulo",
    weatherSearching: "Buscando…",
    weatherNoResults: "Ninguna ciudad encontrada.",
    weatherSelected: "Seleccionada",
    weatherChangeCity: "Cambiar ciudad",
    weatherUnitsTitle: "Unidades",
    weatherTempUnit: "Temperatura",
    weatherWindUnit: "Viento",
    weatherPrecipUnit: "Precipitación",
    weatherForecastDays: "Días de previsión",
    weatherDisplayTitle: "Qué mostrar en el widget",
    weatherShowCurrent: "Condiciones actuales",
    weatherShowHourly: "Próximas horas",
    weatherShowDaily: "Próximos días",
    weatherHourlyCount: "Horas por delante",
    weatherDailyCount: "Días por delante",
    weatherFieldsTitle: "Campos en el widget",
    weatherFieldTemperature: "Temperatura",
    weatherFieldFeelsLike: "Sensación térmica",
    weatherFieldHumidity: "Humedad",
    weatherFieldPrecip: "Precipitación",
    weatherFieldWind: "Viento",
    weatherFieldPressure: "Presión",
    weatherFieldCloudCover: "Nubes",
    weatherFieldUvIndex: "Índice UV",
    weatherFieldSunriseSunset: "Amanecer/atardecer",
    weatherAdvancedTitle: "Variables avanzadas (Open-Meteo)",
    weatherCurrentVars: "Variables actuales",
    weatherHourlyVars: "Variables por hora",
    weatherDailyVars: "Variables por día",
    weatherVarsHint: "Elige qué datos busca el colector en Open-Meteo. Todas las opciones de la API están disponibles.",
    weatherNotConfigured: "Configura la ciudad para ver el clima.",
    weatherPoweredBy: "Datos por Open-Meteo.com",
    financeiroTitle: "Finanzas",
    financeiroLead: "Billetera Bitcoin, AdSense y cotización de monedas — dólar, euro, cripto, lo que quieras seguir.",
    currenciesTitle: "Cotización de monedas",
    currenciesLead: "Agrega las monedas que quieras — fiat (dólar, euro...) o cripto — y mira la cotización convertida a tu moneda base.",
    currenciesEnabled: "Mostrar en el panel",
    currenciesBaseLabel: "Moneda base (cotizaciones convertidas a)",
    currenciesListLabel: "Monedas seguidas",
    currenciesEmpty: "Ninguna moneda añadida todavía.",
    currenciesAddTitle: "Añadir moneda",
    currenciesKindFiat: "Moneda (cambio)",
    currenciesKindCrypto: "Criptomoneda",
    currenciesAdd: "Añadir",
    currenciesSearchPh: "ej.: ethereum, solana...",
    currenciesSearch: "Buscar",
    currenciesSearching: "Buscando…",
    currenciesNoResults: "Ninguna criptomoneda encontrada.",
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
  if (p.mode === "oauth") return c.modeOauth;
  if (p.mode === "need_oauth") return c.modeNeedOauth;
  if (p.mode === "need_paste" && inDocker && usesLocalApp) return c.modeDocker;
  if (p.mode === "need_paste") return c.modeNeedPaste;
  if (p.mode === "need_local") return c.modeNeedLocal;
  return p.label;
}
