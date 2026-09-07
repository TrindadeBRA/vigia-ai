import type { Lang } from "../../i18n";
import type { MiningStatusValue } from "../../api/types";

export type MiningCopy = {
  title: string;
  lead: string;
  loadError: string;
  offline: string;
  retry: string;
  saving: string;
  save: string;
  saved: string;
  statusTitle: string;
  currentStatusLabel: string;
  status: Record<MiningStatusValue, string>;
  hashrateCurrent: string;
  hashrateAvg: string;
  sharesAccepted: string;
  sharesRejected: string;
  bestDifficulty: string;
  blockHeight: string;
  uptime: string;
  lastReport: string;
  never: string;
  staleHint: string;
  lastErrorLabel: string;
  configTitle: string;
  configLead: string;
  enabledLabel: string;
  poolUrlLabel: string;
  poolPortLabel: string;
  walletLabel: string;
  walletHint: string;
  walletMissingHint: string;
  workerLabel: string;
  workerHint: string;
  logTitle: string;
  logLead: string;
  logEmpty: string;
  hintCurrentStatus: string;
  hintHashrateCurrent: string;
  hintHashrateAvg: string;
  hintSharesAccepted: string;
  hintSharesRejected: string;
  hintBestDifficulty: string;
  hintBlockHeight: string;
  hintUptime: string;
  hintLastReport: string;
};

export const MINING_STR: Record<Lang, MiningCopy> = {
  pt: {
    title: "Mineração de Bitcoin",
    lead: "Protótipo (MVP): a placa só minera de fato quando está na tela dedicada de mineração (VIEW_MINER) — não é um serviço de fundo. Aqui você vê o último relatório recebido e controla pool/wallet/liga-desliga remoto.",
    loadError: "Não deu para carregar os dados de mineração.",
    offline: "Coletor offline — tente de novo.",
    retry: "Tentar de novo",
    saving: "Salvando…",
    save: "Salvar",
    saved: "Salvo",
    statusTitle: "Status atual",
    currentStatusLabel: "Situação",
    status: {
      idle: "Parado (fora da rota de mineração)",
      no_wifi: "Sem Wi-Fi",
      connecting: "Conectando ao pool",
      mining: "Minerando",
      pool_offline: "Pool offline",
      error: "Erro",
    },
    hashrateCurrent: "Hashrate atual",
    hashrateAvg: "Hashrate médio",
    sharesAccepted: "Shares aceitas",
    sharesRejected: "Shares rejeitadas",
    bestDifficulty: "Melhor dificuldade",
    blockHeight: "Block height",
    uptime: "Tempo minerando",
    lastReport: "Último relatório",
    never: "nunca",
    staleHint: "Sem relatório recente — a placa provavelmente não está na tela de mineração agora.",
    lastErrorLabel: "Último erro",
    configTitle: "Configuração remota",
    configLead: "A placa busca essa config no coletor. Sem endereço de wallet preenchido, a mineração não liga mesmo entrando na tela.",
    enabledLabel: "Mineração habilitada",
    poolUrlLabel: "Pool (URL)",
    poolPortLabel: "Pool (porta)",
    walletLabel: "Endereço BTC (wallet)",
    walletHint: "Endereço de payout do pool — não é senha, mas evite compartilhar publicamente.",
    walletMissingHint: "Sem wallet configurada, a rota de mineração na placa recusa minerar.",
    workerLabel: "Nome do worker (opcional)",
    workerHint: "Aparece como sufixo do wallet no pool (ex.: endereço.nome).",
    logTitle: "Log da placa",
    logLead: "Últimas linhas recebidas da placa — atualiza junto com o status (a cada ~10s), não é um stream de verdade nem histórico completo.",
    logEmpty: "Sem linhas de log ainda.",
    hintCurrentStatus: "Estado atual da conexão com o pool de mineração.",
    hintHashrateCurrent: "Velocidade de hashing agora (tentativas de solução por segundo), medida no ultimo ~1s.",
    hintHashrateAvg: "Velocidade média desde que a sessão de mineração atual começou.",
    hintSharesAccepted: "Soluções parciais (bem mais fáceis que um bloco de verdade) que o pool aceitou — é como ele mede sua contribuição.",
    hintSharesRejected: "Soluções que o pool recusou (chegaram atrasadas ou com a dificuldade errada).",
    hintBestDifficulty: "A dificuldade mais alta entre as soluções encontradas até agora — quanto maior, mais \"perto\" (ainda astronomicamente longe) de um bloco de verdade.",
    hintBlockHeight: "Altura do bloco atual da rede Bitcoin. Fora do escopo deste MVP — a placa não busca isso (precisaria de uma API externa), por isso fica sempre \"—\".",
    hintUptime: "Há quanto tempo a sessão de mineração atual está rodando — zera toda vez que a placa entra na tela de mineração de novo.",
    hintLastReport: "Quando o coletor recebeu o último relatório da placa.",
  },
  en: {
    title: "Bitcoin mining",
    lead: "Prototype (MVP): the board only actually mines while on the dedicated mining screen (VIEW_MINER) — it is not a background service. Here you see the last report received and control pool/wallet/remote enable.",
    loadError: "Could not load the mining data.",
    offline: "Collector offline — try again.",
    retry: "Retry",
    saving: "Saving…",
    save: "Save",
    saved: "Saved",
    statusTitle: "Current status",
    currentStatusLabel: "State",
    status: {
      idle: "Stopped (off the mining route)",
      no_wifi: "No Wi-Fi",
      connecting: "Connecting to pool",
      mining: "Mining",
      pool_offline: "Pool offline",
      error: "Error",
    },
    hashrateCurrent: "Current hashrate",
    hashrateAvg: "Average hashrate",
    sharesAccepted: "Accepted shares",
    sharesRejected: "Rejected shares",
    bestDifficulty: "Best difficulty",
    blockHeight: "Block height",
    uptime: "Mining uptime",
    lastReport: "Last report",
    never: "never",
    staleHint: "No recent report — the board is probably not on the mining screen right now.",
    lastErrorLabel: "Last error",
    configTitle: "Remote config",
    configLead: "The board fetches this config from the collector. Without a wallet address, mining won't start even if the screen is opened.",
    enabledLabel: "Mining enabled",
    poolUrlLabel: "Pool (URL)",
    poolPortLabel: "Pool (port)",
    walletLabel: "BTC address (wallet)",
    walletHint: "Pool payout address — not a secret, but avoid sharing it publicly.",
    walletMissingHint: "Without a configured wallet, the mining screen on the board refuses to mine.",
    workerLabel: "Worker name (optional)",
    workerHint: "Shown as a suffix on the wallet at the pool (e.g. address.name).",
    logTitle: "Board log",
    logLead: "Latest lines received from the board — updates along with the status (every ~10s), not a real stream nor a full history.",
    logEmpty: "No log lines yet.",
    hintCurrentStatus: "Current state of the connection to the mining pool.",
    hintHashrateCurrent: "Hashing speed right now (solution attempts per second), measured over the last ~1s.",
    hintHashrateAvg: "Average speed since the current mining session started.",
    hintSharesAccepted: "Partial solutions (much easier than a real block) the pool accepted — this is how it measures your contribution.",
    hintSharesRejected: "Solutions the pool refused (arrived late or with the wrong difficulty).",
    hintBestDifficulty: "The highest difficulty among the solutions found so far — higher means \"closer\" (still astronomically far) to an actual block.",
    hintBlockHeight: "Current Bitcoin network block height. Out of scope for this MVP — the board doesn't fetch it (would need an external API), so it always shows \"—\".",
    hintUptime: "How long the current mining session has been running — resets every time the board re-enters the mining screen.",
    hintLastReport: "When the collector received the last report from the board.",
  },
  es: {
    title: "Minería de Bitcoin",
    lead: "Prototipo (MVP): la placa solo mina de verdad cuando está en la pantalla dedicada de minería (VIEW_MINER) — no es un servicio en segundo plano. Aquí ves el último reporte recibido y controlas pool/wallet/activación remota.",
    loadError: "No se pudieron cargar los datos de minería.",
    offline: "Colector fuera de línea — inténtalo de nuevo.",
    retry: "Reintentar",
    saving: "Guardando…",
    save: "Guardar",
    saved: "Guardado",
    statusTitle: "Estado actual",
    currentStatusLabel: "Situación",
    status: {
      idle: "Detenido (fuera de la ruta de minería)",
      no_wifi: "Sin Wi-Fi",
      connecting: "Conectando al pool",
      mining: "Minando",
      pool_offline: "Pool fuera de línea",
      error: "Error",
    },
    hashrateCurrent: "Hashrate actual",
    hashrateAvg: "Hashrate promedio",
    sharesAccepted: "Shares aceptadas",
    sharesRejected: "Shares rechazadas",
    bestDifficulty: "Mejor dificultad",
    blockHeight: "Block height",
    uptime: "Tiempo minando",
    lastReport: "Último reporte",
    never: "nunca",
    staleHint: "Sin reporte reciente — la placa probablemente no está en la pantalla de minería ahora.",
    lastErrorLabel: "Último error",
    configTitle: "Configuración remota",
    configLead: "La placa busca esta config en el colector. Sin una dirección de wallet, la minería no arranca aunque se abra la pantalla.",
    enabledLabel: "Minería habilitada",
    poolUrlLabel: "Pool (URL)",
    poolPortLabel: "Pool (puerto)",
    walletLabel: "Dirección BTC (wallet)",
    walletHint: "Dirección de pago del pool — no es una contraseña, pero evita compartirla públicamente.",
    walletMissingHint: "Sin wallet configurada, la pantalla de minería de la placa se niega a minar.",
    workerLabel: "Nombre del worker (opcional)",
    workerHint: "Aparece como sufijo del wallet en el pool (ej.: direccion.nombre).",
    logTitle: "Log de la placa",
    logLead: "Últimas líneas recibidas de la placa — se actualiza junto con el estado (cada ~10s), no es un stream real ni historial completo.",
    logEmpty: "Todavía no hay líneas de log.",
    hintCurrentStatus: "Estado actual de la conexión con el pool de minería.",
    hintHashrateCurrent: "Velocidad de hashing ahora mismo (intentos de solución por segundo), medida en el ultimo ~1s.",
    hintHashrateAvg: "Velocidad promedio desde que empezó la sesión de minería actual.",
    hintSharesAccepted: "Soluciones parciales (mucho más fáciles que un bloque real) que el pool aceptó — así mide tu contribución.",
    hintSharesRejected: "Soluciones que el pool rechazó (llegaron tarde o con la dificultad incorrecta).",
    hintBestDifficulty: "La dificultad más alta entre las soluciones encontradas hasta ahora — cuanto mayor, más \"cerca\" (todavía astronómicamente lejos) de un bloque real.",
    hintBlockHeight: "Altura del bloque actual de la red Bitcoin. Fuera del alcance de este MVP — la placa no lo busca (necesitaría una API externa), por eso siempre muestra \"—\".",
    hintUptime: "Cuánto tiempo lleva corriendo la sesión de minería actual — se reinicia cada vez que la placa vuelve a entrar en la pantalla de minería.",
    hintLastReport: "Cuándo el colector recibió el último reporte de la placa.",
  },
};
