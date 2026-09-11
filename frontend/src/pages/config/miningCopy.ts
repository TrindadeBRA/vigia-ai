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
  poolHint: string;
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
    lead: "Protótipo (MVP): a placa só minera de fato quando está na tela dedicada de mineração (VIEW_MINER) — não é um serviço de fundo. Share de baixa dificuldade é válido, igual ao NerdMiner: não é um bloco, é o recibo de que a placa está hasheando. Hashrate e tempo minerando são o sinal de que está funcionando; shares só aparecem se o pool aceitar dificuldade baixa.",
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
    configLead: "A placa busca essa config no coletor. Sem wallet, não liga. Use um pool de solo mining com share baixo (padrão public-pool.io:3333), igual ao NerdMiner — pools de ASIC com dificuldade 1 quase nunca marcam share numa ESP32.",
    enabledLabel: "Mineração habilitada",
    poolUrlLabel: "Pool (URL)",
    poolHint: "Precisa aceitar share de dificuldade ~0.00015. public-pool.io, pool.nerdminers.org, pool.nerdminer.io (porta 3333). Pools comuns (ckpool, Slush, ASIC) impõem dificuldade 1 — ~1 share a cada ~30 h a 40 kH/s.",
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
    hintSharesAccepted: "Soluções parciais (bem mais fáceis que um bloco) que o pool aceitou — o mesmo mecanismo do NerdMiner. A placa pede dificuldade 0.00015; se o log mostrar «nova dificuldade: 1», espere ~1 share a cada ~30 h a ~40 kH/s. Zero shares após uma noite, com hashrate subindo, é esperado nesse caso.",
    hintSharesRejected: "Soluções que o pool recusou (chegaram atrasadas ou com a dificuldade errada).",
    hintBestDifficulty: "A dificuldade mais alta entre as shares que o pool aceitou — só atualiza quando entra uma share aceita, por isso fica 0 enquanto o contador de aceitas for 0.",
    hintBlockHeight: "Altura do bloco atual da rede Bitcoin. Fora do escopo deste MVP — a placa não busca isso (precisaria de uma API externa), por isso fica sempre \"—\".",
    hintUptime: "Há quanto tempo a sessão de mineração atual está rodando — zera toda vez que a placa entra na tela de mineração de novo.",
    hintLastReport: "Quando o coletor recebeu o último relatório da placa.",
  },
  en: {
    title: "Bitcoin mining",
    lead: "Prototype (MVP): the board only actually mines while on the dedicated mining screen (VIEW_MINER) — it is not a background service. Low-difficulty shares are valid, same as NerdMiner: not a block, just the receipt that the board is hashing. Hashrate and uptime are the sign that it is working; shares only show up if the pool accepts low difficulty.",
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
    configLead: "The board fetches this config from the collector. Without a wallet, mining won't start. Use a solo-mining pool that accepts low-difficulty shares (default public-pool.io:3333), same as NerdMiner — ASIC pools at difficulty 1 almost never record a share on an ESP32.",
    enabledLabel: "Mining enabled",
    poolUrlLabel: "Pool (URL)",
    poolHint: "Must accept shares around difficulty 0.00015. public-pool.io, pool.nerdminers.org, pool.nerdminer.io (port 3333). Regular pools (ckpool, Slush, ASIC) set difficulty 1 — about 1 share every ~30 h at 40 kH/s.",
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
    hintSharesAccepted: "Partial solutions (much easier than a real block) the pool accepted — the same mechanism as NerdMiner. The board asks for difficulty 0.00015; if the log shows \"nova dificuldade: 1\", expect ~1 share every ~30 h at ~40 kH/s. Zero shares after a night, with hashrate going up, is expected in that case.",
    hintSharesRejected: "Solutions the pool refused (arrived late or with the wrong difficulty).",
    hintBestDifficulty: "The highest difficulty among shares the pool accepted — only updates when an accepted share comes in, so it stays 0 while accepted shares are 0.",
    hintBlockHeight: "Current Bitcoin network block height. Out of scope for this MVP — the board doesn't fetch it (would need an external API), so it always shows \"—\".",
    hintUptime: "How long the current mining session has been running — resets every time the board re-enters the mining screen.",
    hintLastReport: "When the collector received the last report from the board.",
  },
  es: {
    title: "Minería de Bitcoin",
    lead: "Prototipo (MVP): la placa solo mina de verdad cuando está en la pantalla dedicada de minería (VIEW_MINER) — no es un servicio en segundo plano. Un share de baja dificultad es válido, igual que NerdMiner: no es un bloque, es el recibo de que la placa está hasheando. Hashrate y tiempo minando son la señal de que funciona; las shares solo aparecen si el pool acepta dificultad baja.",
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
    configLead: "La placa busca esta config en el colector. Sin wallet, no arranca. Usa un pool de minería en solitario con share bajo (por defecto public-pool.io:3333), igual que NerdMiner — pools de ASIC con dificultad 1 casi nunca marcan share en una ESP32.",
    enabledLabel: "Minería habilitada",
    poolUrlLabel: "Pool (URL)",
    poolHint: "Tiene que aceptar shares cerca de dificultad 0.00015. public-pool.io, pool.nerdminers.org, pool.nerdminer.io (puerto 3333). Pools comunes (ckpool, Slush, ASIC) imponen dificultad 1 — ~1 share cada ~30 h a 40 kH/s.",
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
    hintSharesAccepted: "Soluciones parciales (mucho más fáciles que un bloque) que el pool aceptó — el mismo mecanismo de NerdMiner. La placa pide dificultad 0.00015; si el log muestra «nova dificuldade: 1», espera ~1 share cada ~30 h a ~40 kH/s. Cero shares tras una noche, con hashrate subiendo, es lo esperado en ese caso.",
    hintSharesRejected: "Soluciones que el pool rechazó (llegaron tarde o con la dificultad incorrecta).",
    hintBestDifficulty: "La dificultad más alta entre las shares que el pool aceptó — solo se actualiza cuando entra una share aceptada, por eso queda en 0 mientras el contador de aceptadas sea 0.",
    hintBlockHeight: "Altura del bloque actual de la red Bitcoin. Fuera del alcance de este MVP — la placa no lo busca (necesitaría una API externa), por eso siempre muestra \"—\".",
    hintUptime: "Cuánto tiempo lleva corriendo la sesión de minería actual — se reinicia cada vez que la placa vuelve a entrar en la pantalla de minería.",
    hintLastReport: "Cuándo el colector recibió el último reporte de la placa.",
  },
};
