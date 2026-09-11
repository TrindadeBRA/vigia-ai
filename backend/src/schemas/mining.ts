import { z } from "zod";

// Bech32 (bc1...) só é válido tudo-maiúsculo OU tudo-minúsculo (BIP-173) —
// as duas formas são o mesmo endereço. Pools como o public-pool.io validam
// o prefixo "bc1" literal (minúsculo) no mining.authorize e rejeitam
// "BC1..." com "Authorization validation error", mesmo sendo bech32
// válido. Normaliza só esse caso; endereços legados (1.../3..., Base58)
// são case-sensitive de verdade — nunca mexer neles.
function normalizeBtcWallet(v: string): string {
  const trimmed = v.trim();
  return /^bc1/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

// Config remota da mineração (protótipo — ver .agents/MINERACAO.md).
// Guardada em backend/data/mining.json (gitignored), nunca no firmware nem no git.
// Default public-pool.io:3333 porque aceita share baixo (0.00015), igual ao NerdMiner.
export const MiningConfigSchema = z.object({
  enabled: z.boolean().default(false),
  poolUrl: z.string().default("public-pool.io"),
  poolPort: z.number().int().min(1).max(65535).default(3333),
  btcWallet: z.string().default("").transform(normalizeBtcWallet),
  workerName: z.string().default(""),
});
export type MiningConfig = z.infer<typeof MiningConfigSchema>;

export const MiningConfigPatchSchema = MiningConfigSchema.partial();
export type MiningConfigPatch = z.infer<typeof MiningConfigPatchSchema>;

// Status: quem realmente decide se está minerando agora é a VIEW_MINER no
// device (entrar liga, sair desliga) — este relatório só chega enquanto a
// placa estiver de fato na rota. Fora dela, o painel mostra o último report
// como parado (ver `stale` em MiningStatusSchema).
export const MiningStatusValueSchema = z.enum([
  "idle",
  "no_wifi",
  "connecting",
  "mining",
  "pool_offline",
  "error",
]);
export type MiningStatusValue = z.infer<typeof MiningStatusValueSchema>;

export const MiningReportSchema = z.object({
  status: MiningStatusValueSchema,
  hashrateCurrent: z.number().nonnegative().default(0),
  hashrateAvg: z.number().nonnegative().default(0),
  sharesAccepted: z.number().int().nonnegative().default(0),
  sharesRejected: z.number().int().nonnegative().default(0),
  bestDifficulty: z.number().nonnegative().default(0),
  blockHeight: z.number().int().nonnegative().default(0),
  uptimeS: z.number().int().nonnegative().default(0),
  lastError: z.string().default(""),
  // Últimas linhas do log da placa (buffer circular pequeno no firmware,
  // ver firmware/src/mining/mining_log.h) — aproximação de "tempo real":
  // só atualiza a cada report (~10s), não é stream de verdade, e não é
  // histórico completo (o buffer da placa roda por cima do que não coube
  // no último report).
  log: z.array(z.string()).max(64).default([]),
});
export type MiningReport = z.infer<typeof MiningReportSchema>;

export const MiningStatusSchema = MiningReportSchema.extend({
  reportedAt: z.string().nullable(),
  stale: z.boolean(),
});
export type MiningStatus = z.infer<typeof MiningStatusSchema>;
